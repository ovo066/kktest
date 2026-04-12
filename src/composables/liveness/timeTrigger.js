/**
 * 时间触发事件源 — 在特定时间点触发（早安、午休、晚安等）
 */
import { EventType, isQuietHours, getTimePeriod, getTimePeriodLabel } from './eventTypes'
import { toBeijingDateKey } from '../../utils/beijingTime'

// 每个时段每天只触发一次
const firedToday = new Map()

function getTodayKey(period) {
  return `${toBeijingDateKey()}-${period}`
}

export function createTimeTriggerSource({ emit, store, livenessStore }) {
  let timer = null

  function check() {
    if (!store.allowLivenessEngine) return
    if (isQuietHours(store.livenessConfig)) return

    const period = getTimePeriod()
    const key = getTodayKey(period)
    if (firedToday.has(key)) return

    // 只在 morning / evening 触发（可扩展）
    if (period !== 'morning' && period !== 'evening') return

    firedToday.set(key, true)

    const contacts = store.contacts || []
    for (const contact of contacts) {
      if (contact.type === 'group') continue
      const s = livenessStore.getState(contact.id)
      const cooldown = store.livenessConfig?.proactiveCooldown || 1800000
      if (Date.now() - (s.lastProactiveMsg || 0) < cooldown) continue

      emit({
        type: EventType.TIME_TRIGGER,
        contactId: contact.id,
        context: {
          period,
          periodLabel: getTimePeriodLabel(),
          affection: s.affection,
          mood: s.mood
        }
      })
    }
  }

  function start() {
    stop()
    // 每 15 分钟检查一次时间触发
    timer = setInterval(check, 900000)
    // 启动时立即检查一次
    setTimeout(check, 5000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return { start, stop }
}
