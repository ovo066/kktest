import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  getNotificationPermission,
  requestNotificationPermission,
  showSystemNotification
} from '../../../composables/useSystemNotifications'
import {
  ensurePushSubscription,
  getCurrentPushSubscription,
  isPushSupported,
  refreshPushSubscription,
  sendPushViaServer,
  unsubscribePushSubscription
} from '../../../composables/usePushChannel'

export function usePushSettings({ showToast, store }) {
  const notificationPermission = ref(getNotificationPermission())
  const pushBusy = ref(false)
  const pushSubscribed = ref(false)
  const pushSupported = computed(() => isPushSupported())
  const notificationPermissionLabel = computed(() => {
    const permission = notificationPermission.value
    if (permission === 'granted') return '已授权'
    if (permission === 'denied') return '已拒绝'
    if (permission === 'default') return '去授权'
    return '不支持'
  })
  const pushSubscriptionLabel = computed(() => {
    if (!pushSupported.value) return '不支持'
    return pushSubscribed.value ? '已订阅' : '未订阅'
  })

  function refreshNotificationPermission() {
    notificationPermission.value = getNotificationPermission()
    void refreshPushSubscriptionState()
  }

  async function handleRequestNotificationPermission() {
    const result = await requestNotificationPermission()
    notificationPermission.value = result.permission || getNotificationPermission()
    if (result.permission === 'granted') {
      showToast('通知权限已开启')
      return
    }
    if (result.permission === 'denied') {
      showToast('通知权限被拒绝，请在系统设置中开启')
      return
    }
    showToast('当前环境不支持通知')
  }

  async function handleTestNotification() {
    const permission = notificationPermission.value
    if (permission !== 'granted') {
      showToast('请先开启通知权限')
      return
    }
    const ok = await showSystemNotification({
      title: 'AI Chat 测试通知',
      body: '如果你看到了这条通知，系统通知链路已生效。',
      tag: 'aichat-test-notification',
      data: { type: 'test', url: '#/settings' },
      silent: false
    })
    showToast(ok ? '测试通知已发送' : '测试通知发送失败')
  }

  function getPushApiBase() {
    return String(store.livenessConfig.pushApiBase || '/api').trim() || '/api'
  }

  function getPushAuthToken() {
    return String(store.livenessConfig.pushAuthToken || '').trim()
  }

  function formatPushError(prefix, result) {
    const code = String(result?.error || 'unknown_error').trim()
    const status = Number(result?.status || result?.statusCode)
    const providerReason = String(result?.providerReason || '').trim()
    const message = String(result?.message || '').trim()
    const detail = providerReason
      ? (message ? `${providerReason}; ${message}` : providerReason)
      : message
    const shortMessage = detail ? detail.slice(0, 110) : ''
    const codeWithStatus = Number.isFinite(status) && status > 0 ? `${code}/${status}` : code
    if (shortMessage) return `${prefix}（${codeWithStatus}: ${shortMessage}）`
    return `${prefix}（${codeWithStatus}）`
  }

  function shouldRetryPushWithRefresh(result) {
    if (!result || result.ok) return false
    if (result.expired) return true
    if (result.error === 'subscription_expired' || result.error === 'invalid_subscription') return true
    const status = Number(result.status || result.statusCode)
    if (status === 404 || status === 410) return true
    const text = `${String(result.providerReason || '')} ${String(result.message || '')}`.toLowerCase()
    if (text.includes('status=404') || text.includes('status=410')) return true
    if (text.includes('permanently-removed.invalid')) return true
    if (text.includes('enotfound') && text.includes('invalid')) return true
    if (text.includes('unregistered') || text.includes('no such subscription')) return true
    return false
  }

  function showPushSendFailure(result) {
    if (result?.error === 'unauthorized') { showToast('Push Token 无效'); return }
    if (result?.error === 'push_not_configured') { showToast('服务端未配置 VAPID'); return }
    if (result?.expired || result?.error === 'subscription_expired') { showToast('订阅已过期，请重新订阅'); return }
    if (result?.error === 'invalid_subscription') { showToast('订阅数据无效，请取消后重新订阅（建议使用 Chrome）'); return }
    if (result?.error === 'network_error') { showToast('网络错误，无法访问 Push 服务'); return }
    showToast(formatPushError('Push 测试发送失败', result || { error: 'unknown_error' }))
  }

  function buildPushTestPayload() {
    return {
      title: 'AI Chat Web Push 测试',
      body: '如果你收到这条，说明服务端推送链路已生效。',
      tag: 'aichat-server-push-test',
      data: { type: 'test', url: '#/settings' },
      silent: false
    }
  }

  async function sendPushTestToSubscription(subscription) {
    return sendPushViaServer(buildPushTestPayload(), {
      apiBase: getPushApiBase(),
      authToken: getPushAuthToken(),
      subscription
    })
  }

  async function refreshPushSubscriptionState() {
    if (!pushSupported.value) {
      pushSubscribed.value = false
      return
    }
    const sub = await getCurrentPushSubscription()
    pushSubscribed.value = !!sub
  }

  async function handleTogglePushSubscription() {
    if (!pushSupported.value || pushBusy.value) return
    pushBusy.value = true
    try {
      if (pushSubscribed.value) {
        const res = await unsubscribePushSubscription()
        if (!res.ok) showToast('取消订阅失败')
        else showToast('已取消 Push 订阅')
      } else {
        const res = await ensurePushSubscription({ apiBase: getPushApiBase() })
        if (!res.ok) {
          if (res.error === 'service_worker_unavailable') showToast('Service Worker 不可用')
          else if (res.error === 'notification_permission_denied') showToast('通知权限未开启')
          else if (res.error === 'missing_vapid_public_key') showToast('服务端未配置 VAPID 公钥')
          else if (res.error === 'invalid_subscription') showToast('订阅数据无效，请换 Chrome 或重装应用后重试')
          else showToast(formatPushError('Push 订阅失败', res))
        } else {
          showToast('Push 订阅成功')
        }
      }
    } finally {
      await refreshPushSubscriptionState()
      pushBusy.value = false
    }
  }

  async function handleTestServerPush() {
    if (!pushSupported.value || pushBusy.value) return
    pushBusy.value = true
    try {
      const ensured = await ensurePushSubscription({ apiBase: getPushApiBase() })
      if (!ensured.ok) {
        if (ensured.error === 'notification_permission_denied') showToast('请先开启通知权限')
        else if (ensured.error === 'missing_vapid_public_key') showToast('服务端未配置 VAPID 公钥')
        else if (ensured.error === 'service_worker_unavailable') showToast('Service Worker 不可用')
        else if (ensured.error === 'invalid_subscription') showToast('订阅数据无效，请取消后重新订阅')
        else showToast(formatPushError('Push 订阅失败，无法测试', ensured))
        return
      }
      let res = await sendPushTestToSubscription(ensured.subscription)
      let refreshed = false
      if (!res.ok && shouldRetryPushWithRefresh(res)) {
        const refreshRes = await refreshPushSubscription({ apiBase: getPushApiBase() })
        if (refreshRes.ok) {
          refreshed = true
          res = await sendPushTestToSubscription(refreshRes.subscription)
        } else {
          showToast(formatPushError('订阅刷新失败', refreshRes))
          showPushSendFailure(res)
          return
        }
      }
      if (res.ok) {
        showToast(refreshed ? 'Push 测试已发送（订阅已自动刷新）' : 'Push 测试已发送')
        return
      }
      showPushSendFailure(res)
    } finally {
      await refreshPushSubscriptionState()
      pushBusy.value = false
    }
  }

  onMounted(() => {
    notificationPermission.value = getNotificationPermission()
    void refreshPushSubscriptionState()
    document.addEventListener('visibilitychange', refreshNotificationPermission)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', refreshNotificationPermission)
  })

  return {
    handleRequestNotificationPermission,
    handleTestNotification,
    handleTestServerPush,
    handleTogglePushSubscription,
    notificationPermissionLabel,
    pushBusy,
    pushSubscribed,
    pushSubscriptionLabel,
    pushSupported
  }
}
