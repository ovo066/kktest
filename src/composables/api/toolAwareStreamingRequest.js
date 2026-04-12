/**
 * Tool-aware streaming request executor.
 *
 * Wraps the standard streaming request pattern and adds:
 *  1. Tool definitions injected into the payload
 *  2. Tool-call accumulation during streaming
 *  3. Multi-turn loop: execute tools → send results → stream final response
 */

import { consumeToolAwareChatCompletionsStream } from './toolAwareStream'
import { buildChatCompletionPayload } from './chatCompletions'
import { fetchOpenAICompat, readOpenAICompatError } from './openaiCompat'
import { estimatePromptBreakdownFromMessages, estimateUsageFromMessages, recordUsage } from './usage'
import { createAssistantMessage } from './assistantMessageLifecycle'
import { executeToolCalls } from './tools/toolCallExecutor'

/**
 * Execute a streamed assistant request with tool-calling support.
 *
 * When the model responds with tool_calls instead of (or alongside) text,
 * this function:
 *   1. Streams text content normally to the chat bubble
 *   2. Accumulates tool_calls
 *   3. Executes tool calls silently
 *   4. Appends tool results to conversation and tool logs to the assistant message
 *   5. Re-calls the API for a follow-up response (up to maxRounds)
 *
 * @param {object} options
 * @param {object} options.cfg - API config (url, key, model, etc.)
 * @param {Array} options.messages - Conversation messages
 * @param {object} options.activeChat - Active chat contact
 * @param {Function} options.makeMsgId - ID generator
 * @param {string} options.traceId
 * @param {Function} options.onChunk - Chunk callback for UI
 * @param {Function} options.createStreamChunkBatcher - Batcher factory
 * @param {object} [options.assistantMessage] - Extra fields for assistant message
 * @param {Function} [options.setTyping]
 * @param {Function} [options.setThinking]
 * @param {Array} options.tools - OpenAI-format tools array
 * @param {object} options.toolContext - Context object passed to tool executors
 * @param {number} [options.maxToolRounds=3] - Max tool-call rounds
 * @param {Map} [options.externalExecutors] - MCP/external tool executors
 */
export async function executeToolAwareStreamedRequest({
  cfg,
  messages,
  activeChat,
  makeMsgId,
  traceId,
  onChunk,
  createStreamChunkBatcher,
  assistantMessage = {},
  setTyping,
  setThinking,
  tools,
  toolContext,
  maxToolRounds = 3,
  externalExecutors = null
}) {
  let currentMessages = [...messages]
  let toolRoundCount = 0
  let assistantStreamMsg = null
  let finalStreamMsg = null
  let finalStreamInfo = null
  let finalUrl = ''
  let createdMsgId = null

  while (true) {
    const enableTools = toolRoundCount < maxToolRounds
    const payloadOptions = {
      tools: enableTools ? tools : undefined,
      tool_choice: enableTools ? undefined : 'none'
    }

    const payload = buildChatCompletionPayload(cfg, currentMessages, payloadOptions)
    const { request, response: res } = await fetchOpenAICompat(cfg.url, {
      apiKey: cfg.key,
      body: payload
    })
    const url = request.targetUrl
    if (!finalUrl) finalUrl = url

    if (typeof setTyping === 'function') setTyping(false)
    if (typeof setThinking === 'function') setThinking(true)

    if (!res.ok) {
      throw new Error(await readOpenAICompatError(res))
    }

    // Create assistant message in chat (only on first round)
    if (createdMsgId == null) {
      const newMsg = createAssistantMessage(makeMsgId, traceId, assistantMessage)
      activeChat.msgs.push(newMsg)
      createdMsgId = newMsg.id
      assistantStreamMsg = newMsg
    }

    finalStreamMsg = assistantStreamMsg || activeChat.msgs[activeChat.msgs.length - 1]
    const streamBatcher = createStreamChunkBatcher(finalStreamMsg, onChunk)

    let firstDeltaReceived = false
    const streamInfo = await consumeToolAwareChatCompletionsStream(res, {
      onDelta(delta) {
        if (!firstDeltaReceived) {
          firstDeltaReceived = true
          if (typeof setThinking === 'function') setThinking(false)
        }
        streamBatcher.push(delta)
      }
    })

    streamBatcher.flushNow()
    finalStreamInfo = streamInfo

    // If model returned tool_calls, execute them and loop
    if (enableTools && streamInfo.toolCalls && streamInfo.toolCalls.length > 0) {
      // Append assistant message with tool_calls to conversation
      currentMessages.push({
        role: 'assistant',
        content: finalStreamMsg.content || null,
        tool_calls: streamInfo.toolCalls
      })

      // Execute tools
      const { messages: toolResults, logs: toolLogs } = await executeToolCalls(
        streamInfo.toolCalls,
        toolContext,
        externalExecutors
      )

      appendToolLogs(finalStreamMsg, toolLogs, toolRoundCount + 1)

      // Inject tool result tokens back into assistant message content for display pipeline
      injectToolResultTokens(finalStreamMsg, streamInfo.toolCalls, toolResults)

      // Append tool results to conversation
      for (const result of toolResults) {
        currentMessages.push(result)
      }

      toolRoundCount++
      continue
    }

    // No tool calls or max rounds reached — we're done
    break
  }

  // Record usage
  const estimatedUsage = estimateUsageFromMessages(currentMessages, finalStreamMsg?.content, cfg.model)
  const promptBreakdown = estimatePromptBreakdownFromMessages(currentMessages, cfg.model)
  recordUsage(activeChat, finalStreamInfo, estimatedUsage, cfg.model, { promptBreakdown })

  return {
    url: finalUrl,
    streamInfo: finalStreamInfo,
    streamMsg: finalStreamMsg,
    createdMsgId
  }
}

function appendToolLogs(streamMsg, logs, round) {
  if (!streamMsg || !Array.isArray(logs) || logs.length === 0) return

  if (!Array.isArray(streamMsg.toolLogs)) {
    streamMsg.toolLogs = []
  }

  logs.forEach((log, index) => {
    streamMsg.toolLogs.push({
      ...log,
      round,
      indexInRound: index
    })
  })
}

/**
 * Inject special tokens from tool results into the assistant message content
 * so the existing post-processing pipeline can handle them (e.g. image generation,
 * sticker display).
 */
function injectToolResultTokens(streamMsg, toolCalls, toolResults) {
  const tokensToInject = []

  for (const result of toolResults) {
    let parsed
    try {
      parsed = JSON.parse(result.content)
    } catch {
      continue
    }
    if (!parsed?.success) continue

    // Image generation returns a token for the existing pipeline
    if (parsed.result?.imageToken) {
      tokensToInject.push(parsed.result.imageToken)
    }
    // Sticker returns a token for the existing pipeline
    if (parsed.result?.stickerToken) {
      tokensToInject.push(parsed.result.stickerToken)
    }
  }

  if (tokensToInject.length > 0) {
    const suffix = '\n' + tokensToInject.join('\n')
    streamMsg.content = (streamMsg.content || '') + suffix
  }
}
