/**
 * 心跳事件源 — 定时触发，让 AI 有机会决定是否主动发消息
 */
import { EventType, isQuietHours } from './eventTypes'

export function createHeartbeatSource({ emit, store, livenessStore }) {
  let timer = null

  function tick() {
    const config = store.livenessConfig
    if (!store.allowLivenessEngine) return
    if (isQuietHours(config)) return

    const contacts = store.contacts || []
    for (const contact of contacts) {
      if (contact.type === 'group') continue

      // 随机过滤：每次心跳每个联系人只有 30% 概率被检查
      // 这样避免所有角色同时触发，更像真人的随机性
      if (Math.random() > 0.3) continue

      const s = livenessStore.applyDecay(contact.id)
      const cooldown = config.proactiveCooldown || 1800000
      const sinceLastProactive = Date.now() - (s.lastProactiveMsg || 0)
      if (sinceLastProactive < cooldown) continue

      // 距上次互动越久，触发概率越高（但仍有随机性）
      const idleHours = (Date.now() - s.lastInteraction) / 3600000
      if (idleHours < 1 && Math.random() > 0.15) continue

      emit({
        type: EventType.HEARTBEAT,
        contactId: contact.id,
        context: {
          idleHours: idleHours.toFixed(1),
          loneliness: s.loneliness,
          mood: s.mood,
          energy: s.energy,
          affection: s.affection
        }
      })
    }
  }

  function start() {
    stop()
    const interval = store.livenessConfig?.heartbeatInterval || 600000
    timer = setInterval(tick, interval)
    // 启动后立即执行一次，让引擎马上有反应
    setTimeout(tick, 3000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return { start, stop }
}
