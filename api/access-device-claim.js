import { readJsonBody } from '../src/utils/pushApiUtils.js'
import {
  claimAccessDeviceSlot,
  readAccessDevicesForSession,
  removeAccessDeviceRegistration
} from '../src/utils/accessGuardStorage.js'
import {
  ACCESS_DEVICE_COOKIE_NAME,
  createAccessDeviceCookie,
  createAccessDeviceToken,
  createClearedCookie,
  readAccessDeviceFromCookieHeader,
  readAccessEnv,
  readClientIp,
  resolveAccessFailureStatus,
  sanitizeSessionForClient,
  verifyAccessRequest
} from '../src/utils/accessControlServer.js'

function resolveDeviceCookieMaxAgeSeconds(session, env) {
  const expiresAt = Number(session?.exp || 0)
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  }
  return env.sessionMaxAgeSeconds
}

function serializeClientDevice(device = {}) {
  return {
    deviceId: String(device.deviceId || '').trim(),
    deviceName: String(device.deviceName || '').trim(),
    claimedAt: Math.max(0, Number(device.claimedAt || 0) || 0),
    lastSeenAt: Math.max(0, Number(device.lastSeenAt || 0) || 0)
  }
}

async function handleListDevices(req, res, env, session) {
  if (session.provider === 'admin') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  if (!env.deviceBindingEnabled) {
    return res.status(200).json({
      ok: true,
      deviceBindingEnabled: false,
      slotCount: 0,
      slotLimit: Math.max(0, Number(env.deviceSlotLimit || 0) || 0),
      devices: []
    })
  }

  const devicesResult = await readAccessDevicesForSession(env, session)
  if (!devicesResult.ok) {
    return res.status(resolveAccessFailureStatus(devicesResult.reason)).json({
      ok: false,
      error: devicesResult.reason
    })
  }

  return res.status(200).json({
    ok: true,
    deviceBindingEnabled: true,
    slotCount: devicesResult.slotCount,
    slotLimit: devicesResult.slotLimit,
    devices: devicesResult.devices.map((device) => serializeClientDevice(device))
  })
}

async function handleReleaseDevice(req, res, env, session, targetDeviceId) {
  if (session.provider === 'admin') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  if (!env.deviceBindingEnabled) {
    return res.status(503).json({ ok: false, error: 'device_binding_unavailable' })
  }

  if (!targetDeviceId) {
    return res.status(400).json({ ok: false, error: 'bad_request' })
  }

  const releaseResult = await removeAccessDeviceRegistration(env, session, targetDeviceId)
  if (!releaseResult.ok) {
    const status = releaseResult.reason === 'bad_request'
      ? 400
      : resolveAccessFailureStatus(releaseResult.reason)
    return res.status(status).json({ ok: false, error: releaseResult.reason })
  }

  const currentDevice = env.sessionSecret
    ? readAccessDeviceFromCookieHeader(String(req.headers.cookie || ''), env.sessionSecret)
    : null
  const shouldClearDeviceCookie = String(currentDevice?.deviceId || '').trim() === targetDeviceId
  if (shouldClearDeviceCookie) {
    res.setHeader('Set-Cookie', createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME))
  }

  return res.status(200).json({
    ok: true,
    removed: releaseResult.removed,
    releasedDeviceId: targetDeviceId,
    slotCount: releaseResult.slotCount,
    slotLimit: releaseResult.slotLimit,
    devices: releaseResult.devices.map((device) => serializeClientDevice(device))
  })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const env = readAccessEnv()
  const access = verifyAccessRequest(req, env, { requireDevice: false })
  if (!access.ok) {
    const status = access.reason === 'service_misconfigured' ? 503 : 401
    return res.status(status).json({ ok: false, error: access.reason })
  }

  const session = access.session
  if (!session) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      return await handleListDevices(req, res, env, session)
    } catch (error) {
      console.warn('[access-control]', error instanceof Error ? error.message : String(error))
      return res.status(503).json({ ok: false, error: 'device_binding_unavailable' })
    }
  }

  const body = readJsonBody(req)
  const action = String(body.action || '').trim().toLowerCase()
  if (action === 'release') {
    try {
      return await handleReleaseDevice(req, res, env, session, String(body.deviceId || '').trim())
    } catch (error) {
      console.warn('[access-control]', error instanceof Error ? error.message : String(error))
      return res.status(503).json({ ok: false, error: 'device_binding_unavailable' })
    }
  }

  if (session.provider === 'admin') {
    res.setHeader('Set-Cookie', createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME))
    return res.status(200).json({
      ok: true,
      skipped: true,
      session: sanitizeSessionForClient(session)
    })
  }

  if (!env.deviceBindingEnabled) {
    return res.status(503).json({ ok: false, error: 'device_binding_unavailable' })
  }

  const deviceId = String(body.deviceId || '').trim()
  const deviceName = String(body.deviceName || '').trim()

  if (!deviceId) {
    return res.status(400).json({ ok: false, error: 'device_binding_unavailable' })
  }

  try {
    const result = await claimAccessDeviceSlot(env, session, {
      deviceId,
      deviceName,
      ip: readClientIp(req),
      userAgent: String(req.headers['user-agent'] || '').trim()
    })

    if (!result.ok) {
      const status = result.reason === 'device_limit_reached' ? 409 : 503
      return res.status(status).json({
        ok: false,
        error: result.reason,
        slotCount: result.slotCount ?? 0,
        slotLimit: result.slotLimit ?? env.deviceSlotLimit
      })
    }

    const maxAgeSeconds = resolveDeviceCookieMaxAgeSeconds(session, env)
    const { token } = createAccessDeviceToken(session, result.device.deviceId, env.sessionSecret)
    res.setHeader('Set-Cookie', createAccessDeviceCookie(req, token, maxAgeSeconds))

    return res.status(200).json({
      ok: true,
      deviceId: result.device.deviceId,
      deviceName: result.device.deviceName,
      slotCount: result.slotCount,
      slotLimit: result.slotLimit,
      session: sanitizeSessionForClient(session, {
        deviceId: result.device.deviceId,
        deviceName: result.device.deviceName,
        deviceSlotCount: result.slotCount,
        deviceSlotLimit: result.slotLimit,
        deviceAuthenticated: true
      })
    })
  } catch (error) {
    console.warn('[access-control]', error instanceof Error ? error.message : String(error))
    return res.status(503).json({ ok: false, error: 'device_binding_unavailable' })
  }
}
