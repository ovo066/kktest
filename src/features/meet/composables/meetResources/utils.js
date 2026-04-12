// @ts-check

const WEAK_WORDS = new Set([
  'the', 'a', 'an', 'at', 'in', 'on', 'of', 'for', 'and', 'or', 'scene', 'background',
  'with', 'without', 'very', 'new', 'meet', 'date', 'romantic'
])

export function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

export function normalizeText(value) {
  return String(value || '').trim()
}

export function normalizeExpression(value) {
  const text = normalizeText(value).toLowerCase()
  return text || 'normal'
}

export function lower(value) {
  return normalizeText(value).toLowerCase()
}

export function isDirectUrl(value) {
  const text = normalizeText(value)
  if (!text) return false
  return /^(https?:|data:|blob:)/i.test(text)
}

export function hashString(value) {
  const text = String(value || '')
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function tokenizeText(value) {
  return lower(value)
    .split(/[\s,，.:;|/\\_()[\]{}'\"`!?]+/g)
    .map(t => t.trim())
    .filter(t => t && !WEAK_WORDS.has(t))
}

