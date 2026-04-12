import { getNotificationPermission, requestNotificationPermission } from './useSystemNotifications'

function normalizeApiBase(apiBase) {
  const raw = String(apiBase || '/api').trim()
  if (!raw) return '/api'
  return raw.replace(/\/+$/, '')
}

function toUrl(path, apiBase) {
  return `${normalizeApiBase(apiBase)}${path}`
}

function isValidSubscriptionEndpoint(endpoint) {
  const raw = String(endpoint || '').trim()
  if (!raw) return false
  let parsed = null
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = String(parsed.hostname || '').toLowerCase()
  if (!host) return false
  if (host === 'permanently-removed.invalid' || host.endsWith('.invalid')) return false
  return true
}

function bytesToBase64Url(bytes) {
  if (!bytes || !bytes.length) return ''
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function normalizeSubscriptionKey(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (value instanceof ArrayBuffer) return bytesToBase64Url(new Uint8Array(value))
  if (ArrayBuffer.isView(value)) return bytesToBase64Url(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
  if (Array.isArray(value)) return bytesToBase64Url(Uint8Array.from(value))
  return ''
}

function serializePushSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return null
  const raw = (typeof subscription.toJSON === 'function') ? subscription.toJSON() : subscription
  const endpoint = String(raw?.endpoint || subscription.endpoint || '').trim()
  const rawKeys = (raw?.keys && typeof raw.keys === 'object') ? raw.keys : {}
  let p256dh = normalizeSubscriptionKey(rawKeys.p256dh)
  let auth = normalizeSubscriptionKey(rawKeys.auth)

  // Safari/iOS may only expose raw key bytes via getKey().
  if ((!p256dh || !auth) && typeof subscription.getKey === 'function') {
    if (!p256dh) p256dh = normalizeSubscriptionKey(subscription.getKey('p256dh'))
    if (!auth) auth = normalizeSubscriptionKey(subscription.getKey('auth'))
  }

  const payload = {
    endpoint,
    keys: {
      p256dh,
      auth
    }
  }
  if (raw && Object.prototype.hasOwnProperty.call(raw, 'expirationTime')) {
    payload.expirationTime = raw.expirationTime
  }
  return payload
}

function isValidSubscriptionPayload(subscription) {
  if (!subscription || typeof subscription !== 'object') return false
  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') return false
  if (!isValidSubscriptionEndpoint(subscription.endpoint)) return false
  const keys = subscription.keys
  if (!keys || typeof keys !== 'object') return false
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return false
  if (!keys.p256dh.trim() || !keys.auth.trim()) return false
  return true
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function readJsonSafe(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing) return existing
  } catch {
    // noop
  }
  try {
    const ready = await navigator.serviceWorker.ready
    if (ready) return ready
  } catch {
    // noop
  }
  return null
}

export function isPushSupported() {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function fetchPushConfig(options = {}) {
  const apiBase = normalizeApiBase(options.apiBase)
  try {
    const res = await fetch(toUrl('/push-config', apiBase), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    const data = await readJsonSafe(res)
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || `HTTP_${res.status}`,
        vapidPublicKey: ''
      }
    }
    return {
      ok: true,
      pushEnabled: !!data.pushEnabled,
      vapidPublicKey: String(data.vapidPublicKey || ''),
      requireAuthToken: !!data.requireAuthToken
    }
  } catch {
    return {
      ok: false,
      error: 'network_error',
      vapidPublicKey: ''
    }
  }
}

export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null
  const reg = await getServiceWorkerRegistration()
  if (!reg) return null
  try {
    const subscription = await reg.pushManager.getSubscription()
    return subscription || null
  } catch {
    return null
  }
}

export async function ensurePushSubscription(options = {}) {
  if (!isPushSupported()) {
    return { ok: false, error: 'push_not_supported' }
  }
  const forceResubscribe = !!options.forceResubscribe

  let permission = getNotificationPermission()
  if (permission !== 'granted') {
    const result = await requestNotificationPermission()
    permission = result.permission
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'notification_permission_denied' }
  }

  const reg = await getServiceWorkerRegistration()
  if (!reg) {
    return { ok: false, error: 'service_worker_unavailable' }
  }

  let subscription = null
  try {
    subscription = await reg.pushManager.getSubscription()
  } catch {
    return { ok: false, error: 'push_manager_error' }
  }

  if (subscription && forceResubscribe) {
    try {
      await subscription.unsubscribe()
    } catch {
      // Ignore unsubscribe failures and continue.
    }
    subscription = null
  }

  if (subscription) {
    const payload = serializePushSubscription(subscription)
    if (!isValidSubscriptionPayload(payload)) {
      try {
        await subscription.unsubscribe()
      } catch {
        // noop
      }
      subscription = null
    } else {
      return { ok: true, subscription: payload }
    }
  }

  const pushConfig = await fetchPushConfig(options)
  if (!pushConfig.ok) {
    return { ok: false, error: pushConfig.error || 'push_config_failed' }
  }
  if (!pushConfig.vapidPublicKey) {
    return { ok: false, error: 'missing_vapid_public_key' }
  }

  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushConfig.vapidPublicKey)
    })
    const payload = serializePushSubscription(subscription)
    if (!isValidSubscriptionPayload(payload)) {
      return { ok: false, error: 'invalid_subscription' }
    }
    return { ok: true, subscription: payload }
  } catch (error) {
    return { ok: false, error: error?.message || 'push_subscribe_failed' }
  }
}

export async function unsubscribePushSubscription() {
  const current = await getCurrentPushSubscription()
  if (!current) return { ok: true, unsubscribed: false }
  try {
    const unsubscribed = await current.unsubscribe()
    return { ok: true, unsubscribed }
  } catch (error) {
    return { ok: false, error: error?.message || 'push_unsubscribe_failed' }
  }
}

export async function refreshPushSubscription(options = {}) {
  return ensurePushSubscription({ ...options, forceResubscribe: true })
}

export async function sendPushViaServer(notification, options = {}) {
  const apiBase = normalizeApiBase(options.apiBase)
  const authToken = String(options.authToken || '').trim()

  let subscription = options.subscription || null
  if (!subscription) {
    const current = await getCurrentPushSubscription()
    if (!current) return { ok: false, error: 'missing_subscription' }
    subscription = serializePushSubscription(current)
  } else {
    subscription = serializePushSubscription(subscription) || subscription
  }
  if (!isValidSubscriptionPayload(subscription)) {
    return { ok: false, error: 'invalid_subscription', expired: false }
  }

  const headers = {
    'Content-Type': 'application/json'
  }
  if (authToken) {
    headers['x-push-token'] = authToken
  }

  try {
    const res = await fetch(toUrl('/push-send', apiBase), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription,
        notification
      })
    })
    const data = await readJsonSafe(res)
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || `HTTP_${res.status}`,
        expired: !!data.expired,
        message: typeof data.message === 'string' ? data.message : '',
        providerReason: typeof data.providerReason === 'string' ? data.providerReason : '',
        status: res.status
      }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'network_error',
      expired: false,
      message: 'network_request_failed'
    }
  }
}
