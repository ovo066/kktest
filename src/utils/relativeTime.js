const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime()
  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : NaN
}

export function formatRelativeTime(value, {
  short = false,
  maxRelativeDays = short ? Number.POSITIVE_INFINITY : 30,
  now = Date.now(),
  dateLocale,
  dateOptions
} = {}) {
  const timestamp = toTimestamp(value)
  const current = toTimestamp(now)
  if (!Number.isFinite(timestamp) || !Number.isFinite(current)) return ''

  const diff = Math.max(0, current - timestamp)
  if (short) {
    if (diff < MINUTE_MS) return '1m'
    if (diff < HOUR_MS) return Math.floor(diff / MINUTE_MS) + 'm'
    if (diff < DAY_MS) return Math.floor(diff / HOUR_MS) + 'h'
    return Math.floor(diff / DAY_MS) + 'd'
  }

  if (diff < MINUTE_MS) return '刚刚'
  if (diff < HOUR_MS) return Math.floor(diff / MINUTE_MS) + '分钟前'
  if (diff < DAY_MS) return Math.floor(diff / HOUR_MS) + '小时前'

  if (Number.isFinite(maxRelativeDays) && maxRelativeDays > 0) {
    const days = Math.floor(diff / DAY_MS)
    if (days <= maxRelativeDays) return days + '天前'
  }

  return new Date(timestamp).toLocaleDateString(dateLocale, dateOptions)
}

