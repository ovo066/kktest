import { consumeChatCompletionsStream } from './stream'
import { fetchOpenAICompat, readOpenAICompatError } from './openaiCompat'

export function createOpenAICompatTextAccumulator(initialText = '') {
  let text = String(initialText || '')
  let lastChunk = ''

  return {
    getText() {
      return text
    },
    push(delta) {
      const piece = String(delta || '')
      if (!piece) {
        return {
          text,
          changed: false,
          emittedDelta: '',
          piece: ''
        }
      }

      const previousText = text
      let emittedDelta = ''

      if (text && piece.startsWith(text)) {
        text = piece
        emittedDelta = piece.slice(previousText.length)
      } else if (!(piece === lastChunk && text.endsWith(piece))) {
        text += piece
        emittedDelta = piece
      }

      lastChunk = piece

      return {
        text,
        changed: text !== previousText,
        emittedDelta,
        piece
      }
    }
  }
}

function createOpenAICompatStreamError(detail, response, request, options = {}) {
  const status = Number(response?.status)
  const cleanPrefix = String(options.errorPrefix || '').trim()
  const fallbackDetail = String(detail || '').trim() || `HTTP ${Number.isFinite(status) ? status : ''}`.trim()

  let message = fallbackDetail
  if (options.includeStatusInMessage && Number.isFinite(status) && status > 0) {
    message = cleanPrefix
      ? `${cleanPrefix} ${status}: ${fallbackDetail}`
      : `HTTP ${status}: ${fallbackDetail}`
  }

  const error = new Error(message)
  if (Number.isFinite(status) && status > 0) error.status = status
  if (request?.targetUrl) error.url = request.targetUrl
  if (fallbackDetail) error.detail = fallbackDetail
  return error
}

export async function runOpenAICompatTextStream(options = {}) {
  const {
    cfg,
    body,
    signal,
    onDelta,
    onText,
    errorPrefix = '',
    includeStatusInMessage = false,
    path,
    extraHeaders
  } = options

  const { request, response } = await fetchOpenAICompat(cfg?.url, {
    apiKey: cfg?.key,
    body,
    signal,
    path,
    extraHeaders
  })

  if (!response.ok) {
    const detail = await readOpenAICompatError(response)
    throw createOpenAICompatStreamError(detail, response, request, {
      errorPrefix,
      includeStatusInMessage
    })
  }

  const accumulator = createOpenAICompatTextAccumulator()
  const streamResult = await consumeChatCompletionsStream(response, (delta) => {
    const update = accumulator.push(delta)
    if (!update.changed) return
    if (typeof onDelta === 'function' && update.emittedDelta) {
      onDelta(update.emittedDelta, update.text, update.piece)
    }
    if (typeof onText === 'function') {
      onText(update.text, update.emittedDelta, update.piece)
    }
  })

  return {
    text: accumulator.getText(),
    streamResult,
    url: request.targetUrl
  }
}
