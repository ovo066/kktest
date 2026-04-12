const ECHO_SUPPRESS_WINDOW_MS = 2600
const AI_ECHO_MEMORY_LIMIT = 8

export const STT_RESUME_DELAY_MS = 900
export const STT_SILENCE_REPLY_MS = 1400
export const STT_MIN_REPLY_CHARS = 2

export function normalizeSpeechText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s,.!?;:'"()[\]{}\-_/\\，。！？、；：‘’“”【】（）《》…·]/g, '')
    .trim()
}

export function mergeSpeechBuffer(base, incoming) {
  const current = String(base || '').trim()
  const next = String(incoming || '').trim()
  if (!next) return current
  if (!current) return next
  if (current.includes(next)) return current
  if (next.includes(current)) return next
  return `${current} ${next}`.replace(/\s+/g, ' ').trim()
}

export function createCallSpeechEchoGuard() {
  let lastAISpeechAt = 0
  const recentAISentences = []

  function rememberAISentence(text) {
    const normalized = normalizeSpeechText(text)
    if (!normalized) return
    recentAISentences.push(normalized)
    if (recentAISentences.length > AI_ECHO_MEMORY_LIMIT) {
      recentAISentences.shift()
    }
  }

  function markAISpeechEnded() {
    lastAISpeechAt = Date.now()
  }

  function isLikelyEchoText(text) {
    const normalized = normalizeSpeechText(text)
    if (!normalized) return false
    if (!lastAISpeechAt || Date.now() - lastAISpeechAt > ECHO_SUPPRESS_WINDOW_MS) {
      return false
    }
    return recentAISentences.some((item) => {
      if (!item) return false
      if (normalized === item) return true
      if (normalized.length >= 4 && item.includes(normalized)) return true
      if (item.length >= 4 && normalized.includes(item)) return true
      return false
    })
  }

  function resetEchoGuard() {
    lastAISpeechAt = 0
    recentAISentences.length = 0
  }

  return {
    rememberAISentence,
    markAISpeechEnded,
    isLikelyEchoText,
    resetEchoGuard
  }
}
