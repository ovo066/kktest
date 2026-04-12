import {
  ACCESS_DEVICE_COOKIE_NAME,
  ACCESS_SESSION_COOKIE_NAME,
  createClearedCookie,
  parseCookieHeader,
  readAccessEnv,
  readAccessDeviceFromCookieHeader,
  readAccessSessionFromCookieHeader,
  sanitizeSessionForClient
} from '../src/utils/accessControlServer.js'
import { readAccessDeviceRegistration } from '../src/utils/accessGuardStorage.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const env = readAccessEnv()
  const rawCookieHeader = String(req.headers.cookie || '')
  const cookies = parseCookieHeader(rawCookieHeader)
  const hasSessionCookie = !!cookies[ACCESS_SESSION_COOKIE_NAME]
  const hasDeviceCookie = !!cookies[ACCESS_DEVICE_COOKIE_NAME]
  const session = env.sessionSecret
    ? readAccessSessionFromCookieHeader(rawCookieHeader, env.sessionSecret)
    : null
  const device = env.sessionSecret
    ? readAccessDeviceFromCookieHeader(rawCookieHeader, env.sessionSecret)
    : null
  const cookiesToClear = []

  if (hasSessionCookie && !session) {
    cookiesToClear.push(
      createClearedCookie(req, ACCESS_SESSION_COOKIE_NAME),
      createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME)
    )
  }

  let deviceAuthenticated = false
  let sessionPayload = sanitizeSessionForClient(session)

  if (!session && hasDeviceCookie) {
    cookiesToClear.push(createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME))
  }

  if (session?.provider === 'admin') {
    if (hasDeviceCookie) {
      cookiesToClear.push(createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME))
    }
  } else if (session && env.deviceBindingEnabled) {
    const deviceMatches = !!device
      && String(device.userId || '').trim() === String(session.userId || '').trim()
      && String(device.provider || '').trim() === String(session.provider || 'discord').trim()
      && String(device.deviceId || '').trim()

    if (hasDeviceCookie && !deviceMatches) {
      cookiesToClear.push(createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME))
    }

    try {
      const registration = await readAccessDeviceRegistration(
        env,
        session,
        deviceMatches ? device.deviceId : ''
      )
      deviceAuthenticated = !!deviceMatches && !!registration?.found && !!registration?.device

      if (!deviceAuthenticated && hasDeviceCookie) {
        cookiesToClear.push(createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME))
      }

      sessionPayload = sanitizeSessionForClient(session, {
        deviceId: deviceAuthenticated ? device.deviceId : '',
        deviceName: deviceAuthenticated
          ? (registration?.device?.deviceName || device?.deviceName)
          : '',
        deviceSlotCount: registration?.slotCount ?? 0,
        deviceSlotLimit: env.deviceSlotLimit,
        deviceAuthenticated
      })
    } catch (error) {
      console.warn('[access-control]', error instanceof Error ? error.message : String(error))
      sessionPayload = sanitizeSessionForClient(session, {
        deviceSlotLimit: env.deviceSlotLimit,
        deviceAuthenticated: false
      })
    }
  }

  if (cookiesToClear.length > 0) {
    res.setHeader('Set-Cookie', [...new Set(cookiesToClear)])
  }

  return res.status(200).json({
    ok: true,
    enabled: env.requestedEnabled,
    configured: env.configured,
    discordConfigured: env.discordConfigured,
    adminCodeEnabled: env.adminCodeEnabled,
    deviceBindingEnabled: env.deviceBindingEnabled,
    deviceSlotLimit: env.deviceSlotLimit,
    provider: env.provider,
    guildId: env.guildId,
    ruleCount: env.ruleCount,
    hasRoleRules: env.hasRoleRules,
    authenticated: !!session,
    deviceAuthenticated: session?.provider === 'admin'
      ? true
      : (env.deviceBindingEnabled ? deviceAuthenticated : false),
    deviceClaimRequired: !!(
      session
      && session.provider !== 'admin'
      && env.deviceBindingEnabled
      && !deviceAuthenticated
    ),
    session: sessionPayload
  })
}
