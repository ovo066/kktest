<template>
  <Transition name="fade-start">
    <div v-if="visible" class="meet-start-screen" @click.stop>
      <div class="start-card">
        <h1 class="start-title">{{ title }}</h1>
        <div v-if="location" class="start-location">
          <i class="ph ph-map-pin-fill"></i> {{ location }}
        </div>
        <p class="start-desc">{{ description }}</p>
        <div class="start-actions">
          <button class="btn-setup" @click.stop="emit('setup')">配置</button>
          <button class="btn-start" :disabled="isGenerating" @click.stop="emit('start')">
            {{ startActionLabel }}
          </button>
          <button v-if="hasHistory" class="btn-restart" :disabled="isGenerating" @click.stop="emit('restart')">
            重新开始
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  description: { type: String, default: '' },
  hasHistory: { type: Boolean, default: false },
  isGenerating: { type: Boolean, default: false },
  location: { type: String, default: '' },
  startActionLabel: { type: String, default: '开始约会' },
  title: { type: String, default: '约会' },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['restart', 'setup', 'start'])
</script>

<style scoped>
.meet-start-screen {
  position: absolute;
  inset: 0;
  z-index: 110;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
}

.start-card {
  width: 100%;
  max-width: 420px;
  background: rgba(210, 210, 210, 0.88);
  border: 3px solid #111;
  padding: 48px 32px 32px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.start-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #111;
  margin-bottom: 8px;
  letter-spacing: 4px;
}

.start-location {
  color: #555;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  letter-spacing: 2px;
}

.start-desc {
  margin: 24px 0 32px;
  color: #666;
  font-size: 0.85rem;
  line-height: 1.6;
  letter-spacing: 1px;
}

.start-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.start-actions button {
  height: 50px;
  font-weight: 700;
  font-size: 1rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-setup {
  flex: 1;
  background: transparent;
  border: 2px solid #555;
  color: #333;
}

.btn-setup:hover {
  border-color: #333;
  color: #111;
}

.btn-start {
  flex: 2;
  background: #000;
  border: 2px solid #000;
  color: #fff;
}

.btn-start:hover {
  background: #222;
}

.btn-start:active,
.btn-setup:active {
  transform: scale(0.96);
}

.btn-start:disabled {
  opacity: 0.3;
}

.btn-restart {
  width: 100%;
  height: 44px;
  background: transparent;
  border: 1px solid #555;
  color: #333;
  font-size: 0.85rem;
  letter-spacing: 2px;
}

.btn-restart:hover {
  border-color: #333;
  color: #111;
}

.btn-restart:disabled {
  opacity: 0.45;
}

.fade-start-enter-active {
  transition: opacity 0.4s ease;
}

.fade-start-leave-active {
  transition: opacity 0.3s ease;
}

.fade-start-enter-from,
.fade-start-leave-to {
  opacity: 0;
}
</style>
