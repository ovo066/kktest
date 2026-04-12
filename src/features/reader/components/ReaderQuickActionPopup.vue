<template>
  <Teleport to="body">
    <Transition name="qa-popup">
      <div
        v-if="visible"
        class="fixed inset-0 z-[975] flex items-end justify-center pointer-events-none"
      >
        <div
          class="pointer-events-auto w-[92vw] max-w-[400px] mb-[env(safe-area-inset-bottom,12px)] mb-3 rounded-2xl bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-white/30 dark:border-white/8 overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 pt-3 pb-2">
            <div class="flex items-center gap-2">
              <i :class="actionIcon" class="text-[16px]"></i>
              <span class="text-[13px] font-semibold text-[var(--text-primary)]">{{ actionLabel }}</span>
            </div>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-colors"
              @click="$emit('close')"
            >
              <i class="ph ph-x text-[13px] text-[var(--text-secondary)]"></i>
            </button>
          </div>

          <!-- Selected text preview -->
          <div v-if="selectedText" class="px-4 pb-2">
            <div class="text-[11px] text-[var(--text-secondary)] line-clamp-2 italic border-l-2 border-[var(--primary-color)]/30 pl-2">
              {{ selectedText }}
            </div>
          </div>

          <!-- Result -->
          <div class="px-4 pb-3 max-h-[40vh] overflow-y-auto">
            <div class="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
              {{ result }}<span v-if="loading" class="inline-block w-1.5 h-[14px] bg-[var(--primary-color)] rounded-sm animate-pulse ml-0.5 align-middle"></span>
            </div>
            <div v-if="!result && !loading" class="text-[12px] text-[var(--text-secondary)] opacity-60">
              正在准备...
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-2 px-4 pb-3">
            <button
              class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--primary-color)]/10 active:bg-[var(--primary-color)]/20 transition-colors"
              :disabled="!result || loading"
              @click="$emit('save-note')"
            >
              <i class="ph ph-note-pencil text-[14px] text-[var(--primary-color)]"></i>
              <span class="text-[12px] font-medium text-[var(--primary-color)]">保存笔记</span>
            </button>
            <button
              class="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/8 active:bg-black/10 dark:active:bg-white/15 transition-colors"
              @click="handleCopy"
            >
              <i class="ph ph-copy text-[14px] text-[var(--text-secondary)]"></i>
              <span class="text-[12px] text-[var(--text-secondary)]">复制</span>
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
  action: { type: String, default: '' },
  selectedText: { type: String, default: '' },
  result: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

defineEmits(['close', 'save-note'])

const ACTION_META = {
  explain: { label: '解释', icon: 'ph ph-lightbulb text-amber-500' },
  summarize: { label: '总结', icon: 'ph ph-text-align-left text-blue-500' },
  translate: { label: '翻译', icon: 'ph ph-translate text-green-500' }
}

const actionLabel = computed(() => ACTION_META[props.action]?.label || '操作')
const actionIcon = computed(() => ACTION_META[props.action]?.icon || 'ph ph-sparkle text-[var(--text-secondary)]')

function handleCopy() {
  if (props.result) {
    navigator.clipboard.writeText(props.result).catch(() => {})
  }
}
</script>

<style scoped>
.qa-popup-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.qa-popup-leave-active {
  transition: all 0.2s ease;
}
.qa-popup-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.95);
}
.qa-popup-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
