// Register SW only in production. In dev, clear stale SW/cache to avoid stale module styles.
const SW_VERSION = __APP_BUILD_ID__
const SW_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

function askServiceWorkerToActivate(registration) {
  const waitingWorker = registration?.waiting
  if (!waitingWorker) return false
  waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  return true
}

function wireInstallingWorker(registration, shouldForceReload) {
  const installingWorker = registration?.installing
  if (!installingWorker) return

  installingWorker.addEventListener('statechange', () => {
    // New SW finished installing: if current page is controlled, promote it immediately.
    if (installingWorker.state !== 'installed') return
    if (!shouldForceReload()) return
    askServiceWorkerToActivate(registration)
  })
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event?.data
    if (!data || typeof data !== 'object') return
    if (data.type !== 'navigate') return
    const raw = String(data.url || '').trim()
    if (!raw) return

    let hashTarget = ''
    if (raw.startsWith('/#/')) hashTarget = raw.slice(2) // => /chat/xxx
    else if (raw.startsWith('#/')) hashTarget = raw.slice(1) // => /chat/xxx
    if (!hashTarget || window.location.hash === `#${hashTarget}`) return
    window.location.hash = hashTarget
  })

  window.addEventListener('load', async () => {
    if (import.meta.env.PROD) {
      const base = import.meta.env.BASE_URL || '/'
      const swUrl = new URL(`sw.js?v=${SW_VERSION}`, new URL(base, window.location.href))
      let registration = null
      try {
        registration = await navigator.serviceWorker.register(swUrl.href, { updateViaCache: 'none' })
      } catch {
        // Ignore registration failures.
      }
      if (!registration) return

      const shouldForceReload = () => !!navigator.serviceWorker.controller
      let isReloadingForUpdate = false

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!shouldForceReload()) return
        if (isReloadingForUpdate) return
        isReloadingForUpdate = true
        window.location.reload()
      })

      // If a waiting worker already exists, activate it now.
      if (shouldForceReload()) {
        askServiceWorkerToActivate(registration)
      }

      registration.addEventListener('updatefound', () => {
        wireInstallingWorker(registration, shouldForceReload)
      })
      wireInstallingWorker(registration, shouldForceReload)

      const triggerUpdateCheck = () => {
        registration.update().catch(() => {
          // Ignore update check failures.
        })
      }

      window.setInterval(triggerUpdateCheck, SW_UPDATE_CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          triggerUpdateCheck()
        }
      })
      return
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(reg => reg.unregister()))
    } catch {
      // Ignore cleanup failures in development.
    }

    if ('caches' in window) {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map(key => caches.delete(key)))
      } catch {
        // Ignore cache cleanup failures in development.
      }
    }
  })
}
