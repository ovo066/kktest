import { isStoredMediaRecord, mediaValueToBlob } from './mediaBinary'

export const MEDIA_REF_PREFIX = 'media:'

export function isInlineImageDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

export function isBlobUrl(value) {
  return typeof value === 'string' && value.startsWith('blob:')
}

export function isBlobValue(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

export function shouldExternalizeInlineMedia(value) {
  return isInlineImageDataUrl(value)
}

export function isLikelyMediaString(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return false
  return isInlineImageDataUrl(text) || isBlobUrl(text) || /^https?:\/\//i.test(text)
}

function sanitizeRefSegment(value, fallback = 'x') {
  const raw = String(value == null ? '' : value).trim()
  if (!raw) return fallback
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, '_')
  return safe.length > 80 ? safe.slice(0, 80) : safe
}

export function buildMediaRef(scope, ownerId, itemId, index = 0) {
  const owner = sanitizeRefSegment(ownerId, 'owner')
  const item = sanitizeRefSegment(itemId, 'item_' + index)
  return `${MEDIA_REF_PREFIX}${scope}:${owner}:${item}`
}

export function resolveContextEntityId(context, fallback = 'global') {
  let cursor = context
  let lastKey = ''
  while (cursor) {
    if (typeof cursor.key === 'string' && cursor.key) {
      lastKey = cursor.key
    }
    const sourceId = String(cursor.source?.id || '').trim()
    if (sourceId) return sourceId
    cursor = cursor.parentContext || null
  }
  return lastKey || fallback
}

export function buildMediaSignature(value) {
  if (isBlobValue(value)) {
    return `blob:${value.type || 'application/octet-stream'}:${value.size}:${value.lastModified || 0}`
  }
  const text = String(value || '')
  if (!text) return '0'
  const len = text.length
  const head = text.slice(0, 48)
  const tail = text.slice(-24)
  return `${len}:${head}:${tail}`
}

export function normalizeMediaBinary(value) {
  return mediaValueToBlob(value)
}

export function shouldUpgradeStoredMediaValue(value) {
  return isInlineImageDataUrl(value) && !isStoredMediaRecord(value)
}
