import { buildDirectChatApiMessages } from '../messageHistoryBuilder'
import { buildApiRequestMessages, buildDirectRequestPlan } from '../requestPlan'
import { appendInstructionMessage } from '../streamingRequest'
import { finalizeStreamingAssistantReply } from '../assistantMessageLifecycle'
import { applyReadOnlySuppression, finalizeAssistantTurn } from './chatSideEffects'
import { executeChatStreamOrchestrator } from './sharedChatExecutor'
import { resolveDirectMcpServerIds } from '../../../utils/mcpServers'

export async function runDirectChatOrchestrator(context, onChunk) {
  const {
    contactsStore,
    settingsStore,
    chatStore,
    promptStore,
    showToast,
    soundEffects,
    makeMsgId,
    resolveConfig,
    makeTraceId,
    buildApiFailure,
    getTemplateVars,
    applyTemplateVars,
    buildPersonaSystemPrompt,
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
    buildDirectPostInstructionParts,
    createStreamChunkBatcher,
    buildStreamingDisplayContent,
    parseMomentContent,
    applyForumOnlyPlaceholder,
    pushMomentsIslandNotifications
  } = context

  const activeChat = contactsStore.activeChat
  const cfg = activeChat ? resolveConfig(activeChat.configId) : resolveConfig()
  if (!cfg?.key) {
    return buildApiFailure('CONFIG_MISSING', '请先配置 API Key', {
      feature: 'chat',
      action: 'callAPI'
    })
  }
  if (!activeChat) {
    return buildApiFailure('CHAT_NOT_FOUND', '没有活动的聊天', {
      feature: 'chat',
      action: 'callAPI'
    })
  }

  if (settingsStore.allowLivenessEngine && settingsStore.livenessConfig?.allowChatReadOnly) {
    try {
      const { shouldSuppressReply } = await import('../../useLivenessEngine')
      const lastUserMsg = activeChat.msgs.slice().reverse().find(m => m.role === 'user')
      const result = await shouldSuppressReply(activeChat.id, lastUserMsg?.content)
      if (result.suppress) {
        return await applyReadOnlySuppression({
          activeChat,
          chatStore,
          settingsStore,
          showToast,
          reason: result.reason
        })
      }
      if (result.error) {
        console.warn('[LivenessEngine] Decision API error, proceeding with normal reply:', result.error)
      }
    } catch (error) {
      console.warn('[LivenessEngine] shouldSuppressReply threw, proceeding normally:', error?.message || error)
    }
  }

  const traceId = makeTraceId()

  // Resolve tool calling if enabled
  let tools = null
  let toolContext = null
  let externalExecutors = null
  if (settingsStore.allowToolCalling) {
    try {
      const { getAvailableTools } = await import('../tools/toolRegistry')
      const selectedMcpServerIds = resolveDirectMcpServerIds(activeChat)
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

  const { templateVars, mainSystemPrompt, postHistoryPrompt } = buildDirectRequestPlan({
    activeChat,
    promptStore,
    getTemplateVars,
    applyTemplateVars,
    buildPersonaSystemPrompt,
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
      buildApiMessages: (resolvedContextMsgs) => buildDirectChatApiMessages(resolvedContextMsgs, activeChat.msgs),
      insertLorebookEntries,
      buildPostInstructionParts: (retrievedContext) => buildDirectPostInstructionParts({
        postHistoryPrompt,
        retrievedContext
      }),
      appendInstructionMessage
    }).then(result => result.messages),
    async onStreamComplete({ url, streamInfo, streamMsg }) {
      const { forumOnly, interactionOnly, acceptedMeet } = finalizeStreamingAssistantReply({
        message: streamMsg,
        activeChat,
        streamInfo,
        buildDisplayContent: buildStreamingDisplayContent,
        makeMsgId,
        syncForumToAI: settingsStore.syncForumToAI,
        parseMomentContent,
        actor: {
          id: activeChat.id,
          name: activeChat.name,
          avatar: activeChat.avatar
        },
        applyForumOnlyPlaceholder,
        pushMomentsIslandNotifications,
        visibility: {
          mode: 'single',
          traceId,
          model: cfg.model,
          url,
          allowAIImageGeneration: settingsStore.allowAIImageGeneration
        }
      })

      finalizeAssistantTurn(activeChat, soundEffects, {
        playSound: !interactionOnly
      })
      return { success: true, traceId, forumOnly, acceptedMeet }
    }
  })
}
