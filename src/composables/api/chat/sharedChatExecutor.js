import { buildFriendlyErrorMessage } from '../errors'
import { removeMessageIfVisiblyEmpty } from '../chatMessages'
import { handleAssistantRequestFailure } from '../assistantMessageLifecycle'
import { executeStreamedAssistantRequest } from '../streamingRequest'

export async function executeChatStreamOrchestrator(options) {
  const {
    chatStore,
    activeChat,
    cfg,
    messages: providedMessages,
    getMessages,
    makeMsgId,
    traceId,
    onChunk,
    createStreamChunkBatcher,
    assistantMessage = {},
    onStreamComplete,
    failureExtra = {},
    // Tool calling support (optional)
    tools,
    toolContext,
    maxToolRounds,
    externalExecutors
  } = options

  let createdMsgId = null
  chatStore.ui.isTyping = true
  chatStore.ui.isThinking = false

  try {
    const messages = providedMessages ?? await getMessages?.()

    // Use tool-aware path if tools are provided
    const useToolCalling = Array.isArray(tools) && tools.length > 0
    let streamExecution

    if (useToolCalling) {
      const { executeToolAwareStreamedRequest } = await import('../toolAwareStreamingRequest')
      streamExecution = await executeToolAwareStreamedRequest({
        cfg,
        messages,
        activeChat,
        makeMsgId,
        traceId,
        onChunk,
        createStreamChunkBatcher,
        assistantMessage,
        setTyping(value) { chatStore.ui.isTyping = value },
        setThinking(value) { chatStore.ui.isThinking = value },
        tools,
        toolContext,
        maxToolRounds: maxToolRounds ?? 3,
        externalExecutors
      })
    } else {
      streamExecution = await executeStreamedAssistantRequest({
        cfg,
        messages,
        activeChat,
        makeMsgId,
        traceId,
        onChunk,
        createStreamChunkBatcher,
        assistantMessage,
        setTyping(value) { chatStore.ui.isTyping = value },
        setThinking(value) { chatStore.ui.isThinking = value }
      })
    }

    createdMsgId = streamExecution.createdMsgId
    return await onStreamComplete(streamExecution)
  } catch (error) {
    chatStore.ui.isTyping = false
    chatStore.ui.isThinking = false
    return handleAssistantRequestFailure({
      activeChat,
      removeMessageIfVisiblyEmpty,
      createdMsgId,
      buildFriendlyErrorMessage,
      makeMsgId,
      traceId,
      error,
      extra: typeof failureExtra === 'function' ? failureExtra(error) : failureExtra
    })
  }
}
