const ICON_VERSION = '20260310'
const APP_ICON = `./icons/icon-192.png?v=${ICON_VERSION}`
const APP_BADGE = `./icons/icon-192.png?v=${ICON_VERSION}`

function getWindowNotification() {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) return null
  return window.Notification
}

function normalizeHashTarget(rawUrl) {
  const raw = String(rawUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('./#/')) return raw.slice(3)
  if (raw.startsWith('/#/')) return raw.slice(2)
  if (raw.startsWith('#/')) return raw.slice(1)
  if (raw.startsWith('/')) return raw
  return ''
}

function navigateFromNotificationData(data) {
  if (typeof window === 'undefined') return false
  const target = normalizeHashTarget(data?.url)
  if (!target) return false
  if (window.location.hash === `#${target}`) return true
  window.location.hash = target
  return true
}

export function isNotificationSupported() {
  return !!getWindowNotification()
}

export function getNotificationPermission() {
  const NotificationCtor = getWindowNotification()
  if (!NotificationCtor) return 'unsupported'
  return NotificationCtor.permission
}

export async function requestNotificationPermission() {
  const NotificationCtor = getWindowNotification()
  if (!NotificationCtor) return { granted: false, permission: 'unsupported' }
  try {
    const permission = await NotificationCtor.requestPermission()
    return { granted: permission === 'granted', permission }
  } catch {
    return { granted: false, permission: NotificationCtor.permission || 'denied' }
  }
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return reg || null
  } catch {
    return null
  }
}

export async function showSystemNotification(options = {}) {
  const NotificationCtor = getWindowNotification()
  if (!NotificationCtor) return false
  if (NotificationCtor.permission !== 'granted') return false

  const title = String(options.title || 'AI Chat')
  const payload = {
    body: String(options.body || ''),
    tag: options.tag || undefined,
    data: options.data || undefined,
    silent: !!options.silent,
    requireInteraction: !!options.requireInteraction,
    renotify: !!options.renotify,
    timestamp: Number.isFinite(Number(options.timestamp)) ? Number(options.timestamp) : undefined,
    vibrate: Array.isArray(options.vibrate) ? options.vibrate : undefined,
    icon: options.icon || APP_ICON,
    badge: options.badge || APP_BADGE
  }

  const reg = await getServiceWorkerRegistration()
  if (reg?.showNotification) {
    try {
      await reg.showNotification(title, payload)
      return true
    } catch {
      // Fall through to Notification constructor.
    }
  }

  try {
    const notification = new NotificationCtor(title, payload)
    notification.onclick = (event) => {
      try { event?.preventDefault?.() } catch { /* noop */ }
      try { window.focus?.() } catch { /* noop */ }
      navigateFromNotificationData(payload.data)
      try { notification.close?.() } catch { /* noop */ }
    }
    return true
  } catch {
    return false
  }
}

export async function closeSystemNotificationsByTag(tag) {
  if (!tag) return
  const reg = await getServiceWorkerRegistration()
  if (!reg?.getNotifications) return
  try {
    const notifications = await reg.getNotifications({ tag })
    notifications.forEach((notification) => {
      try { notification.close() } catch { /* noop */ }
    })
  } catch {
    // noop
  }
}

export async function postMessageToServiceWorker(message) {
  if (!message || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const target = reg?.active || navigator.serviceWorker.controller
    if (!target) return false
    target.postMessage(message)
    return true
  } catch {
    return false
  }
}
