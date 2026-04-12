const ABSOLUTE_HTTP_URL_RE = /^https?:\/\//i
const DATA_IMAGE_URL_RE = /^data:image\//i
const BLOB_URL_RE = /^blob:/i
const PROTOCOL_RELATIVE_URL_RE = /^\/\//

export function normalizeImageUrlInput(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const normalized = PROTOCOL_RELATIVE_URL_RE.test(raw) ? `https:${raw}` : raw
  if (ABSOLUTE_HTTP_URL_RE.test(normalized)) return normalized
  if (DATA_IMAGE_URL_RE.test(normalized)) return normalized
  if (BLOB_URL_RE.test(normalized)) return normalized

  return null
}

export function resolveMessageImageUrl(message) {
  if (!message || typeof message !== 'object') return ''

  const candidates = [message.imageUrl, message.image, message.url]
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim()
    if (text) return text
  }

  return ''
}
