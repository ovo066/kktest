import { describe, expect, it } from 'vitest'
import {
  ACCESS_DEVICE_COOKIE_NAME,
  ACCESS_SESSION_COOKIE_NAME,
  ACCESS_STATE_COOKIE_NAME,
  buildAccessLogPayload,
  buildAppRedirectUrl,
  buildDiscordAuthorizeUrl,
  buildDiscordRedirectUri,
  createAccessDeviceCookie,
  createAccessDeviceToken,
  createAccessSessionCookie,
  createAccessSessionToken,
  createClearedCookie,
  createStateCookie,
  createStateToken,
  parseCookieHeader,
  readAccessDeviceFromCookieHeader,
  readAccessEnv,
  readAccessSessionFromCookieHeader,
  readStateFromCookieHeader,
  resolveDiscordAccessRules,
  resolveMatchingDiscordAccessRule,
  resolveAccessFailureStatus,
  sanitizeReturnTo,
  sanitizeSessionForClient,
  verifyAccessRequest,
  verifyAccessRequestStrict
} from './accessControlServer'

const requestStub = {
  headers: {
    host: 'aichat.vercel.app',
    'x-forwarded-host': 'aichat.vercel.app',
    'x-forwarded-proto': 'https'
  }
}

function getCookieValue(cookie) {
  return String(cookie || '').split(';')[0]
}

describe('accessControlServer utils', () => {
  it('reads discord access env flags', () => {
    expect(readAccessEnv({
      ACCESS_GUARD_ENABLED: 'true',
      ACCESS_GUARD_SESSION_SECRET: 'secret',
      DISCORD_CLIENT_ID: 'cid',
      DISCORD_CLIENT_SECRET: 'csecret',
      DISCORD_GUILD_ID: 'guild-1'
    })).toMatchObject({
      requestedEnabled: true,
      configured: true,
      enabled: true,
      discordConfigured: true,
      adminCodeEnabled: false,
      deviceBindingEnabled: false,
      guildId: 'guild-1',
      ruleCount: 1,
      scopes: ['identify', 'guilds']
    })
  })

  it('reads admin/device access env flags', () => {
    expect(readAccessEnv({
      ACCESS_GUARD_ENABLED: 'true',
      ACCESS_GUARD_SESSION_SECRET: 'secret',
      ACCESS_GUARD_ADMIN_CODE: 'owner-code',
      ACCESS_GUARD_ADMIN_LABEL: '站长',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
      ACCESS_GUARD_DEVICE_SLOT_LIMIT: '3'
    })).toMatchObject({
      requestedEnabled: true,
      configured: true,
      discordConfigured: false,
      adminCodeEnabled: true,
      adminLabel: '站长',
      deviceBindingEnabled: true,
      deviceSlotLimit: 3
    })
  })

  it('parses advanced multi-guild role rules', () => {
    expect(resolveDiscordAccessRules({
      DISCORD_ACCESS_RULES_JSON: JSON.stringify([
        { guildId: 'g1', label: '主社区', roleIds: ['r1', 'r2'] },
        { guildId: 'g2', label: '公开社区', roleIds: [] }
      ])
    })).toEqual([
      { guildId: 'g1', label: '主社区', roleIds: ['r1', 'r2'] },
      { guildId: 'g2', label: '公开社区', roleIds: [] }
    ])
  })

  it('sanitizes return targets', () => {
    expect(sanitizeReturnTo('https://evil.example.com')).toBe('#/')
    expect(sanitizeReturnTo('#/settings/access')).toBe('#/settings/access')
  })

  it('creates and reads state cookies', () => {
    const { token } = createStateToken('#/chat/demo', 'secret')
    const cookie = createStateCookie(requestStub, token)
    const payload = readStateFromCookieHeader(cookie, 'secret')

    expect(cookie.includes(`${ACCESS_STATE_COOKIE_NAME}=`)).toBe(true)
    expect(payload?.returnTo).toBe('#/chat/demo')
  })

  it('creates and reads discord access session cookies', () => {
    const env = {
      sessionSecret: 'secret',
      sessionMaxAgeSeconds: 3600,
      guildId: 'guild-1',
      matchedRule: {
        guildId: 'guild-1',
        label: '主社区会员',
        roleIds: ['role-1']
      }
    }
    const { token } = createAccessSessionToken({
      id: 'user-1',
      username: 'tester',
      global_name: 'Tester',
      avatar: 'avatar-hash'
    }, env)
    const cookie = createAccessSessionCookie(requestStub, token, env.sessionMaxAgeSeconds)
    const payload = readAccessSessionFromCookieHeader(cookie, env.sessionSecret)

    expect(cookie.includes(`${ACCESS_SESSION_COOKIE_NAME}=`)).toBe(true)
    expect(payload?.provider).toBe('discord')
    expect(payload?.userId).toBe('user-1')
    expect(payload?.username).toBe('tester')
    expect(payload?.ruleLabel).toBe('主社区会员')
  })

  it('creates and sanitizes admin sessions', () => {
    const env = {
      sessionSecret: 'secret',
      sessionMaxAgeSeconds: 3600,
      adminLabel: '站长'
    }
    const { token, payload } = createAccessSessionToken(null, env, {
      provider: 'admin',
      globalName: '站长'
    })
    const cookie = createAccessSessionCookie(requestStub, token, env.sessionMaxAgeSeconds)
    const session = readAccessSessionFromCookieHeader(cookie, env.sessionSecret)
    const clientSession = sanitizeSessionForClient(payload)

    expect(session?.provider).toBe('admin')
    expect(clientSession).toMatchObject({
      provider: 'admin',
      globalName: '站长',
      userId: 'admin'
    })
  })

  it('creates and reads device cookies', () => {
    const now = Date.now()
    const { token } = createAccessDeviceToken({
      provider: 'discord',
      userId: 'user-1',
      authenticatedAt: now,
      exp: now + 3600 * 1000
    }, 'device-1', 'secret')
    const cookie = createAccessDeviceCookie(requestStub, token, 3600)
    const payload = readAccessDeviceFromCookieHeader(cookie, 'secret')

    expect(cookie.includes(`${ACCESS_DEVICE_COOKIE_NAME}=`)).toBe(true)
    expect(payload).toMatchObject({
      provider: 'discord',
      userId: 'user-1',
      deviceId: 'device-1'
    })
  })

  it('builds redirect urls with hash return targets', () => {
    expect(buildAppRedirectUrl(requestStub, '#/settings/access', {
      access_error: 'oauth_failed'
    })).toBe('https://aichat.vercel.app/?access_error=oauth_failed#/settings/access')
  })

  it('builds discord authorize urls', () => {
    const url = buildDiscordAuthorizeUrl(requestStub, {
      clientId: 'cid',
      scopes: ['identify', 'guilds', 'guilds.members.read'],
      redirectUri: ''
    }, 'state-token')

    expect(url).toContain('client_id=cid')
    expect(url).toContain('scope=identify+guilds+guilds.members.read')
    expect(url).toContain('state=state-token')
    expect(buildDiscordRedirectUri(requestStub, { redirectUri: '' })).toBe('https://aichat.vercel.app/api/access-discord-callback')
  })

  it('parses cookie headers and clears cookies', () => {
    expect(parseCookieHeader('foo=bar; hello=world')).toEqual({
      foo: 'bar',
      hello: 'world'
    })
    expect(createClearedCookie(requestStub, 'demo')).toContain('Max-Age=0')
  })

  it('matches any configured guild rule and enforces role ids when present', async () => {
    const result = await resolveMatchingDiscordAccessRule(
      [
        { guildId: 'g1', label: '主社区', roleIds: ['role-a'] },
        { guildId: 'g2', label: '公开社区', roleIds: [] }
      ],
      [
        { id: 'g1', name: 'Guild One' },
        { id: 'g2', name: 'Guild Two' }
      ],
      async (guildId) => (guildId === 'g1' ? { roles: ['role-a'] } : { roles: [] })
    )

    expect(result).toEqual({
      matched: true,
      rule: { guildId: 'g1', label: '主社区', roleIds: ['role-a'] },
      reason: ''
    })
  })

  it('returns missing_required_role when guild matches but roles do not', async () => {
    const result = await resolveMatchingDiscordAccessRule(
      [{ guildId: 'g1', label: '主社区', roleIds: ['role-a'] }],
      [{ id: 'g1', name: 'Guild One' }],
      async () => ({ roles: ['role-b'] })
    )

    expect(result).toEqual({
      matched: false,
      rule: null,
      reason: 'missing_required_role'
    })
  })

  it('includes access session metadata in access logs', () => {
    const payload = buildAccessLogPayload({
      id: '123456789012345678',
      username: 'tester',
      global_name: 'Tester'
    }, requestStub, {
      guildId: 'guild-1',
      guildIds: ['guild-1'],
      matchedRule: {
        guildId: 'guild-1',
        label: '主社区会员',
        roleIds: ['role-1']
      }
    }, {
      provider: 'discord',
      userId: '123456789012345678',
      username: 'tester',
      globalName: 'Tester',
      guildId: 'guild-1',
      ruleLabel: '主社区会员',
      authenticatedAt: 1711972800000,
      exp: 1711976400000
    })

    expect(payload.provider).toBe('discord')
    expect(payload.authenticatedAt).toBe(1711972800000)
    expect(payload.sessionExpiresAt).toBe(1711976400000)
  })

  it('requires a device cookie for discord sessions when device binding is enabled', () => {
    const env = readAccessEnv({
      ACCESS_GUARD_ENABLED: 'true',
      ACCESS_GUARD_SESSION_SECRET: 'secret',
      DISCORD_CLIENT_ID: 'cid',
      DISCORD_CLIENT_SECRET: 'csecret',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token'
    })
    const { token, payload } = createAccessSessionToken({
      id: 'user-1',
      username: 'tester',
      global_name: 'Tester'
    }, env)

    const sessionCookie = getCookieValue(createAccessSessionCookie(requestStub, token, env.sessionMaxAgeSeconds))
    const denied = verifyAccessRequest({
      headers: {
        cookie: sessionCookie
      }
    }, env)

    expect(denied.ok).toBe(false)
    expect(denied.reason).toBe('unauthorized_device')

    const { token: deviceToken } = createAccessDeviceToken(payload, 'device-1', env.sessionSecret)
    const deviceCookie = getCookieValue(createAccessDeviceCookie(requestStub, deviceToken, env.sessionMaxAgeSeconds))
    const allowed = verifyAccessRequest({
      headers: {
        cookie: `${sessionCookie}; ${deviceCookie}`
      }
    }, env)

    expect(allowed.ok).toBe(true)
    expect(allowed.device?.deviceId).toBe('device-1')
  })

  it('allows admin sessions to bypass device binding', () => {
    const env = readAccessEnv({
      ACCESS_GUARD_ENABLED: 'true',
      ACCESS_GUARD_SESSION_SECRET: 'secret',
      ACCESS_GUARD_ADMIN_CODE: 'owner-code',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token'
    })
    const { token } = createAccessSessionToken(null, env, {
      provider: 'admin',
      globalName: '站长'
    })
    const sessionCookie = getCookieValue(createAccessSessionCookie(requestStub, token, env.sessionMaxAgeSeconds))
    const result = verifyAccessRequest({
      headers: {
        cookie: sessionCookie
      }
    }, env)

    expect(result.ok).toBe(true)
    expect(result.session?.provider).toBe('admin')
  })

  it('re-validates stored devices when strict access verification is used', async () => {
    const env = readAccessEnv({
      ACCESS_GUARD_ENABLED: 'true',
      ACCESS_GUARD_SESSION_SECRET: 'secret',
      DISCORD_CLIENT_ID: 'cid',
      DISCORD_CLIENT_SECRET: 'csecret',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token'
    })
    const { token, payload } = createAccessSessionToken({
      id: 'user-1',
      username: 'tester',
      global_name: 'Tester'
    }, env)
    const { token: deviceToken } = createAccessDeviceToken(payload, 'device-1', env.sessionSecret)
    const sessionCookie = getCookieValue(createAccessSessionCookie(requestStub, token, env.sessionMaxAgeSeconds))
    const deviceCookie = getCookieValue(createAccessDeviceCookie(requestStub, deviceToken, env.sessionMaxAgeSeconds))
    const request = {
      headers: {
        cookie: `${sessionCookie}; ${deviceCookie}`
      }
    }

    const denied = await verifyAccessRequestStrict(request, env, {
      loadStoredDevice: async () => ({
        ok: false,
        reason: 'unauthorized_device',
        device: null
      })
    })
    expect(denied.ok).toBe(false)
    expect(denied.reason).toBe('unauthorized_device')

    const allowed = await verifyAccessRequestStrict(request, env, {
      loadStoredDevice: async () => ({
        ok: true,
        reason: '',
        device: {
          deviceId: 'device-1',
          deviceName: 'Windows 桌面浏览器'
        }
      })
    })
    expect(allowed.ok).toBe(true)
    expect(allowed.device?.deviceId).toBe('device-1')
  })

  it('maps device storage failures to service unavailable responses', () => {
    expect(resolveAccessFailureStatus('service_misconfigured')).toBe(503)
    expect(resolveAccessFailureStatus('device_binding_unavailable')).toBe(503)
    expect(resolveAccessFailureStatus('unauthorized')).toBe(401)
  })
})
