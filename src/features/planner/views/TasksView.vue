<template>
  <div class="tasks-view">
    <header class="view-header">
      <button class="home-btn" @click="goHome">
        <span class="material-symbols-outlined">chevron_left</span>
        <span>桌面</span>
      </button>
      <div class="header-main">
        <h1 class="view-title">任务</h1>
      </div>
      <button class="filter-btn" @click="showCompleted = !showCompleted">
        <span class="material-symbols-outlined" style="font-size:20px">{{ showCompleted ? 'visibility' : 'visibility_off' }}</span>
      </button>
    </header>

    <div class="scroll-area">
      <template v-if="groupedTasks.length === 0">
        <div class="empty-state">
          <span class="material-symbols-outlined" style="font-size:56px;opacity:0.2">checklist</span>
          <p>还没有任务，点击 + 添加一个吧</p>
        </div>
      </template>

      <template v-else>
        <div v-for="group in groupedTasks" :key="group.category.id" class="category-group">
          <!-- Category header -->
          <div class="cat-header" :style="{ '--cat-color': group.category.color }">
            <div class="cat-bar" />
            <span class="material-symbols-outlined cat-icon">{{ group.category.icon }}</span>
            <span class="cat-name">{{ group.category.name }}</span>
            <span class="cat-count">{{ group.events.length }}</span>
          </div>

          <!-- Task cards -->
          <div class="task-list">
            <TaskCard
              v-for="evt in group.events"
              :key="evt.id"
              :event="evt"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '../../../stores/planner'
import TaskCard from '../components/TaskCard.vue'

const router = useRouter()
const plannerStore = usePlannerStore()
const showCompleted = ref(false)

const groupedTasks = computed(() => {
  const filtered = plannerStore.events.filter(e => showCompleted.value ? true : !e.completed)

  const groups = plannerStore.categories.map(cat => ({
    category: cat,
    events: filtered.filter(e => e.category === cat.id).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
  })).filter(g => g.events.length > 0)

  return groups
})

function goHome() {
  router.push({ name: 'home' })
}
</script>

<style scoped>
.tasks-view {
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

.filter-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #a89f9e);
  display: flex;
  align-items: center;
  padding: 6px;
}

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

.category-group {
  margin-bottom: 24px;
}

.cat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-left: 4px;
}

.cat-bar {
  width: 4px;
  height: 20px;
  border-radius: 4px;
  background: var(--cat-color);
  flex-shrink: 0;
}

.cat-icon {
  font-size: 18px;
  color: var(--cat-color);
  font-variation-settings: 'FILL' 0, 'wght' 300;
}

.cat-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
  flex: 1;
}

.cat-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #a89f9e);
  background: var(--card-bg, rgba(0,0,0,0.04));
  border-radius: 20px;
  padding: 2px 8px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
