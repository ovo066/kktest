import { Redis } from '@upstash/redis'

const DEFAULT_STORAGE_PREFIX = 'aichat_access_guard'
const DEFAULT_ACCESS_ANNOUNCEMENT = {
  id: '2026-04-02-kaka-chat-notice',
  title: '关于kaka chat的公告',
  body: [
    'Kaka小手机完全免费！获取渠道仅限：',
    'Discord社区 - 旅程 / 尾巴镇 / 喵喵电波',
    '',
    '❌ 闲鱼、淘宝等平台的付费售卖均为盗版倒卖',
    '❌ 禁止二次传播和商业盈利',
    '谢绝任何形式的二传和私自售卖！',
    '如果你是在闲鱼之类的地方花钱买到它的，请立刻去退款并反手给卖家一个举报！千万不要让倒卖黑心商贩得逞！',
    '（ps：已经被打包进大礼包挂到闲鱼卖了，在考虑是否关停链接....）'
  ].join('\n'),
  publishedAt: '2026-04-02',
  buttonText: '我知道了'
}

let cachedRedisClient = null
let cachedRedisKey = ''

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTimestamp(value, fallback = 0) {
  const timestamp = Number(value || 0)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return fallback
  return Math.round(timestamp)
}

function normalizeDeviceRecord(record = {}, fallbacks = {}) {
  return {
    deviceId: normalizeText(record.deviceId || fallbacks.deviceId),
    deviceName: normalizeText(record.deviceName || fallbacks.deviceName),
    provider: normalizeText(record.provider || fallbacks.provider),
    userId: normalizeText(record.userId || fallbacks.userId),
    username: normalizeText(record.username || fallbacks.username),
    globalName: normalizeText(record.globalName || fallbacks.globalName),
    ruleLabel: normalizeText(record.ruleLabel || fallbacks.ruleLabel),
    claimedAt: normalizeTimestamp(record.claimedAt, fallbacks.claimedAt || Date.now()),
    lastSeenAt: normalizeTimestamp(record.lastSeenAt, fallbacks.lastSeenAt || Date.now()),
    userAgent: normalizeText(record.userAgent || fallbacks.userAgent).slice(0, 180),
    ip: normalizeText(record.ip || fallbacks.ip)
  }
}

function readJsonValue(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function getRedisConfig(env = process.env) {
  const url = normalizeText(env?.storageUrl || env?.UPSTASH_REDIS_REST_URL)
  const token = normalizeText(env?.storageToken || env?.UPSTASH_REDIS_REST_TOKEN)
  return { url, token }
}

function getRedisClient(env = process.env) {
  const { url, token } = getRedisConfig(env)
  if (!url || !token) return null

  const cacheKey = `${url}::${token}`
  if (!cachedRedisClient || cachedRedisKey !== cacheKey) {
    cachedRedisClient = new Redis({ url, token })
    cachedRedisKey = cacheKey
  }

  return cachedRedisClient
}

function getStoragePrefix(env = process.env) {
  return normalizeText(env?.storagePrefix || env?.ACCESS_GUARD_STORAGE_PREFIX) || DEFAULT_STORAGE_PREFIX
}

function buildDevicesKey(env, provider, userId) {
  return `${getStoragePrefix(env)}:devices:${normalizeText(provider)}:${normalizeText(userId)}`
}

function getDevicesScanPattern(env) {
  return `${getStoragePrefix(env)}:devices:*`
}

function parseDevicesKey(env, storageKey = '') {
  const prefix = `${getStoragePrefix(env)}:devices:`
  const normalizedKey = normalizeText(storageKey)
  if (!normalizedKey.startsWith(prefix)) return null

  const remainder = normalizedKey.slice(prefix.length)
  const separatorIndex = remainder.indexOf(':')
  if (separatorIndex <= 0) return null

  const provider = normalizeText(remainder.slice(0, separatorIndex))
  const userId = normalizeText(remainder.slice(separatorIndex + 1))
  if (!provider || !userId) return null

  return { provider, userId }
}

function sortDeviceRecords(records = []) {
  return [...records].sort((left, right) => {
    const claimedDiff = normalizeTimestamp(right?.claimedAt) - normalizeTimestamp(left?.claimedAt)
    if (claimedDiff !== 0) return claimedDiff
    return normalizeText(left?.deviceId).localeCompare(normalizeText(right?.deviceId))
  })
}

function buildDeviceAccountLabel(device = null, fallbackUserId = '') {
  if (!device || typeof device !== 'object') return normalizeText(fallbackUserId)

  const globalName = normalizeText(device.globalName)
  const username = normalizeText(device.username)
  if (globalName && username && globalName.toLowerCase() !== username.toLowerCase()) {
    return `${globalName} (@${username})`
  }
  if (globalName) return globalName
  if (username) return `@${username}`
  return normalizeText(fallbackUserId)
}

function buildAnnouncementKey(env) {
  return normalizeText(env?.announcementKey || env?.ACCESS_GUARD_ANNOUNCEMENT_KEY)
    || `${getStoragePrefix(env)}:announcement:current`
}

function normalizeAnnouncement(input) {
  let source = input
  if (typeof source === 'string') {
    const raw = normalizeText(source)
    if (!raw) return null
    try {
      source = JSON.parse(raw)
    } catch {
      source = { body: raw }
    }
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) return null

  const title = normalizeText(source.title) || '公告'
  const body = String(source.body ?? source.content ?? '').trim()
  const changelog = Array.isArray(source.changelog)
    ? source.changelog
      .map((item) => normalizeText(typeof item === 'string' ? item : item?.text || item?.label))
      .filter(Boolean)
    : []
  const publishedAt = normalizeText(source.publishedAt)
  const id = normalizeText(source.id)
    || normalizeText(source.version)
    || [publishedAt, title, body, ...changelog].filter(Boolean).join('|').slice(0, 180)

  if (!id) return null

  return {
    id,
    title,
    body,
    changelog,
    publishedAt,
    force: !!source.force,
    buttonText: normalizeText(source.buttonText) || '我知道了'
  }
}

const claimDeviceScript = `
local key = KEYS[1]
local field = ARGV[1]
local value = ARGV[2]
local limit = tonumber(ARGV[3])

if redis.call("HEXISTS", key, field) == 1 then
  redis.call("HSET", key, field, value)
  return {1, redis.call("HLEN", key)}
end

local count = redis.call("HLEN", key)
if count >= limit then
  return {0, count}
end

redis.call("HSET", key, field, value)
return {1, count + 1}
`

export async function claimAccessDeviceSlot(env, session, device = {}) {
  const redis = getRedisClient(env)
  if (!redis) {
    return { ok: false, reason: 'device_binding_unavailable' }
  }

  const provider = normalizeText(session?.provider || 'discord')
  const userId = normalizeText(session?.userId)
  const deviceId = normalizeText(device.deviceId)
  if (!provider || !userId || !deviceId) {
    return { ok: false, reason: 'device_binding_unavailable' }
  }

  const slotLimit = Math.max(0, Number(env?.deviceSlotLimit || 0) || 0)
  if (slotLimit <= 0) {
    return { ok: false, reason: 'device_binding_unavailable' }
  }

  const storageKey = buildDevicesKey(env, provider, userId)
  const now = Date.now()
  const nextRecord = normalizeDeviceRecord({
    deviceId,
    deviceName: device.deviceName,
    provider,
    userId,
    username: session?.username,
    globalName: session?.globalName,
    ruleLabel: session?.ruleLabel,
    claimedAt: now,
    lastSeenAt: now,
    userAgent: device.userAgent,
    ip: device.ip
  })

  const existing = readJsonValue(await redis.hget(storageKey, deviceId))
  if (existing) {
    const merged = normalizeDeviceRecord(existing, {
      ...nextRecord,
      claimedAt: normalizeTimestamp(existing.claimedAt, now)
    })
    await redis.hset(storageKey, {
      [deviceId]: JSON.stringify(merged)
    })
    const slotCount = Math.max(0, Number(await redis.hlen(storageKey)) || 0)
    return {
      ok: true,
      slotCount,
      slotLimit,
      device: merged
    }
  }

  const script = redis.createScript(claimDeviceScript)
  const result = await script.exec(
    [storageKey],
    [deviceId, JSON.stringify(nextRecord), String(slotLimit)]
  )
  const [claimedRaw, slotCountRaw] = Array.isArray(result) ? result : [0, 0]
  const claimed = Number(claimedRaw || 0) === 1
  const slotCount = Math.max(0, Number(slotCountRaw || 0) || 0)

  if (!claimed) {
    return {
      ok: false,
      reason: 'device_limit_reached',
      slotCount,
      slotLimit
    }
  }

  return {
    ok: true,
    slotCount,
    slotLimit,
    device: nextRecord
  }
}

export async function readAccessDeviceRegistration(env, session, deviceId = '') {
  const redis = getRedisClient(env)
  if (!redis) return null

  const provider = normalizeText(session?.provider || 'discord')
  const userId = normalizeText(session?.userId)
  if (!provider || !userId) return null

  const storageKey = buildDevicesKey(env, provider, userId)
  const normalizedDeviceId = normalizeText(deviceId)
  const [slotCountRaw, storedRecord] = await Promise.all([
    redis.hlen(storageKey),
    normalizedDeviceId ? redis.hget(storageKey, normalizedDeviceId) : Promise.resolve(null)
  ])
  const parsedRecord = normalizedDeviceId ? readJsonValue(storedRecord) : null

  return {
    slotCount: Math.max(0, Number(slotCountRaw || 0) || 0),
    slotLimit: Math.max(0, Number(env?.deviceSlotLimit || 0) || 0),
    found: !!parsedRecord,
    device: normalizedDeviceId && parsedRecord
      ? normalizeDeviceRecord(parsedRecord, {
          deviceId: normalizedDeviceId,
          provider,
          userId
        })
      : null
  }
}

export async function readAccessDevicesForSession(env, session) {
  const redis = getRedisClient(env)
  const slotLimit = Math.max(0, Number(env?.deviceSlotLimit || 0) || 0)
  if (!redis) {
    return {
      ok: false,
      reason: 'device_binding_unavailable',
      slotCount: 0,
      slotLimit,
      devices: []
    }
  }

  const provider = normalizeText(session?.provider || 'discord')
  const userId = normalizeText(session?.userId)
  if (!provider || !userId) {
    return {
      ok: false,
      reason: 'device_binding_unavailable',
      slotCount: 0,
      slotLimit,
      devices: []
    }
  }

  const storageKey = buildDevicesKey(env, provider, userId)
  const storedDevices = await redis.hgetall(storageKey)
  const devices = sortDeviceRecords(
    Object.values(storedDevices || {})
      .map((entry) => normalizeDeviceRecord(readJsonValue(entry) || {}, {
        provider,
        userId
      }))
      .filter((entry) => !!entry.deviceId)
  )

  return {
    ok: true,
    reason: '',
    slotCount: devices.length,
    slotLimit,
    devices
  }
}

export async function removeAccessDeviceRegistration(env, session, deviceId = '') {
  const redis = getRedisClient(env)
  const slotLimit = Math.max(0, Number(env?.deviceSlotLimit || 0) || 0)
  if (!redis) {
    return {
      ok: false,
      reason: 'device_binding_unavailable',
      removed: false,
      removedDevice: null,
      slotCount: 0,
      slotLimit,
      devices: []
    }
  }

  const provider = normalizeText(session?.provider || 'discord')
  const userId = normalizeText(session?.userId)
  const normalizedDeviceId = normalizeText(deviceId)
  if (!provider || !userId || !normalizedDeviceId) {
    return {
      ok: false,
      reason: 'bad_request',
      removed: false,
      removedDevice: null,
      slotCount: 0,
      slotLimit,
      devices: []
    }
  }

  const storageKey = buildDevicesKey(env, provider, userId)
  const storedRecord = await redis.hget(storageKey, normalizedDeviceId)
  const removed = Number(await redis.hdel(storageKey, normalizedDeviceId) || 0) > 0
  const nextDevices = await readAccessDevicesForSession(env, session)

  return {
    ok: nextDevices.ok,
    reason: nextDevices.reason,
    removed,
    removedDevice: removed && storedRecord
      ? normalizeDeviceRecord(readJsonValue(storedRecord) || {}, {
          deviceId: normalizedDeviceId,
          provider,
          userId
        })
      : null,
    slotCount: nextDevices.slotCount,
    slotLimit: nextDevices.slotLimit,
    devices: nextDevices.devices
  }
}

export async function verifyStoredAccessDevice(env, session, deviceId = '') {
  const registration = await readAccessDeviceRegistration(env, session, deviceId)
  if (!registration) {
    return {
      ok: false,
      reason: 'device_binding_unavailable',
      slotCount: 0,
      slotLimit: Math.max(0, Number(env?.deviceSlotLimit || 0) || 0),
      device: null
    }
  }

  if (!registration.found || !registration.device) {
    return {
      ok: false,
      reason: 'unauthorized_device',
      slotCount: registration.slotCount,
      slotLimit: registration.slotLimit,
      device: null
    }
  }

  return {
    ok: true,
    reason: '',
    slotCount: registration.slotCount,
    slotLimit: registration.slotLimit,
    device: registration.device
  }
}

export async function readAccessDeviceStats(env, options = {}) {
  const redis = getRedisClient(env)
  if (!redis) {
    return {
      ok: false,
      reason: 'device_binding_unavailable',
      summary: {
        totalUsers: 0,
        totalDevices: 0,
        maxDevicesPerUser: 0,
        usersAtLimit: 0
      },
      users: []
    }
  }

  const maxUsers = Math.max(1, Number(options.maxUsers || 500) || 500)
  const scanCount = Math.max(10, Number(options.scanCount || 100) || 100)
  const collectedKeys = new Set()
  let cursor = '0'

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: getDevicesScanPattern(env),
      count: scanCount
    })

    for (const key of Array.isArray(keys) ? keys : []) {
      const normalizedKey = normalizeText(key)
      if (!normalizedKey) continue
      collectedKeys.add(normalizedKey)
      if (collectedKeys.size >= maxUsers) break
    }

    cursor = String(nextCursor || '0')
  } while (cursor !== '0' && collectedKeys.size < maxUsers)

  const rawUsers = await Promise.all(
    [...collectedKeys]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, maxUsers)
      .map(async (storageKey) => {
        const keyInfo = parseDevicesKey(env, storageKey)
        if (!keyInfo) return null

        const storedDevices = await redis.hgetall(storageKey)
        const devices = sortDeviceRecords(
          Object.values(storedDevices || {})
            .map((entry) => normalizeDeviceRecord(readJsonValue(entry) || {}, keyInfo))
            .filter((entry) => !!entry.deviceId)
        )

        const identitySource = devices.find((entry) => entry.globalName || entry.username) || devices[0] || null
        return {
          provider: keyInfo.provider,
          userId: keyInfo.userId,
          username: normalizeText(identitySource?.username),
          globalName: normalizeText(identitySource?.globalName),
          ruleLabel: normalizeText(identitySource?.ruleLabel),
          accountLabel: buildDeviceAccountLabel(identitySource, keyInfo.userId),
          deviceCount: devices.length,
          lastClaimedAt: devices[0]?.claimedAt || 0,
          devices
        }
      })
  )

  const users = rawUsers
    .filter(Boolean)
    .sort((left, right) => {
      const countDiff = Math.max(0, Number(right?.deviceCount || 0) || 0) - Math.max(0, Number(left?.deviceCount || 0) || 0)
      if (countDiff !== 0) return countDiff
      const claimedDiff = normalizeTimestamp(right?.lastClaimedAt) - normalizeTimestamp(left?.lastClaimedAt)
      if (claimedDiff !== 0) return claimedDiff
      return normalizeText(left?.accountLabel).localeCompare(normalizeText(right?.accountLabel))
    })

  const totalDevices = users.reduce((sum, user) => sum + Math.max(0, Number(user.deviceCount || 0) || 0), 0)
  const slotLimit = Math.max(0, Number(env?.deviceSlotLimit || 0) || 0)

  return {
    ok: true,
    reason: '',
    summary: {
      totalUsers: users.length,
      totalDevices,
      maxDevicesPerUser: users.reduce((max, user) => Math.max(max, Math.max(0, Number(user.deviceCount || 0) || 0)), 0),
      usersAtLimit: slotLimit > 0
        ? users.filter((user) => Math.max(0, Number(user.deviceCount || 0) || 0) >= slotLimit).length
        : 0
    },
    users
  }
}

export async function readAccessAnnouncement(env) {
  const envAnnouncement = normalizeAnnouncement(env?.announcementJson || env?.ACCESS_GUARD_ANNOUNCEMENT_JSON)
  if (envAnnouncement) return envAnnouncement

  const redis = getRedisClient(env)
  if (redis) {
    const stored = await redis.get(buildAnnouncementKey(env))
    const storedAnnouncement = normalizeAnnouncement(stored)
    if (storedAnnouncement) return storedAnnouncement
  }

  if (!env?.requestedEnabled && !env?.enabled) return null
  return normalizeAnnouncement(DEFAULT_ACCESS_ANNOUNCEMENT)
}
