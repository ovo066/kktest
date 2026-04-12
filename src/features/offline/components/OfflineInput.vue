<template>
  <div class="offline-input-area">
    <button class="ai-help-btn" :disabled="isGenerating" @click="$emit('ai-help')" title="AI 帮答">
      <i class="ph-bold ph-magic-wand text-lg"></i>
    </button>

    <div class="input-wrapper">
      <textarea
        ref="textareaRef"
        v-model="text"
        :placeholder="isGenerating ? 'AI 正在回复...' : '描述你的行动或对话...'"
        :disabled="isGenerating"
        rows="1"
        @input="autoResize"
        @keydown.enter.exact="handleSend"
      ></textarea>
    </div>

    <button
      v-if="isGenerating"
      class="send-btn stop-btn"
      @click="$emit('cancel')"
    >
      <i class="ph-fill ph-stop text-lg"></i>
    </button>
    <button
      v-else
      class="send-btn"
      :class="{ active: text.trim() }"
      :disabled="!text.trim()"
      @click="handleSend"
    >
      <i class="ph-bold ph-paper-plane-tilt text-lg"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

defineProps({
  isGenerating: { type: Boolean, default: false }
})

const emit = defineEmits(['send', 'cancel', 'ai-help'])

const text = ref('')
const textareaRef = ref(null)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function handleSend(e) {
  if (e?.type === 'keydown') e.preventDefault()
  const content = text.value.trim()
  if (!content) return
  emit('send', content)
  text.value = ''
  nextTick(autoResize)
}

defineExpose({ focus: () => textareaRef.value?.focus() })
</script>

<style scoped>
.offline-input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 14px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--off-surface);
  border-top: var(--off-border-w) solid var(--off-border);
  z-index: 10;
}

.ai-help-btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 50%;
  background: var(--off-surface);
  box-shadow: var(--off-shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--off-text);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.ai-help-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.ai-help-btn:disabled {
  opacity: 0.4;
  pointer-events: none;
}

.input-wrapper {
  flex: 1;
  background: var(--off-surface);
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 22px;
  padding: 0 14px;
  display: flex;
  align-items: flex-end;
}

textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.4;
  padding: 10px 0;
  max-height: 120px;
  min-height: 42px;
  resize: none;
  color: var(--off-text);
}
textarea::placeholder {
  color: var(--off-text-sec);
  opacity: 0.5;
}
textarea:disabled {
  opacity: 0.5;
}

.send-btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 50%;
  background: var(--off-bg);
  color: var(--off-text-sec);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s, background 0.15s, color 0.15s;
}
.send-btn.active {
  background: var(--off-text);
  color: var(--off-surface);
  box-shadow: var(--off-shadow-sm);
}
.send-btn.active:active {
  transform: scale(0.9);
  box-shadow: none;
}
.send-btn:disabled {
  cursor: default;
}
.stop-btn {
  background: var(--off-danger) !important;
  color: #fff !important;
  border-color: var(--off-danger) !important;
}
.stop-btn:active {
  transform: scale(0.9);
}
</style>
