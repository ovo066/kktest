import { buildGroupMultiApiMessages } from '../messageHistoryBuilder'
import { buildApiRequestMessages, buildGroupMultiRequestPlan } from '../requestPlan'
import { appendInstructionMessage } from '../streamingRequest'
import { finalizeStreamingAssistantReply } from '../assistantMessageLifecycle'
import { finalizeAssistantTurn } from './chatSideEffects'
import { executeChatStreamOrchestrator } from './sharedChatExecutor'
import { resolveGroupMultiMcpServerIds } from '../../../utils/mcpServers'

export async function runGroupMultiChatOrchestrator(context, memberId, onChunk) {
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
    buildStickerSystemPrompt,
    buildSpecialFeaturesSystemPrompt,
    buildToolCallingPrompt,
    buildForumSystemPrompt,
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
    buildStreamingDisplayContent,
    parseMomentContent,
    applyForumOnlyPlaceholder,
    pushMomentsIslandNotifications
  } = context

  const activeChat = contactsStore.activeChat
  const member = activeChat?.members?.find(item => item.id === memberId)
  if (!member) {
    return buildApiFailure('MEMBER_NOT_FOUND', '未找到指定成员', {
      feature: 'chat',
      action: 'callGroupAPIMulti',
      memberId
    })
  }

  const cfg = resolveConfig(member.configId)
  if (!cfg?.key) {
    return buildApiFailure('CONFIG_MISSING', `成员 ${member.name} 未配置 API`, {
      feature: 'chat',
      action: 'callGroupAPIMulti',
      memberId: member.id
    })
  }

  const traceId = makeTraceId()

  // Resolve tool calling if enabled
  let tools = null
  let toolContext = null
  let externalExecutors = null
  if (settingsStore.allowToolCalling) {
    try {
      const { getAvailableTools } = await import('../tools/toolRegistry')
      const selectedMcpServerIds = resolveGroupMultiMcpServerIds(activeChat, member)
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

  const { templateVars, mainSystemPrompt, postHistoryPrompt } = buildGroupMultiRequestPlan({
    activeChat,
    member,
    promptStore,
    getTemplateVars,
    applyTemplateVars,
    buildStickerSystemPrompt,
    buildSpecialFeaturesSystemPrompt,
    buildToolCallingPrompt,
    buildForumSystemPrompt,
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
      buildApiMessages: (resolvedContextMsgs) => buildGroupMultiApiMessages(resolvedContextMsgs, member.id),
      insertLorebookEntries,
      buildPostInstructionParts: (retrievedContext) => buildGroupPostInstructionParts({
        postHistoryPrompt,
        retrievedContext,
        momentsAuthorId: member.id
      }),
      appendInstructionMessage
    }).then(result => result.messages),
    assistantMessage: {
      senderId: member.id,
      senderName: member.name
    },
    failureExtra: {
      senderId: member.id,
      senderName: member.name
    },
    async onStreamComplete({ url, streamInfo, streamMsg }) {
      const prefixRegex = new RegExp(`^\\[${member.name}\\][:\\uFF1A]\\s*`, 'i')
      const { forumOnly, interactionOnly } = finalizeStreamingAssistantReply({
        message: streamMsg,
        activeChat,
        streamInfo,
        prefixRegex,
        buildDisplayContent: buildStreamingDisplayContent,
        makeMsgId,
        syncForumToAI: settingsStore.syncForumToAI,
        parseMomentContent,
        actor: {
          id: member.id,
          name: member.name,
          avatar: member.avatar
        },
        applyForumOnlyPlaceholder,
        pushMomentsIslandNotifications,
        visibility: {
          mode: 'group-multi',
          traceId,
          model: cfg.model,
          url,
          allowAIImageGeneration: settingsStore.allowAIImageGeneration,
          extra: { memberId: member.id }
        }
      })

      finalizeAssistantTurn(activeChat, soundEffects, {
        playSound: !interactionOnly
      })
      return { success: true, traceId, forumOnly }
    }
  })
}
