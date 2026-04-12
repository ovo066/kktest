<script setup>
defineProps({
  location: { type: String, default: '' },
  timeOfDay: { type: String, default: '' },
  isGenerating: { type: Boolean, default: false }
})

const emit = defineEmits(['back', 'menu'])
</script>

<template>
  <div class="meet-top-bar">
    <div class="meet-bar-left">
      <button class="meet-sys-btn" @click="emit('back')">
        <span>返回</span>
      </button>
      <div v-if="location" class="meet-info-tag">
        {{ location }}
      </div>
    </div>

    <div class="meet-bar-center">
      <div v-if="isGenerating" class="meet-loading-indicator">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
    </div>

    <div class="meet-bar-right">
      <div v-if="timeOfDay" class="meet-info-tag">
        {{ timeOfDay }}
      </div>
      <button class="meet-sys-btn" @click="emit('menu')">
        <span>菜单</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.meet-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: flex-start;
  padding: var(--app-pt-lg, 48px) 20px 12px;
  pointer-events: none;
}

.meet-bar-left, .meet-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

.meet-bar-right { justify-content: flex-end; }

.meet-sys-btn {
  background: #000;
  color: #fff;
  border: 2px solid #000;
  padding: 8px 18px;
  font-size: 14px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}

.meet-sys-btn:hover {
  background: #333;
}

.meet-sys-btn:active {
  background: #444;
}

.meet-info-tag {
  background: rgba(0, 0, 0, 0.7);
  color: rgba(255, 255, 255, 0.8);
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 2px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-loading-indicator {
  display: flex;
  gap: 6px;
}

.loading-dot {
  width: 6px;
  height: 6px;
  background: #fff;
  border-radius: 50%;
  animation: pulse 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.1); }
}
</style>
