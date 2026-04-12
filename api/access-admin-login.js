import { readJsonBody } from '../src/utils/pushApiUtils.js'
import {
  ACCESS_DEVICE_COOKIE_NAME,
  buildAccessLogPayload,
  createAccessSessionCookie,
  createAccessSessionToken,
  createClearedCookie,
  readAccessEnv,
  sanitizeSessionForClient
} from '../src/utils/accessControlServer.js'

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const env = readAccessEnv()
  if (!env.requestedEnabled || !env.adminCodeEnabled) {
    return res.status(503).json({ ok: false, error: 'service_misconfigured' })
  }

  const body = readJsonBody(req)
  const code = String(body.code || '').trim()
  if (!code || code !== env.adminCode) {
    return res.status(401).json({ ok: false, error: 'invalid_admin_code' })
  }

  const { token, payload } = createAccessSessionToken(null, env, {
    provider: 'admin',
    globalName: env.adminLabel
  })

  console.info('[access-control]', JSON.stringify(buildAccessLogPayload({
    id: 'admin',
    username: 'admin',
    global_name: env.adminLabel
  }, req, env, payload)))

  res.setHeader('Set-Cookie', [
    createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME),
    createAccessSessionCookie(req, token, env.sessionMaxAgeSeconds)
  ])

  return res.status(200).json({
    ok: true,
    session: sanitizeSessionForClient(payload)
  })
}
