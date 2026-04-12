import { useAccessControlStore } from '../stores/accessControl'
import { consumeAccessErrorFromUrl, mapAccessErrorCode } from '../utils/accessControl'
import { buildAccessDevicePayload } from '../utils/accessDeviceClient'

const ACCESS_SESSION_ENDPOINT = '/api/access-session'
const ACCESS_START_ENDPOINT = '/api/access-discord-start'
const ACCESS_ADMIN_LOGIN_ENDPOINT = '/api/access-admin-login'
const ACCESS_ADMIN_STATS_ENDPOINT = '/api/access-admin-stats'
const ACCESS_DEVICE_CLAIM_ENDPOINT = '/api/access-device-claim'
const ACCESS_LOGOUT_ENDPOINT = '/api/access-logout'

function getCurrentReturnTo() {
  if (typeof window === 'undefined') return '#/'
  const hash = String(window.location.hash || '').trim()
  return hash.startsWith('#/') ? hash : '#/'
}

function resolveAccessBootstrapError(redirectErrorCode = '') {
  if (redirectErrorCode) return mapAccessErrorCode(redirectErrorCode)
  return '访问验证服务暂不可用'
}

async function readJsonSafely(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function mergeClaimResult(payload, claimPayload) {
  return {
    ...payload,
    deviceAuthenticated: true,
    deviceClaimRequired: false,
    session: claimPayload.session && typeof claimPayload.session === 'object'
      ? { ...claimPayload.session }
      : {
          ...(payload.session || {}),
          deviceId: claimPayload.deviceId || '',
          deviceName: claimPayload.deviceName || '',
          deviceSlotCount: Math.max(0, Number(claimPayload.slotCount || 0) || 0),
          deviceSlotLimit: Math.max(0, Number(claimPayload.slotLimit || payload.deviceSlotLimit || 0) || 0),
          deviceAuthenticated: true
        }
  }
}

export function useAccessControl() {
  const accessStore = useAccessControlStore()

  async function claimCurrentDevice() {
    const devicePayload = buildAccessDevicePayload()
    const response = await fetch(ACCESS_DEVICE_CLAIM_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(devicePayload)
    })
    const claimPayload = await readJsonSafely(response)

    if (!response.ok) {
      const error = new Error(String(claimPayload.error || `device_claim_${response.status}`))
      error.code = claimPayload.error || `device_claim_${response.status}`
      error.payload = claimPayload
      throw error
    }

    return claimPayload
  }

  async function refreshAccessSession(options = {}) {
    const redirectErrorCode = options.consumeRedirectError === false
      ? ''
      : consumeAccessErrorFromUrl()

    accessStore.startCheck()

    try {
      const response = await fetch(ACCESS_SESSION_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`access_session_${response.status}`)
      }

      let payload = await response.json()

      if (
        payload.authenticated
        && payload.deviceBindingEnabled
        && payload.session?.provider !== 'admin'
        && payload.deviceAuthenticated !== true
      ) {
        try {
          const claimPayload = await claimCurrentDevice()
          payload = mergeClaimResult(payload, claimPayload)
        } catch (error) {
          accessStore.applyStatus({
            ...payload,
            deviceAuthenticated: false,
            deviceClaimRequired: true
          })
          accessStore.setError(mapAccessErrorCode(error?.code), error?.code)
          return false
        }
      }

      accessStore.applyStatus(payload)

      if (payload.enabled && payload.configured === false) {
        accessStore.setError(mapAccessErrorCode('service_misconfigured'), 'service_misconfigured')
        return false
      }

      if (redirectErrorCode && !accessStore.isAuthenticated) {
        accessStore.setError(mapAccessErrorCode(redirectErrorCode), redirectErrorCode)
      }

      return accessStore.canAccessApp
    } catch {
      if (import.meta.env.DEV) {
        accessStore.applyStatus({
          enabled: false,
          configured: true,
          authenticated: false,
          provider: 'discord',
          guildId: '',
          session: null
        })
        return true
      }

      accessStore.blockAccess(resolveAccessBootstrapError(redirectErrorCode), {
        enabled: true,
        configured: false,
        discordConfigured: false,
        adminCodeEnabled: false,
        deviceBindingEnabled: false,
        deviceSlotLimit: 0,
        errorCode: redirectErrorCode || 'service_unavailable'
      })
      return false
    }
  }

  async function bootstrapAccessControl(options = {}) {
    return refreshAccessSession(options)
  }

  function beginDiscordLogin(options = {}) {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams()
    params.set('returnTo', options.returnTo || getCurrentReturnTo())
    if (options.force) {
      params.set('force', '1')
    }
    window.location.assign(`${ACCESS_START_ENDPOINT}?${params.toString()}`)
  }

  async function submitAdminCode(code = '') {
    const normalizedCode = String(code || '').trim()
    if (!normalizedCode) {
      accessStore.setError('请输入管理员验证码')
      return false
    }

    accessStore.startCheck()
    accessStore.clearError()

    try {
      const response = await fetch(ACCESS_ADMIN_LOGIN_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: normalizedCode })
      })
      const payload = await readJsonSafely(response)

      if (!response.ok) {
        accessStore.setError(mapAccessErrorCode(payload.error), payload.error)
        return false
      }

      return refreshAccessSession({ consumeRedirectError: false })
    } catch {
      accessStore.setError('管理员验证码验证失败，请稍后重试')
      return false
    }
  }

  async function logoutAccessControl(options = {}) {
    try {
      await fetch(ACCESS_LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      })
    } catch {
      // clear local runtime state even if the request fails
    }

    accessStore.clearError()
    accessStore.clearSession()

    if (options.reload !== false && typeof window !== 'undefined') {
      window.location.assign('/')
    }
  }

  async function fetchAdminStats() {
    const response = await fetch(ACCESS_ADMIN_STATS_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    })
    const payload = await readJsonSafely(response)

    if (!response.ok) {
      const error = new Error(String(payload.error || `access_admin_stats_${response.status}`))
      error.code = payload.error || `access_admin_stats_${response.status}`
      error.payload = payload
      throw error
    }

    return payload
  }

  async function fetchAccessDevices() {
    const response = await fetch(ACCESS_DEVICE_CLAIM_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    })
    const payload = await readJsonSafely(response)

    if (!response.ok) {
      const error = new Error(String(payload.error || `access_devices_${response.status}`))
      error.code = payload.error || `access_devices_${response.status}`
      error.payload = payload
      throw error
    }

    return payload
  }

  async function releaseAccessDevice(deviceId = '') {
    const normalizedDeviceId = String(deviceId || '').trim()
    if (!normalizedDeviceId) {
      const error = new Error('bad_request')
      error.code = 'bad_request'
      throw error
    }

    const response = await fetch(ACCESS_DEVICE_CLAIM_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'release',
        deviceId: normalizedDeviceId
      })
    })
    const payload = await readJsonSafely(response)

    if (!response.ok) {
      const error = new Error(String(payload.error || `access_device_release_${response.status}`))
      error.code = payload.error || `access_device_release_${response.status}`
      error.payload = payload
      throw error
    }

    return payload
  }

  return {
    accessStore,
    bootstrapAccessControl,
    refreshAccessSession,
    beginDiscordLogin,
    submitAdminCode,
    logoutAccessControl,
    fetchAdminStats,
    fetchAccessDevices,
    releaseAccessDevice
  }
}
