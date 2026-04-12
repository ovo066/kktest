import JSZip from 'jszip'
import { decode, decodeMulti } from '@msgpack/msgpack'
import {
  base64ToUint8Array,
  blobToDataUrl,
  detectImageMimeType,
  uint8ArrayToBase64
} from './shared'

function isZipBuffer(buffer) {
  const bytes = new Uint8Array(buffer)
  return bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4B &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
}

function normalizeMsgpackImage(image) {
  if (image instanceof Uint8Array) return image
  if (typeof image === 'string') return base64ToUint8Array(image)
  if (Array.isArray(image)) return new Uint8Array(image)
  if (image && typeof image === 'object') {
    const nested = normalizeMsgpackImage(
      image.data ?? image.base64 ?? image.b64 ?? image.bytes ?? image.image
    )
    if (nested.length > 0) return nested
  }
  return new Uint8Array(0)
}

function normalizeDecodedEvent(obj) {
  if (!obj || typeof obj !== 'object') return null
  if (obj instanceof Map) return deepConvertMaps(Object.fromEntries(obj.entries()))
  return deepConvertMaps(obj)
}

function deepConvertMaps(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) return obj
  if (Array.isArray(obj)) return obj.map(deepConvertMaps)
  if (obj instanceof Map) {
    const plain = Object.fromEntries(obj.entries())
    for (const key of Object.keys(plain)) {
      plain[key] = deepConvertMaps(plain[key])
    }
    return plain
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val instanceof Map) {
      obj[key] = deepConvertMaps(Object.fromEntries(val.entries()))
    }
  }
  return obj
}

export function parseNovelAISSEEvents(streamData) {
  const events = []
  const text = new TextDecoder().decode(streamData)
  const lines = text.split(/\r?\n/)
  let eventName = ''
  let dataLines = []

  const flushEvent = () => {
    if (dataLines.length === 0) return
    const rawData = dataLines.join('\n').trim()
    const resolvedEventName = String(eventName || '').trim().toLowerCase()
    eventName = ''
    dataLines = []
    if (!rawData) return
    try {
      const parsed = normalizeDecodedEvent(JSON.parse(rawData))
      if (parsed) {
        if (resolvedEventName && parsed.event_type === undefined && parsed.type === undefined) {
          parsed.event_type = resolvedEventName
        }
        events.push(parsed)
      }
    } catch {
      events.push({
        event_type: resolvedEventName || 'message',
        message: rawData
      })
    }
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushEvent()
      continue
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  flushEvent()
  return events
}

export function parseNovelAIMsgpackEvents(msgpackData) {
  const events = []
  let offset = 0
  let canUseLengthPrefix = msgpackData.length > 0

  while (offset < msgpackData.length && canUseLengthPrefix) {
    try {
      if (offset + 4 > msgpackData.length) {
        canUseLengthPrefix = false
        break
      }
      const messageLength = new DataView(
        msgpackData.buffer,
        msgpackData.byteOffset + offset,
        4
      ).getUint32(0, false)
      const msgStart = offset + 4
      const msgEnd = msgStart + messageLength
      if (messageLength <= 0 || msgStart >= msgpackData.length || msgEnd > msgpackData.length) {
        canUseLengthPrefix = false
        break
      }

      const messageData = msgpackData.slice(msgStart, msgEnd)
      const obj = normalizeDecodedEvent(decode(messageData))
      if (!obj) {
        canUseLengthPrefix = false
        break
      }
      events.push(obj)
      offset = msgEnd
    } catch {
      canUseLengthPrefix = false
    }
  }

  if (canUseLengthPrefix && offset === msgpackData.length && events.length > 0) {
    return events
  }

  events.length = 0

  try {
    for (const item of decodeMulti(msgpackData)) {
      const obj = normalizeDecodedEvent(item)
      if (obj) events.push(obj)
    }
  } catch {
    // Ignore and continue to other parsers.
  }

  if (events.length > 0) return events

  try {
    const decoded = normalizeDecodedEvent(decode(msgpackData))
    if (Array.isArray(decoded)) {
      decoded.forEach(item => {
        const obj = normalizeDecodedEvent(item)
        if (obj) events.push(obj)
      })
    } else if (decoded) {
      events.push(decoded)
    }
  } catch {
    // Ignore parse failure.
  }

  return events
}

function parseNovelAIJsonEvents(streamData) {
  const text = new TextDecoder().decode(streamData).trim()
  if (!text) return []
  try {
    const decoded = normalizeDecodedEvent(JSON.parse(text))
    if (Array.isArray(decoded)) return decoded.map(normalizeDecodedEvent).filter(Boolean)
    return decoded ? [decoded] : []
  } catch {
    return []
  }
}

function detectKnownImageMimeType(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) return 'image/gif'

  try {
    const text = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLowerCase()
    if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) {
      return 'image/svg+xml'
    }
  } catch {
    // Ignore non-text payloads.
  }

  return ''
}

function bytesToImageDataUrl(bytes, allowFallbackMime = false) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''
  const mimeType = detectKnownImageMimeType(bytes) || (allowFallbackMime ? detectImageMimeType(bytes) : '')
  if (!mimeType) return ''
  return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`
}

function normalizeImageLikeString(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(?:blob:|https?:\/\/)/i.test(text)) return text
  if (/^data:image\//i.test(text)) return text
  if (/^data:/i.test(text)) {
    const match = text.match(/^data:[^;,]*;base64,([\s\S]+)$/i)
    if (!match) return ''
    const bytes = normalizeMsgpackImage(match[1].replace(/\s+/g, ''))
    return bytesToImageDataUrl(bytes, false) || ''
  }
  if (/^[\[{]/.test(text)) {
    try {
      const parsed = normalizeDecodedEvent(JSON.parse(text))
      return extractImageResultFromValue(parsed)
    } catch {
      return ''
    }
  }
  if (/^[a-z0-9+/=\s]+$/i.test(text) && text.replace(/\s+/g, '').length >= 64) {
    const bytes = normalizeMsgpackImage(text.replace(/\s+/g, ''))
    return bytesToImageDataUrl(bytes, false)
  }
  return ''
}

function extractImageResultFromValue(value, seen = new Set(), depth = 0) {
  if (value === undefined || value === null || depth > 6) return ''
  if (typeof value === 'string') return normalizeImageLikeString(value)
  if (value instanceof Uint8Array) return bytesToImageDataUrl(value, true)
  if (value instanceof ArrayBuffer) return bytesToImageDataUrl(new Uint8Array(value), true)
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractImageResultFromValue(item, seen, depth + 1)
      if (nested) return nested
    }
    return ''
  }
  if (!value || typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  const priorityKeys = [
    'imageUrl',
    'image',
    'url',
    'src',
    'b64_json',
    'base64',
    'b64',
    'bytes',
    'binary',
    'output',
    'data',
    'payload',
    'result',
    'artifact',
    'artifacts',
    'images',
    'results'
  ]

  for (const key of priorityKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue
    const nested = extractImageResultFromValue(value[key], seen, depth + 1)
    if (nested) return nested
  }

  for (const nestedValue of Object.values(value)) {
    const nested = extractImageResultFromValue(nestedValue, seen, depth + 1)
    if (nested) return nested
  }

  return ''
}

function extractImageResultFromJsonPayload(streamData) {
  const text = new TextDecoder().decode(streamData).trim()
  if (!text || !/^[\[{]/.test(text)) return ''
  try {
    const parsed = normalizeDecodedEvent(JSON.parse(text))
    return extractImageResultFromValue(parsed)
  } catch {
    return ''
  }
}

function isLikelySSEPayload(streamData) {
  const preview = new TextDecoder().decode(streamData.slice(0, 200))
  return preview.includes('event:') || preview.includes('data:')
}

function isFinalLikeEventType(value) {
  const type = String(value || '').trim().toLowerCase()
  if (!type) return false
  return (
    type === 'final' ||
    type === 'done' ||
    type === 'complete' ||
    type === 'completed' ||
    type === 'success'
  )
}

function isOutputLikeEventType(value) {
  const type = String(value || '').trim().toLowerCase()
  if (!type) return false
  return type === 'result' || type === 'output'
}

function isErrorLikeEventType(value) {
  const type = String(value || '').trim().toLowerCase()
  if (!type) return false
  return (
    type === 'error' ||
    type === 'failed' ||
    type === 'failure' ||
    type === 'fatal' ||
    type === 'rejected' ||
    type === 'reject' ||
    type === 'denied'
  )
}

function pickFirstNonEmptyText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      const text = value.trim()
      if (text) return text
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    if (typeof value === 'object') {
      try {
        const text = JSON.stringify(value)
        if (text && text !== '{}' && text !== '[]') return text
      } catch {
        // Ignore stringify errors.
      }
    }
  }
  return ''
}

function truncateText(text, maxLen = 360) {
  const source = String(text || '')
  if (source.length <= maxLen) return source
  return source.slice(0, maxLen) + '...'
}

export function extractNovelAIStreamErrorMessage(events) {
  for (const event of events) {
    if (!event || typeof event !== 'object') continue
    const type = event?.event_type ?? event?.type ?? event?.event
    if (!isErrorLikeEventType(type)) continue

    const detail = pickFirstNonEmptyText(
      event?.message,
      event?.error,
      event?.detail,
      event?.reason,
      event?.description,
      event?.data?.message,
      event?.data?.error,
      event?.data?.detail,
      event?.payload?.message,
      event?.payload?.error,
      event?.payload?.detail,
      event?.result?.message,
      event?.result?.error,
      event?.result?.detail
    )
    if (detail) return truncateText(detail)
    const fallback = pickFirstNonEmptyText(sanitizeNovelAIStreamEventForLog(event))
    if (fallback) return truncateText(fallback)
    return '服务端返回 error 事件（无 message/detail）'
  }
  return ''
}

function sanitizeNovelAIStreamEventForLog(event) {
  if (!event || typeof event !== 'object') return event
  const clone = {}
  for (const [key, value] of Object.entries(event)) {
    if (key === 'image') continue
    if (key === 'output' || key === 'data' || key === 'payload' || key === 'result') {
      if (value && typeof value === 'object') {
        const child = {}
        for (const [k, v] of Object.entries(value)) {
          if (k === 'image') continue
          child[k] = v
        }
        clone[key] = child
      } else {
        clone[key] = value
      }
      continue
    }
    clone[key] = value
  }
  return clone
}

function hasFinalLikeMarker(value) {
  if (value === true || value === 1) return true
  if (value === false || value === 0 || value === undefined || value === null) return false
  const text = String(value).trim().toLowerCase()
  if (!text) return false
  return (
    text === 'true' ||
    text === '1' ||
    text === 'done' ||
    text === 'final' ||
    text === 'complete' ||
    text === 'completed' ||
    text === 'success' ||
    text === 'succeeded' ||
    text === 'finished'
  )
}

function isFinalLikeEvent(event) {
  if (!event || typeof event !== 'object') return false
  const type = event?.event_type ?? event?.type ?? event?.event
  if (isFinalLikeEventType(type)) return true

  return (
    hasFinalLikeMarker(event?.final) ||
    hasFinalLikeMarker(event?.is_final) ||
    hasFinalLikeMarker(event?.done) ||
    hasFinalLikeMarker(event?.complete) ||
    hasFinalLikeMarker(event?.completed) ||
    hasFinalLikeMarker(event?.finished) ||
    hasFinalLikeMarker(event?.status) ||
    hasFinalLikeMarker(event?.state) ||
    hasFinalLikeMarker(event?.phase) ||
    hasFinalLikeMarker(event?.output?.done) ||
    hasFinalLikeMarker(event?.output?.complete) ||
    hasFinalLikeMarker(event?.output?.completed) ||
    hasFinalLikeMarker(event?.output?.status)
  )
}

function extractImageBytesFromEvent(event) {
  if (!event || typeof event !== 'object') return new Uint8Array(0)

  const candidates = [
    event.image,
    event.output?.image,
    Array.isArray(event.output) ? event.output[0]?.image : null,
    event.data?.image,
    event.data,
    event.payload?.image,
    event.result?.image
  ]

  for (const candidate of candidates) {
    const bytes = normalizeMsgpackImage(candidate)
    if (bytes.length > 0) return bytes
  }

  return new Uint8Array(0)
}

function pickLastImageBytesFromEvents(events, predicate = null) {
  if (!Array.isArray(events) || events.length === 0) return new Uint8Array(0)

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (predicate && !predicate(event)) continue
    const bytes = extractImageBytesFromEvent(event)
    if (bytes.length > 0) return bytes
  }

  return new Uint8Array(0)
}

async function extractFirstImageFromZip(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const firstImage = Object.values(zip.files).find(file => {
    if (!file || file.dir) return false
    return /\.(png|jpe?g|webp)$/i.test(file.name)
  })
  if (!firstImage) {
    throw new Error('NovelAI 返回 zip 中未找到图片文件')
  }
  const blob = await firstImage.async('blob')
  return await blobToDataUrl(blob)
}

export async function parseNovelAIStreamResponse(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  const buffer = await res.arrayBuffer()

  if (contentType.includes('application/zip') || isZipBuffer(buffer)) {
    return await extractFirstImageFromZip(buffer)
  }

  const data = new Uint8Array(buffer)
  const directImageDataUrl = bytesToImageDataUrl(data, false)
  if (directImageDataUrl) return directImageDataUrl

  if (contentType.startsWith('image/')) {
    const mimeType = contentType.split(';')[0] || detectImageMimeType(data)
    const blob = new Blob([buffer], { type: mimeType || 'image/png' })
    return await blobToDataUrl(blob)
  }

  let events = []
  if (isLikelySSEPayload(data)) {
    events = parseNovelAISSEEvents(data)
  } else {
    events = parseNovelAIMsgpackEvents(data)
    if (events.length === 0) {
      events = parseNovelAIJsonEvents(data)
    }
  }

  const streamErrorMessage = extractNovelAIStreamErrorMessage(events)
  if (streamErrorMessage) {
    const diagnostics = {
      contentType,
      eventCount: events.length,
      eventTypes: events.map(e => String(e?.event_type ?? e?.type ?? e?.event ?? 'unknown')).slice(0, 12),
      eventSamples: events.slice(0, 3).map(sanitizeNovelAIStreamEventForLog)
    }
    try {
      globalThis.__novelaiLastStreamError = diagnostics
    } catch {
      // Ignore assignment failure.
    }
    console.error('[NovelAI] stream returned error event', diagnostics)
    throw new Error(`NovelAI 流式生成失败：${streamErrorMessage}`)
  }

  let imageBytes = pickLastImageBytesFromEvents(events, event => isFinalLikeEvent(event))

  if (imageBytes.length === 0) {
    imageBytes = pickLastImageBytesFromEvents(events, event =>
      isOutputLikeEventType(event?.event_type ?? event?.type ?? event?.event)
    )
  }

  if (imageBytes.length === 0) {
    imageBytes = pickLastImageBytesFromEvents(events)
  }

  if (imageBytes.length === 0) {
    const wrappedImage = extractImageResultFromJsonPayload(data)
    if (wrappedImage) return wrappedImage

    const diagnostics = {
      contentType,
      eventCount: events.length,
      eventTypes: events.map(e => String(e?.event_type ?? e?.type ?? e?.event ?? 'unknown')).slice(0, 12),
      eventSamples: events.slice(0, 3).map(sanitizeNovelAIStreamEventForLog)
    }
    try {
      globalThis.__novelaiLastStreamError = diagnostics
    } catch {
      // Ignore assignment failure.
    }
    console.error('[NovelAI] stream parse failed', diagnostics)
  }

  if (!imageBytes || imageBytes.length === 0) {
    throw new Error('NovelAI V4 返回数据中未找到可用图片')
  }
  const mimeType = detectImageMimeType(imageBytes)
  const blob = new Blob([imageBytes], { type: mimeType })
  return await blobToDataUrl(blob)
}

export async function parseNovelAIResponse(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  const buffer = await res.arrayBuffer()

  if (contentType.includes('application/zip') || isZipBuffer(buffer)) {
    return await extractFirstImageFromZip(buffer)
  }

  const data = new Uint8Array(buffer)
  const directImageDataUrl = bytesToImageDataUrl(data, false)
  if (directImageDataUrl) return directImageDataUrl

  const wrappedImage = extractImageResultFromJsonPayload(data)
  if (wrappedImage) return wrappedImage

  if (contentType.startsWith('image/')) {
    const mimeType = contentType.split(';')[0] || detectImageMimeType(data)
    const blob = new Blob([buffer], { type: mimeType || 'image/png' })
    return await blobToDataUrl(blob)
  }

  if (buffer.byteLength === 0) {
    throw new Error('NovelAI 返回了空图片响应')
  }

  throw new Error(`NovelAI 返回数据中未找到可用图片（content-type: ${contentType || 'unknown'}）`)
}
