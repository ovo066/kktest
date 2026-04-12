<template>
  <div class="reader-toolbar shrink-0 bg-white/80 dark:bg-[#1c1c1e]/85 backdrop-blur-2xl border-t border-black/5 dark:border-white/5 pb-app">
    <!-- Progress Bar -->
    <div class="px-3 sm:px-4 pt-3 pb-1">
      <div class="flex items-center gap-2">
        <button
          class="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          :class="hasPrevChapter ? 'text-[var(--text-secondary)] active:bg-black/5 dark:active:bg-white/10' : 'text-[var(--text-secondary)]/35 cursor-not-allowed'"
          :disabled="!hasPrevChapter"
          title="上一章"
          @click="$emit('prev-chapter')"
        >
          <i class="ph ph-caret-left text-[16px]"></i>
        </button>

        <div class="relative flex-1 min-w-0">
          <input
            type="range"
            min="0"
            max="100"
            :value="progress"
            class="reader-slider w-full h-1 appearance-none rounded-full bg-black/8 dark:bg-white/10 outline-none cursor-pointer"
            @input="$emit('seek', Number($event.target.value))"
          >
          <div class="flex items-center justify-between mt-1.5">
            <span class="text-[11px] text-[var(--text-secondary)] truncate max-w-[66vw] sm:max-w-[440px]">{{ chapterTitle }}</span>
            <span class="text-[11px] text-[var(--text-secondary)] font-medium tabular-nums">{{ progress }}%</span>
          </div>
        </div>

        <button
          class="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          :class="hasNextChapter ? 'text-[var(--text-secondary)] active:bg-black/5 dark:active:bg-white/10' : 'text-[var(--text-secondary)]/35 cursor-not-allowed'"
          :disabled="!hasNextChapter"
          title="下一章"
          @click="$emit('next-chapter')"
        >
          <i class="ph ph-caret-right text-[16px]"></i>
        </button>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-around px-4 sm:px-8 py-2">
      <button
        class="flex flex-col items-center gap-1 active:scale-90 transition-transform min-w-[64px]"
        @click="$emit('open-toc')"
      >
        <i class="ph ph-list-bullets text-[20px] sm:text-[22px] text-[var(--text-secondary)]"></i>
        <span class="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">目录</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 active:scale-90 transition-transform min-w-[64px]"
        @click="$emit('open-notes')"
      >
        <i class="ph ph-note-pencil text-[20px] sm:text-[22px] text-[var(--text-secondary)]"></i>
        <span class="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">笔记</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 active:scale-90 transition-transform min-w-[64px]"
        @click="$emit('open-ai-settings')"
      >
        <i class="ph ph-brain text-[20px] sm:text-[22px] text-[var(--text-secondary)]"></i>
        <span class="text-[10px] sm:text-[11px] text-[var(--text-secondary)] max-w-[68px] truncate">{{ aiName || '伴读' }}</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 active:scale-90 transition-transform min-w-[64px]"
        @click="$emit('open-settings')"
      >
        <i class="ph ph-gear-six text-[20px] sm:text-[22px] text-[var(--text-secondary)]"></i>
        <span class="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">设置</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 active:scale-90 transition-transform min-w-[64px]"
        @click="$emit('open-chat')"
      >
        <div class="relative">
          <i class="ph ph-chat-circle-dots text-[20px] sm:text-[22px] text-[var(--primary-color)]"></i>
          <div class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--primary-color)] animate-pulse"></div>
        </div>
        <span class="text-[10px] sm:text-[11px] text-[var(--primary-color)] font-medium">对话</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: { type: Number, default: 0 },
  chapterTitle: { type: String, default: '' },
  chapterIndex: { type: Number, default: 0 },
  totalChapters: { type: Number, default: 0 },
  aiName: { type: String, default: '' }
})

const hasPrevChapter = computed(() => props.chapterIndex > 0)
const hasNextChapter = computed(() => props.chapterIndex < Math.max(props.totalChapters - 1, 0))

defineEmits([
  'open-toc',
  'open-notes',
  'open-ai-settings',
  'open-settings',
  'open-chat',
  'seek',
  'prev-chapter',
  'next-chapter'
])
</script>

<style scoped>
/* Custom range slider */
.reader-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-color, #007AFF);
  border: 3px solid white;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.reader-slider::-webkit-slider-thumb:active {
  transform: scale(1.3);
}
.reader-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-color, #007AFF);
  border: 3px solid white;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  cursor: pointer;
}
</style>
