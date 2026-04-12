<template>
  <div class="diary-list-view">
    <header class="view-header">
      <button class="home-btn" @click="goHome">
        <span class="material-symbols-outlined">chevron_left</span>
        <span>桌面</span>
      </button>
      <div class="header-main">
        <h1 class="view-title">日记</h1>
      </div>
      <button class="create-diary-btn" @click="showCreateModal = true">
        <span class="material-symbols-outlined" style="font-size:20px;font-variation-settings:'FILL' 0,'wght' 400">edit_note</span>
      </button>
    </header>

    <div class="scroll-area">
      <div v-if="plannerStore.sortedDiary.length === 0" class="empty-state">
        <span class="material-symbols-outlined" style="font-size:56px;opacity:0.2">menu_book</span>
        <p>还没有日记，今天写点什么吧</p>
      </div>

      <div v-else class="diary-list">
        <DiaryCard
          v-for="entry in plannerStore.sortedDiary"
          :key="entry.id"
          :entry="entry"
          @click="openDiary(entry.id)"
        />
      </div>
    </div>

    <DiaryCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onDiaryCreated"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '../../../stores/planner'
import DiaryCard from '../components/DiaryCard.vue'
import DiaryCreateModal from '../components/DiaryCreateModal.vue'

const router = useRouter()
const plannerStore = usePlannerStore()
const showCreateModal = ref(false)

function openDiary(id) {
  router.push({ name: 'diary-detail', params: { id } })
}

function goHome() {
  router.push({ name: 'home' })
}

function onDiaryCreated(id) {
  showCreateModal.value = false
  router.push({ name: 'diary-detail', params: { id } })
}
</script>

<style scoped>
.diary-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #fffdfa);
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 52px 20px 12px;
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

.create-diary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid rgba(166,227,233,0.4);
  background: rgba(166,227,233,0.12);
  color: var(--planner-accent2, #a6e3e9);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s;
}
.create-diary-btn:active { transform: scale(0.92); }

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 100px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 0;
  color: var(--text-muted, #a89f9e);
  font-size: 14px;
  text-align: center;
}

.diary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
