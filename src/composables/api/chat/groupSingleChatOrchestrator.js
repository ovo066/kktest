import { trimText, createApiError } from '../errors'
import { buildGroupSingleApiMessages } from '../messageHistoryBuilder'
import { buildApiRequestMessages, buildGroupSingleRequestPlan } from '../requestPlan'
import { appendInstructionMessage } from '../streamingRequest'
import { createAssistantMessage } from '../assistantMessageLifecycle'
import { parseGroupReplyMessages } from '../groupReplyParser'
import { applyAssistantInteractionDecisions } from '../../../features/chat'
import { finalizeAssistantTurn } from './chatSideEffects'
import { executeChatStreamOrchestrator } from './sharedChatExecutor'
import { resolveGroupSingleMcpServerIds } from '../../../utils/mcpServers'

export async function runGroupSingleChatOrchestrator(context, onChunk) {
  const {
    contactsStore,
    settingsStore,
    chatStore,
    promptStore,
    soundEffects,
    makeMsgId,
    resolveConfig,
    makeTraceId,
    buildApiFailure,
    getTemplateVars,
    applyTemplateVars,
    buildGroupSystemPrompt,
    buildStickerSystemPrompt,
    buildSpecialFeaturesSystemPrompt,
    buildToolCallingPrompt,
    buildMemoryPrompt,
    buildMusicContextPrompt,
    discoverMcpTools,
    buildChatFormatSystemPrompt,
    shouldAddReplyFormatPrompt,
    buildReplyFormatSystemPrompt,
    buildUnifiedSystemPrompt,
    getContextWindowedMsgs,
    resolveContextMessagesForApi,
    insertLorebookEntries,
    buildGroupPostInstructionParts,
    createStreamChunkBatcher,
    parseMomentContent,
    pushMomentsIslandNotifications,
    stripForumBlocks,
    forumOnlyPlaceholder
  } = context

  const activeChat = contactsStore.activeChat
  const cfg = resolveConfig(activeChat?.configId)
  if (!cfg?.key) {
    return buildApiFailure('CONFIG_MISSING', '请先配置 API Key', {
      feature: 'chat',
      action: 'callGroupAPISingle'
    })
  }

  const traceId = makeTraceId()
  const members = activeChat?.members || []

  // Resolve tool calling if enabled
  let tools = null
  let toolContext = null
  let externalExecutors = null
  if (settingsStore.allowToolCalling) {
    try {
      const { getAvailableTools } = await import('../tools/toolRegistry')
      const selectedMcpServerIds = resolveGroupSingleMcpServerIds(activeChat)
      const mcpDiscovery = typeof discoverMcpTools === 'function'
        ? await discoverMcpTools({ serverIds: selectedMcpServerIds })
        : { tools: [], externalExecutors: null }
      externalExecutors = mcpDiscovery.externalExecutors || null
      tools = getAvailableTools(settingsStore, activeChat, mcpDiscovery.tools || [])
      if (tools.length > 0) {
        const { useMomentsStore } = await import('../../../stores/moments')
        const { useMusicStore } = await import('../../../stores/music')
        const { usePlannerStore } = await import('../../../stores/planner')
        const { useLivenessStore } = await import('../../../stores/liveness')
        toolContext = {
          contactsStore,
          settingsStore,
          momentsStore: useMomentsStore(),
          musicStore: useMusicStore(),
          plannerStore: usePlannerStore(),
          livenessStore: useLivenessStore(),
          activeChat,
          makeMsgId
        }
      }
    } catch (err) {
      console.warn('[ToolCalling] Failed to resolve tools, proceeding without:', err?.message)
      tools = null
    }
  }

  const { templateVars, mainSystemPrompt, postHistoryPrompt } = buildGroupSingleRequestPlan({
    activeChat,
    members,
    promptStore,
    getTemplateVars,
    applyTemplateVars,
    buildGroupSystemPrompt,
    buildStickerSystemPrompt,
    buildSpecialFeaturesSystemPrompt,
    buildToolCallingPrompt,
    buildMemoryPrompt,
    buildMusicContextPrompt,
    buildChatFormatSystemPrompt,
    shouldAddReplyFormatPrompt,
    buildReplyFormatSystemPrompt,
    buildUnifiedSystemPrompt,
    tools
  })

  return await executeChatStreamOrchestrator({
    chatStore,
    activeChat,
    cfg,
    makeMsgId,
    traceId,
    onChunk,
    createStreamChunkBatcher,
    tools: tools && tools.length > 0 ? tools : undefined,
    toolContext,
    maxToolRounds: settingsStore.toolCallingConfig?.maxToolRounds,
    externalExecutors,
    getMessages: () => buildApiRequestMessages({
      activeChat,
      mainSystemPrompt,
      templateVars,
      loadContextWindowedMsgs: getContextWindowedMsgs,
      resolveContextMessagesForApi,
      buildApiMessages: buildGroupSingleApiMessages,
      insertLorebookEntries,
      buildPostInstructionParts: (retrievedContext) => buildGroupPostInstructionParts({
        postHistoryPrompt,
        retrievedContext,
        momentsAuthorId: members[0]?.id
      }),
      appendInstructionMessage
    }).then(result => result.messages),
    async onStreamComplete({ url, streamInfo, streamMsg }) {
      if (streamInfo.finishReason === 'content_filter') {
        throw createApiError('CONTENT_FILTER', 'content_filter', { mode: 'group-single', traceId, model: cfg.model })
      }

      const finalContent = streamMsg.content
      activeChat.msgs.pop()

      let forumParsed = null
      if (settingsStore.syncForumToAI && finalContent) {
        const firstMember = members[0]
        forumParsed = parseMomentContent(finalContent, {
          id: firstMember?.id || 'group',
          name: firstMember?.name || '群聊',
          avatar: firstMember?.avatar
        })
        pushMomentsIslandNotifications(forumParsed, firstMember)
      }

      const chatContent = stripForumBlocks(finalContent)
      if (!trimText(chatContent)) {
        if (forumParsed && (forumParsed.moments || forumParsed.posts || forumParsed.replies)) {
          const firstMember = members[0]
          activeChat.msgs.push(createAssistantMessage(makeMsgId, traceId, {
            senderId: firstMember?.id || null,
            senderName: firstMember?.name || 'System',
            content: forumOnlyPlaceholder,
            forumOnly: true
          }))
          finalizeAssistantTurn(activeChat, soundEffects)
          return { success: true, traceId, forumOnly: true }
        }

        console.warn('[api-empty-reply]', {
          mode: 'group-single',
          traceId,
          model: cfg.model,
          url,
          streamInfo
        })
        throw createApiError('EMPTY_REPLY', 'empty reply', {
          mode: 'group-single',
          traceId,
          model: cfg.model,
          url,
          streamInfo
        })
      }

      const parsedReplies = parseGroupReplyMessages(chatContent, members)
      let appendedReplyCount = 0
      parsedReplies.forEach((parsedReply) => {
        const newMsg = createAssistantMessage(makeMsgId, traceId, {
          senderId: parsedReply.senderId,
          senderName: parsedReply.senderName,
          content: parsedReply.content
        })
        const interactionResult = applyAssistantInteractionDecisions({
          activeChat,
          message: newMsg,
          makeId: makeMsgId
        })
        if (parsedReply.replyToText) {
          newMsg.replyToText = parsedReply.replyToText
          const quotedMsg = activeChat.msgs.find(message => message.content && message.content.includes(parsedReply.replyToText))
          if (quotedMsg) newMsg.replyTo = quotedMsg.id
        }
        if (trimText(newMsg.content) || interactionResult.resolvedCount === 0) {
          activeChat.msgs.push(newMsg)
          appendedReplyCount += 1
        }
      })

      finalizeAssistantTurn(activeChat, soundEffects, {
        playSound: appendedReplyCount > 0
      })
      return { success: true, traceId }
    }
  })
}
