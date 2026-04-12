<template>
  <div class="calendar-grid">
    <!-- Month nav -->
    <header class="month-nav">
      <button class="nav-btn" @click="prevMonth">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <h2 class="month-title">{{ year }}年{{ month }}月</h2>
      <button class="nav-btn" @click="nextMonth">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </header>

    <!-- Weekday headers -->
    <div class="weekday-row">
      <div v-for="d in ['一','二','三','四','五','六','日']" :key="d" class="weekday-cell">{{ d }}</div>
    </div>

    <!-- Day cells -->
    <div class="days-grid">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="day-cell"
        :class="{
          'other-month': !cell.current,
          'is-today': cell.isToday,
          'is-selected': cell.dateStr === selectedDate
        }"
        @click="cell.current && $emit('select', cell.dateStr)"
      >
        <span class="day-num">{{ cell.day }}</span>
        <div class="cell-events" v-if="cell.events && cell.events.length">
          <div
            v-for="evt in cell.events.slice(0, 2)"
            :key="evt.id"
            class="cell-event-chip"
            :class="{ completed: evt.completed }"
            :style="{ '--evt-color': evt.color }"
          >{{ evt.title.slice(0, 4) }}</div>
          <div v-if="cell.events.length > 2" class="cell-more">+{{ cell.events.length - 2 }}</div>
        </div>
        <div v-else-if="cell.hasDiary" class="cell-diary-dot" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlannerStore } from '../../../stores/planner'
import { toLocalDateKey } from '../../../utils/dateKey'

defineProps({
  selectedDate: { type: String, default: '' }
})
defineEmits(['select'])

const plannerStore = usePlannerStore()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)

function prevMonth() {
  if (month.value === 1) { year.value--; month.value = 12 }
  else month.value--
}
function nextMonth() {
  if (month.value === 12) { year.value++; month.value = 1 }
  else month.value++
}

const todayStr = toLocalDateKey()

const cells = computed(() => {
  const y = year.value
  const m = month.value
  const eventMap = plannerStore.getMonthEventPreviews(y, m)
  const diaryDates = new Set()
  const prefix = `${y}-${String(m).padStart(2, '0')}`
  for (const entry of plannerStore.diaryEntries) {
    if (entry.date && entry.date.startsWith(prefix)) diaryDates.add(entry.date)
  }

  const firstDay = new Date(y, m - 1, 1).getDay()
  const offset = (firstDay + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()
  const prevMonthDays = new Date(y, m - 1, 0).getDate()

  const result = []

  // prev month padding
  for (let i = offset - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    result.push({ key: `prev-${day}`, day, current: false, dateStr: `${py}-${String(pm).padStart(2,'0')}-${String(day).padStart(2,'0')}`, isToday: false, events: null, hasDiary: false })
  }

  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    result.push({
      key: dateStr,
      day: d,
      current: true,
      dateStr,
      isToday: dateStr === todayStr,
      events: eventMap[dateStr] || null,
      hasDiary: diaryDates.has(dateStr)
    })
  }

  // next month padding
  const total = result.length
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7)
  for (let d = 1; d <= remaining; d++) {
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    result.push({ key: `next-${d}`, day: d, current: false, dateStr: `${ny}-${String(nm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, isToday: false, events: null, hasDiary: false })
  }

  return result
})
</script>

<style scoped>
.calendar-grid {
  padding: 0 10px 8px;
}

.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.month-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
}

.nav-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #a89f9e);
  display: flex;
  align-items: center;
  padding: 4px;
}

.nav-btn .material-symbols-outlined { font-size: 20px; }

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 4px;
}

.weekday-cell {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, #a89f9e);
  padding: 4px 0;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px 2px;
}

.day-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 64px;
  padding: 4px 2px 3px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.day-cell:not(.other-month):hover {
  background: rgba(255,182,185,0.1);
}

.day-num {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #5c4a4d);
  line-height: 1;
  margin-bottom: 3px;
}

.day-cell.other-month .day-num {
  color: var(--text-muted, #a89f9e);
  opacity: 0.3;
}

.day-cell.is-today {
  background: var(--planner-accent, #ffb6b9);
}
.day-cell.is-today .day-num {
  color: #fff;
  font-weight: 700;
}

.day-cell.is-selected:not(.is-today) {
  background: rgba(255,182,185,0.2);
  outline: 1.5px solid var(--planner-accent, #ffb6b9);
}

/* Event chips in cell */
.cell-events {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  padding: 0 1px;
}

.cell-event-chip {
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  padding: 1px 3px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--evt-color) 25%, transparent);
  color: var(--text-color, #5c4a4d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-event-chip.completed {
  text-decoration: line-through;
  opacity: 0.5;
}

.day-cell.is-today .cell-event-chip {
  background: rgba(255,255,255,0.3);
  color: #fff;
}

.cell-more {
  font-size: 8px;
  color: var(--text-muted, #a89f9e);
  text-align: center;
  line-height: 1;
}

.day-cell.is-today .cell-more {
  color: rgba(255,255,255,0.7);
}

/* Diary dot for days without events */
.cell-diary-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--planner-accent2, #a6e3e9);
  margin-top: 2px;
}

.day-cell.is-today .cell-diary-dot {
  background: rgba(255,255,255,0.7);
}
</style>
