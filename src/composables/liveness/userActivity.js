/**
 * 用户活动事件源 — 检测用户离开/返回，触发相应事件
 */
import { EventType, isQuietHours } from './eventTypes'

export function createUserActivitySource({ emit, store, livenessStore }) {
  let lastVisibleTime = Date.now()
  let handleVisibility = null

  function onVisible() {
    const config = store.livenessConfig
    if (!store.allowLivenessEngine) return
    if (isQuietHours(config)) return

    const now = Date.now()
    const awayMs = now - lastVisibleTime
    const awayMinutes = awayMs / 60000

    // 离开超过 5 分钟才算"回来"
    if (awayMinutes < 5) {
      lastVisibleTime = now
      return
    }

    // 对每个联系人检查是否需要触发 user_return
    const contacts = store.contacts || []
    for (const contact of contacts) {
      if (contact.type === 'group') continue
      const s = livenessStore.getState(contact.id)
      const cooldown = config.proactiveCooldown || 1800000
      const sinceLastProactive = now - (s.lastProactiveMsg || 0)
      if (sinceLastProactive < cooldown) continue

      emit({
        type: EventType.USER_RETURN,
        contactId: contact.id,
        context: {
          awayMinutes: Math.round(awayMinutes),
          loneliness: s.loneliness,
          affection: s.affection
        }
      })
    }

    lastVisibleTime = now
  }

  function start() {
    stop()
    lastVisibleTime = Date.now()
    handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        onVisible()
      } else {
        lastVisibleTime = Date.now()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
  }

  function stop() {
    if (handleVisibility) {
      document.removeEventListener('visibilitychange', handleVisibility)
      handleVisibility = null
    }
  }

  return { start, stop }
}
