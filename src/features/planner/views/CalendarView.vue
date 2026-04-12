<template>
  <div class="calendar-view">
    <header class="view-header">
      <button class="home-btn" @click="goHome">
        <span class="material-symbols-outlined">chevron_left</span>
        <span>桌面</span>
      </button>
      <div class="header-main">
        <h1 class="view-title">日历</h1>
      </div>
      <slot name="schedule-toggle" />
    </header>

    <div class="scroll-area">
      <CalendarGrid :selected-date="selectedDate" @select="onSelect" />
    </div>

    <!-- Day detail panel -->
    <DayDetailPanel
      :date-str="selectedDate"
      :visible="showPanel"
      @close="showPanel = false"
      @open-diary="openDiary"
      @add-task="onAddTask"
    />

    <!-- Inline task create for specific date -->
    <TaskCreateModal
      v-if="showCreateForDate"
      :preset-date="createDate"
      @close="showCreateForDate = false"
      @created="showCreateForDate = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CalendarGrid from '../components/CalendarGrid.vue'
import DayDetailPanel from '../components/DayDetailPanel.vue'
import TaskCreateModal from '../components/TaskCreateModal.vue'
import { toLocalDateKey } from '../../../utils/dateKey'

const router = useRouter()

const today = toLocalDateKey()
const selectedDate = ref(today)
const showPanel = ref(false)
const showCreateForDate = ref(false)
const createDate = ref('')

function onSelect(dateStr) {
  selectedDate.value = dateStr
  showPanel.value = true
}

function goHome() {
  router.push({ name: 'home' })
}

function openDiary(id) {
  showPanel.value = false
  router.push({ name: 'diary-detail', params: { id } })
}

function onAddTask(dateStr) {
  showPanel.value = false
  createDate.value = dateStr
  showCreateForDate.value = true
}
</script>

<style scoped>
.calendar-view {
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

.home-btn .material-symbols-outlined {
  font-size: 18px;
}

.header-main {
  flex: 1;
  min-width: 0;
}

.view-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-color, #5c4a4d);
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 100px;
}
</style>
