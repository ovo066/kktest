<template>
  <div class="char-schedule-view">
    <header class="view-header">
      <button class="home-btn" @click="$router.push({ name: 'home' })">
        <span class="material-symbols-outlined">chevron_left</span>
        <span>桌面</span>
      </button>
      <div class="header-main">
        <h1 class="view-title">{{ currentCharacterName }}的日程</h1>
      </div>
      <button class="generate-btn" :class="{ loading }" @click="generateSchedule">
        <span class="material-symbols-outlined" style="font-size:18px">{{ hasTodaySchedule ? 'refresh' : 'auto_awesome' }}</span>
        <span>{{ hasTodaySchedule ? '重新生成' : '生成' }}</span>
      </button>
    </header>

    <div class="scroll-area">
      <div v-if="contacts.length > 1" class="character-strip">
        <button
          v-for="contact in contacts"
          :key="contact.id"
          class="character-chip"
          :class="{ active: contact.id === contactId }"
          @click="$emit('select-contact', contact.id)"
        >
          <div class="chip-avatar">
            <img v-if="contact.avatar" :src="contact.avatar" class="chip-avatar-img" alt="" />
            <span v-else class="chip-avatar-letter">{{ contact.name?.[0] || 'A' }}</span>
            <span v-if="plannerStore.isCharacterBusy(contact.id)" class="chip-busy-dot" />
          </div>
          <span class="chip-name">{{ contact.name }}</span>
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="loading && !hasSchedule" class="loading-state">
        <span class="material-symbols-outlined spin" style="font-size:32px;opacity:0.4">progress_activity</span>
        <p>正在生成日程…</p>
      </div>

      <!-- Empty state — 需要用户确认才生成 -->
      <div v-else-if="!hasSchedule" class="empty-state">
        <span class="material-symbols-outlined" style="font-size:48px;opacity:0.2">event_busy</span>
        <p>{{ currentCharacterName }}今天还没有日程</p>
        <button class="gen-btn" @click="generateSchedule">
          <span class="material-symbols-outlined" style="font-size:16px">auto_awesome</span>
          生成今日日程
        </button>
      </div>

      <!-- Timeline -->
      <div v-else class="timeline">
        <div
          v-for="slot in scheduleSlots"
          :key="slot.id"
          class="timeline-item"
          :class="{ current: isCurrentSlot(slot), busy: !slot.interruptible }"
        >
          <div class="time-col">
            <span class="time-start">{{ slot.startTime }}</span>
            <span class="time-end">{{ slot.endTime }}</span>
          </div>
          <div class="timeline-line">
            <div class="dot" :class="{ pulse: isCurrentSlot(slot) }" />
            <div class="line" />
          </div>
          <div class="activity-card">
            <div class="activity-header">
              <span class="activity-name">{{ slot.activity }}</span>
              <span v-if="!slot.interruptible" class="busy-badge">忙碌</span>
              <span v-else class="free-badge">可聊</span>
            </div>
            <div class="activity-meta">
              <span v-if="slot.location" class="meta-item">
                <span class="material-symbols-outlined" style="font-size:13px">location_on</span>
                {{ slot.location }}
              </span>
              <span v-if="slot.mood" class="meta-item">
                <span class="material-symbols-outlined" style="font-size:13px">mood</span>
                {{ slot.mood }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlannerStore } from '../../../stores/planner'
import { useToast } from '../../../composables/useToast'
import { toLocalDateKey } from '../../../utils/dateKey'
import { getBeijingTimeHHMM } from '../../../utils/beijingTime'

const props = defineProps({
  contactId: { type: String, default: '' },
  characterName: { type: String, default: 'AI' },
  contacts: { type: Array, default: () => [] },
  mode: { type: String, default: 'character' },
  userAvatar: { type: String, default: '' }
})
defineEmits(['select-contact', 'update:mode'])

const plannerStore = usePlannerStore()
const { showToast } = useToast()
const loading = ref(false)
const todayStr = ref(toLocalDateKey())
const autoRefreshKey = ref('')
let dayRefreshTimer = null

function syncTodayKey() {
  const nextKey = toLocalDateKey()
  if (todayStr.value !== nextKey) {
    todayStr.value = nextKey
  }
}

const currentCharacter = computed(() =>
  props.contacts.find(contact => contact.id === props.contactId) || null
)

const currentCharacterName = computed(() => currentCharacter.value?.name || props.characterName || 'AI')

const todaySchedule = computed(() => {
  if (!props.contactId) return null
  return plannerStore.getCharacterSchedule(props.contactId, todayStr.value)
})

const schedule = computed(() => {
  if (todaySchedule.value) return todaySchedule.value
  if (!props.contactId) return null
  return plannerStore.getLatestCharacterSchedule(props.contactId)
})

const scheduleSlots = computed(() => (
  Array.isArray(schedule.value?.slots) ? schedule.value.slots : []
))

const hasTodaySchedule = computed(() => (
  Array.isArray(todaySchedule.value?.slots) ? todaySchedule.value.slots.length > 0 : false
))

const hasSchedule = computed(() => scheduleSlots.value.length > 0)

function isCurrentSlot(slot) {
  const nowTime = getBeijingTimeHHMM()
  return slot.startTime <= nowTime && nowTime < slot.endTime
}

async function requestTodaySchedule({ regenerate = false, silent = false } = {}) {
  syncTodayKey()
  if (loading.value || !props.contactId) return null

  loading.value = true
  try {
    const { generateCharacterSchedule } = await import('../../../composables/useCharacterSchedule')
    const result = await generateCharacterSchedule(props.contactId, todayStr.value, {
      force: true,
      regenerate
    })
    if (!result?.slots?.length && !silent) {
      showToast(regenerate ? '更新失败，已保留原日程' : '暂时无法更新日程，请稍后重试')
    }
    return result
  } catch (e) {
    console.warn('[CharacterScheduleView] Refresh failed:', e.message)
    if (!silent) {
      showToast(regenerate ? '更新失败，已保留原日程' : '暂时无法更新日程，请稍后重试')
    }
    return null
  } finally {
    loading.value = false
  }
}

async function generateSchedule() {
  const isRegenerating = hasTodaySchedule.value
  await requestTodaySchedule({ regenerate: isRegenerating, silent: false })
}

watch(() => props.contactId, () => {
  autoRefreshKey.value = ''
  syncTodayKey()
}, { immediate: true })

onMounted(() => {
  dayRefreshTimer = window.setInterval(() => {
    const previousKey = todayStr.value
    syncTodayKey()
    if (todayStr.value !== previousKey) {
      autoRefreshKey.value = ''
      // 跨日只刷新日期，不自动生成
    }
  }, 60 * 1000)
})

onBeforeUnmount(() => {
  if (dayRefreshTimer) {
    window.clearInterval(dayRefreshTimer)
    dayRefreshTimer = null
  }
})
</script>

<style scoped>
.char-schedule-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #fffdfa);
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 52px 16px 12px;
}

.home-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 7px 12px;
  border: 1px solid rgba(255, 182, 185, 0.28);
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-bg, #fff) 88%, var(--planner-accent3, #fae3d9));
  color: var(--text-color, #5c4a4d);
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(255, 182, 185, 0.12);
}

.home-btn .material-symbols-outlined { font-size: 18px; }

.header-main { flex: 1; min-width: 0; }

.view-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-color, #5c4a4d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted, #a89f9e);
}

.generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(166, 227, 233, 0.35);
  background: rgba(166, 227, 233, 0.12);
  cursor: pointer;
  color: var(--planner-accent2, #a6e3e9);
  font-size: 13px;
  font-weight: 700;
}

.generate-btn.loading .material-symbols-outlined {
  animation: spin-slow 1s linear infinite;
}

@keyframes spin-slow {
  to { transform: rotate(360deg); }
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px 100px;
}

.character-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 14px;
  margin-bottom: 6px;
}

.character-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: fit-content;
  padding: 6px 10px 6px 6px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.08);
  background: var(--card-bg, #fff);
  color: var(--text-muted, #a89f9e);
  cursor: pointer;
}

.character-chip.active {
  border-color: var(--planner-accent, #ffb6b9);
  background: rgba(255,182,185,0.12);
  color: var(--text-color, #5c4a4d);
}

.chip-avatar {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(166,227,233,0.22);
  flex-shrink: 0;
}

.chip-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chip-avatar-letter {
  font-size: 12px;
  font-weight: 700;
  color: var(--planner-accent2, #a6e3e9);
}

.chip-busy-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
  border: 1.5px solid var(--card-bg, #fff);
}

.chip-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* Loading / Empty states */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--text-muted, #a89f9e);
  font-size: 14px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin { animation: spin 1s linear infinite; display: inline-block; }

.gen-btn {
  padding: 10px 20px;
  border-radius: 14px;
  border: 1.5px dashed rgba(166,227,233,0.5);
  background: none;
  color: var(--planner-accent2, #a6e3e9);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: 12px;
  min-height: 72px;
}

.time-col {
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 2px;
  flex-shrink: 0;
}

.time-start {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
}

.time-end {
  font-size: 10px;
  color: var(--text-muted, #a89f9e);
  margin-top: 2px;
}

.timeline-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--planner-accent2, #a6e3e9);
  border: 2px solid var(--bg-color, #fffdfa);
  flex-shrink: 0;
  margin-top: 4px;
}

.dot.pulse {
  background: var(--planner-accent, #ffb6b9);
  box-shadow: 0 0 0 4px rgba(255,182,185,0.3);
  animation: pulse-ring 2s ease-out infinite;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(255,182,185,0.4); }
  70% { box-shadow: 0 0 0 8px rgba(255,182,185,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,182,185,0); }
}

.line {
  flex: 1;
  width: 2px;
  background: rgba(166,227,233,0.3);
  margin: 4px 0;
}

.timeline-item:last-child .line { display: none; }

.timeline-item.current .dot {
  background: var(--planner-accent, #ffb6b9);
}

.activity-card {
  flex: 1;
  padding: 8px 12px;
  border-radius: 14px;
  background: var(--card-bg, #fff);
  border: 1px solid rgba(0,0,0,0.05);
  margin-bottom: 8px;
  min-width: 0;
}

.timeline-item.current .activity-card {
  border-color: rgba(255,182,185,0.3);
  background: color-mix(in srgb, var(--card-bg, #fff) 92%, var(--planner-accent, #ffb6b9));
}

.timeline-item.busy .activity-card {
  border-left: 3px solid rgba(248,113,113,0.4);
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.activity-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #5c4a4d);
  flex: 1;
}

.busy-badge, .free-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}

.busy-badge {
  background: rgba(248,113,113,0.12);
  color: #f87171;
}

.free-badge {
  background: rgba(166,227,233,0.15);
  color: var(--planner-accent2, #a6e3e9);
}

.activity-meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
}

/* Generated info */
.gen-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 0;
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
  opacity: 0.7;
}
</style>



