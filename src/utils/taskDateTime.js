import { toLocalDateKey } from './dateKey'

const EMPTY_RESULT = {
  matched: false,
  cleanedText: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  allDay: false,
  kind: 'todo',
  matchedFragments: []
}

const TIME_PERIOD_PATTERN = '凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|夜里'
const TIME_VALUE_REGEX = '[0-9零〇一二两三四五六七八九十]{1,3}(?:[:：][0-9零〇一二两三四五六七八九十]{1,2}|点(?:半|一刻|三刻|(?:\\d{1,2}分?|[零〇一二两三四五六七八九十]{1,2}分))?|时(?:\\d{1,2}分?|[零〇一二两三四五六七八九十]{1,2}分)?)'
const TIME_RANGE_REGEX = new RegExp(`(${TIME_PERIOD_PATTERN})?\\s*(${TIME_VALUE_REGEX})\\s*(?:到|至|\\-|~|～|—)\\s*(${TIME_PERIOD_PATTERN})?\\s*(${TIME_VALUE_REGEX})`)
const SINGLE_TIME_REGEX = new RegExp(`(${TIME_PERIOD_PATTERN})?\\s*(${TIME_VALUE_REGEX})`)
const ANNIVERSARY_REGEX = /生日|纪念日|周年|诞辰|忌日/i
const WEEKDAY_MAP = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
  末: 6
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\u3000/g, ' ')
    .replace(/[，]/g, '，')
    .replace(/[：]/g, ':')
}

function normalizeFragment(text) {
  return String(text || '').replace(/\s+/g, '').trim()
}

function parseChineseNumber(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) return NaN
  if (/^\d+$/.test(raw)) return Number(raw)

  const map = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  }

  const normalized = raw.replace(/两/g, '二').replace(/〇/g, '零')
  if (!/^[零一二三四五六七八九十]+$/.test(normalized)) return NaN
  if (normalized === '十') return 10

  const tenIndex = normalized.indexOf('十')
  if (tenIndex !== -1) {
    const left = normalized.slice(0, tenIndex)
    const right = normalized.slice(tenIndex + 1)
    const tens = left ? map[left] : 1
    const units = right ? map[right] : 0
    return (Number.isFinite(tens) ? tens : NaN) * 10 + (Number.isFinite(units) ? units : 0)
  }

  if (normalized.length === 1) return map[normalized]
  return NaN
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(`${year}-${pad2(month)}-${pad2(day)}T12:00:00`)
  return (
    Number.isFinite(probe.getTime()) &&
    probe.getFullYear() === year &&
    probe.getMonth() + 1 === month &&
    probe.getDate() === day
  )
}

function createDateKey(year, month, day) {
  if (!isValidDateParts(year, month, day)) return ''
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function keyToDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`)
}

function addDays(dateKey, days) {
  if (!dateKey) return ''
  const next = keyToDate(dateKey)
  next.setDate(next.getDate() + Number(days || 0))
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`
}

function getCurrentYear(now) {
  const todayKey = toLocalDateKey(now)
  const [year] = String(todayKey).split('-')
  return Number(year || new Date(now).getFullYear())
}

function getWeekMonday(dateKey) {
  const current = keyToDate(dateKey)
  const jsWeekday = current.getDay()
  const mondayOffset = jsWeekday === 0 ? -6 : 1 - jsWeekday
  current.setDate(current.getDate() + mondayOffset)
  return `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`
}

function computeWeekdayDateKey(todayKey, weekday, mode = '') {
  const monday = getWeekMonday(todayKey)
  const targetOffset = weekday === 0 ? 6 : weekday - 1
  const thisWeekTarget = addDays(monday, targetOffset)

  if (mode === 'this') return thisWeekTarget
  if (mode === 'next') return addDays(thisWeekTarget, 7)
  if (mode === 'next2') return addDays(thisWeekTarget, 14)
  if (thisWeekTarget < todayKey) return addDays(thisWeekTarget, 7)
  return thisWeekTarget
}

function normalizeMinute(value) {
  const n = parseChineseNumber(value)
  if (!Number.isFinite(n) || n < 0 || n > 59) return NaN
  return n
}

function applyTimePeriod(hour, period = '') {
  const normalized = String(period || '').trim()
  if (!normalized) return hour

  if (/凌晨/.test(normalized)) {
    return hour === 12 ? 0 : hour
  }

  if (/早上|早晨|清晨|上午/.test(normalized)) {
    return hour === 12 ? 0 : hour
  }

  if (/中午/.test(normalized)) {
    if (hour >= 1 && hour <= 10) return hour + 12
    return hour
  }

  if (/下午|傍晚|晚上|今晚|夜里/.test(normalized)) {
    if (hour < 12) return hour + 12
    return hour
  }

  return hour
}

function parseSingleTimeToken(rawValue, period = '') {
  const raw = String(rawValue || '').trim()
  if (!raw) return null

  let hour = NaN
  let minute = 0

  const colonMatch = raw.match(/^([0-9零〇一二两三四五六七八九十]{1,3})[:：]([0-9零〇一二两三四五六七八九十]{1,2})$/)
  if (colonMatch) {
    hour = parseChineseNumber(colonMatch[1])
    minute = normalizeMinute(colonMatch[2])
  } else {
    const dotMatch = raw.match(/^([0-9零〇一二两三四五六七八九十]{1,3})(?:点|时)(半|一刻|三刻|(?:\d{1,2}分?|[零〇一二两三四五六七八九十]{1,2}分))?$/)
    if (!dotMatch) return null
    hour = parseChineseNumber(dotMatch[1])
    const minuteToken = String(dotMatch[2] || '').trim()
    if (!minuteToken) {
      minute = 0
    } else if (minuteToken === '半') {
      minute = 30
    } else if (minuteToken === '一刻') {
      minute = 15
    } else if (minuteToken === '三刻') {
      minute = 45
    } else {
      minute = normalizeMinute(minuteToken.replace(/分$/, ''))
    }
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  hour = applyTimePeriod(hour, period)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${pad2(hour)}:${pad2(minute)}`
}

function parseTimeInfo(text) {
  const content = normalizeText(text)
  if (!content.trim()) return { startTime: '', endTime: '', matchedFragments: [] }

  const rangeMatch = content.match(TIME_RANGE_REGEX)
  if (rangeMatch) {
    let startPeriod = rangeMatch[1] || ''
    const startToken = rangeMatch[2] || ''
    let endPeriod = rangeMatch[3] || ''
    const endToken = rangeMatch[4] || ''

    if (!startPeriod && endPeriod) startPeriod = endPeriod
    const startTime = parseSingleTimeToken(startToken, startPeriod)
    const endTime = parseSingleTimeToken(endToken, endPeriod || startPeriod)
    if (startTime && endTime) {
      return {
        startTime,
        endTime,
        matchedFragments: [String(rangeMatch[0] || '').trim()].filter(Boolean)
      }
    }
  }

  const singleMatch = content.match(SINGLE_TIME_REGEX)
  if (singleMatch) {
    const startTime = parseSingleTimeToken(singleMatch[2], singleMatch[1])
    if (startTime) {
      return {
        startTime,
        endTime: '',
        matchedFragments: [String(singleMatch[0] || '').trim()].filter(Boolean)
      }
    }
  }

  return { startTime: '', endTime: '', matchedFragments: [] }
}

function parseAbsoluteDate(text, now) {
  const content = normalizeText(text)
  const yearMonthDay = content.match(/(\d{4})\s*[年/-]\s*(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*(?:日|号)?/)
  if (yearMonthDay) {
    const dateKey = createDateKey(Number(yearMonthDay[1]), Number(yearMonthDay[2]), Number(yearMonthDay[3]))
    if (dateKey) {
      return { startDate: dateKey, matchedFragments: [String(yearMonthDay[0] || '').trim()] }
    }
  }

  const monthDay = content.match(/(\d{1,2})\s*(?:月|\/)\s*(\d{1,2})\s*(?:日|号)?/)
  if (monthDay) {
    const year = getCurrentYear(now)
    const dateKey = createDateKey(year, Number(monthDay[1]), Number(monthDay[2]))
    if (dateKey) {
      return { startDate: dateKey, matchedFragments: [String(monthDay[0] || '').trim()] }
    }
  }

  return null
}

function parseRelativeDate(text, now) {
  const content = normalizeText(text)
  const todayKey = toLocalDateKey(now)

  const relativeRules = [
    { regex: /大后天/, days: 3 },
    { regex: /后天/, days: 2 },
    { regex: /明天|明早|明晨|明晚/, days: 1 },
    { regex: /今天|今晚|今早|今晨|今日/, days: 0 }
  ]

  for (const rule of relativeRules) {
    const matched = content.match(rule.regex)
    if (matched) {
      return {
        startDate: addDays(todayKey, rule.days),
        matchedFragments: [String(matched[0] || '').trim()]
      }
    }
  }

  const weekdayMatch = content.match(/(?:(下下|下|这|本)周|(周|星期))([一二三四五六日天末])/)
  if (weekdayMatch) {
    const prefix = weekdayMatch[1] || ''
    const weekdayToken = weekdayMatch[3]
    const weekday = WEEKDAY_MAP[weekdayToken]
    if (weekday == null) return null

    let mode = ''
    if (prefix === '下') mode = 'next'
    else if (prefix === '下下') mode = 'next2'
    else if (prefix === '这' || prefix === '本') mode = 'this'
    const startDate = computeWeekdayDateKey(todayKey, weekday, mode)
    if (startDate) {
      return {
        startDate,
        matchedFragments: [String(weekdayMatch[0] || '').trim()]
      }
    }
  }

  const weekendMatch = content.match(/(?:下下|下|这|本)?周末/)
  if (weekendMatch) {
    const token = String(weekendMatch[0] || '').trim()
    let mode = ''
    if (token.startsWith('下下')) mode = 'next2'
    else if (token.startsWith('下')) mode = 'next'
    else if (token.startsWith('这') || token.startsWith('本')) mode = 'this'
    const startDate = computeWeekdayDateKey(todayKey, 6, mode)
    if (startDate) {
      return {
        startDate,
        matchedFragments: [token]
      }
    }
  }

  return null
}

function stripFragments(text, fragments = []) {
  let next = String(text || '')
  const normalizedFragments = Array.from(new Set(
    fragments
      .map(fragment => String(fragment || '').trim())
      .filter(Boolean)
  )).sort((a, b) => b.length - a.length)

  normalizedFragments.forEach((fragment) => {
    if (!fragment) return
    next = next.replace(fragment, ' ')
  })

  return next
    .replace(/\s+/g, ' ')
    .replace(/^[，,。；;:：、\-~～—\s]+/, '')
    .replace(/[，,。；;:：、\-~～—\s]+$/, '')
    .trim()
}

function mergeFragments(...groups) {
  return Array.from(new Set(
    groups.flat().map(normalizeFragment).filter(Boolean)
  ))
}

export function extractTaskScheduleFromText(text, options = {}) {
  const content = normalizeText(text)
  if (!content.trim()) {
    return {
      ...EMPTY_RESULT,
      cleanedText: ''
    }
  }

  const now = options.now || new Date()
  const kind = ANNIVERSARY_REGEX.test(content) ? 'anniversary' : 'todo'

  const absolute = parseAbsoluteDate(content, now)
  const relative = absolute ? null : parseRelativeDate(content, now)
  const timeInfo = parseTimeInfo(content)

  const startDate = absolute?.startDate || relative?.startDate || ''
  const startTime = timeInfo.startTime || ''
  const endTime = timeInfo.endTime || ''
  const matchedFragments = mergeFragments(
    absolute?.matchedFragments || [],
    relative?.matchedFragments || [],
    timeInfo.matchedFragments || []
  )
  const cleanedText = stripFragments(content, matchedFragments)

  return {
    matched: Boolean(startDate || startTime),
    cleanedText,
    startDate,
    endDate: startDate,
    startTime,
    endTime,
    allDay: Boolean(startDate) && !startTime,
    kind,
    matchedFragments
  }
}

export function mergeTaskScheduleDetections(primary, secondary, options = {}) {
  const first = primary || EMPTY_RESULT
  const second = secondary || EMPTY_RESULT
  const fallbackTitle = String(options.fallbackTitle || '').trim()
  const startDate = first.startDate || second.startDate || ''
  const endDate = first.endDate || second.endDate || startDate
  const startTime = first.startTime || second.startTime || ''
  const endTime = first.endTime || second.endTime || ''
  const cleanedText = first.cleanedText || fallbackTitle
  const kind = first.kind === 'anniversary' || second.kind === 'anniversary'
    ? 'anniversary'
    : (first.kind || second.kind || 'todo')

  return {
    matched: Boolean(startDate || startTime || first.matched || second.matched),
    cleanedText,
    startDate,
    endDate,
    startTime,
    endTime,
    allDay: Boolean(startDate) && !startTime,
    kind,
    matchedFragments: mergeFragments(first.matchedFragments || [], second.matchedFragments || [])
  }
}

export function formatTaskScheduleLabel(detection) {
  if (!detection?.startDate) return ''
  const [year, month, day] = String(detection.startDate).split('-').map(value => Number(value))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ''

  let label = `${month}月${day}日`
  if (detection.endDate && detection.endDate !== detection.startDate) {
    const [, endMonth, endDay] = String(detection.endDate).split('-').map(value => Number(value))
    label += ` - ${endMonth}月${endDay}日`
  }
  if (detection.startTime) {
    label += ` ${detection.startTime}`
    if (detection.endTime) label += `-${detection.endTime}`
  } else {
    label += ' 全天'
  }
  if (detection.kind === 'anniversary') {
    label = `纪念日 · ${label}`
  }
  return label
}
