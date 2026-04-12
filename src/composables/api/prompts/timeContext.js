import { formatBeijingLocale, getBeijingHour } from '../../../utils/beijingTime'

export function formatTimestampForAI(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return formatBeijingLocale(d, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function normalizeMessageTimestamp(value) {
  if (value == null || value === '') return null
  const asNumber = Number(value)
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function describeTimeGap(gapMs, nowMs) {
  const hours = gapMs / 3600000
  const h = getBeijingHour(new Date(nowMs))
  const period = h < 6 ? '凌晨' : h < 9 ? '早上' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜'

  if (hours < 2) return '聊天中断了一小会儿'
  if (hours < 5) return '过了好几个小时，现在是' + period
  if (hours < 10) return '隔了大半天，现在是' + period
  if (hours < 24) return '隔了差不多一整天，现在是' + period
  const days = Math.floor(hours / 24)
  if (days === 1) return '隔了一天，现在是' + period
  if (days <= 3) return '已经过了' + days + '天，现在是' + period
  return '好几天没聊了（' + days + '天），现在是' + period
}

export function buildTimestampSystemPrompt(messages, options = {}) {
  const {
    longGapThresholdMs = 30 * 60 * 1000
  } = options
  const nowMs = Date.now()
  const now = formatTimestampForAI(nowMs)

  const timeline = Array.isArray(messages)
    ? messages
      .filter(m => m && !m.hideInChat && !m.hidden)
      .map(m => {
        const ts = normalizeMessageTimestamp(m.time)
        return ts ? { role: m.role, time: ts } : null
      })
      .filter(Boolean)
    : []
  const latestMsg = timeline.length > 0 ? timeline[timeline.length - 1] : null
  const previousMsg = timeline.length > 1 ? timeline[timeline.length - 2] : null

  const hasLongGap = latestMsg && previousMsg
    && latestMsg.role === 'user'
    && latestMsg.time >= previousMsg.time
    && (latestMsg.time - previousMsg.time) >= longGapThresholdMs

  if (!hasLongGap) {
    return `<time>${now}</time>`
  }

  const gapMs = latestMsg.time - previousMsg.time
  const scene = describeTimeGap(gapMs, nowMs)
  const lines = [`<time>${now}</time>`]
  if (scene) lines.push(`<time_gap>${scene}</time_gap>`)
  return lines.join('\n')
}

/**
 * 返回结构化时间数据（供 <now> 块合并使用）
 * @returns {{ time: string, gap: string|null }}
 */
export function buildTimestampData(messages, options = {}) {
  const { longGapThresholdMs = 30 * 60 * 1000 } = options
  const nowMs = Date.now()
  const now = formatTimestampForAI(nowMs)

  const timeline = Array.isArray(messages)
    ? messages
      .filter(m => m && !m.hideInChat && !m.hidden)
      .map(m => {
        const ts = normalizeMessageTimestamp(m.time)
        return ts ? { role: m.role, time: ts } : null
      })
      .filter(Boolean)
    : []
  const latestMsg = timeline.length > 0 ? timeline[timeline.length - 1] : null
  const previousMsg = timeline.length > 1 ? timeline[timeline.length - 2] : null

  const hasLongGap = latestMsg && previousMsg
    && latestMsg.role === 'user'
    && latestMsg.time >= previousMsg.time
    && (latestMsg.time - previousMsg.time) >= longGapThresholdMs

  const gap = hasLongGap
    ? describeTimeGap(latestMsg.time - previousMsg.time, nowMs)
    : null

  return { time: now, gap }
}
