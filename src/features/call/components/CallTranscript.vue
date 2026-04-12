<template>
  <div class="call-transcript-area" ref="scrollContainer">
    <div class="flex flex-col gap-2.5 px-4 py-3" ref="messageList">
      <div
        v-for="msg in visibleMessages"
        :key="msg.id"
        class="call-transcript-row flex bubble-in"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="call-transcript-bubble px-3.5 py-2 rounded-2xl text-[14px] leading-relaxed"
          :class="msg.role === 'user'
            ? 'bg-[#34C759]/80 text-white rounded-br-md'
            : 'bg-white/[0.12] text-white/90 rounded-bl-md backdrop-blur-sm'"
        >
          {{ msg.text }}
        </div>
      </div>

      <!-- AI 正在输出的实时气泡 -->
      <div v-if="streamingText" class="call-transcript-row flex justify-start bubble-in">
        <div class="call-transcript-bubble px-3.5 py-2 rounded-2xl rounded-bl-md text-[14px] leading-relaxed bg-white/[0.12] text-white/90 backdrop-blur-sm">
          {{ streamingText }}
        </div>
      </div>
      <div ref="bottomAnchor" class="h-px w-full shrink-0"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { cleanCallText } from '../composables/useCallParser'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  streamingText: { type: String, default: '' }
})

const scrollContainer = ref(null)
const bottomAnchor = ref(null)

const visibleMessages = computed(() =>
  props.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const text = cleanCallText(m.content)
      return text ? { id: m.id, role: m.role, text } : null
    })
    .filter(Boolean)
)

function scrollToBottom() {
  nextTick(() => {
    const el = scrollContainer.value
    const anchor = bottomAnchor.value
    if (!el) return

    // Safari is less reliable with repeated scrollTop writes while content is growing.
    // Keeping a bottom anchor in view is more stable for streaming call subtitles.
    if (anchor && typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({ block: 'end' })
    }

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  })
}

watch(() => visibleMessages.value.length, scrollToBottom, { flush: 'post' })
watch(() => props.streamingText, scrollToBottom, { flush: 'post' })
</script>

<style scoped>
.call-transcript-area {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.call-transcript-area::-webkit-scrollbar {
  display: none;
}

.call-transcript-row {
  min-width: 0;
}

.call-transcript-bubble {
  width: fit-content;
  max-width: min(84%, 340px);
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
