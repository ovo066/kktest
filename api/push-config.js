import { applyCors, readPushEnv } from '../src/utils/pushApiUtils.js'
import { resolveAccessFailureStatus, verifyAccessRequestStrict } from '../src/utils/accessControlServer.js'

export default async function handler(req, res) {
  applyCors(res, {
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  })

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const access = await verifyAccessRequestStrict(req)
  if (!access.ok) {
    return res.status(resolveAccessFailureStatus(access.reason)).json({ ok: false, error: access.reason })
  }

  const env = readPushEnv()
  return res.status(200).json({
    ok: true,
    pushEnabled: env.enabled,
    vapidPublicKey: env.publicKey || '',
    requireAuthToken: !!env.authToken
  })
}
