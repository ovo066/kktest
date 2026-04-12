<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="visible" class="fixed inset-0 z-[1000] flex flex-col justify-end px-2 sm:px-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" @click="$emit('close')"></div>

        <!-- Content Area -->
        <div class="relative w-full max-w-[720px] mx-auto max-h-[min(78vh,700px)] bg-white/85 dark:bg-[#1c1c1e]/88 backdrop-blur-2xl rounded-t-[24px] border-t border-white/30 dark:border-white/8 flex flex-col shadow-2xl overflow-hidden">
          <!-- Handle Bar -->
          <div class="flex justify-center p-3" @click="$emit('close')">
            <div class="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20"></div>
          </div>

          <!-- Header -->
          <div class="px-4 sm:px-6 py-2 flex items-center justify-between">
            <h2 class="text-[17px] sm:text-lg font-semibold text-[var(--text-primary)]">目录</h2>
            <span class="text-xs text-[var(--text-secondary)]">{{ chapters.length }} 章节</span>
          </div>

          <!-- Chapters List -->
          <div class="flex-1 overflow-y-auto px-3 sm:px-4 py-2 no-scrollbar">
            <div
              v-for="(chapter, index) in chapters"
              :key="index"
              class="flex items-center py-3 px-3.5 sm:px-4 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
              :ref="el => setChapterItemRef(el, index)"
              :class="currentIndex === index ? 'bg-[var(--primary-color)]/10' : 'active:bg-black/5 dark:active:bg-white/5'"
              @click="handleSelect(index)"
            >
              <div class="shrink-0 w-8 text-[12px] font-mono tabular-nums" :class="currentIndex === index ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)]'">
                {{ String(index + 1).padStart(2, '0') }}
              </div>
              <div class="flex-1 text-[14px] sm:text-[15px] truncate" :class="currentIndex === index ? 'text-[var(--primary-color)] font-medium' : 'text-[var(--text-primary)]'">
                {{ chapter.title }}
              </div>
              <div v-if="currentIndex === index" class="shrink-0 ml-2">
                <i class="ph-fill ph-check-circle text-[var(--primary-color)] text-lg"></i>
              </div>
            </div>
          </div>

          <!-- Bottom Safe Area -->
          <div class="h-[max(12px,env(safe-area-inset-bottom,0px))] shrink-0"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  chapters: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['close', 'select'])
const chapterItemRefs = ref([])

function setChapterItemRef(el, index) {
  if (el) {
    chapterItemRefs.value[index] = el
  } else {
    delete chapterItemRefs.value[index]
  }
}

function handleSelect(index) {
  emit('select', index)
  emit('close')
}

function scrollToCurrentChapter() {
  const target = chapterItemRefs.value[props.currentIndex]
  if (!target?.scrollIntoView) return
  target.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: 'smooth'
  })
}

watch(
  () => [props.visible, props.currentIndex, props.chapters.length],
  ([visible]) => {
    if (!visible) return
    nextTick(scrollToCurrentChapter)
  }
)
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
