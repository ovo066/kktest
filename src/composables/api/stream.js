// Utilities for consuming OpenAI-compatible streaming responses (SSE over fetch).
// The server usually sends "data: {json}\n\n" and ends with "data: [DONE]".

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

/**
 * Consume a streamed /chat/completions response and emit text deltas.
 * Returns parse diagnostics to help callers distinguish protocol issues.
 *
 * @param {Response} res fetch() response
 * @param {(delta: string) => void} onDelta called for every delta chunk
 * @returns {Promise<{emittedChars:number,emittedEvents:number,usedFallback:boolean}>}
 */
export async function consumeChatCompletionsStream(res, onDelta) {
  const reader = res?.body?.getReader?.()
  if (!reader) {
    throw new Error('当前环境不支持流式读取')
  }

  const decoder = new TextDecoder()
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
      emitText(extractTextFromPayload(payload))
      const choiceFinish = payload?.choices?.[0]?.finish_reason
      if (choiceFinish) finishReason = choiceFinish
      if (payload.usage && typeof payload.usage === 'object') {
        usage = payload.usage
      }
    } catch {
      // Ignore invalid payload frames and continue parsing subsequent frames.
    }
  }

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

  if (lineBuffer.trim()) {
    const line = lineBuffer.trimEnd()
    if (line.startsWith('data:')) {
      eventLines.push(line.slice(5).trimStart())
    }
  }
  processEvent()

  let usedFallback = false
  if (emittedChars === 0) {
    const text = rawText.trim()
    if (text) {
      try {
        const payload = JSON.parse(text)
        const fallbackText = extractTextFromPayload(payload)
        if (fallbackText) {
          usedFallback = true
          emitText(fallbackText)
        }
        const choiceFinish = payload?.choices?.[0]?.finish_reason
        if (choiceFinish) finishReason = choiceFinish
        if (payload.usage && typeof payload.usage === 'object') {
          usage = payload.usage
        }
      } catch {
        // Non-JSON fallback ignored.
      }
    }
  }

  return { emittedChars, emittedEvents, usedFallback, usage, finishReason }
}
