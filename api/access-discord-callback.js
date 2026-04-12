import {
  ACCESS_DEVICE_COOKIE_NAME,
  ACCESS_SESSION_COOKIE_NAME,
  ACCESS_STATE_COOKIE_NAME,
  buildAccessLogPayload,
  buildAppRedirectUrl,
  buildDiscordRedirectUri,
  createAccessSessionCookie,
  createAccessSessionToken,
  createClearedCookie,
  getRequestQueryValue,
  parseCookieHeader,
  readAccessEnv,
  resolveMatchingDiscordAccessRule,
  readStateFromCookieHeader
} from '../src/utils/accessControlServer.js'

function redirect(res, location, cookies = []) {
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies)
  }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', location)
  return res.status(302).end()
}

async function exchangeDiscordCode(req, env, code) {
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: buildDiscordRedirectUri(req, env)
  })

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })

  if (!response.ok) {
    throw new Error(`discord_token_exchange_failed_${response.status}`)
  }

  const data = await response.json()
  return String(data?.access_token || '')
}

async function fetchDiscordIdentity(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`discord_identity_failed_${response.status}`)
  }

  return response.json()
}

async function fetchUserGuilds(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`discord_guilds_failed_${response.status}`)
  }

  const guilds = await response.json()
  return Array.isArray(guilds) ? guilds : []
}

async function fetchCurrentGuildMember(accessToken, guildId) {
  const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`discord_member_failed_${guildId}_${response.status}`)
  }

  return response.json()
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const env = readAccessEnv()
  const cookieHeader = String(req.headers.cookie || '')
  const rawCookies = parseCookieHeader(cookieHeader)
  const statePayload = env.configured
    ? readStateFromCookieHeader(cookieHeader, env.sessionSecret)
    : null
  const returnTo = statePayload?.returnTo || '#/'
  const clearCookies = [
    createClearedCookie(req, ACCESS_STATE_COOKIE_NAME),
    createClearedCookie(req, ACCESS_SESSION_COOKIE_NAME),
    createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME)
  ]

  if (!env.requestedEnabled) {
    return redirect(res, buildAppRedirectUrl(req, returnTo))
  }
  if (!env.discordConfigured) {
    return redirect(res, buildAppRedirectUrl(req, returnTo, {
      access_error: 'service_misconfigured'
    }), clearCookies)
  }

  const callbackError = getRequestQueryValue(req, 'error')
  if (callbackError) {
    const errorCode = callbackError === 'access_denied' ? 'oauth_denied' : 'oauth_failed'
    return redirect(res, buildAppRedirectUrl(req, returnTo, {
      access_error: errorCode
    }), clearCookies)
  }

  const returnedState = getRequestQueryValue(req, 'state')
  const storedState = String(rawCookies[ACCESS_STATE_COOKIE_NAME] || '')
  if (!storedState || !returnedState || returnedState !== storedState || !statePayload) {
    return redirect(res, buildAppRedirectUrl(req, returnTo, {
      access_error: 'state_mismatch'
    }), clearCookies)
  }

  const code = getRequestQueryValue(req, 'code')
  if (!code) {
    return redirect(res, buildAppRedirectUrl(req, returnTo, {
      access_error: 'oauth_failed'
    }), clearCookies)
  }

  try {
    const accessToken = await exchangeDiscordCode(req, env, code)
    if (!accessToken) {
      throw new Error('discord_token_missing')
    }

    const user = await fetchDiscordIdentity(accessToken)
    const userGuilds = env.ruleCount > 0 ? await fetchUserGuilds(accessToken) : []
    const match = await resolveMatchingDiscordAccessRule(
      env.rules,
      userGuilds,
      (guildId) => fetchCurrentGuildMember(accessToken, guildId)
    )
    if (!match.matched) {
      return redirect(res, buildAppRedirectUrl(req, returnTo, {
        access_error: match.reason || 'not_in_guild'
      }), clearCookies)
    }

    const envWithMatch = match.rule ? { ...env, matchedRule: match.rule } : env
    const { token, payload: sessionPayload } = createAccessSessionToken(user, envWithMatch)
    console.info('[access-control]', JSON.stringify(buildAccessLogPayload(user, req, envWithMatch, sessionPayload)))

    return redirect(res, buildAppRedirectUrl(req, returnTo), [
      createClearedCookie(req, ACCESS_STATE_COOKIE_NAME),
      createClearedCookie(req, ACCESS_DEVICE_COOKIE_NAME),
      createAccessSessionCookie(req, token, env.sessionMaxAgeSeconds)
    ])
  } catch (error) {
    console.warn('[access-control]', error instanceof Error ? error.message : String(error))
    return redirect(res, buildAppRedirectUrl(req, returnTo, {
      access_error: 'service_unavailable'
    }), clearCookies)
  }
}
