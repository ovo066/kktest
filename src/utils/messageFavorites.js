import { parseMessageContent } from '../features/chat'

export const FAVORITE_PART_WHOLE_MESSAGE = 'message'

export function normalizeFavoritePartIndex(partIndex) {
  if (partIndex == null || partIndex === '') return null
  const value = Number(partIndex)
  return Number.isInteger(value) && value >= 0 ? value : null
}

export function favoritePartIndexToKey(partIndex) {
  const normalized = normalizeFavoritePartIndex(partIndex)
  return normalized == null ? FAVORITE_PART_WHOLE_MESSAGE : String(normalized)
}

export function favoritePartKeyToIndex(partKey) {
  const text = String(partKey ?? '').trim()
  if (!text || text === FAVORITE_PART_WHOLE_MESSAGE) return null
  return normalizeFavoritePartIndex(text)
}

function sanitizeFavoritePartIndexes(partIndexes) {
  if (!Array.isArray(partIndexes)) return []
  const seen = new Set()
  const result = []

  for (const item of partIndexes) {
    const normalized = normalizeFavoritePartIndex(item)
    const key = favoritePartIndexToKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function getExplicitFavoritePartIndexes(message) {
  return sanitizeFavoritePartIndexes(message?.favoritePartIndexes)
}

export function getStoredFavoritePartIndexes(message) {
  const explicit = getExplicitFavoritePartIndexes(message)
  if (explicit.length > 0) return explicit
  return message?.favorited ? [null] : []
}

export function isMessagePartFavorited(message, partIndex) {
  const normalized = normalizeFavoritePartIndex(partIndex)
  const explicit = getExplicitFavoritePartIndexes(message)
  if (explicit.length > 0) {
    return explicit.some(item => item === normalized)
  }
  return !!message?.favorited
}

export function setMessagePartFavorited(message, partIndex, favorited) {
  if (!message || typeof message !== 'object') return false

  const normalized = normalizeFavoritePartIndex(partIndex)
  const explicit = getExplicitFavoritePartIndexes(message)
  const hadState = explicit.length > 0
    ? explicit.some(item => item === normalized)
    : !!message.favorited

  if (!!favorited === hadState) {
    return hadState
  }

  if (favorited) {
    const next = explicit.slice()
    if (!next.some(item => item === normalized)) {
      next.push(normalized)
    }
    message.favoritePartIndexes = sanitizeFavoritePartIndexes(next)
    message.favorited = false
    return true
  }

  if (explicit.length > 0) {
    message.favoritePartIndexes = explicit.filter(item => item !== normalized)
  } else {
    message.favorited = false
    message.favoritePartIndexes = []
  }

  return false
}

export function toggleMessagePartFavorite(message, partIndex) {
  const next = !isMessagePartFavorited(message, partIndex)
  setMessagePartFavorited(message, partIndex, next)
  return next
}

export function getLastFavoriteEligiblePartIndex(message) {
  if (!message || typeof message !== 'object') return null
  if (
    message.isImage ||
    message.isSticker ||
    message.isCallRecord ||
    message.isMockImage ||
    message.isImageRendering
  ) {
    return null
  }

  const rawContent = String((message.displayContent ?? message.content) ?? '').trim()
  if (!rawContent) return null

  const parts = parseMessageContent(rawContent, {
    allowStickers: true,
    allowTransfer: true,
    allowGift: true,
    allowVoice: true,
    allowCall: true,
    allowMockImage: true,
    allowMusic: true,
    allowMeet: true,
    allowNarration: true
  })

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index]?.type !== 'narration') {
      return index
    }
  }

  return null
}
