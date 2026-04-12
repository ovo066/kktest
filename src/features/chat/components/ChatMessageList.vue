<template>
  <div class="relative flex-1 overflow-hidden">
    <div
      ref="containerRef"
      class="chat-messages h-full overflow-y-auto overflow-x-hidden p-4 bg-[var(--chat-bg)] no-scrollbar pb-6 bg-cover bg-center bg-no-repeat"
      :style="chatBackgroundStyle"
      @scroll.passive="handleScroll"
    >
      <div v-if="canLoadOlder" class="flex justify-center mb-3">
        <button
          class="px-3 py-1.5 rounded-full text-[11px] font-medium bg-[var(--card-bg)]/88 text-[var(--text-secondary)] border border-[var(--border-color)]"
          @click="requestLoadOlder"
        >
          加载更早消息
        </button>
      </div>

      <div
        v-if="showWatermark"
        class="chat-watermark text-center text-[10px] font-semibold opacity-30 mb-6 mt-2 tracking-widest uppercase"
        style="color: var(--meta-color, #8E8E93);"
      >
        {{ watermarkText }}
      </div>

      <ChatMessageBlock
        v-for="block in blocks"
        :key="block.key"
        v-memo="[block, multiSelectMode, isSelected(block.key), showChatAvatars]"
        class="chat-msg-item"
        :block="block"
        :multi-select-mode="multiSelectMode"
        :selected="isSelected(block.key)"
        :show-chat-avatars="showChatAvatars"
        @toggle-select="emit('toggle-select', $event)"
        @context-menu="forwardContextMenu"
        @narration-menu="forwardNarrationMenu"
        @open-call-history="emit('open-call-history', $event)"
        @delete-offline-card="emit('delete-offline-card', $event)"
        @accept-transfer="emit('accept-transfer', $event)"
        @reject-transfer="emit('reject-transfer', $event)"
        @accept-gift="emit('accept-gift', $event)"
        @reject-gift="emit('reject-gift', $event)"
        @accept-meet="emit('accept-meet', $event)"
        @reject-meet="emit('reject-meet', $event)"
        @open-transfer-detail="emit('open-transfer-detail', $event)"
      />

      <TypingIndicator :is-typing="isTyping" :is-thinking="isThinking" />
    </div>

    <Transition name="scroll-btn">
      <button
        v-if="showScrollToBottom"
        class="absolute right-3 bottom-3 w-9 h-9 rounded-full bg-[var(--card-bg)] shadow-lg border border-[var(--border-color)] flex items-center justify-center z-10 active:scale-90 transition-transform"
        @click="onScrollToBottomClick"
      >
        <i class="ph-bold ph-arrow-down text-[16px] text-[var(--text-secondary)]"></i>
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { nextTick, ref, watch, Transition } from 'vue'
import ChatMessageBlock from './ChatMessageBlock.vue'
import TypingIndicator from './TypingIndicator.vue'

const props = defineProps({
  blocks: { type: Array, default: () => [] },
  chatBackgroundStyle: { type: Object, default: () => ({}) },
  isTyping: { type: Boolean, default: false },
  isThinking: { type: Boolean, default: false },
  multiSelectMode: { type: Boolean, default: false },
  selectedBlockKeys: { type: Object, default: () => new Set() },
  showChatAvatars: { type: Boolean, default: false },
  showWatermark: { type: Boolean, default: false },
  watermarkText: { type: String, default: '' },
  canLoadOlder: { type: Boolean, default: false }
})

const emit = defineEmits([
  'load-older',
  'toggle-select',
  'context-menu',
  'narration-menu',
  'open-call-history',
  'delete-offline-card',
  'accept-transfer',
  'reject-transfer',
  'accept-gift',
  'reject-gift',
  'accept-meet',
  'reject-meet',
  'open-transfer-detail'
])

const containerRef = ref(null)
const showScrollToBottom = ref(false)
const LOAD_OLDER_THRESHOLD_PX = 88
const SCROLL_BOTTOM_THRESHOLD_PX = 300
let pendingRestore = null

function isSelected(blockKey) {
  return typeof props.selectedBlockKeys?.has === 'function' && props.selectedBlockKeys.has(blockKey)
}

function forwardContextMenu(...args) {
  emit('context-menu', ...args)
}

function forwardNarrationMenu(...args) {
  emit('narration-menu', ...args)
}

function requestLoadOlder() {
  if (!props.canLoadOlder) return
  const el = containerRef.value
  if (!el || pendingRestore) return

  pendingRestore = {
    blockCount: props.blocks.length,
    scrollHeight: el.scrollHeight,
    scrollTop: el.scrollTop
  }
  emit('load-older')
  nextTick(() => {
    if (!pendingRestore) return
    if (props.blocks.length > pendingRestore.blockCount) return
    pendingRestore = null
  })
}

function handleScroll() {
  const el = containerRef.value
  if (!el) return
  // Load older messages on scroll to top
  if (props.canLoadOlder && el.scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
    requestLoadOlder()
  }
  // Show/hide scroll-to-bottom button
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollToBottom.value = distFromBottom > SCROLL_BOTTOM_THRESHOLD_PX
}

function onScrollToBottomClick() {
  scrollToBottom()
  showScrollToBottom.value = false
}

function scrollToBottom() {
  const el = containerRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight - el.clientHeight
}

watch(() => props.blocks.length, async (nextLength) => {
  if (!pendingRestore) return
  if (nextLength <= pendingRestore.blockCount) return

  const restore = pendingRestore
  pendingRestore = null
  await nextTick()

  const el = containerRef.value
  if (!el) return
  const heightDelta = el.scrollHeight - restore.scrollHeight
  el.scrollTop = restore.scrollTop + Math.max(0, heightDelta)
})

watch(() => props.canLoadOlder, (value) => {
  if (value) return
  pendingRestore = null
})

defineExpose({ containerRef, scrollToBottom })
</script>

<style scoped>
.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
