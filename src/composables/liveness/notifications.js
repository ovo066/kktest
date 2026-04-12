import { useDynamicIsland } from '../useDynamicIsland'
import { showSystemNotification } from '../useSystemNotifications'
import { sendPushViaServer } from '../usePushChannel'
import { useSoundEffects } from '../useSoundEffects'

export async function sendNotification(contact, preview, config, { type = 'chat', momentId = null } = {}) {
  const mode = config.notifyMode || 'island'
  if (mode === 'none') return

  // 灵动岛通知
  if (mode === 'island' || mode === 'both') {
    try {
      const island = useDynamicIsland()
      island.push({
        name: contact.name || 'AI',
        preview: preview.slice(0, 60),
        avatar: contact.avatar || null,
        avatarType: contact.avatarType || null,
        contactId: contact.id,
        momentId,
        type
      })
    } catch { /* island not available */ }
  }

  // 系统通知（Service Worker showNotification 优先）
  if (mode === 'browser' || mode === 'both') {
    const url = (type === 'moment' && momentId)
      ? `#/moments/${momentId}`
      : `#/chat/${contact.id}`
    const notificationPayload = {
      title: contact.name || 'AI',
      body: preview.slice(0, 100),
      tag: `liveness-${contact.id}-${type}`,
      data: {
        type,
        contactId: contact.id,
        momentId,
        url
      },
      silent: false,
      renotify: true,
      timestamp: Date.now(),
      vibrate: [180, 80, 180]
    }

    const pushEnabled = !!config.pushEnabled
    if (pushEnabled) {
      try {
        const pushRes = await sendPushViaServer(notificationPayload, {
          apiBase: config.pushApiBase || '/api',
          authToken: config.pushAuthToken || ''
        })
        if (pushRes.ok) return
      } catch {
        // Fall back to local system notification.
      }
    }

    await showSystemNotification(notificationPayload)
  }
}

export function markPendingUserMessagesAsRead(contact, reason = 'assistant_reply') {
  if (!contact || !Array.isArray(contact.msgs)) return 0
  const now = Date.now()
  let changed = 0
  for (const msg of contact.msgs) {
    if (!msg || msg.role !== 'user') continue
    if (msg.hideInChat || msg.hidden) continue
    const current = String(msg.readStatus || '').trim().toLowerCase()
    const alreadyRead = current === 'read' || (Number.isFinite(Number(msg.readAt)) && Number(msg.readAt) > 0)
    if (alreadyRead) continue
    msg.readStatus = 'read'
    msg.readAt = now
    if (reason) msg.readReason = reason
    changed += 1
  }
  if (changed > 0) {
    useSoundEffects().playEvent('readReceipt')
  }
  return changed
}
