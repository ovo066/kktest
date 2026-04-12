const MIN_SEGMENT_LEN = 18
const MINIMAX_SEGMENT_MAX = 90
const DEFAULT_SEGMENT_MAX = 180

export function splitForTTS(rawText, maxLen = DEFAULT_SEGMENT_MAX) {
  const text = String(rawText || '').trim()
  if (!text) return []
  if (text.length <= maxLen) return [text]

  const chunks = []
  let remaining = text

  while (remaining.length > maxLen) {
    const window = remaining.slice(0, maxLen + 1)
    let cut = -1
    const punctuation = /[。！？!?；;，,、\n]/g
    let m
    while ((m = punctuation.exec(window)) !== null) {
      const idx = m.index + 1
      if (idx >= MIN_SEGMENT_LEN) cut = idx
    }

    if (cut < 0) {
      const spaceIdx = window.lastIndexOf(' ')
      if (spaceIdx >= MIN_SEGMENT_LEN) {
        cut = spaceIdx + 1
      } else {
        cut = maxLen
      }
    }

    const part = remaining.slice(0, cut).trim()
    if (part) chunks.push(part)
    remaining = remaining.slice(cut).trim()
  }

  if (remaining) chunks.push(remaining)
  return chunks
}

export function splitForVoiceMode(rawText, mode) {
  const normalizedMode = String(mode || '').toLowerCase()
  const maxLen = normalizedMode === 'minimax'
    ? MINIMAX_SEGMENT_MAX
    : DEFAULT_SEGMENT_MAX
  return splitForTTS(rawText, maxLen)
}

export function splitForCallTranscriptPlayback(rawText, mode) {
  const text = String(rawText || '').trim()
  if (!text) return []

  // Keep sentence boundaries aligned with call streaming playback, then apply length splitting.
  const sentenceEnd = /([。！？!?\n])/
  const parts = text.split(sentenceEnd)
  const sentences = []
  let current = ''
  for (let i = 0; i < parts.length; i++) {
    current += parts[i]
    if (sentenceEnd.test(parts[i]) && current.trim()) {
      sentences.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) {
    sentences.push(current.trim())
  }

  const out = []
  for (const sentence of sentences) {
    const chunks = splitForVoiceMode(sentence, mode)
    if (chunks.length) {
      out.push(...chunks)
    }
  }
  return out
}
