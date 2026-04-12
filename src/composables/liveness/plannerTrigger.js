/**
 * 日程提醒事件源 — 在待办截止前 reminderBefore 分钟触发
 */
import { EventType, isQuietHours } from './eventTypes'
import { usePlannerStore } from '../../stores/planner'
import { toLocalDateKey } from '../../utils/dateKey'

// 已触发提醒的事件 ID（避免重复提醒）
const remindedIds = new Set()

function getReminderTimeString(event) {
  const time = event?.startTime || event?.dueTime || ''
  if (time) return time
  return event?.allDay ? '09:00' : ''
}

export function createPlannerTriggerSource({ emit, store, livenessStore }) {
  let timer = null

  function check() {
    if (!store.allowLivenessEngine) return
    if (!store.allowPlannerAI) return
    if (isQuietHours(store.livenessConfig)) return

    let plannerStore
    try {
      plannerStore = usePlannerStore()
    } catch {
      return
    }

    const now = Date.now()
    const todayStr = toLocalDateKey()

    const todayEvents = plannerStore.getEventsForDate(todayStr).filter(e =>
      !e.completed && e.shareWithAI && getReminderTimeString(e) && e.reminderBefore > 0
    )

    for (const evt of todayEvents) {
      if (remindedIds.has(evt.id)) continue

      // 计算事件的本地时间戳（业务时间统一使用北京时间日期键）
      const timeStr = getReminderTimeString(evt)
      const [h, m] = timeStr.split(':').map(Number)
      const evtDate = new Date()
      evtDate.setHours(h, m, 0, 0)
      const evtTs = evtDate.getTime()

      // 提醒窗口：[dueTime - reminderBefore, dueTime]
      const windowStart = evtTs - evt.reminderBefore * 60000
      const windowEnd = evtTs

      if (now >= windowStart && now <= windowEnd) {
        remindedIds.add(evt.id)

        const contacts = store.contacts || []
        for (const contact of contacts) {
          if (contact.type === 'group') continue
          const s = livenessStore.getState(contact.id)
          const cooldown = store.livenessConfig?.proactiveCooldown || 1800000
          if (now - (s.lastProactiveMsg || 0) < cooldown) continue

          emit({
            type: EventType.PLANNER_REMINDER,
            contactId: contact.id,
            context: {
              eventTitle: evt.title,
              eventTime: evt.allDay ? '全天' : timeStr,
              minutesBefore: evt.reminderBefore,
              affection: s.affection,
              mood: s.mood
            }
          })
        }
      }
    }
  }

  function start() {
    stop()
    // 每 5 分钟检查一次
    timer = setInterval(check, 5 * 60 * 1000)
    setTimeout(check, 10000)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return { start, stop }
}
