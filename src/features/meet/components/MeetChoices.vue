<script setup>
import { ref } from 'vue'

defineProps({
  options: { type: Array, default: () => [] }
})

const emit = defineEmits(['select', 'custom'])
const customText = ref('')

function sendCustom() {
  const text = customText.value.trim()
  if (!text) return
  customText.value = ''
  emit('custom', text)
}
</script>

<template>
  <div v-if="options?.length" class="meet-choices-layer">
    <div class="meet-choice-stack">
      <button
        v-for="(opt, idx) in options"
        :key="idx"
        class="meet-choice-btn animate-in"
        :style="{ animationDelay: `${idx * 80}ms` }"
        @click.stop="emit('select', opt)"
      >
        <span class="meet-choice-text">{{ opt.text }}</span>
        <span v-if="opt.effect" class="meet-choice-effect">{{ opt.effect }}</span>
      </button>

      <!-- Custom Response -->
      <div class="meet-custom-input-box animate-in" :style="{ animationDelay: `${(options?.length || 0) * 80 + 60}ms` }">
        <input
          v-model="customText"
          type="text"
          class="meet-custom-input"
          placeholder="或者，你想说什么..."
          @click.stop
          @keydown.enter.stop="sendCustom"
        >
        <button class="meet-custom-send" @click.stop="sendCustom">
          <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.meet-choices-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--app-pb, 8px) + var(--kb-inset, 0px) + 118px);
  z-index: 40;
  display: flex;
  justify-content: center;
  padding: 0 clamp(12px, 4vw, 28px);
  pointer-events: none;
}

.meet-choice-stack {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: auto;
  max-height: min(46vh, 380px);
  overflow-y: auto;
  padding-right: 4px;
}

.meet-choice-stack::-webkit-scrollbar {
  width: 4px;
}

.meet-choice-stack::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.meet-choice-btn {
  width: 100%;
  background: linear-gradient(to bottom, rgba(80, 80, 80, 0.85), rgba(40, 40, 40, 0.85));
  border: 1px solid rgba(0, 0, 0, 0.8);
  border-top: 2px solid #222;
  border-bottom: 2px solid #111;
  padding: 12px 14px;
  color: #fff;
  font-size: 1rem;
  line-height: 1.4;
  font-weight: 700;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 1px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.meet-choice-text {
  width: 100%;
  white-space: normal;
  word-break: break-word;
}

.meet-choice-btn:hover {
  background: linear-gradient(to bottom, rgba(100, 100, 100, 0.9), rgba(60, 60, 60, 0.9));
  transform: scale(1.02);
}

.meet-choice-btn:active {
  transform: scale(0.98);
  background: linear-gradient(to bottom, rgba(60, 60, 60, 0.9), rgba(30, 30, 30, 0.9));
}

.meet-choice-effect {
  font-size: 0.72rem;
  opacity: 0.5;
  font-style: italic;
  font-weight: 400;
  letter-spacing: 1px;
}

.meet-custom-input-box {
  background: rgba(30, 30, 30, 0.85);
  border: 2px solid #333;
  padding: 4px 4px 4px 16px;
  display: flex;
  align-items: center;
  margin-top: 2px;
  width: 100%;
}

.meet-custom-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  height: 40px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 1px;
}

.meet-custom-input::placeholder { color: rgba(255, 255, 255, 0.3); }

.meet-custom-send {
  width: 40px;
  height: 40px;
  background: #000;
  border: none;
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.meet-custom-send:hover { background: #333; }
.meet-custom-send:active { transform: scale(0.9); }

@keyframes slideIn {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.animate-in {
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@media (max-width: 420px) {
  .meet-choices-layer {
    bottom: calc(var(--app-pb, 8px) + var(--kb-inset, 0px) + 110px);
    padding: 0 10px;
  }

  .meet-choice-btn {
    font-size: 0.94rem;
    padding: 10px 12px;
  }

  .meet-custom-input {
    font-size: 0.9rem;
  }
}
</style>
