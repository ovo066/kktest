<template>
  <Transition name="vn-dialog" appear>
    <div class="vn-dialog-wrap" :style="cssVars">
      <!-- Character name badge -->
      <div v-if="name" class="vn-name-badge">
        {{ name }}
      </div>

      <!-- Glass dialog card -->
      <div class="vn-glass-dialog">
        <div class="vn-dialog-body">
          <p class="vn-dialog-text">{{ displayText }}<span v-if="isPlaying && displayText" class="vn-cursor"></span></p>
        </div>

        <!-- Continue indicator -->
        <div v-if="!isPlaying && displayText" class="vn-continue">
          <i class="ph ph-caret-double-down"></i>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  nameColor: { type: String, default: '#6366f1' },
  text: { type: String, default: '' },
  textSpeed: { type: Number, default: 30 },
  isPlaying: { type: Boolean, default: false }
})

const emit = defineEmits(['complete'])

const displayText = ref('')
let timer = null
let completedForText = ''

const cssVars = computed(() => ({
  '--badge-bg': props.nameColor || '#6366f1'
}))

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function completeNow() {
  stopTimer()
  displayText.value = props.text || ''
  if (props.text && completedForText !== props.text) {
    completedForText = props.text
    emit('complete')
  }
}

function startTyping(text) {
  stopTimer()
  completedForText = ''
  displayText.value = ''
  if (!text) { emit('complete'); return }

  const speed = Math.max(10, Number(props.textSpeed || 30))
  let i = 0
  timer = setInterval(() => {
    if (!props.isPlaying) { completeNow(); return }
    i += 1
    displayText.value = text.slice(0, i)
    if (i >= text.length) {
      stopTimer()
      completedForText = text
      emit('complete')
    }
  }, speed)
}

watch(() => props.text, (t) => {
  if (t == null) return
  startTyping(String(t))
}, { immediate: true })

watch(() => props.isPlaying, (v) => {
  if (v === false && props.text && displayText.value !== props.text) {
    completeNow()
  }
})

onBeforeUnmount(() => stopTimer())
</script>

<style scoped>
.vn-dialog-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 0 16px 24px;
  pointer-events: none;
}

.vn-glass-dialog {
  pointer-events: auto;
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 24px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  padding: 32px 24px 28px;
  min-height: 140px;
}

.vn-name-badge {
  position: absolute;
  top: -14px;
  left: 36px;
  padding: 6px 20px;
  border-radius: 20px;
  background: var(--badge-bg);
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  z-index: 2;
}

.vn-dialog-body {
  padding-top: 4px;
}

.vn-dialog-text {
  font-size: 16px;
  line-height: 1.9;
  color: rgba(30, 30, 50, 0.88);
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0.02em;
}

.vn-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: var(--badge-bg);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: vnCursorBlink 1s step-end infinite;
}

.vn-continue {
  position: absolute;
  right: 24px;
  bottom: 14px;
  color: rgba(30, 30, 50, 0.25);
  font-size: 18px;
  animation: vnContinueBounce 2s ease-in-out infinite;
}

/* Entrance transition */
.vn-dialog-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.vn-dialog-leave-active {
  transition: all 0.25s ease-in;
}
.vn-dialog-enter-from {
  opacity: 0;
  transform: translateY(24px);
}
.vn-dialog-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@keyframes vnCursorBlink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes vnContinueBounce {
  0%, 100% { transform: translateY(0); opacity: 0.25; }
  50% { transform: translateY(5px); opacity: 0.6; }
}
</style>
