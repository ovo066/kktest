<template>
  <div class="today-view">
    <!-- Header: Date & greeting -->
    <header class="today-header">
      <div class="header-top-row">
        <button class="home-btn" @click="goHome">
          <span class="material-symbols-outlined">chevron_left</span>
          <span>桌面</span>
        </button>
        <slot name="schedule-toggle" />
      </div>
      <div class="date-display">
        <h1 class="date-main">{{ dayLabel }}</h1>
        <p class="date-sub">{{ weekdayLabel }} · {{ greeting }}</p>
      </div>
    </header>

    <div class="scroll-area">
      <!-- Today's tasks -->
      <section class="section">
        <div class="section-header">
          <div class="section-icon" style="background: rgba(255,182,185,0.2)">
            <span class="material-symbols-outlined" style="color: var(--planner-accent, #ffb6b9)">auto_awesome</span>
          </div>
          <h2 class="section-title">今日预览</h2>
          <span class="section-count" v-if="todayEvents.length">{{ todayEvents.length }}</span>
        </div>

        <div v-if="todayEvents.length === 0" class="empty-hint">
          今天没有待办，悠然自在~
        </div>

        <div v-else class="event-preview-list">
          <SwipeDeleteReveal
            v-for="evt in todayEvents.slice(0, 4)"
            :key="evt.id"
            @delete="removeEvent(evt.id)"
          >
            <div
              class="event-preview-card"
              :style="{ '--cat-color': getCatColor(evt.category) }"
            >
              <div class="epc-icon">
                <span class="material-symbols-outlined" style="font-size:20px;font-variation-settings:'FILL' 0,'wght' 300">
                  {{ getCatIcon(evt.category) }}
                </span>
              </div>
              <div class="epc-info">
                <p class="epc-title" :class="{ done: evt.completed }">{{ evt.title }}</p>
                <p v-if="evt.dueTime || evt.startTime" class="epc-time">{{ evt.startTime || evt.dueTime }}</p>
              </div>
              <span
                v-if="evt.completed"
                class="badge done-badge"
              >完成</span>
              <button class="quick-check" type="button" @click="toggleComplete(evt.id)">
                <span class="material-symbols-outlined" :style="{ 'font-variation-settings': evt.completed ? `'FILL' 1,'wght' 500` : `'FILL' 0,'wght' 300` }">
                  {{ evt.completed ? 'check_circle' : 'radio_button_unchecked' }}
                </span>
              </button>
            </div>
          </SwipeDeleteReveal>
          <p v-if="todayEvents.length > 4" class="more-hint">还有 {{ todayEvents.length - 4 }} 项…</p>
        </div>
      </section>

      <!-- Upcoming events (next 3 days) -->
      <section v-if="upcomingEvents.length" class="section">
        <div class="section-header">
          <div class="section-icon" style="background: rgba(166,227,233,0.2)">
            <span class="material-symbols-outlined" style="color: var(--planner-accent2, #a6e3e9)">upcoming</span>
          </div>
          <h2 class="section-title">即将到来</h2>
        </div>

        <div class="upcoming-list">
          <div
            v-for="evt in upcomingEvents.slice(0, 3)"
            :key="evt.id"
            class="upcoming-card"
          >
            <p class="upcoming-date">{{ formatEventDate(evt.dueDate) }}</p>
            <p class="upcoming-title">{{ evt.title }}</p>
          </div>
        </div>
      </section>

      <!-- Today's diary -->
      <section class="section" v-if="todayDiary">
        <div class="section-header">
          <div class="section-icon" style="background: rgba(250,227,217,0.5)">
            <span class="material-symbols-outlined" style="color: var(--planner-accent, #ffb6b9)">menu_book</span>
          </div>
          <h2 class="section-title">今天的日记</h2>
        </div>

        <div class="diary-preview" @click="openDiary(todayDiary.id)">
          <div class="dp-tags">
            <span v-if="todayDiary.mood" class="dp-tag">{{ todayDiary.mood }}</span>
            <span v-if="todayDiary.weather" class="dp-tag">{{ todayDiary.weather }}</span>
          </div>
          <p class="dp-content">{{ todayDiary.content.slice(0, 100) }}{{ todayDiary.content.length > 100 ? '…' : '' }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '../../../stores/planner'
import { useStorage } from '../../../composables/useStorage'
import { toLocalDateKey } from '../../../utils/dateKey'
import { getBeijingDateParts, getBeijingWeekdayIndex } from '../../../utils/beijingTime'
import SwipeDeleteReveal from '../components/SwipeDeleteReveal.vue'

const router = useRouter()
const plannerStore = usePlannerStore()
const { scheduleSave } = useStorage()

const now = new Date()
const today = toLocalDateKey(now)
const nowParts = getBeijingDateParts(now)

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const dayLabel = computed(() => `${nowParts.month}月${nowParts.day}日`)
const weekdayLabel = computed(() => weekdays[getBeijingWeekdayIndex(now)])

const greeting = computed(() => {
  const h = nowParts.hour
  if (h < 6) return '深夜好'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '午安'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

const todayEvents = computed(() => plannerStore.getTodayEvents())
const upcomingEvents = computed(() => {
  return plannerStore.getUpcomingEvents(4).filter(e => e.dueDate > today)
})
const todayDiary = computed(() => plannerStore.getDiaryForDate(today))

function getCatColor(catId) {
  const cat = plannerStore.getCategory(catId)
  return cat?.color || '#ffb6b9'
}

function getCatIcon(catId) {
  const cat = plannerStore.getCategory(catId)
  return cat?.icon || 'label'
}

function formatEventDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function goHome() {
  router.push({ name: 'home' })
}

function toggleComplete(id) {
  plannerStore.toggleComplete(id)
  scheduleSave()
}

function removeEvent(id) {
  plannerStore.removeEvent(id)
  scheduleSave()
}

function openDiary(id) {
  router.push({ name: 'diary-detail', params: { id } })
}
</script>

<style scoped>
.today-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #fffdfa);
}

.today-header {
  padding: 52px 20px 16px;
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
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

.home-btn .material-symbols-outlined {
  font-size: 18px;
}

.date-main {
  font-size: 32px;
  font-weight: 800;
  color: var(--text-color, #5c4a4d);
  line-height: 1.1;
}

.date-sub {
  font-size: 14px;
  color: var(--text-muted, #a89f9e);
  margin-top: 4px;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 100px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section { }

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.section-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-icon .material-symbols-outlined { font-size: 18px; }

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
  flex: 1;
}

.section-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #a89f9e);
  background: rgba(0,0,0,0.05);
  border-radius: 20px;
  padding: 2px 8px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted, #a89f9e);
  padding: 12px 0;
}

/* Event preview cards */
.event-preview-list { display: flex; flex-direction: column; gap: 8px; }

.event-preview-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card-bg, #fff);
  border: 1.5px solid rgba(0,0,0,0.05);
  border-radius: 16px;
  padding: 10px 12px;
}

.epc-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--cat-color) 20%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cat-color);
  flex-shrink: 0;
}

.epc-info { flex: 1; min-width: 0; }

.epc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #5c4a4d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.epc-title.done {
  text-decoration: line-through;
  color: var(--text-muted, #a89f9e);
}

.epc-time {
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
  margin-top: 2px;
}

.done-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 20px;
  background: rgba(166,227,233,0.2);
  color: var(--planner-accent2, #a6e3e9);
  border: 1px solid rgba(166,227,233,0.35);
  flex-shrink: 0;
}

.quick-check {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  flex-shrink: 0;
}

.quick-check {
  color: var(--cat-color);
  font-size: 22px;
}

.quick-check:hover {
  background: color-mix(in srgb, var(--cat-color) 16%, transparent);
}

.more-hint {
  font-size: 12px;
  color: var(--text-muted, #a89f9e);
  text-align: center;
  padding-top: 4px;
}

/* Upcoming */
.upcoming-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.upcoming-card {
  flex-shrink: 0;
  background: var(--card-bg, #fff);
  border: 1.5px solid rgba(0,0,0,0.05);
  border-radius: 16px;
  padding: 12px 14px;
  min-width: 120px;
}

.upcoming-date {
  font-size: 11px;
  color: var(--planner-accent2, #a6e3e9);
  font-weight: 700;
  margin-bottom: 6px;
}

.upcoming-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #5c4a4d);
  line-height: 1.3;
}

/* Diary preview */
.diary-preview {
  background: var(--card-bg, #fff);
  border: 1.5px solid rgba(250,227,217,0.6);
  border-radius: 18px;
  padding: 14px 16px;
  cursor: pointer;
  transition: transform 0.15s;
}

.diary-preview:active { transform: scale(0.98); }

.dp-tags { display: flex; gap: 6px; margin-bottom: 8px; }

.dp-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(255,182,185,0.15);
  color: var(--planner-accent, #ffb6b9);
  border: 1px solid rgba(255,182,185,0.3);
}

.dp-content {
  font-size: 13px;
  color: var(--text-muted, #a89f9e);
  line-height: 1.6;
}
</style>
