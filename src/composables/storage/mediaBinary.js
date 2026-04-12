const MEDIA_RECORD_KIND = 'aichat-media'
const MEDIA_RECORD_VERSION = 1

function isBlobValue(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

function isInlineDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:')
}

function hasArrayBufferValue(value) {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
}

function resolveArrayBuffer(value) {
  if (value instanceof ArrayBuffer) {
    return value
  }
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  }
  return null
}

function decodeBase64(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  const BufferCtor = typeof globalThis !== 'undefined' ? globalThis.Buffer : null
  if (BufferCtor) {
    return Uint8Array.from(BufferCtor.from(base64, 'base64'))
  }

  throw new Error('Base64 decoder unavailable')
}

function dataUrlToBlob(dataUrl) {
  if (!isInlineDataUrl(dataUrl)) return null
  const match = String(dataUrl).match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) return null

  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = !!match[2]
  const payload = match[3] || ''

  if (isBase64) {
    return new Blob([decodeBase64(payload)], { type: mimeType })
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType })
}

async function blobToArrayBuffer(blob) {
  if (!blob) return null
  if (typeof blob.arrayBuffer === 'function') {
    return await blob.arrayBuffer()
  }
  if (typeof Response !== 'undefined') {
    return await new Response(blob).arrayBuffer()
  }
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : null)
      reader.onerror = () => reject(reader.error || new Error('Failed to read media blob'))
      reader.readAsArrayBuffer(blob)
    })
  }
  throw new Error('ArrayBuffer encoder unavailable')
}

export function isStoredMediaRecord(value) {
  if (!value || typeof value !== 'object') return false
  if (value.kind !== MEDIA_RECORD_KIND || value.version !== MEDIA_RECORD_VERSION) return false
  return hasArrayBufferValue(value.buffer)
}

export function mediaValueToBlob(value) {
  if (isBlobValue(value)) return value
  if (isStoredMediaRecord(value)) {
    const buffer = resolveArrayBuffer(value.buffer)
    if (!buffer) return null
    return new Blob([buffer], { type: value.type || 'application/octet-stream' })
  }
  return dataUrlToBlob(value)
}

export async function serializeMediaForStorage(value) {
  if (isStoredMediaRecord(value)) return value

  const blob = mediaValueToBlob(value)
  if (!blob) return value
  const buffer = await blobToArrayBuffer(blob)
  if (!(buffer instanceof ArrayBuffer)) return value

  return {
    kind: MEDIA_RECORD_KIND,
    version: MEDIA_RECORD_VERSION,
    type: blob.type || 'application/octet-stream',
    buffer
  }
}
