<template>
  <ChatMessageShell
    :block="block"
    :multi-select-mode="multiSelectMode"
    :selected="isSelected"
    :show-chat-avatars="showChatAvatars"
    :root-class="wrapClass(block)"
    @click="handleRootClick"
  >
    <template #default="{ isUser }">
      <div
        v-if="block.type === 'image'"
        class="max-w-[70%] rounded-2xl overflow-hidden"
        :class="block.animClass"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <img :src="block.imageUrl" class="max-w-full max-h-[300px] object-contain rounded-2xl">
      </div>

      <div
        v-else-if="block.type === 'mockImage'"
        class="relative w-[220px] h-[220px] [perspective:1200px]"
        :class="block.animClass"
        @click.stop="toggleMockImageFlip"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div
          class="relative w-full h-full transition-transform duration-500 ease-out [transform-style:preserve-3d]"
          :class="{ '[transform:rotateY(180deg)]': mockImageFlipped }"
        >
          <div
            class="absolute inset-0 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--card-bg)] [backface-visibility:hidden]"
          >
            <img :src="block.imageUrl" class="w-full h-full object-cover">
            <div class="absolute right-2 bottom-2 w-7 h-7 rounded-full bg-black/65 text-white flex items-center justify-center">
              <i class="ph-fill ph-camera text-[14px]"></i>
            </div>
          </div>
          <div
            class="absolute inset-0 rounded-2xl overflow-hidden border border-[var(--border-color)] p-4 flex flex-col mock-image-reading-face [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <div class="flex-1 overflow-y-auto no-scrollbar">
              <div class="mock-image-reading-text">
                {{ block.mockText || '（无内容）' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="block.type === 'imageRendering'"
        class="w-[180px] h-[180px] rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] flex flex-col items-center justify-center gap-2"
        :class="block.animClass"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <i class="ph ph-circle-notch animate-spin text-[26px]" style="color: var(--primary-color);"></i>
        <div class="text-[12px]" style="color: var(--text-secondary);">{{ block.text || '正在渲染图片…' }}</div>
      </div>

      <template v-else>
        <template v-if="block.stickerUrl && !stickerImgFailed">
          <div class="max-w-[120px]" :class="block.animClass" @contextmenu.prevent="emit('context-menu', $event, block)">
            <img
              :src="stickerSrc"
              class="max-w-full max-h-[120px] object-contain"
              loading="eager"
              decoding="async"
              @error="handleStickerImgError"
            >
          </div>
        </template>
        <div
          v-else
          class="bubble"
          :class="[isUser ? 'bubble-user' : 'bubble-ai', block.animClass]"
          @contextmenu.prevent="emit('context-menu', $event, block)"
        >
          [表情包：{{ block.stickerName }}]
        </div>
      </template>
    </template>
  </ChatMessageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ChatMessageShell from './ChatMessageShell.vue'

const props = defineProps({
  block: { type: Object, required: true },
  multiSelectMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  showChatAvatars: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-select', 'context-menu'])

const isSelected = computed(() => props.multiSelectMode && props.selected)

const STICKER_MAX_AUTO_RETRY = 3
const STICKER_RETRY_DELAYS_MS = [800, 1800, 3600]

const stickerImgFailed = ref(false)
const stickerRetrySeq = ref(0)
const stickerRetryCount = ref(0)
const mockImageFlipped = ref(false)
let stickerRetryTimer = null

const stickerSrc = computed(() => {
  const raw = String(props.block?.stickerUrl || '').trim()
  if (!raw) return ''
  if (/^(?:data|blob):/i.test(raw)) return raw
  const joiner = raw.includes('?') ? '&' : '?'
  return `${raw}${joiner}_retry=${stickerRetrySeq.value}`
})

watch(() => [props.block?.key, props.block?.stickerUrl], () => {
  resetStickerImageState()
})

watch(() => [props.block?.key, props.block?.type], () => {
  mockImageFlipped.value = false
})

function clearStickerRetryTimer() {
  if (!stickerRetryTimer) return
  clearTimeout(stickerRetryTimer)
  stickerRetryTimer = null
}

function resetStickerImageState() {
  clearStickerRetryTimer()
  stickerImgFailed.value = false
  stickerRetrySeq.value = 0
  stickerRetryCount.value = 0
}

function scheduleStickerRetry({ force = false } = {}) {
  if (!props.block?.stickerUrl) return
  if (!force && stickerRetryCount.value >= STICKER_MAX_AUTO_RETRY) return
  clearStickerRetryTimer()
  const delay = force
    ? 120
    : (STICKER_RETRY_DELAYS_MS[stickerRetryCount.value] ?? 2500)
  stickerRetryTimer = setTimeout(() => {
    stickerRetryTimer = null
    if (!force) stickerRetryCount.value += 1
    stickerImgFailed.value = false
    stickerRetrySeq.value += 1
  }, delay)
}

function handleStickerImgError() {
  stickerImgFailed.value = true
  scheduleStickerRetry()
}

function handleNetworkOnline() {
  if (!stickerImgFailed.value) return
  scheduleStickerRetry({ force: true })
}

function toggleMockImageFlip() {
  if (props.multiSelectMode) return
  mockImageFlipped.value = !mockImageFlipped.value
}

function handleRootClick() {
  if (!props.multiSelectMode) return
  emit('toggle-select', props.block.key)
}

function wrapClass(block) {
  const align = block.isUser ? 'justify-end' : 'justify-start'
  return 'flex w-full ' + block.mb + ' ' + align + ' items-end select-none'
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleNetworkOnline)
  }
})

onBeforeUnmount(() => {
  clearStickerRetryTimer()
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleNetworkOnline)
  }
})
</script>

<style scoped>
.mock-image-reading-face {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,248,242,0.96) 100%),
    var(--card-bg);
}

.mock-image-reading-text {
  max-width: 26ch;
  margin: 0 auto;
  color: var(--text-primary);
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", Georgia, serif;
  font-style: italic;
  font-size: 15px;
  line-height: 1.95;
  letter-spacing: 0.01em;
  text-indent: 2em;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
