import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ACCESS_DEVICE_COOKIE_NAME: 'aichat_access_device',
  createAccessDeviceCookie: vi.fn(() => 'aichat_access_device=token'),
  createAccessDeviceToken: vi.fn(() => ({ token: 'token' })),
  createClearedCookie: vi.fn(() => 'aichat_access_device=; Max-Age=0'),
  readAccessDeviceFromCookieHeader: vi.fn(),
  readAccessEnv: vi.fn(),
  readClientIp: vi.fn(() => '127.0.0.1'),
  resolveAccessFailureStatus: vi.fn((reason) => (
    reason === 'device_binding_unavailable' || reason === 'service_misconfigured' ? 503 : 401
  )),
  sanitizeSessionForClient: vi.fn(() => ({ provider: 'discord', userId: 'user-1' })),
  verifyAccessRequest: vi.fn(),
  claimAccessDeviceSlot: vi.fn(),
  readAccessDevicesForSession: vi.fn(),
  removeAccessDeviceRegistration: vi.fn()
}))

vi.mock('../../src/utils/accessControlServer.js', () => ({
  ACCESS_DEVICE_COOKIE_NAME: mocks.ACCESS_DEVICE_COOKIE_NAME,
  createAccessDeviceCookie: mocks.createAccessDeviceCookie,
  createAccessDeviceToken: mocks.createAccessDeviceToken,
  createClearedCookie: mocks.createClearedCookie,
  readAccessDeviceFromCookieHeader: mocks.readAccessDeviceFromCookieHeader,
  readAccessEnv: mocks.readAccessEnv,
  readClientIp: mocks.readClientIp,
  resolveAccessFailureStatus: mocks.resolveAccessFailureStatus,
  sanitizeSessionForClient: mocks.sanitizeSessionForClient,
  verifyAccessRequest: mocks.verifyAccessRequest
}))

vi.mock('../../src/utils/accessGuardStorage.js', () => ({
  claimAccessDeviceSlot: mocks.claimAccessDeviceSlot,
  readAccessDevicesForSession: mocks.readAccessDevicesForSession,
  removeAccessDeviceRegistration: mocks.removeAccessDeviceRegistration
}))

import handler from '../../api/access-device-claim'

function createMockRes() {
  return {
    headers: {},
    statusCode: 200,
    jsonBody: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.jsonBody = payload
      return this
    },
    end() {
      return this
    }
  }
}

beforeEach(() => {
  Object.values(mocks).forEach((fn) => {
    if (typeof fn?.mockReset === 'function') {
      fn.mockReset()
    }
  })
  mocks.createAccessDeviceCookie.mockReturnValue('aichat_access_device=token')
  mocks.createAccessDeviceToken.mockReturnValue({ token: 'token' })
  mocks.createClearedCookie.mockReturnValue('aichat_access_device=; Max-Age=0')
  mocks.readClientIp.mockReturnValue('127.0.0.1')
  mocks.resolveAccessFailureStatus.mockImplementation((reason) => (
    reason === 'device_binding_unavailable' || reason === 'service_misconfigured' ? 503 : 401
  ))
  mocks.sanitizeSessionForClient.mockImplementation((session, extras = {}) => ({
    provider: String(session?.provider || 'discord'),
    userId: String(session?.userId || 'user-1'),
    ...extras
  }))
})

describe('api/access-device-claim', () => {
  it('claims the current device on POST without action', async () => {
    mocks.readAccessEnv.mockReturnValue({
      deviceBindingEnabled: true,
      sessionSecret: 'secret',
      sessionMaxAgeSeconds: 3600,
      deviceSlotLimit: 3
    })
    mocks.verifyAccessRequest.mockReturnValue({
      ok: true,
      session: {
        provider: 'discord',
        userId: 'user-1',
        exp: Date.now() + 3600000
      }
    })
    mocks.claimAccessDeviceSlot.mockResolvedValue({
      ok: true,
      slotCount: 2,
      slotLimit: 3,
      device: {
        deviceId: 'device-1',
        deviceName: 'Windows 桌面浏览器'
      }
    })

    const req = {
      method: 'POST',
      headers: {
        cookie: '',
        'user-agent': 'ua'
      },
      body: {
        deviceId: 'device-1',
        deviceName: 'Windows 桌面浏览器'
      }
    }
    const res = createMockRes()

    await handler(req, res)

    expect(mocks.claimAccessDeviceSlot).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      provider: 'discord',
      userId: 'user-1'
    }), {
      deviceId: 'device-1',
      deviceName: 'Windows 桌面浏览器',
      ip: '127.0.0.1',
      userAgent: 'ua'
    })
    expect(res.headers['set-cookie']).toBe('aichat_access_device=token')
    expect(res.statusCode).toBe(200)
    expect(res.jsonBody).toMatchObject({
      ok: true,
      deviceId: 'device-1',
      deviceName: 'Windows 桌面浏览器',
      slotCount: 2,
      slotLimit: 3
    })
  })

  it('returns the current user device list on GET', async () => {
    mocks.readAccessEnv.mockReturnValue({
      deviceBindingEnabled: true,
      deviceSlotLimit: 3
    })
    mocks.verifyAccessRequest.mockReturnValue({
      ok: true,
      session: {
        provider: 'discord',
        userId: 'user-1'
      }
    })
    mocks.readAccessDevicesForSession.mockResolvedValue({
      ok: true,
      slotCount: 2,
      slotLimit: 3,
      devices: [
        {
          deviceId: 'device-1',
          deviceName: 'Windows 桌面浏览器',
          claimedAt: 1710000000000,
          lastSeenAt: 1710000001000,
          username: 'tester'
        }
      ]
    })

    const req = {
      method: 'GET',
      headers: {}
    }
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.jsonBody).toEqual({
      ok: true,
      deviceBindingEnabled: true,
      slotCount: 2,
      slotLimit: 3,
      devices: [
        {
          deviceId: 'device-1',
          deviceName: 'Windows 桌面浏览器',
          claimedAt: 1710000000000,
          lastSeenAt: 1710000001000
        }
      ]
    })
  })

  it('releases the target device on POST action=release and clears the current device cookie when needed', async () => {
    mocks.readAccessEnv.mockReturnValue({
      deviceBindingEnabled: true,
      sessionSecret: 'secret'
    })
    mocks.verifyAccessRequest.mockReturnValue({
      ok: true,
      session: {
        provider: 'discord',
        userId: 'user-1'
      }
    })
    mocks.removeAccessDeviceRegistration.mockResolvedValue({
      ok: true,
      removed: true,
      slotCount: 1,
      slotLimit: 3,
      devices: [
        {
          deviceId: 'device-1',
          deviceName: 'Windows 桌面浏览器',
          claimedAt: 1710000000000,
          lastSeenAt: 1710000001000
        }
      ]
    })
    mocks.readAccessDeviceFromCookieHeader.mockReturnValue({
      deviceId: 'device-2'
    })

    const req = {
      method: 'POST',
      headers: {
        cookie: 'aichat_access_device=device-2'
      },
      body: {
        action: 'release',
        deviceId: 'device-2'
      }
    }
    const res = createMockRes()

    await handler(req, res)

    expect(mocks.removeAccessDeviceRegistration).toHaveBeenCalledWith(expect.any(Object), {
      provider: 'discord',
      userId: 'user-1'
    }, 'device-2')
    expect(mocks.createClearedCookie).toHaveBeenCalledWith(req, 'aichat_access_device')
    expect(res.headers['set-cookie']).toBe('aichat_access_device=; Max-Age=0')
    expect(res.statusCode).toBe(200)
    expect(res.jsonBody).toEqual({
      ok: true,
      removed: true,
      releasedDeviceId: 'device-2',
      slotCount: 1,
      slotLimit: 3,
      devices: [
        {
          deviceId: 'device-1',
          deviceName: 'Windows 桌面浏览器',
          claimedAt: 1710000000000,
          lastSeenAt: 1710000001000
        }
      ]
    })
  })
})
