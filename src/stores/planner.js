import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { makeId } from '../utils/id'
import { toLocalDateKey } from '../utils/dateKey'
import { getBeijingTimeHHMM } from '../utils/beijingTime'

const DEFAULT_CATEGORIES = [
  { id: 'work', name: '工作', icon: 'local_cafe', color: '#b8e0d2' },
  { id: 'personal', name: '个人', icon: 'potted_plant', color: '#f4c2c2' },
  { id: 'ideas', name: '灵感', icon: 'lightbulb', color: '#fff1a8' }
]

export const usePlannerStore = defineStore('planner', () => {
  const events = ref([])
  const diaryEntries = ref([])
  const categories = ref([...DEFAULT_CATEGORIES])
  const characterSchedules = ref({})

  function normalizeId(value) {
    if (value == null) return ''
    return String(value).trim()
  }

  // ── Event CRUD ──

  function addEvent(data) {
    const now = Date.now()
    const startDate = data.startDate || data.dueDate || ''
    const evt = {
      id: makeId('evt'),
      title: data.title || '',
      description: data.description || '',
      category: data.category || 'personal',
      kind: data.kind || 'todo',
      source: data.source || 'manual',
      sourceChatId: data.sourceChatId || '',
      sourceContactId: data.sourceContactId || '',
      sourceMessageId: data.sourceMessageId || '',
      extractedAt: data.extractedAt ?? null,
      completed: false,
      completedAt: null,
      startDate,
      endDate: data.endDate || startDate,
      startTime: data.startTime || data.dueTime || '',
      endTime: data.endTime || '',
      allDay: data.allDay ?? false,
      // backward compat aliases
      dueDate: startDate,
      dueTime: data.startTime || data.dueTime || '',
      reminderBefore: data.reminderBefore ?? 30,
      shareWithAI: data.shareWithAI ?? true,
      createdAt: now,
      updatedAt: now
    }
    events.value.push(evt)
    return evt
  }

  function updateEvent(id, updates) {
    const idx = events.value.findIndex(e => e.id === id)
    if (idx === -1) return null
    const evt = events.value[idx]
    Object.assign(evt, updates, { updatedAt: Date.now() })
    return evt
  }

  function removeEvent(id) {
    const idx = events.value.findIndex(e => e.id === id)
    if (idx !== -1) events.value.splice(idx, 1)
  }

  function toggleComplete(id) {
    const evt = events.value.find(e => e.id === id)
    if (!evt) return
    evt.completed = !evt.completed
    evt.completedAt = evt.completed ? Date.now() : null
    evt.updatedAt = Date.now()
  }

  // ── Diary CRUD ──

  function addDiaryEntry(data) {
    const now = Date.now()
    const d = new Date()
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const entry = {
      id: makeId('diary'),
      date: data.date || toLocalDateKey(d),
      weekday: data.weekday || weekdays[d.getDay()],
      mood: data.mood || '',
      weather: data.weather || '',
      content: data.content || '',
      images: data.images || [],
      shareWithAI: data.shareWithAI ?? true,
      sharedWithContacts: data.sharedWithContacts || [],
      injectToChat: data.injectToChat ?? true,
      aiReplies: [],
      createdAt: now,
      updatedAt: now
    }
    diaryEntries.value.push(entry)
    return entry
  }

  function updateDiaryEntry(id, updates) {
    const targetId = normalizeId(id)
    if (!targetId) return null
    const idx = diaryEntries.value.findIndex(e => normalizeId(e?.id) === targetId)
    if (idx === -1) return null
    const entry = diaryEntries.value[idx]
    Object.assign(entry, updates, { updatedAt: Date.now() })
    return entry
  }

  function removeDiaryEntry(id) {
    const targetId = normalizeId(id)
    if (!targetId) return
    const idx = diaryEntries.value.findIndex(e => normalizeId(e?.id) === targetId)
    if (idx !== -1) diaryEntries.value.splice(idx, 1)
  }

  // ── Queries ──

  function getEventsForDate(dateStr) {
    return events.value.filter(e => {
      const start = e.startDate || e.dueDate
      const end = e.endDate || e.dueDate || start
      return start <= dateStr && dateStr <= end
    })
  }

  function getUpcomingEvents(days = 7) {
    const now = new Date()
    const todayStr = toLocalDateKey(now)
    const futureDate = new Date(now.getTime() + days * 86400000)
    const futureStr = toLocalDateKey(futureDate)
    return events.value
      .filter(e => {
        if (e.completed) return false
        const start = e.startDate || e.dueDate
        const end = e.endDate || e.dueDate || start
        return end >= todayStr && start <= futureStr
      })
      .sort((a, b) => {
        const aStart = a.startDate || a.dueDate
        const bStart = b.startDate || b.dueDate
        if (aStart !== bStart) return aStart < bStart ? -1 : 1
        return (a.startTime || a.dueTime || '').localeCompare(b.startTime || b.dueTime || '')
      })
  }

  function getTodayEvents() {
    const todayStr = toLocalDateKey()
    return getEventsForDate(todayStr).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      return (a.startTime || a.dueTime || '').localeCompare(b.startTime || b.dueTime || '')
    })
  }

  function getDiaryForDate(dateStr) {
    return diaryEntries.value.find(e => e.date === dateStr) || null
  }

  function getDiaryById(id) {
    const targetId = normalizeId(id)
    if (!targetId) return null
    return diaryEntries.value.find(e => normalizeId(e?.id) === targetId) || null
  }

  function getDatesWithEvents(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDay = `${prefix}-01`
    const lastDay = `${prefix}-${String(daysInMonth).padStart(2, '0')}`
    const dateMap = {}

    for (const evt of events.value) {
      const start = evt.startDate || evt.dueDate
      const end = evt.endDate || evt.dueDate || start
      if (!start) continue

      const rangeStart = start < firstDay ? firstDay : start
      const rangeEnd = end > lastDay ? lastDay : end
      if (rangeStart > lastDay || rangeEnd < firstDay) continue

      const cat = categories.value.find(c => c.id === evt.category)
      const color = cat?.color || '#ffb6b9'
      let d = new Date(rangeStart + 'T00:00:00')
      const endD = new Date(rangeEnd + 'T00:00:00')
      while (d <= endD) {
        const dayStr = toLocalDateKey(d)
        if (!dateMap[dayStr]) dateMap[dayStr] = []
        dateMap[dayStr].push(color)
        d.setDate(d.getDate() + 1)
      }
    }

    for (const entry of diaryEntries.value) {
      if (entry.date && entry.date.startsWith(prefix)) {
        const day = entry.date
        if (!dateMap[day]) dateMap[day] = []
        dateMap[day].push('#a6e3e9')
      }
    }
    return dateMap
  }

  function getCategory(id) {
    return categories.value.find(c => c.id === id) || null
  }

  /** Returns { [dateStr]: [{id, title, color, completed}] } for calendar cell previews */
  function getMonthEventPreviews(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const firstDay = `${prefix}-01`
    const lastDay = `${prefix}-${String(daysInMonth).padStart(2, '0')}`
    const map = {}

    for (const evt of events.value) {
      const start = evt.startDate || evt.dueDate
      const end = evt.endDate || evt.dueDate || start
      if (!start) continue

      const rangeStart = start < firstDay ? firstDay : start
      const rangeEnd = end > lastDay ? lastDay : end
      if (rangeStart > lastDay || rangeEnd < firstDay) continue

      const cat = categories.value.find(c => c.id === evt.category)
      const color = cat?.color || '#ffb6b9'
      let d = new Date(rangeStart + 'T00:00:00')
      const endD = new Date(rangeEnd + 'T00:00:00')
      while (d <= endD) {
        const dayStr = toLocalDateKey(d)
        if (!map[dayStr]) map[dayStr] = []
        map[dayStr].push({ id: evt.id, title: evt.title, color, completed: evt.completed })
        d.setDate(d.getDate() + 1)
      }
    }
    return map
  }

  function addCategory(data) {
    const cat = {
      id: data.id || makeId('cat'),
      name: data.name || '',
      icon: data.icon || 'label',
      color: data.color || '#ffb6b9'
    }
    categories.value.push(cat)
    return cat
  }

  function removeCategory(id) {
    if (['work', 'personal', 'ideas'].includes(id)) return
    const idx = categories.value.findIndex(c => c.id === id)
    if (idx !== -1) categories.value.splice(idx, 1)
  }

  // ── Sorted diary list ──

  const sortedDiary = computed(() =>
    [...diaryEntries.value].sort((a, b) => b.date.localeCompare(a.date))
  )

  // ── Shared diary for a specific contact ──

  function getSharedDiaryForContact(contactId) {
    return diaryEntries.value.filter(
      e => e.sharedWithContacts.includes(contactId) && e.injectToChat
    )
  }

  // ── Character Schedules (AI) ──

  function getCharacterSchedule(contactId, dateStr) {
    return characterSchedules.value[`${contactId}:${dateStr}`] || null
  }

  function getLatestCharacterSchedule(contactId) {
    if (!contactId) return null
    const prefix = `${contactId}:`
    const matchedKeys = Object.keys(characterSchedules.value)
      .filter(key => key.startsWith(prefix))
      .sort((a, b) => b.localeCompare(a))
    if (!matchedKeys.length) return null
    return characterSchedules.value[matchedKeys[0]] || null
  }

  function setCharacterSchedule(contactId, dateStr, data) {
    const generatedAt = Number(data?.generatedAt)
    characterSchedules.value[`${contactId}:${dateStr}`] = {
      contactId,
      date: dateStr,
      ...data,
      generatedAt: Number.isFinite(generatedAt) && generatedAt > 0 ? generatedAt : Date.now()
    }
  }

  function removeCharacterSchedule(contactId, dateStr) {
    delete characterSchedules.value[`${contactId}:${dateStr}`]
  }

  function getCharacterCurrentActivity(contactId) {
    const todayStr = toLocalDateKey()
    const schedule = getCharacterSchedule(contactId, todayStr)
    if (!schedule?.slots?.length) return null
    const nowTime = getBeijingTimeHHMM()
    return schedule.slots.find(s => s.startTime <= nowTime && nowTime < s.endTime) || null
  }

  function isCharacterBusy(contactId) {
    const activity = getCharacterCurrentActivity(contactId)
    return activity ? !activity.interruptible : false
  }

  function pruneOldSchedules() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 3)
    const cutoffStr = toLocalDateKey(cutoff)
    let changed = false
    for (const key of Object.keys(characterSchedules.value)) {
      const dateStr = key.split(':')[1]
      if (dateStr < cutoffStr) {
        delete characterSchedules.value[key]
        changed = true
      }
    }
    return changed
  }

  // ── Persistence ──

  function exportData() {
    return {
      events: JSON.parse(JSON.stringify(events.value)),
      diaryEntries: JSON.parse(JSON.stringify(diaryEntries.value)),
      categories: JSON.parse(JSON.stringify(categories.value)),
      characterSchedules: JSON.parse(JSON.stringify(characterSchedules.value))
    }
  }

  function importData(d) {
    if (!d || typeof d !== 'object') return
    if (Array.isArray(d.events)) {
      events.value = d.events.map(e => ({
        ...e,
        kind: e.kind || 'todo',
        source: e.source || 'manual',
        sourceChatId: e.sourceChatId || '',
        sourceContactId: e.sourceContactId || '',
        sourceMessageId: e.sourceMessageId || '',
        extractedAt: e.extractedAt ?? null,
        startDate: e.startDate || e.dueDate || '',
        endDate: e.endDate || e.dueDate || '',
        startTime: e.startTime || e.dueTime || '',
        endTime: e.endTime || '',
        allDay: e.allDay ?? false,
        dueDate: e.dueDate || e.startDate || '',
        dueTime: e.dueTime || e.startTime || ''
      }))
    }
    if (Array.isArray(d.diaryEntries)) diaryEntries.value = d.diaryEntries
    if (Array.isArray(d.categories) && d.categories.length > 0) {
      categories.value = d.categories
    }
    if (d.characterSchedules && typeof d.characterSchedules === 'object') {
      characterSchedules.value = d.characterSchedules
    }
  }

  return {
    events,
    diaryEntries,
    categories,
    sortedDiary,
    addEvent,
    updateEvent,
    removeEvent,
    toggleComplete,
    addDiaryEntry,
    updateDiaryEntry,
    removeDiaryEntry,
    getEventsForDate,
    getUpcomingEvents,
    getTodayEvents,
    getDiaryForDate,
    getDiaryById,
    getDatesWithEvents,
    getMonthEventPreviews,
    getCategory,
    addCategory,
    removeCategory,
    getSharedDiaryForContact,
    characterSchedules,
    getCharacterSchedule,
    getLatestCharacterSchedule,
    setCharacterSchedule,
    removeCharacterSchedule,
    getCharacterCurrentActivity,
    isCharacterBusy,
    pruneOldSchedules,
    exportData,
    importData
  }
})
