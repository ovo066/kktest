/**
 * 日程感知事件源 — 按需生成角色日程，跟踪忙/闲状态
 */
import { EventType, isQuietHours } from './eventTypes'
import { usePlannerStore } from '../../stores/planner'
import { useStorage } from '../useStorage'
import { getBeijingTimeHHMM } from '../../utils/beijingTime'
import { toLocalDateKey } from '../../utils/dateKey'

const lastActivityStates = new Map() // contactId -> 'busy'|'free'
const lastConflictStates = new Map() // contactId -> conflictKey

function getNowTimeString() {
  return getBeijingTimeHHMM()
}

function isUserEventActiveNow(event, nowTime) {
  if (!event || event.completed) return false
  if (event.allDay) return true
  const startTime = event.startTime || event.dueTime || ''
  const endTime = event.endTime || ''
  if (!startTime) return false
  if (!endTime) return nowTime >= startTime
  return startTime <= nowTime && nowTime < endTime
}

function findScheduleConflict(contact, contacts, plannerStore, dateStr, nowTime) {
  if (!contact?.name) return null
  const otherContacts = (contacts || []).filter(c => c && c.type !== 'group' && c.id !== contact.id && c.name)
  if (otherContacts.length === 0) return null

  const events = plannerStore.getEventsForDate(dateStr).filter(e => e.shareWithAI && !e.completed)
  for (const event of events) {
    if (!isUserEventActiveNow(event, nowTime)) continue
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase()
    if (!text) continue
    if (text.includes(String(contact.name).toLowerCase())) continue
    const matched = otherContacts.find(other => text.includes(String(other.name).toLowerCase()))
    if (matched) {
      return { event, otherContact: matched }
    }
  }
  return null
}

export function createScheduleTriggerSource({ emit, store, livenessStore: _livenessStore }) {
  let timer = null
  const { scheduleSave } = useStorage()

  async function check() {
    if (!store.allowLivenessEngine) return
    if (!store.allowPlannerAI) return
    if (!store.allowCharacterSchedule) return
    if (isQuietHours(store.livenessConfig)) return

    let plannerStore
    try {
      plannerStore = usePlannerStore()
    } catch { return }

    // 清理旧日程
    if (plannerStore.pruneOldSchedules()) {
      scheduleSave()
    }

    const todayStr = toLocalDateKey()
    const nowTime = getNowTimeString()
    const contacts = store.contacts || []

    for (const contact of contacts) {
      if (contact.type === 'group') continue

      // 跟踪忙/闲状态变化
      const currentActivity = plannerStore.getCharacterCurrentActivity(contact.id)
      const isBusy = currentActivity && !currentActivity.interruptible
      const prevState = lastActivityStates.get(contact.id) || 'free'
      const newState = isBusy ? 'busy' : 'free'

      if (prevState !== newState) {
        lastActivityStates.set(contact.id, newState)
        if (newState === 'busy' && currentActivity) {
          emit({
            type: EventType.SCHEDULE_BUSY,
            contactId: contact.id,
            context: {
              activity: currentActivity.activity,
              location: currentActivity.location || '',
              mood: currentActivity.mood || '',
              interruptible: false
            }
          })
        }
      }

      const conflict = findScheduleConflict(contact, contacts, plannerStore, todayStr, nowTime)
      const prevConflictKey = lastConflictStates.get(contact.id) || ''
      const nextConflictKey = conflict ? `${conflict.event.id}:${conflict.otherContact.id}` : ''
      if (prevConflictKey !== nextConflictKey) {
        if (nextConflictKey) {
          emit({
            type: EventType.SCHEDULE_CONFLICT,
            contactId: contact.id,
            context: {
              eventTitle: conflict.event.title,
              otherCharacterName: conflict.otherContact.name
            }
          })
          lastConflictStates.set(contact.id, nextConflictKey)
        } else {
          lastConflictStates.delete(contact.id)
        }
      }
    }
  }

  function start() {
    stop()
    timer = setInterval(check, 15 * 60 * 1000) // 15分钟检查一次
    setTimeout(check, 8000)
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
  }

  return { start, stop }
}
