export const BEIJING_TIME_ZONE = 'Asia/Shanghai'
export const TIME_ZONE_MODE_BEIJING = 'beijing'
export const TIME_ZONE_MODE_DEVICE = 'device'
export const TIME_ZONE_MODE_CUSTOM = 'custom'

const VALID_TIME_ZONE_MODES = new Set([
  TIME_ZONE_MODE_BEIJING,
  TIME_ZONE_MODE_DEVICE,
  TIME_ZONE_MODE_CUSTOM
])

const timeZonePreference = {
  mode: TIME_ZONE_MODE_BEIJING,
  customTimeZone: BEIJING_TIME_ZONE
}

function toDate(input) {
  if (input instanceof Date) return input
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function isValidIanaTimeZone(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function sanitizeIanaTimeZone(value, fallback = BEIJING_TIME_ZONE) {
  const raw = String(value || '').trim()
  if (isValidIanaTimeZone(raw)) return raw
  return isValidIanaTimeZone(fallback) ? String(fallback || '').trim() : BEIJING_TIME_ZONE
}

export function normalizeTimeZoneMode(value) {
  const mode = String(value || '').trim()
  return VALID_TIME_ZONE_MODES.has(mode) ? mode : TIME_ZONE_MODE_BEIJING
}

export function getDeviceTimeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return sanitizeIanaTimeZone(zone, BEIJING_TIME_ZONE)
  } catch {
    return BEIJING_TIME_ZONE
  }
}

export function resolveActiveTimeZone(mode, customTimeZone) {
  const normalizedMode = normalizeTimeZoneMode(mode)
  if (normalizedMode === TIME_ZONE_MODE_DEVICE) {
    return getDeviceTimeZone()
  }
  if (normalizedMode === TIME_ZONE_MODE_CUSTOM) {
    return sanitizeIanaTimeZone(customTimeZone, BEIJING_TIME_ZONE)
  }
  return BEIJING_TIME_ZONE
}

export function setTimeZonePreference(next = {}) {
  const modeInput = Object.prototype.hasOwnProperty.call(next, 'mode')
    ? next.mode
    : timeZonePreference.mode
  const customInput = Object.prototype.hasOwnProperty.call(next, 'customTimeZone')
    ? next.customTimeZone
    : timeZonePreference.customTimeZone

  timeZonePreference.mode = normalizeTimeZoneMode(modeInput)
  timeZonePreference.customTimeZone = sanitizeIanaTimeZone(customInput, BEIJING_TIME_ZONE)
}

export function getTimeZonePreference() {
  return {
    mode: timeZonePreference.mode,
    customTimeZone: timeZonePreference.customTimeZone
  }
}

export function getActiveTimeZone() {
  return resolveActiveTimeZone(timeZonePreference.mode, timeZonePreference.customTimeZone)
}

function getParts(date = new Date(), timeZone = getActiveTimeZone()) {
  const d = toDate(date)
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  const parts = formatter.formatToParts(d)
  const map = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return {
    year: map.year || '1970',
    month: map.month || '01',
    day: map.day || '01',
    hour: map.hour || '00',
    minute: map.minute || '00'
  }
}

function getTimeZoneOffsetMs(date, timeZone) {
  const d = toDate(date)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
  const parts = formatter.formatToParts(d)
  const map = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const year = Number(map.year || 1970)
  const month = Number(map.month || 1)
  const day = Number(map.day || 1)
  const hour = Number(map.hour || 0)
  const minute = Number(map.minute || 0)
  const second = Number(map.second || 0)
  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  return asUtcMs - d.getTime()
}

function parseDateKey(key) {
  const raw = String(key || '').trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

function getDayStartTimestampByDateKey(dateKey, timeZone) {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return Date.now()

  const { year, month, day } = parsed
  const targetUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0)
  let result = targetUtcMs

  // Iterate once or twice to account for DST offsets in custom zones.
  for (let i = 0; i < 2; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(result), timeZone)
    const next = targetUtcMs - offset
    if (next === result) break
    result = next
  }

  return result
}

export function getDateParts(date = new Date()) {
  const p = getParts(date)
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute)
  }
}

export function getHour(date = new Date()) {
  return Number(getParts(date).hour)
}

export function getTimeHHMM(date = new Date()) {
  const p = getParts(date)
  return `${p.hour}:${p.minute}`
}

export function toDateKey(date = new Date()) {
  const p = getParts(date)
  return `${p.year}-${p.month}-${p.day}`
}

export function formatLocale(date = new Date(), options = {}) {
  const d = toDate(date)
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: getActiveTimeZone(),
    ...options
  }).format(d)
}

export function getWeekdayIndex(date = new Date()) {
  const d = toDate(date)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: getActiveTimeZone(),
    weekday: 'short'
  }).format(d)
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[weekday] ?? 0
}

export function getDayStartTimestamp(nowMs = Date.now()) {
  const d = toDate(nowMs)
  const timeZone = getActiveTimeZone()
  const key = toDateKey(d)
  return getDayStartTimestampByDateKey(key, timeZone)
}

// Backward-compatible aliases for existing imports.
export function getBeijingDateParts(date = new Date()) { return getDateParts(date) }
export function getBeijingHour(date = new Date()) { return getHour(date) }
export function getBeijingTimeHHMM(date = new Date()) { return getTimeHHMM(date) }
export function toBeijingDateKey(date = new Date()) { return toDateKey(date) }
export function formatBeijingLocale(date = new Date(), options = {}) { return formatLocale(date, options) }
export function getBeijingWeekdayIndex(date = new Date()) { return getWeekdayIndex(date) }
export function getBeijingDayStartTimestamp(nowMs = Date.now()) { return getDayStartTimestamp(nowMs) }
