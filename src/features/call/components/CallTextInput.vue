<template>
  <div v-if="visible" class="text-input-slide px-4 pb-4 w-full max-w-xl mx-auto z-20 relative">
    <div class="flex items-center gap-2.5 glass-input rounded-full p-1 pl-4 pr-1 shadow-xl">
      <input
        ref="inputRef"
        v-model="text"
        type="text"
        class="flex-1 bg-transparent text-white text-[15px] outline-none placeholder-white/25 h-10"
        placeholder="发送消息..."
        :disabled="disabled"
        @keydown.enter="handleSend"
      >
      <button
        class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm"
        :class="text.trim() ? 'bg-white text-[#111] scale-100' : 'bg-white/8 text-white/20 scale-90'"
        :disabled="!text.trim() || disabled"
        @click="handleSend"
      >
        <i class="ph-bold ph-arrow-up text-base"></i>
      </button>
    </div>

    <!-- STT 状态 -->
    <div v-if="sttListening" class="flex items-start justify-center gap-2 mt-2.5 min-h-5">
      <div class="flex gap-1">
        <div class="w-1 h-1 rounded-full bg-red-500 animate-bounce shadow-[0_0_8px_red]" style="animation-delay: 0s"></div>
        <div class="w-1 h-1 rounded-full bg-red-500 animate-bounce shadow-[0_0_8px_red]" style="animation-delay: 0.1s"></div>
        <div class="w-1 h-1 rounded-full bg-red-500 animate-bounce shadow-[0_0_8px_red]" style="animation-delay: 0.2s"></div>
      </div>
      <span class="text-[10px] font-semibold text-white/50 tracking-wider uppercase leading-5 shrink-0">Listening</span>
      <span
        v-if="interimText"
        class="text-[10px] text-white/80 glass-panel px-2 py-0.5 rounded ml-1 max-w-[min(240px,calc(100vw-132px))] leading-relaxed break-words whitespace-pre-wrap"
      >{{ interimText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  sttListening: { type: Boolean, default: false },
  interimText: { type: String, default: '' }
})

const emit = defineEmits(['send'])

const text = ref('')
const inputRef = ref(null)

watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => inputRef.value?.focus())
  }
})

function handleSend() {
  const t = text.value.trim()
  if (!t || props.disabled) return
  emit('send', t)
  text.value = ''
}
</script>
