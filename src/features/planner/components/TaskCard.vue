<template>
  <SwipeDeleteReveal @delete="removeEvent">
    <div
      class="task-card"
      :class="{ completed: event.completed }"
      :style="{ '--cat-color': catColor }"
    >
      <button class="check-btn" @click.stop="toggleComplete">
        <span
          class="material-symbols-outlined"
          :style="{ 'font-variation-settings': event.completed ? `'FILL' 1,'wght' 500` : `'FILL' 0,'wght' 300` }"
        >
          {{ event.completed ? 'check_circle' : 'radio_button_unchecked' }}
        </span>
      </button>

      <div class="task-content">
        <p class="task-title" :class="{ done: event.completed }">{{ event.title }}</p>
        <div class="task-meta">
          <span v-if="event.kind === 'anniversary'" class="meta-item kind-badge">
            <span class="material-symbols-outlined" style="font-size:12px">cake</span>
            纪念日
          </span>
          <span v-if="displayTime" class="meta-item">
            <span class="material-symbols-outlined" style="font-size:13px">schedule</span>
            {{ displayTime }}
          </span>
          <span v-if="displayDate" class="meta-item">
            <span class="material-symbols-outlined" style="font-size:13px">today</span>
            {{ displayDate }}
          </span>
          <span v-if="event.shareWithAI" class="meta-item ai-badge">
            <span class="material-symbols-outlined" style="font-size:12px">smart_toy</span>
          </span>
        </div>
      </div>
    </div>
  </SwipeDeleteReveal>
</template>

<script setup>
import { computed } from 'vue'
import { usePlannerStore } from '../../../stores/planner'
import { useStorage } from '../../../composables/useStorage'
import { toLocalDateKey } from '../../../utils/dateKey'
import SwipeDeleteReveal from './SwipeDeleteReveal.vue'

const props = defineProps({
  event: { type: Object, required: true }
})

const plannerStore = usePlannerStore()
const { scheduleSave } = useStorage()

const catColor = computed(() => {
  const cat = plannerStore.getCategory(props.event.category)
  return cat?.color || '#ffb6b9'
})

const displayTime = computed(() => {
  const time = props.event.startTime || props.event.dueTime || ''
  if (!time) return ''
  const end = props.event.endTime || ''
  return end ? `${time} - ${end}` : time
})

const displayDate = computed(() => {
  const start = props.event.startDate || props.event.dueDate
  if (!start) return ''
  const end = props.event.endDate || props.event.dueDate || start
  const today = toLocalDateKey()
  if (start === end) {
    if (start === today) return '今天'
    return formatDate(start)
  }
  return `${formatDate(start)} - ${formatDate(end)}`
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = toLocalDateKey()
  if (dateStr === today) return '今天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function toggleComplete() {
  plannerStore.toggleComplete(props.event.id)
  scheduleSave()
}

function removeEvent() {
  plannerStore.removeEvent(props.event.id)
  scheduleSave()
}
</script>

<style scoped>
.task-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card-bg, #fff);
  border: 1.5px solid rgba(0,0,0,0.05);
  border-radius: 16px;
  padding: 12px 12px 12px 10px;
  transition: opacity 0.2s;
}

.task-card.completed {
  opacity: 0.55;
}

.check-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--cat-color);
  flex-shrink: 0;
  font-size: 24px;
  display: flex;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #5c4a4d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted, #a89f9e);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
}

.ai-badge {
  color: var(--planner-accent2, #a6e3e9);
}

.kind-badge {
  color: var(--planner-accent, #ffb6b9);
}

</style>
