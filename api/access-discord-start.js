import {
  buildAppRedirectUrl,
  buildDiscordAuthorizeUrl,
  createStateCookie,
  createStateToken,
  readAccessEnv,
  readAccessSessionFromCookieHeader,
  getRequestQueryValue,
  sanitizeReturnTo
} from '../src/utils/accessControlServer.js'

function redirect(res, location, cookies = []) {
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies)
  }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', location)
  return res.status(302).end()
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const env = readAccessEnv()
  const returnTo = sanitizeReturnTo(getRequestQueryValue(req, 'returnTo'))
  const shouldForce = getRequestQueryValue(req, 'force') === '1'

  if (!env.requestedEnabled) {
    return redirect(res, buildAppRedirectUrl(req, returnTo))
  }
  if (!env.discordConfigured) {
    return redirect(res, buildAppRedirectUrl(req, returnTo, {
      access_error: 'service_misconfigured'
    }))
  }

  const existingSession = readAccessSessionFromCookieHeader(String(req.headers.cookie || ''), env.sessionSecret)
  if (existingSession && !shouldForce) {
    return redirect(res, buildAppRedirectUrl(req, returnTo))
  }

  const { token } = createStateToken(returnTo, env.sessionSecret, env.stateMaxAgeSeconds)
  return redirect(res, buildDiscordAuthorizeUrl(req, env, token), [
    createStateCookie(req, token, env.stateMaxAgeSeconds)
  ])
}
