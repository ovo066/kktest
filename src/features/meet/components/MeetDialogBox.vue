<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  nameColor: { type: String, default: '#fff' },
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
  <div class="meet-dialog-wrapper">
    <div class="meet-dialog-panel">
      <!-- Name Tag - VN black nameplate -->
      <div v-if="name" class="meet-name-tag">
        {{ name }}
      </div>

      <!-- Text Content -->
      <div class="meet-dialog-content">
        <p class="meet-dialog-text">
          {{ displayText }}<span v-if="isPlaying && displayText" class="meet-cursor"></span>
        </p>
      </div>

      <!-- Continue indicator -->
      <Transition name="fade">
        <div v-if="!isPlaying && displayText" class="meet-next-hint">
          点击继续
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.meet-dialog-wrapper {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 0 5% calc(var(--app-pb, 8px) + 20px);
  pointer-events: none;
}

.meet-dialog-panel {
  max-width: 800px;
  margin: 0 auto;
  min-height: 120px;
  background: rgba(210, 210, 210, 0.85);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 3px solid #111;
  padding: 25px 30px;
  pointer-events: auto;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-name-tag {
  position: absolute;
  top: -18px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 6px 24px;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 4px;
  line-height: 1.3;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-dialog-content {
  flex: 1;
  overflow-y: auto;
  margin-top: 4px;
}

.meet-dialog-content::-webkit-scrollbar { display: none; }

.meet-dialog-text {
  font-size: 1.1rem;
  line-height: 1.7;
  color: #111;
  font-weight: 700;
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0.02em;
}

.meet-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: #333;
  margin-left: 4px;
  vertical-align: middle;
  animation: cursorBlink 0.8s step-end infinite;
}

.meet-next-hint {
  position: absolute;
  right: 20px;
  bottom: 15px;
  color: #333;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  animation: hintBlink 1.5s infinite;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

@keyframes cursorBlink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes hintBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
