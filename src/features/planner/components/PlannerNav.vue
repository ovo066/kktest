<template>
  <div class="planner-nav">
    <nav class="nav-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="nav-tab"
        :class="{ active: modelValue === tab.key }"
        @click="$emit('update:modelValue', tab.key)"
      >
        <span class="material-symbols-outlined nav-icon">{{ tab.icon }}</span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: 'today' }
})
defineEmits(['update:modelValue'])

const tabs = [
  { key: 'today', label: '今天', icon: 'home' },
  { key: 'calendar', label: '日历', icon: 'calendar_month' },
  { key: 'tasks', label: '任务', icon: 'checklist' },
  { key: 'diary', label: '日记', icon: 'menu_book' }
]
</script>

<style scoped>
.planner-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
}

.nav-bar {
  width: 100%;
  max-width: 430px;
  background: var(--card-bg, rgba(255,255,255,0.95));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1.5px dashed var(--border-color, rgba(255,182,185,0.4));
  border-radius: 24px 24px 0 0;
  padding: 8px 16px calc(env(safe-area-inset-bottom, 12px) + 8px);
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  position: relative;
}

.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #a89f9e);
  transition: color 0.2s;
  min-width: 52px;
}

.nav-tab.active {
  color: var(--planner-accent, #ffb6b9);
}

.nav-icon {
  font-size: 26px;
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
}

.nav-tab.active .nav-icon {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.nav-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

</style>
