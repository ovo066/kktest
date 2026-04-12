<template>
  <Transition name="vn-narration" appear>
    <div v-if="text" class="vn-narration-overlay" @click.stop>
      <div class="vn-narration-box">
        <div class="vn-narration-ornament">
          <i class="ph ph-sparkle"></i>
        </div>
        <p class="vn-narration-text">{{ displayText }}<span v-if="isPlaying && displayText" class="vn-nar-cursor">|</span></p>
        <div class="vn-narration-ornament bottom">
          <i class="ph ph-sparkle"></i>
        </div>

        <div v-if="!isPlaying && displayText" class="vn-nar-continue">
          <span class="vn-nar-hint">点击继续</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

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

  const speed = Math.max(10, Number(props.textSpeed || 30) + 10)
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
.vn-narration-overlay {
  position: absolute;
  inset: 0;
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.vn-narration-box {
  position: relative;
  width: 100%;
  max-width: 680px;
  padding: 48px 40px;
  text-align: center;
}

.vn-narration-ornament {
  color: rgba(255, 255, 255, 0.2);
  font-size: 24px;
  margin-bottom: 24px;
}
.vn-narration-ornament.bottom {
  margin-bottom: 0;
  margin-top: 24px;
}

.vn-narration-text {
  font-family: 'Noto Serif SC', 'Source Han Serif SC', Georgia, 'Times New Roman', serif;
  font-size: 20px;
  line-height: 2.2;
  color: rgba(255, 255, 255, 0.92);
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0.05em;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

.vn-nar-cursor {
  color: rgba(255, 255, 255, 0.5);
  animation: vnNarCursorBlink 1s step-end infinite;
}

.vn-nar-continue {
  margin-top: 32px;
}

.vn-nar-hint {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  animation: vnNarPulse 2s ease-in-out infinite;
}

@keyframes vnNarCursorBlink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes vnNarPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* Transition */
.vn-narration-enter-active { transition: opacity 0.6s ease; }
.vn-narration-leave-active { transition: opacity 0.4s ease; }
.vn-narration-enter-from,
.vn-narration-leave-to { opacity: 0; }
</style>
