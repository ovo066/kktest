<template>
  <Transition name="vn-choices-fade">
    <div v-if="options?.length" class="vn-choices-overlay">
      <div class="vn-choices-list">
        <button
          v-for="(opt, idx) in options"
          :key="idx"
          class="vn-choice-card"
          :style="{ animationDelay: `${idx * 120}ms` }"
          @click.stop="emit('select', opt)"
        >
          <div class="vn-choice-num">{{ idx + 1 }}</div>
          <div class="vn-choice-body">
            <div class="vn-choice-label">{{ opt.text }}</div>
            <div v-if="opt.effect" class="vn-choice-hint">{{ opt.effect }}</div>
          </div>
          <i class="ph ph-caret-right vn-choice-arrow"></i>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  options: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])
</script>

<style scoped>
.vn-choices-overlay {
  position: absolute;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.vn-choices-list {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.vn-choice-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  text-align: left;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  animation: vnChoiceSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.vn-choice-card:active {
  transform: scale(0.97) translateX(4px);
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
}

.vn-choice-num {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  color: white;
}

.vn-choice-body {
  flex: 1;
  min-width: 0;
}

.vn-choice-label {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.5;
}

.vn-choice-hint {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.vn-choice-arrow {
  flex-shrink: 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.3);
  transition: transform 0.2s ease;
}

.vn-choice-card:active .vn-choice-arrow {
  transform: translateX(3px);
  color: rgba(255, 255, 255, 0.6);
}

@keyframes vnChoiceSlideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.vn-choices-fade-enter-active { transition: opacity 0.4s ease; }
.vn-choices-fade-leave-active { transition: opacity 0.25s ease; }
.vn-choices-fade-enter-from,
.vn-choices-fade-leave-to { opacity: 0; }
</style>
