<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  textSpeed: { type: Number, default: 30 },
  isPlaying: { type: Boolean, default: false }
})

const emit = defineEmits(['complete'])

const displayText = ref('')
let timer = null
let completedForText = ''

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

<template>
  <div class="meet-narration-overlay">
    <div class="meet-narration-panel">
      <div class="meet-narration-body">
        <p class="meet-narration-text">
          {{ displayText }}<span v-if="isPlaying && displayText" class="meet-cursor"></span>
        </p>
      </div>
      <div v-if="!isPlaying && displayText" class="meet-narration-hint">
        点击屏幕继续
      </div>
    </div>
  </div>
</template>

<style scoped>
.meet-narration-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
  pointer-events: none;
  padding: 40px;
  background: rgba(0, 0, 0, 0.6);
}

.meet-narration-panel {
  width: 100%;
  max-width: 600px;
  background: rgba(210, 210, 210, 0.8);
  border: 3px solid #111;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-narration-text {
  font-size: 1.15rem;
  line-height: 1.9;
  color: #111;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: pre-wrap;
  word-break: break-word;
}

.meet-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: #333;
  margin-left: 6px;
  vertical-align: middle;
  animation: cursorBlink 1s step-end infinite;
}

.meet-narration-hint {
  margin-top: 24px;
  font-size: 0.85rem;
  color: #555;
  letter-spacing: 4px;
  font-weight: 700;
  animation: hintBlink 1.5s infinite;
}

@keyframes cursorBlink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes hintBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
</style>
