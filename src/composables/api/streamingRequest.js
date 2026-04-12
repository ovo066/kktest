import { consumeChatCompletionsStream } from './stream'
import { buildChatCompletionPayload } from './chatCompletions'
import { fetchOpenAICompat, readOpenAICompatError } from './openaiCompat'
import { estimatePromptBreakdownFromMessages, estimateUsageFromMessages, recordUsage } from './usage'
import { createAssistantMessage } from './assistantMessageLifecycle'

function extractTextFromContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part
      if (typeof part?.text === 'string') return part.text
      return ''
    }).join('')
  }
  return ''
}

function extractNonStreamMessageText(payload) {
  if (!payload || typeof payload !== 'object') return ''

  const choice = payload?.choices?.[0]
  const messageText = extractTextFromContent(choice?.message?.content)
  if (messageText) return messageText

  const deltaText = extractTextFromContent(choice?.delta?.content)
  if (deltaText) return deltaText

  if (typeof payload.output_text === 'string') return payload.output_text
  if (typeof payload.text === 'string') return payload.text
  return ''
}

function buildNonStreamingPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { stream: false }
  }
  const nextPayload = { ...payload, stream: false }
  delete nextPayload.stream_options
  return nextPayload
}

async function recoverAssistantReplyWithoutStreaming({ cfg, payload }) {
  const { request, response } = await fetchOpenAICompat(cfg.url, {
    apiKey: cfg.key,
    body: buildNonStreamingPayload(payload)
  })

  if (!response.ok) {
    throw new Error(await readOpenAICompatError(response))
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    let rawText = ''
    try {
      rawText = await response.clone().text()
    } catch {
      rawText = ''
    }
    return {
      content: String(rawText || '').trim(),
      finishReason: null,
      usage: null,
      url: request.targetUrl
    }
  }

  return {
    content: extractNonStreamMessageText(data).trim(),
    finishReason: data?.choices?.[0]?.finish_reason || null,
    usage: data?.usage || null,
    url: request.targetUrl
  }
}

export function appendInstructionMessage(messages, parts = []) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return messages
  }

  messages.push({
    role: 'system',
    content: '<instructions>\n' + parts.join('\n\n') + '\n</instructions>'
  })
  return messages
}

export async function executeStreamedAssistantRequest({
  cfg,
  messages,
  activeChat,
  makeMsgId,
  traceId,
  onChunk,
  createStreamChunkBatcher,
  assistantMessage = {},
  setTyping,
  setThinking
}) {
  const payload = buildChatCompletionPayload(cfg, messages)
  const { request, response: res } = await fetchOpenAICompat(cfg.url, {
    apiKey: cfg.key,
    body: payload
  })
  const url = request.targetUrl

  if (typeof setTyping === 'function') {
    setTyping(false)
  }
  if (typeof setThinking === 'function') {
    setThinking(true)
  }

  if (!res.ok) {
    throw new Error(await readOpenAICompatError(res))
  }

  const newMsg = createAssistantMessage(makeMsgId, traceId, assistantMessage)
  activeChat.msgs.push(newMsg)
  const streamMsg = activeChat.msgs[activeChat.msgs.length - 1]
  const streamBatcher = createStreamChunkBatcher(streamMsg, onChunk)

  let firstDeltaReceived = false
  let streamInfo = await consumeChatCompletionsStream(res, delta => {
    if (!firstDeltaReceived) {
      firstDeltaReceived = true
      if (typeof setThinking === 'function') setThinking(false)
    }
    streamBatcher.push(delta)
  })

  if (streamInfo?.emittedChars === 0 && !String(streamMsg.content || '').trim()) {
    if (typeof setThinking === 'function') setThinking(false)
    const fallback = await recoverAssistantReplyWithoutStreaming({
      cfg,
      payload
    })
    if (fallback.content) {
      streamBatcher.push(fallback.content)
    }
    streamInfo = {
      ...streamInfo,
      finishReason: fallback.finishReason || streamInfo?.finishReason || null,
      usage: fallback.usage || streamInfo?.usage || null,
      usedNonStreamFallback: !!fallback.content,
      fallbackUrl: fallback.url
    }
  }

  streamBatcher.flushNow()

  const estimatedUsage = estimateUsageFromMessages(messages, streamMsg.content, cfg.model)
  const promptBreakdown = estimatePromptBreakdownFromMessages(messages, cfg.model)
  recordUsage(activeChat, streamInfo, estimatedUsage, cfg.model, { promptBreakdown })

  return {
    url,
    streamInfo,
    streamMsg,
    createdMsgId: newMsg.id
  }
}
