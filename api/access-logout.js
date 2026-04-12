import {
  ACCESS_DEVICE_COOKIE_NAME,
  ACCESS_SESSION_COOKIE_NAME,
  ACCESS_STATE_COOKIE_NAME,
  createClearedCookie
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

  res.setHeader('Set-Cookie', [
    createClearedCookie(req, ACCESS_SESSION_COOKIE_NAME),
    createClearedCookie(req, ACCESS_STATE_COOKIE_NAME),
    createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME)
  ])

  return res.status(200).json({ ok: true })
}
