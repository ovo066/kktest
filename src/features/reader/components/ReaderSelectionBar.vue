<template>
  <Teleport to="body">
    <Transition name="sel-bar">
      <div
        v-if="visible"
        class="fixed z-[980] pointer-events-none"
        :style="positionStyle"
      >
        <div class="pointer-events-auto w-full rounded-2xl bg-white/92 dark:bg-[#2c2c2e]/92 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-white/40 dark:border-white/10 overflow-hidden">
          <div v-if="selectedText" class="px-3 py-2 text-[11px] sm:text-[12px] text-[var(--text-primary)]/85 bg-black/[0.03] dark:bg-white/[0.04]">
            <span class="line-clamp-2">{{ selectedText }}</span>
          </div>
          <!-- Quick AI actions row -->
          <div class="flex items-center gap-0 border-b border-black/5 dark:border-white/5">
            <button
              class="flex-1 flex items-center justify-center gap-1 px-2 py-2 active:bg-black/5 dark:active:bg-white/10 transition-colors"
              @click="$emit('quick-action', 'explain')"
            >
              <i class="ph ph-lightbulb text-[14px] text-amber-500"></i>
              <span class="text-[11px] sm:text-[12px] text-[var(--text-primary)]">解释</span>
            </button>
            <div class="w-px h-4 bg-black/8 dark:bg-white/8"></div>
            <button
              class="flex-1 flex items-center justify-center gap-1 px-2 py-2 active:bg-black/5 dark:active:bg-white/10 transition-colors"
              @click="$emit('quick-action', 'summarize')"
            >
              <i class="ph ph-text-align-left text-[14px] text-blue-500"></i>
              <span class="text-[11px] sm:text-[12px] text-[var(--text-primary)]">总结</span>
            </button>
            <div class="w-px h-4 bg-black/8 dark:bg-white/8"></div>
            <button
              class="flex-1 flex items-center justify-center gap-1 px-2 py-2 active:bg-black/5 dark:active:bg-white/10 transition-colors"
              @click="$emit('quick-action', 'translate')"
            >
              <i class="ph ph-translate text-[14px] text-green-500"></i>
              <span class="text-[11px] sm:text-[12px] text-[var(--text-primary)]">翻译</span>
            </button>
          </div>
          <!-- Copy / Chat row -->
          <div class="flex items-center gap-0">
            <button
              class="flex-1 flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 active:bg-black/5 dark:active:bg-white/10 transition-colors"
              @click="$emit('copy')"
            >
              <i class="ph ph-copy text-[16px] text-[var(--text-secondary)]"></i>
              <span class="text-[12px] sm:text-[13px] font-medium text-[var(--text-primary)]">复制</span>
            </button>
            <div class="w-px h-5 bg-black/10 dark:bg-white/10"></div>
            <button
              class="flex-[1.15] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 active:bg-[var(--primary-color)]/10 transition-colors"
              @click="$emit('chat')"
            >
              <i class="ph-fill ph-chat-circle-dots text-[16px] text-[var(--primary-color)]"></i>
              <span class="text-[12px] sm:text-[13px] font-semibold text-[var(--primary-color)]">和TA聊聊</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  rect: { type: Object, default: null },
  containerRect: { type: Object, default: null },
  selectedText: { type: String, default: '' }
})

defineEmits(['copy', 'chat', 'close', 'quick-action'])

const positionStyle = computed(() => {
  if (!props.rect) return { display: 'none' }
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 390
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 844
  const edgeGap = 10
  const barWidth = Math.min(260, Math.max(172, viewportWidth - edgeGap * 2))
  const centerX = props.rect.left + (props.rect.width / 2)
  const left = Math.max(edgeGap, Math.min(centerX - (barWidth / 2), viewportWidth - barWidth - edgeGap))

  // Prefer below selection to avoid overlapping with native selection bar.
  const selectionBottom = props.rect.top + props.rect.height
  const barHeight = props.selectedText ? 124 : 88
  let top = selectionBottom + 12
  if (top + barHeight > viewportHeight - 8) {
    top = Math.max(8, props.rect.top - barHeight - 12)
  }

  return {
    top: Math.max(8, top) + 'px',
    left: left + 'px',
    width: barWidth + 'px'
  }
})
</script>

<style scoped>
.sel-bar-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.sel-bar-leave-active {
  transition: all 0.15s ease;
}
.sel-bar-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(8px);
}
.sel-bar-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
