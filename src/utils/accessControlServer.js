import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { verifyStoredAccessDevice } from './accessGuardStorage.js'

export const ACCESS_SESSION_COOKIE_NAME = 'aichat_access_session'
export const ACCESS_STATE_COOKIE_NAME = 'aichat_access_state'
export const ACCESS_DEVICE_COOKIE_NAME = 'aichat_access_device'

const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const DEFAULT_STATE_MAX_AGE_SECONDS = 10 * 60
const DEFAULT_DEVICE_SLOT_LIMIT = 3
const DEFAULT_STORAGE_PREFIX = 'aichat_access_guard'
const DEFAULT_ADMIN_LABEL = '管理员'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePositiveInteger(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.round(num)
}

function normalizeNonNegativeInteger(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.round(num)
}

function normalizeTextList(value) {
  return [...new Set(
    String(value || '')
      .split(/[,\s]+/)
      .map((item) => normalizeText(item))
      .filter(Boolean)
  )]
}

function normalizeRuleList(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
      const guildId = normalizeText(entry.guildId)
      if (!guildId) return null
      const roleIds = Array.isArray(entry.roleIds)
        ? [...new Set(entry.roleIds.map((item) => normalizeText(item)).filter(Boolean))]
        : []
      const label = normalizeText(entry.label)
      return {
        guildId,
        roleIds,
        label
      }
    })
    .filter(Boolean)
}

function parseAccessRulesJson(value) {
  const raw = normalizeText(value)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return normalizeRuleList(parsed)
  } catch {
    return []
  }
}

function buildLegacyAccessRules(envSource = process.env) {
  const legacyGuildId = normalizeText(envSource.DISCORD_GUILD_ID)
  const guildIds = normalizeTextList(envSource.DISCORD_GUILD_IDS)
  if (legacyGuildId) guildIds.unshift(legacyGuildId)
  return [...new Map(
    guildIds
      .filter(Boolean)
      .map((guildId) => [guildId, { guildId, roleIds: [], label: '' }])
  ).values()]
}

function normalizeSessionProvider(value) {
  return normalizeText(value).toLowerCase() === 'admin' ? 'admin' : 'discord'
}

function normalizeTimestamp(value, fallback = 0) {
  const timestamp = Number(value || 0)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return fallback
  return Math.round(timestamp)
}

function sanitizeDeviceFields(extras = {}) {
  const deviceId = normalizeText(extras.deviceId)
  const deviceName = normalizeText(extras.deviceName)
  const deviceSlotCount = Math.max(0, Number(extras.deviceSlotCount ?? 0) || 0)
  const deviceSlotLimit = Math.max(0, Number(extras.deviceSlotLimit ?? 0) || 0)
  const deviceAuthenticated = !!extras.deviceAuthenticated
  return {
    deviceId,
    deviceName,
    deviceSlotCount,
    deviceSlotLimit,
    deviceAuthenticated
  }
}

export function resolveDiscordAccessRules(envSource = process.env) {
  const jsonRules = parseAccessRulesJson(envSource.DISCORD_ACCESS_RULES_JSON)
  if (jsonRules.length > 0) return jsonRules
  return buildLegacyAccessRules(envSource)
}

export function parseBooleanEnv(value) {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on'
}

export function parseCookieHeader(header = '') {
  return String(header || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((result, entry) => {
      const separator = entry.indexOf('=')
      if (separator <= 0) return result
      const key = entry.slice(0, separator).trim()
      const value = entry.slice(separator + 1).trim()
      if (!key) return result
      result[key] = value
      return result
    }, {})
}

export function resolveAccessFailureStatus(reason = '') {
  const normalized = normalizeText(reason)
  if (normalized === 'service_misconfigured' || normalized === 'device_binding_unavailable') {
    return 503
  }
  if (normalized === 'forbidden') {
    return 403
  }
  return 401
}

export function readAccessEnv(envSource = process.env) {
  const requestedEnabled = parseBooleanEnv(envSource.ACCESS_GUARD_ENABLED)
  const sessionSecret = normalizeText(envSource.ACCESS_GUARD_SESSION_SECRET)

  const clientId = normalizeText(envSource.DISCORD_CLIENT_ID)
  const clientSecret = normalizeText(envSource.DISCORD_CLIENT_SECRET)
  const rules = resolveDiscordAccessRules(envSource)
  const guildIds = [...new Set(rules.map((rule) => rule.guildId).filter(Boolean))]
  const hasRoleRules = rules.some((rule) => rule.roleIds.length > 0)
  const guildId = rules.length === 1 && !hasRoleRules ? rules[0].guildId : ''
  const redirectUri = normalizeText(envSource.DISCORD_REDIRECT_URI)
  const discordConfigured = !!(requestedEnabled && sessionSecret && clientId && clientSecret)

  const adminCode = normalizeText(envSource.ACCESS_GUARD_ADMIN_CODE)
  const adminLabel = normalizeText(envSource.ACCESS_GUARD_ADMIN_LABEL) || DEFAULT_ADMIN_LABEL
  const adminCodeEnabled = !!(requestedEnabled && sessionSecret && adminCode)

  const sessionMaxAgeSeconds = normalizePositiveInteger(
    envSource.ACCESS_GUARD_SESSION_MAX_AGE_SECONDS,
    DEFAULT_SESSION_MAX_AGE_SECONDS
  )

  const storageUrl = normalizeText(envSource.UPSTASH_REDIS_REST_URL)
  const storageToken = normalizeText(envSource.UPSTASH_REDIS_REST_TOKEN)
  const storagePrefix = normalizeText(envSource.ACCESS_GUARD_STORAGE_PREFIX) || DEFAULT_STORAGE_PREFIX
  const storageConfigured = !!(requestedEnabled && storageUrl && storageToken)
  const deviceSlotLimit = normalizeNonNegativeInteger(
    envSource.ACCESS_GUARD_DEVICE_SLOT_LIMIT,
    DEFAULT_DEVICE_SLOT_LIMIT
  )

  const announcementJson = normalizeText(envSource.ACCESS_GUARD_ANNOUNCEMENT_JSON)
  const announcementKey = normalizeText(envSource.ACCESS_GUARD_ANNOUNCEMENT_KEY)
    || `${storagePrefix}:announcement:current`
  const configured = !!(requestedEnabled && sessionSecret && (discordConfigured || adminCodeEnabled))
  const deviceBindingEnabled = !!(
    requestedEnabled
    && configured
    && storageConfigured
    && deviceSlotLimit > 0
  )

  return {
    provider: 'discord',
    requestedEnabled,
    configured,
    enabled: requestedEnabled && configured,
    sessionSecret,
    sessionMaxAgeSeconds,
    stateMaxAgeSeconds: DEFAULT_STATE_MAX_AGE_SECONDS,

    clientId,
    clientSecret,
    redirectUri,
    discordConfigured,
    guildId,
    guildIds,
    rules,
    ruleCount: rules.length,
    hasRoleRules,
    scopes: rules.length > 0
      ? (hasRoleRules ? ['identify', 'guilds', 'guilds.members.read'] : ['identify', 'guilds'])
      : ['identify'],

    adminCode,
    adminLabel,
    adminCodeEnabled,

    storageUrl,
    storageToken,
    storageConfigured,
    storagePrefix,
    deviceBindingEnabled,
    deviceSlotLimit,

    announcementJson,
    announcementKey
  }
}

export function getRequestOrigin(req) {
  const forwardedProto = normalizeText(req?.headers?.['x-forwarded-proto'])
  const forwardedHost = normalizeText(req?.headers?.['x-forwarded-host'])
  const host = forwardedHost || normalizeText(req?.headers?.host)
  const proto = forwardedProto || 'https'
  if (!host) return ''
  return `${proto}://${host}`
}

function shouldUseSecureCookies(req) {
  const proto = normalizeText(req?.headers?.['x-forwarded-proto']).toLowerCase()
  const host = normalizeText(req?.headers?.['x-forwarded-host'] || req?.headers?.host).toLowerCase()
  if (proto === 'https') return true
  return !(host.startsWith('localhost') || host.startsWith('127.0.0.1'))
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`]
  if (options.maxAge != null) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
  }
  parts.push(`Path=${options.path || '/'}`)
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

function signTokenPayload(encodedPayload, secret) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function encodeSignedPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signTokenPayload(encoded, secret)
  return `${encoded}.${signature}`
}

function decodeSignedPayload(token, secret) {
  const rawToken = normalizeText(token)
  if (!rawToken || !secret) return null

  const parts = rawToken.split('.')
  if (parts.length !== 2) return null

  const [encodedPayload, signature] = parts
  const expectedSignature = signTokenPayload(encodedPayload, secret)
  if (signature.length !== expectedSignature.length) return null

  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    const expiresAt = Number(payload?.exp || 0)
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt < Date.now()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function sanitizeReturnTo(value) {
  const raw = normalizeText(value)
  if (!raw) return '#/'
  if (raw.startsWith('#/')) return raw
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '#/'
}

export function buildDiscordRedirectUri(req, env) {
  const configured = normalizeText(env?.redirectUri)
  if (configured) return configured
  const origin = getRequestOrigin(req)
  return origin ? `${origin}/api/access-discord-callback` : '/api/access-discord-callback'
}

export function buildDiscordAuthorizeUrl(req, env, stateToken) {
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', env.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', env.scopes.join(' '))
  url.searchParams.set('state', stateToken)
  url.searchParams.set('redirect_uri', buildDiscordRedirectUri(req, env))
  return url.toString()
}

export function buildAppRedirectUrl(req, returnTo = '#/', params = {}) {
  const safeReturnTo = sanitizeReturnTo(returnTo)
  const origin = getRequestOrigin(req)

  if (safeReturnTo.startsWith('#')) {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      const text = normalizeText(value)
      if (text) search.set(key, text)
    })
    const query = search.toString()
    const basePath = origin ? `${origin}/` : '/'
    return `${basePath}${query ? `?${query}` : ''}${safeReturnTo}`
  }

  try {
    const base = origin || 'https://example.com'
    const url = new URL(safeReturnTo, base)
    Object.entries(params).forEach(([key, value]) => {
      const text = normalizeText(value)
      if (text) url.searchParams.set(key, text)
    })
    if (!origin) {
      return `${url.pathname}${url.search}${url.hash}`
    }
    return url.toString()
  } catch {
    return origin ? `${origin}/#/` : '/#/'
  }
}

export function createStateToken(returnTo, secret, maxAgeSeconds = DEFAULT_STATE_MAX_AGE_SECONDS) {
  const now = Date.now()
  const payload = {
    v: 1,
    nonce: randomBytes(16).toString('hex'),
    returnTo: sanitizeReturnTo(returnTo),
    iat: now,
    exp: now + (maxAgeSeconds * 1000)
  }
  return {
    token: encodeSignedPayload(payload, secret),
    payload
  }
}

export function readStateFromCookieHeader(cookieHeader, secret) {
  const cookies = parseCookieHeader(cookieHeader)
  return decodeSignedPayload(cookies[ACCESS_STATE_COOKIE_NAME], secret)
}

export function createStateCookie(req, token, maxAgeSeconds = DEFAULT_STATE_MAX_AGE_SECONDS) {
  return serializeCookie(ACCESS_STATE_COOKIE_NAME, token, {
    maxAge: maxAgeSeconds,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(req)
  })
}

export function createAccessSessionToken(user, env, options = {}) {
  const now = Date.now()
  const provider = normalizeSessionProvider(options.provider || env?.provider || 'discord')
  const expiresAt = now + (normalizePositiveInteger(env?.sessionMaxAgeSeconds, DEFAULT_SESSION_MAX_AGE_SECONDS) * 1000)

  if (provider === 'admin') {
    const payload = {
      v: 1,
      provider,
      userId: normalizeText(options.userId) || 'admin',
      username: normalizeText(options.username) || 'admin',
      globalName: normalizeText(options.globalName || env?.adminLabel) || DEFAULT_ADMIN_LABEL,
      authenticatedAt: now,
      exp: expiresAt
    }
    return {
      token: encodeSignedPayload(payload, env.sessionSecret),
      payload
    }
  }

  const matchedRule = env?.matchedRule && typeof env.matchedRule === 'object' ? env.matchedRule : null
  const payload = {
    v: 1,
    provider,
    userId: normalizeText(options.userId || user?.id),
    username: normalizeText(options.username || user?.username),
    discriminator: normalizeText(user?.discriminator),
    globalName: normalizeText(options.globalName || user?.global_name),
    avatar: normalizeText(user?.avatar),
    guildId: normalizeText(matchedRule?.guildId || env?.guildId),
    ruleLabel: normalizeText(options.ruleLabel || matchedRule?.label),
    matchedRoleIds: Array.isArray(matchedRule?.roleIds)
      ? matchedRule.roleIds.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    authenticatedAt: now,
    exp: expiresAt
  }
  return {
    token: encodeSignedPayload(payload, env.sessionSecret),
    payload
  }
}

export function createAccessDeviceToken(session, deviceId, secret) {
  const normalizedDeviceId = normalizeText(deviceId)
  const payload = {
    v: 1,
    provider: normalizeSessionProvider(session?.provider),
    userId: normalizeText(session?.userId),
    deviceId: normalizedDeviceId,
    authenticatedAt: normalizeTimestamp(session?.authenticatedAt, Date.now()),
    exp: normalizeTimestamp(session?.exp, Date.now() + (DEFAULT_SESSION_MAX_AGE_SECONDS * 1000))
  }
  return {
    token: encodeSignedPayload(payload, secret),
    payload
  }
}

export function buildDiscordAvatarUrl(identity = {}) {
  const userId = normalizeText(identity?.userId || identity?.id)
  const avatar = normalizeText(identity?.avatar)
  if (!userId || !avatar) return ''
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`
}

export function sanitizeSessionForClient(session = null, extras = {}) {
  if (!session) return null

  const provider = normalizeSessionProvider(session.provider)
  const deviceFields = sanitizeDeviceFields({
    ...session,
    ...extras
  })
  const base = provider === 'admin'
    ? {
        provider,
        userId: normalizeText(session.userId) || 'admin',
        username: normalizeText(session.username) || 'admin',
        discriminator: '',
        globalName: normalizeText(session.globalName) || DEFAULT_ADMIN_LABEL,
        avatarUrl: '',
        guildId: '',
        ruleLabel: '',
        matchedRoleIds: [],
        authenticatedAt: normalizeTimestamp(session.authenticatedAt),
        expiresAt: normalizeTimestamp(session.exp)
      }
    : {
        provider,
        userId: normalizeText(session.userId),
        username: normalizeText(session.username),
        discriminator: normalizeText(session.discriminator),
        globalName: normalizeText(session.globalName),
        avatarUrl: buildDiscordAvatarUrl({
          userId: session.userId,
          avatar: session.avatar
        }),
        guildId: normalizeText(session.guildId),
        ruleLabel: normalizeText(session.ruleLabel),
        matchedRoleIds: Array.isArray(session.matchedRoleIds)
          ? session.matchedRoleIds.map((item) => normalizeText(item)).filter(Boolean)
          : [],
        authenticatedAt: normalizeTimestamp(session.authenticatedAt),
        expiresAt: normalizeTimestamp(session.exp)
      }

  return {
    ...base,
    ...deviceFields
  }
}

export function readAccessSessionFromCookieHeader(cookieHeader, secret) {
  const cookies = parseCookieHeader(cookieHeader)
  return decodeSignedPayload(cookies[ACCESS_SESSION_COOKIE_NAME], secret)
}

export function readAccessDeviceFromCookieHeader(cookieHeader, secret) {
  const cookies = parseCookieHeader(cookieHeader)
  return decodeSignedPayload(cookies[ACCESS_DEVICE_COOKIE_NAME], secret)
}

export function createAccessSessionCookie(req, token, maxAgeSeconds = DEFAULT_SESSION_MAX_AGE_SECONDS) {
  return serializeCookie(ACCESS_SESSION_COOKIE_NAME, token, {
    maxAge: maxAgeSeconds,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(req)
  })
}

export function createAccessDeviceCookie(req, token, maxAgeSeconds = DEFAULT_SESSION_MAX_AGE_SECONDS) {
  return serializeCookie(ACCESS_DEVICE_COOKIE_NAME, token, {
    maxAge: maxAgeSeconds,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(req)
  })
}

export function createClearedCookie(req, name) {
  return serializeCookie(name, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(req)
  })
}

export function getRequestQueryValue(req, key) {
  const fromParsedQuery = req?.query?.[key]
  if (typeof fromParsedQuery === 'string') return fromParsedQuery
  if (Array.isArray(fromParsedQuery)) return String(fromParsedQuery[0] || '')

  try {
    const url = new URL(String(req?.url || ''), getRequestOrigin(req) || 'https://example.com')
    return String(url.searchParams.get(key) || '')
  } catch {
    return ''
  }
}

export function readClientIp(req) {
  const forwarded = normalizeText(req?.headers?.['x-forwarded-for'])
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return normalizeText(req?.socket?.remoteAddress)
}

export function buildAccessLogPayload(user, req, env, session = null) {
  const provider = normalizeSessionProvider(session?.provider || env?.provider)
  const matchedRule = env?.matchedRule && typeof env.matchedRule === 'object' ? env.matchedRule : null
  const authenticatedAt = Number(session?.authenticatedAt || 0) || 0
  return {
    event: 'access_granted',
    provider,
    guildId: provider === 'discord'
      ? normalizeText(matchedRule?.guildId || session?.guildId || env?.guildId)
      : '',
    configuredGuildIds: provider === 'discord' && Array.isArray(env?.guildIds)
      ? env.guildIds.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    ruleLabel: provider === 'discord'
      ? normalizeText(matchedRule?.label || session?.ruleLabel)
      : '',
    matchedRoleIds: provider === 'discord' && Array.isArray(matchedRule?.roleIds)
      ? matchedRule.roleIds.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    userId: normalizeText(user?.id || session?.userId),
    username: normalizeText(user?.username || session?.username),
    globalName: normalizeText(user?.global_name || session?.globalName),
    authenticatedAt,
    sessionExpiresAt: Number(session?.exp || 0) || 0,
    verifiedAt: new Date().toISOString(),
    ip: readClientIp(req),
    vercelId: normalizeText(req?.headers?.['x-vercel-id']),
    userAgent: normalizeText(req?.headers?.['user-agent']).slice(0, 180)
  }
}

export async function resolveMatchingDiscordAccessRule(rules = [], guilds = [], loadMember = async () => null) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { matched: true, rule: null, reason: '' }
  }

  const guildMap = new Map(
    (Array.isArray(guilds) ? guilds : [])
      .map((guild) => {
        const id = normalizeText(guild?.id)
        if (!id) return null
        return [id, guild]
      })
      .filter(Boolean)
  )

  const memberCache = new Map()
  let hasGuildMatch = false

  for (const rule of rules) {
    const guildId = normalizeText(rule?.guildId)
    if (!guildId || !guildMap.has(guildId)) continue
    hasGuildMatch = true

    if (!Array.isArray(rule.roleIds) || rule.roleIds.length === 0) {
      return { matched: true, rule, reason: '' }
    }

    if (!memberCache.has(guildId)) {
      memberCache.set(guildId, await loadMember(guildId))
    }
    const member = memberCache.get(guildId)
    const memberRoleIds = Array.isArray(member?.roles)
      ? member.roles.map((item) => normalizeText(item)).filter(Boolean)
      : []

    if (rule.roleIds.some((roleId) => memberRoleIds.includes(roleId))) {
      return { matched: true, rule, reason: '' }
    }
  }

  return {
    matched: false,
    rule: null,
    reason: hasGuildMatch ? 'missing_required_role' : 'not_in_guild'
  }
}

export function verifyAccessRequest(req, env = readAccessEnv(), options = {}) {
  if (!env.requestedEnabled) {
    return { ok: true, env, session: null, device: null, reason: '' }
  }
  if (!env.configured) {
    return { ok: false, env, session: null, device: null, reason: 'service_misconfigured' }
  }

  const cookieHeader = String(req?.headers?.cookie || '')
  const session = readAccessSessionFromCookieHeader(cookieHeader, env.sessionSecret)
  if (!session) {
    return { ok: false, env, session: null, device: null, reason: 'unauthorized' }
  }

  const provider = normalizeSessionProvider(session.provider)
  if (provider === 'admin') {
    return { ok: true, env, session, device: null, reason: '' }
  }

  if (options.requireDevice === false || !env.deviceBindingEnabled) {
    return { ok: true, env, session, device: null, reason: '' }
  }

  const device = readAccessDeviceFromCookieHeader(cookieHeader, env.sessionSecret)
  const deviceMatches = !!device
    && normalizeSessionProvider(device.provider) === provider
    && normalizeText(device.userId) === normalizeText(session.userId)
    && !!normalizeText(device.deviceId)

  if (!deviceMatches) {
    return { ok: false, env, session, device: null, reason: 'unauthorized_device' }
  }

  return { ok: true, env, session, device, reason: '' }
}

export async function verifyAccessRequestStrict(req, env = readAccessEnv(), options = {}) {
  const access = verifyAccessRequest(req, env, options)
  if (!access.ok || !access.session) {
    return access
  }

  const provider = normalizeSessionProvider(access.session.provider)
  if (provider === 'admin' || options.requireDevice === false || !env.deviceBindingEnabled) {
    return access
  }

  const loadStoredDevice = typeof options.loadStoredDevice === 'function'
    ? options.loadStoredDevice
    : verifyStoredAccessDevice

  try {
    const storedDevice = await loadStoredDevice(env, access.session, access.device?.deviceId || '')
    if (!storedDevice?.ok || !storedDevice.device) {
      return {
        ...access,
        ok: false,
        device: null,
        reason: storedDevice?.reason || 'device_binding_unavailable'
      }
    }

    return {
      ...access,
      device: storedDevice.device,
      reason: ''
    }
  } catch {
    return {
      ...access,
      ok: false,
      device: null,
      reason: 'device_binding_unavailable'
    }
  }
}
