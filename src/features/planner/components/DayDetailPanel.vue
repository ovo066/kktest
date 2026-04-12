<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="visible" class="panel-overlay" @click.self="$emit('close')">
        <div class="panel-sheet">
          <!-- Handle bar -->
          <div class="handle-bar"><div class="handle" /></div>

          <!-- Date header -->
          <div class="panel-header">
            <h2 class="panel-date">{{ dateLabel }}</h2>
            <span class="panel-weekday">{{ weekdayLabel }}</span>
          </div>

          <!-- Events -->
          <section v-if="dayEvents.length > 0" class="panel-section">
            <div class="section-label">
              <span class="material-symbols-outlined" style="font-size:16px">checklist</span>
              待办 · {{ dayEvents.length }}
            </div>
            <div class="event-list">
              <SwipeDeleteReveal
                v-for="evt in dayEvents"
                :key="evt.id"
                :radius="14"
                @delete="removeEvent(evt.id)"
              >
                <div
                  class="event-row"
                  :style="{ '--cat-color': getCatColor(evt.category) }"
                >
                  <button class="check-btn" type="button" @click.stop="toggleComplete(evt.id)">
                    <span
                      class="material-symbols-outlined"
                      :style="{ 'font-variation-settings': evt.completed ? `'FILL' 1,'wght' 500` : `'FILL' 0,'wght' 300` }"
                    >{{ evt.completed ? 'check_circle' : 'radio_button_unchecked' }}</span>
                  </button>
                  <div class="event-info">
                    <span class="event-title" :class="{ done: evt.completed }">{{ evt.title }}</span>
                    <span v-if="evt.kind === 'anniversary' || evt.startTime || evt.dueTime" class="event-time-row">
                      <span v-if="evt.kind === 'anniversary'" class="event-kind">纪念日</span>
                      <span v-if="evt.startTime || evt.dueTime" class="event-time">{{ evt.startTime || evt.dueTime }}{{ evt.endTime ? ` - ${evt.endTime}` : '' }}</span>
                    </span>
                  </div>
                  <span v-if="isMultiDay(evt)" class="range-badge">多天</span>
                </div>
              </SwipeDeleteReveal>
            </div>
          </section>

          <!-- Diary -->
          <section v-if="dayDiary" class="panel-section">
            <div class="section-label diary-label">
              <span class="material-symbols-outlined" style="font-size:16px">menu_book</span>
              日记
            </div>
            <div class="diary-card" @click="$emit('open-diary', dayDiary.id)">
              <div class="diary-tags" v-if="dayDiary.mood || dayDiary.weather">
                <span v-if="dayDiary.mood" class="diary-tag">{{ dayDiary.mood }}</span>
                <span v-if="dayDiary.weather" class="diary-tag">{{ dayDiary.weather }}</span>
              </div>
              <p class="diary-preview">{{ dayDiary.content.slice(0, 80) }}{{ dayDiary.content.length > 80 ? '…' : '' }}</p>
              <span class="material-symbols-outlined diary-arrow" style="font-size:16px">chevron_right</span>
            </div>
          </section>

          <!-- Empty state -->
          <div v-if="dayEvents.length === 0 && !dayDiary" class="empty-state">
            <span class="material-symbols-outlined" style="font-size:36px;opacity:0.25">event_available</span>
            <p>这天没有安排</p>
          </div>

          <!-- Add task button -->
          <button class="add-btn" @click="$emit('add-task', dateStr)">
            <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:'FILL' 1,'wght' 400">add</span>
            添加任务到这天
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { usePlannerStore } from '../../../stores/planner'
import { useStorage } from '../../../composables/useStorage'
import { toLocalDateKey } from '../../../utils/dateKey'
import SwipeDeleteReveal from './SwipeDeleteReveal.vue'

const props = defineProps({
  dateStr: { type: String, default: '' },
  visible: { type: Boolean, default: false }
})

defineEmits(['close', 'open-diary', 'add-task'])

const plannerStore = usePlannerStore()
const { scheduleSave } = useStorage()

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const dateLabel = computed(() => {
  if (!props.dateStr) return ''
  const d = new Date(props.dateStr + 'T00:00:00')
  const today = toLocalDateKey()
  const prefix = props.dateStr === today ? '今天 · ' : ''
  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日`
})

const weekdayLabel = computed(() => {
  if (!props.dateStr) return ''
  const d = new Date(props.dateStr + 'T00:00:00')
  return weekdays[d.getDay()]
})

const dayEvents = computed(() => {
  if (!props.dateStr) return []
  return plannerStore.getEventsForDate(props.dateStr).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return (a.startTime || a.dueTime || '').localeCompare(b.startTime || b.dueTime || '')
  })
})

const dayDiary = computed(() => {
  if (!props.dateStr) return null
  return plannerStore.getDiaryForDate(props.dateStr)
})

function getCatColor(catId) {
  const cat = plannerStore.getCategory(catId)
  return cat?.color || '#ffb6b9'
}

function isMultiDay(evt) {
  const start = evt.startDate || evt.dueDate
  const end = evt.endDate || evt.dueDate || start
  return start !== end
}

function toggleComplete(id) {
  plannerStore.toggleComplete(id)
  scheduleSave()
}

function removeEvent(id) {
  plannerStore.removeEvent(id)
  scheduleSave()
}
</script>

<style scoped>
/* Overlay */
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 150;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Sheet */
.panel-sheet {
  width: 100%;
  max-width: 430px;
  max-height: 70dvh;
  background: var(--card-bg, #fff);
  border-radius: 24px 24px 0 0;
  padding: 8px 20px calc(env(safe-area-inset-bottom, 12px) + 16px);
  overflow-y: auto;
}

/* Transition */
.panel-enter-active { transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.panel-leave-active { transition: all 0.2s ease-in; }
.panel-enter-from .panel-sheet,
.panel-leave-to .panel-sheet { transform: translateY(100%); }
.panel-enter-from,
.panel-leave-to { opacity: 0; }

/* Handle */
.handle-bar { display: flex; justify-content: center; padding: 8px 0 12px; }
.handle { width: 36px; height: 4px; border-radius: 4px; background: rgba(0,0,0,0.12); }

/* Header */
.panel-header { margin-bottom: 16px; }
.panel-date {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-color, #5c4a4d);
}
.panel-weekday {
  font-size: 13px;
  color: var(--text-muted, #a89f9e);
}

/* Section */
.panel-section { margin-bottom: 16px; }
.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--planner-accent, #ffb6b9);
  margin-bottom: 10px;
}
.diary-label { color: var(--planner-accent2, #a6e3e9); }

/* Event list */
.event-list { display: flex; flex-direction: column; gap: 6px; }

.event-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-color, #fffdfa);
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.04);
}

.check-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--cat-color);
  font-size: 22px;
  display: flex;
  flex-shrink: 0;
}

.event-info { flex: 1; min-width: 0; }
.event-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #5c4a4d);
  display: block;
}
.event-title.done {
  text-decoration: line-through;
  color: var(--text-muted, #a89f9e);
}
.event-time {
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
  display: block;
  margin-top: 2px;
}

.event-time-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.event-kind {
  font-size: 10px;
  font-weight: 700;
  color: var(--planner-accent, #ffb6b9);
}

.range-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(255,182,185,0.15);
  color: var(--planner-accent, #ffb6b9);
  flex-shrink: 0;
}

/* Diary card */
.diary-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-color, #fffdfa);
  border: 1px solid rgba(166,227,233,0.3);
  border-radius: 14px;
  cursor: pointer;
}
.diary-tags { display: flex; gap: 4px; flex-shrink: 0; }
.diary-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(166,227,233,0.15);
  color: var(--planner-accent2, #a6e3e9);
}
.diary-preview {
  flex: 1;
  font-size: 13px;
  color: var(--text-muted, #a89f9e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.diary-arrow { color: var(--text-muted, #a89f9e); opacity: 0.4; flex-shrink: 0; }

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 0 16px;
  color: var(--text-muted, #a89f9e);
  font-size: 13px;
}

/* Add button */
.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: 1.5px dashed rgba(255,182,185,0.4);
  border-radius: 14px;
  background: none;
  color: var(--planner-accent, #ffb6b9);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.add-btn:active { background: rgba(255,182,185,0.08); }
</style>
