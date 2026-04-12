/**
 * 通话消息解析器
 * 从 AI 流式输出中提取 [emotion:xxx] 标签和对话文本
 */

const EMOTION_REGEX = /\[\s*emotion\s*[:：]\s*([^\]\r\n]+?)\s*\]/gi
const CALL_CONTROL_REGEX = /\[\s*call\s*[:：]\s*(end|hangup|reject|decline|cancel|refuse)\s*(?:[:：]\s*([^\]]+))?\s*\]/gi
const VALID_EMOTIONS = new Set([
  'normal', 'happy', 'sad', 'surprised', 'angry', 'shy', 'thinking', 'laughing',
  'excited', 'worried', 'confused', 'love', 'sleepy', 'proud', 'nervous'
])

function normalizeCallAction(rawAction) {
  const value = String(rawAction || '').trim().toLowerCase()
  if (!value) return null
  if (value === 'end' || value === 'hangup') return 'end'
  if (value === 'reject' || value === 'decline' || value === 'cancel' || value === 'refuse') return 'reject'
  return null
}

function parseLastCallAction(content) {
  if (!content || typeof content !== 'string') return null

  CALL_CONTROL_REGEX.lastIndex = 0
  let match
  let action = null
  while ((match = CALL_CONTROL_REGEX.exec(content)) !== null) {
    const normalized = normalizeCallAction(match[1])
    if (!normalized) continue
    action = {
      action: normalized,
      reason: String(match[2] || '').trim()
    }
  }

  return action
}

function stripCallControlTags(content) {
  if (!content || typeof content !== 'string') return ''
  return content.replace(CALL_CONTROL_REGEX, '').trim()
}

export function parseCallContent(content) {
  if (!content || typeof content !== 'string') {
    return { segments: [], lastEmotion: 'normal', callAction: null }
  }

  const callAction = parseLastCallAction(content)
  const normalizedContent = stripCallControlTags(content)
  const segments = []
  let currentEmotion = 'normal'
  let lastIndex = 0

  EMOTION_REGEX.lastIndex = 0

  let match
  while ((match = EMOTION_REGEX.exec(normalizedContent)) !== null) {
    const textBefore = normalizedContent.slice(lastIndex, match.index).trim()
    if (textBefore) {
      segments.push({ emotion: currentEmotion, text: textBefore })
    }

    const emotion = match[1].toLowerCase()
    currentEmotion = VALID_EMOTIONS.has(emotion) ? emotion : 'normal'
    lastIndex = match.index + match[0].length
  }

  const remaining = normalizedContent.slice(lastIndex).trim()
  if (remaining) {
    segments.push({ emotion: currentEmotion, text: remaining })
  }

  return {
    segments,
    lastEmotion: currentEmotion,
    callAction
  }
}

export function extractCompleteSentences(buffer) {
  if (!buffer) return { sentences: [], remainder: '', emotion: null, callAction: null }

  let emotion = null
  const callAction = parseLastCallAction(buffer)
  let cleaned = stripCallControlTags(buffer)

  EMOTION_REGEX.lastIndex = 0
  let match
  while ((match = EMOTION_REGEX.exec(buffer)) !== null) {
    const em = match[1].toLowerCase()
    if (VALID_EMOTIONS.has(em)) emotion = em
  }

  cleaned = cleaned.replace(EMOTION_REGEX, '').trim()

  const sentenceEnd = /([。！？!?\n])/
  const parts = cleaned.split(sentenceEnd)

  const sentences = []
  let current = ''
  for (let i = 0; i < parts.length; i++) {
    current += parts[i]
    if (sentenceEnd.test(parts[i]) && current.trim()) {
      sentences.push(current.trim())
      current = ''
    }
  }

  return {
    sentences,
    remainder: current.trim(),
    emotion,
    callAction
  }
}

export function cleanCallText(text) {
  if (!text) return ''
  return stripCallControlTags(text).replace(EMOTION_REGEX, '').trim()
}
