import {
  closeSystemNotificationsByTag,
  postMessageToServiceWorker,
  showSystemNotification
} from '../useSystemNotifications'

export function createKeepAliveController({ store }) {
  let keepAliveTimer = null
  let keepAliveVisibilityHandler = null
  let keepAliveWakeLock = null

  async function tryAcquireWakeLock() {
    if (!store.allowLivenessEngine) return
    if (!store.livenessConfig?.backgroundKeepAlive) return
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    if (keepAliveWakeLock) return

    try {
      keepAliveWakeLock = await navigator.wakeLock.request('screen')
      keepAliveWakeLock?.addEventListener?.('release', () => {
        keepAliveWakeLock = null
      })
    } catch {
      keepAliveWakeLock = null
    }
  }

  async function releaseWakeLock() {
    if (!keepAliveWakeLock) return
    try {
      await keepAliveWakeLock.release()
    } catch {
      // noop
    }
    keepAliveWakeLock = null
  }

  async function updateKeepAliveNotification() {
    if (!store.allowLivenessEngine || !store.livenessConfig?.backgroundKeepAlive) {
      await closeSystemNotificationsByTag('aichat-keepalive')
      return
    }

    const mode = store.livenessConfig?.notifyMode || 'island'
    const supportsSystemNotification = mode === 'browser' || mode === 'both'
    if (!supportsSystemNotification) return

    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (hidden) {
      await showSystemNotification({
        title: 'AI Chat 后台保活已开启',
        body: '拟真互动会尽量在后台持续运行（仍受系统限制）。',
        tag: 'aichat-keepalive',
        data: { type: 'keepalive', url: '#/messages' },
        silent: true,
        requireInteraction: false
      })
      return
    }

    await closeSystemNotificationsByTag('aichat-keepalive')
  }

  function startKeepAlive() {
    stopKeepAlive()
    if (!store.allowLivenessEngine) return
    if (!store.livenessConfig?.backgroundKeepAlive) return
    if (typeof document === 'undefined') return

    keepAliveTimer = setInterval(() => {
      if (!store.allowLivenessEngine || !store.livenessConfig?.backgroundKeepAlive) return
      void postMessageToServiceWorker({ type: 'liveness_keepalive_ping', time: Date.now() })
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void tryAcquireWakeLock()
      }
    }, 30000)

    keepAliveVisibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void tryAcquireWakeLock()
      } else {
        void releaseWakeLock()
      }
      void updateKeepAliveNotification()
    }
    document.addEventListener('visibilitychange', keepAliveVisibilityHandler)
    void tryAcquireWakeLock()
    void updateKeepAliveNotification()
  }

  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer)
      keepAliveTimer = null
    }
    if (keepAliveVisibilityHandler) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', keepAliveVisibilityHandler)
      }
      keepAliveVisibilityHandler = null
    }
    void releaseWakeLock()
    void closeSystemNotificationsByTag('aichat-keepalive')
  }

  return {
    startKeepAlive,
    stopKeepAlive
  }
}
