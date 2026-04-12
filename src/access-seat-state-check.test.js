import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAccessControlStore } from './stores/accessControl'
import { useAccessControl } from './composables/useAccessControl'

describe('seat manager state flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function resolveShowSeatManager(store) {
    return !!(
      store.isEnabled
      && store.deviceBindingEnabled
      && store.isAuthenticated
      && store.session?.provider !== 'admin'
      && store.deviceClaimRequired
    )
  }

  function createFetchMock(claimErrorCode = 'device_limit_reached') {
    return vi.fn(async (url) => {
      if (url === '/api/access-session') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            enabled: true,
            configured: true,
            discordConfigured: true,
            adminCodeEnabled: false,
            deviceBindingEnabled: true,
            deviceSlotLimit: 3,
            provider: 'discord',
            guildId: '',
            ruleCount: 0,
            hasRoleRules: false,
            authenticated: true,
            deviceAuthenticated: false,
            deviceClaimRequired: true,
            session: {
              provider: 'discord',
              userId: 'user-1',
              username: 'tester',
              globalName: 'Tester',
              deviceId: '',
              deviceName: '',
              deviceSlotCount: 3,
              deviceSlotLimit: 3,
              deviceAuthenticated: false,
              authenticatedAt: Date.now(),
              expiresAt: Date.now() + 3600000
            }
          })
        }
      }

      if (url === '/api/access-device-claim') {
        return {
          ok: false,
          json: async () => ({
            ok: false,
            error: claimErrorCode,
            slotCount: 3,
            slotLimit: 3
          })
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
  }

  it('enters the seat manager branch when device claim fails with device_limit_reached', async () => {
    const fetchMock = createFetchMock('device_limit_reached')

    globalThis.fetch = fetchMock

    const { refreshAccessSession } = useAccessControl()
    const canAccess = await refreshAccessSession({ consumeRedirectError: false })
    const store = useAccessControlStore()

    expect(canAccess).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.lastErrorCode).toBe('device_limit_reached')
    expect(store.lastError).toBe('这个账号的设备席位已满，请先弹出一台已登录设备再继续')
    expect(store.deviceClaimRequired).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(resolveShowSeatManager(store)).toBe(true)
  })

  it('still shows the seat manager when current device needs binding for non-limit errors', async () => {
    const fetchMock = createFetchMock('device_binding_unavailable')

    globalThis.fetch = fetchMock

    const { refreshAccessSession } = useAccessControl()
    await refreshAccessSession({ consumeRedirectError: false })
    const store = useAccessControlStore()

    expect(store.lastErrorCode).toBe('device_binding_unavailable')
    expect(store.deviceClaimRequired).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(resolveShowSeatManager(store)).toBe(true)
  })
})
