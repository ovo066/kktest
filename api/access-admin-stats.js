import { readAccessDeviceStats } from '../src/utils/accessGuardStorage.js'
import {
  readAccessEnv,
  resolveAccessFailureStatus,
  verifyAccessRequestStrict
} from '../src/utils/accessControlServer.js'

function buildEmptyStatsPayload(env) {
  return {
    ok: true,
    deviceBindingEnabled: !!env.deviceBindingEnabled,
    deviceSlotLimit: Math.max(0, Number(env.deviceSlotLimit || 0) || 0),
    generatedAt: Date.now(),
    summary: {
      totalUsers: 0,
      totalDevices: 0,
      maxDevicesPerUser: 0,
      usersAtLimit: 0
    },
    users: []
  }
}

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
  const access = await verifyAccessRequestStrict(req, env)
  if (!access.ok) {
    return res.status(resolveAccessFailureStatus(access.reason)).json({ ok: false, error: access.reason })
  }

  if (access.session?.provider !== 'admin') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  if (!env.deviceBindingEnabled) {
    return res.status(200).json(buildEmptyStatsPayload(env))
  }

  try {
    const stats = await readAccessDeviceStats(env)
    if (!stats.ok) {
      return res.status(resolveAccessFailureStatus(stats.reason)).json({ ok: false, error: stats.reason })
    }

    return res.status(200).json({
      ok: true,
      deviceBindingEnabled: true,
      deviceSlotLimit: Math.max(0, Number(env.deviceSlotLimit || 0) || 0),
      generatedAt: Date.now(),
      summary: stats.summary,
      users: stats.users
    })
  } catch (error) {
    console.warn('[access-control]', error instanceof Error ? error.message : String(error))
    return res.status(503).json({ ok: false, error: 'device_binding_unavailable' })
  }
}
