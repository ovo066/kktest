/**
 * Tool-aware SSE stream consumer.
 *
 * Extends the existing stream.js pattern to additionally extract
 * delta.tool_calls from streaming chunks. The original stream.js
 * is NOT modified; this is a standalone parallel implementation.
 */

import { createToolCallAccumulator } from './tools/toolCallAccumulator'

function extractTextFromChoice(choice) {
  if (!choice || typeof choice !== 'object') return ''

  const deltaContent = choice?.delta?.content
  if (typeof deltaContent === 'string') return deltaContent
  if (Array.isArray(deltaContent)) {
    return deltaContent.map(p => (typeof p?.text === 'string' ? p.text : '')).join('')
  }

  const msgContent = choice?.message?.content
  if (typeof msgContent === 'string') return msgContent
  if (Array.isArray(msgContent)) {
    return msgContent.map(p => (typeof p?.text === 'string' ? p.text : '')).join('')
  }

  return ''
}

function extractTextFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return ''

  const firstChoice = payload?.choices?.[0]
  const fromChoice = extractTextFromChoice(firstChoice)
  if (fromChoice) return fromChoice

  if (typeof payload.output_text === 'string') return payload.output_text
  if (typeof payload.text === 'string') return payload.text
  return ''
}

function extractToolCallsDelta(payload) {
  const choice = payload?.choices?.[0]
  return choice?.delta?.tool_calls || choice?.message?.tool_calls || null
}

/**
 * Consume a streamed /chat/completions response, extracting both text deltas
 * and tool_calls deltas.
 *
 * @param {Response} res  fetch() response
 * @param {object} callbacks
 * @param {(delta: string) => void} callbacks.onDelta  called for text content
 * @param {(toolCalls: Array) => void} [callbacks.onToolCallDelta]  called per tool_calls chunk
 * @returns {Promise<{emittedChars, emittedEvents, usedFallback, usage, finishReason, toolCalls}>}
 */
export async function consumeToolAwareChatCompletionsStream(res, { onDelta, onToolCallDelta } = {}) {
  const reader = res?.body?.getReader?.()
  if (!reader) {
    throw new Error('当前环境不支持流式读取')
  }

  const decoder = new TextDecoder()
  const accumulator = createToolCallAccumulator()
  let lineBuffer = ''
  let rawText = ''
  let eventLines = []
  let emittedChars = 0
  let emittedEvents = 0
  let usage = null
  let finishReason = null

  const emitText = (text) => {
    if (!text || typeof text !== 'string') return
    emittedChars += text.length
    emittedEvents += 1
    if (typeof onDelta === 'function') onDelta(text)
  }

  const processEvent = () => {
    if (eventLines.length === 0) return
    const payloadText = eventLines.join('\n').trim()
    eventLines = []
    if (!payloadText || payloadText === '[DONE]') return

    try {
      const payload = JSON.parse(payloadText)

      // Extract text content
      emitText(extractTextFromPayload(payload))

      // Extract tool_calls deltas
      const toolCallsDelta = extractToolCallsDelta(payload)
      if (toolCallsDelta) {
        accumulator.push(toolCallsDelta)
        if (typeof onToolCallDelta === 'function') {
          onToolCallDelta(toolCallsDelta)
        }
      }

      const choiceFinish = payload?.choices?.[0]?.finish_reason
      if (choiceFinish) finishReason = choiceFinish
      if (payload.usage && typeof payload.usage === 'object') {
        usage = payload.usage
      }
    } catch {
      // Ignore invalid payload frames
    }
  }

  // Main stream read loop
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    rawText += chunk
    lineBuffer += chunk

    const lines = lineBuffer.split(/\r?\n/)
    lineBuffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      if (line === '') {
        processEvent()
        continue
      }
      if (!line.startsWith('data:')) continue
      eventLines.push(line.slice(5).trimStart())
    }
  }

  // Process remaining buffer
  if (lineBuffer.trim()) {
    const line = lineBuffer.trimEnd()
    if (line.startsWith('data:')) {
      eventLines.push(line.slice(5).trimStart())
    }
  }
  processEvent()

  // Fallback: try non-streaming JSON parse
  let usedFallback = false
  if (emittedChars === 0 && !accumulator.hasToolCalls()) {
    const text = rawText.trim()
    if (text) {
      try {
        const payload = JSON.parse(text)
        const fallbackText = extractTextFromPayload(payload)
        if (fallbackText) {
          usedFallback = true
          emitText(fallbackText)
        }
        const toolCallsDelta = extractToolCallsDelta(payload)
        if (toolCallsDelta) {
          accumulator.push(toolCallsDelta)
        }
        const choiceFinish = payload?.choices?.[0]?.finish_reason
        if (choiceFinish) finishReason = choiceFinish
        if (payload.usage && typeof payload.usage === 'object') {
          usage = payload.usage
        }
      } catch {
        // Non-JSON fallback ignored
      }
    }
  }

  // Compile completed tool calls
  const toolCalls = accumulator.hasToolCalls() ? accumulator.getCompleted() : []

  return {
    emittedChars,
    emittedEvents,
    usedFallback,
    usage,
    finishReason,
    toolCalls
  }
}
