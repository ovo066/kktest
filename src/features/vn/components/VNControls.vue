<template>
  <div class="vn-ctrl-row">
    <!-- Settings -->
    <button
      class="vn-circle-btn"
      @click.stop="emit('menu')"
      aria-label="设置"
    >
      <i class="ph ph-gear-six"></i>
    </button>

    <!-- History -->
    <button
      class="vn-circle-btn"
      @click.stop="emit('show-history')"
      aria-label="历史"
    >
      <i class="ph ph-clock-counter-clockwise"></i>
    </button>

    <!-- Auto play -->
    <button
      class="vn-circle-btn"
      :class="{ 'is-active': isAuto }"
      @click.stop="emit('toggle-auto')"
      aria-label="自动播放"
    >
      <span v-if="isAuto" class="vn-auto-label">AUTO</span>
      <i v-else class="ph ph-play"></i>
    </button>

    <!-- Generating indicator -->
    <div v-if="isGenerating" class="vn-gen-dots">
      <span></span><span></span><span></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isAuto: { type: Boolean, default: false },
  isGenerating: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-auto',
  'show-history',
  'menu'
])
</script>

<style scoped>
.vn-ctrl-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vn-circle-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.vn-circle-btn:active {
  transform: scale(0.9);
  background: rgba(255, 255, 255, 0.15);
}

.vn-circle-btn.is-active {
  background: rgba(99, 102, 241, 0.6);
  border-color: rgba(99, 102, 241, 0.5);
  color: #fff;
}

.vn-auto-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.vn-gen-dots {
  display: flex;
  gap: 3px;
  margin-left: 4px;
}

.vn-gen-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  animation: vnDotPulse 1.2s infinite;
}

.vn-gen-dots span:nth-child(2) { animation-delay: 0.15s; }
.vn-gen-dots span:nth-child(3) { animation-delay: 0.3s; }

@keyframes vnDotPulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.1); }
}
</style>
