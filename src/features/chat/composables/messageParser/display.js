const REPLY_PREVIEW_BREAK_REGEX = /\r\n?|\u0085|\u2028|\u2029/g
const REPLY_PREVIEW_MAX_CHARS = 140

export function formatTimeShort(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

export function formatTimestampDisplay(ts, prevTs) {
  const d = new Date(ts)
  const timeText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (!prevTs || !isSameDay(prevTs, ts)) {
    const dateText = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    return dateText + ' ' + timeText
  }
  return timeText
}

export function normalizeReplyPreviewText(text) {
  const normalized = String(text ?? '')
    .replace(REPLY_PREVIEW_BREAK_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''
  if (normalized.length <= REPLY_PREVIEW_MAX_CHARS) return normalized
  return normalized.slice(0, REPLY_PREVIEW_MAX_CHARS).trimEnd() + '…'
}

function normalizeUserReadStatus(message) {
  const raw = String(message?.readStatus || '').trim().toLowerCase()
  if (raw === 'read') return 'read'
  if (raw === 'unread') return 'unread'
  if (Number.isFinite(Number(message?.readAt)) && Number(message.readAt) > 0) return 'read'
  return 'read'
}

export function formatTailMetaText(message, isUser) {
  const ts = Number(message?.time || 0)
  const t = formatTimeShort(ts)
  if (!t) return ''
  if (!isUser) return t
  const readStatus = normalizeUserReadStatus(message)
  return t + (readStatus === 'read' ? ' 已读' : ' 未读')
}
