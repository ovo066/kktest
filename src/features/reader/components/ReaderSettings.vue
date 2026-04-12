<template>
  <Teleport to="body">
    <Transition name="settings-sheet">
      <div v-if="visible" class="fixed inset-x-0 bottom-0 z-[970] px-2 sm:px-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/20" @click="$emit('close')"></div>

        <!-- Panel -->
        <div class="relative w-full max-w-[620px] mx-auto bg-white/90 dark:bg-[#2c2c2e]/92 backdrop-blur-2xl rounded-t-[24px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-white/30 dark:border-white/8 pb-app">
          <!-- Handle -->
          <div class="flex justify-center pt-3 pb-2">
            <div class="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20"></div>
          </div>

          <div class="px-4 sm:px-6 pb-6 space-y-5">
            <!-- Font Size -->
            <div class="flex items-center justify-between gap-3">
              <span class="text-[14px] text-[var(--text-primary)] font-medium shrink-0">字号</span>
              <div class="flex items-center gap-3">
                <button
                  class="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform text-[14px] font-bold text-[var(--text-secondary)]"
                  @click="$emit('update:fontSize', Math.max(12, fontSize - 1))"
                >
                  A<span class="text-[10px]">-</span>
                </button>
                <span class="text-[15px] font-semibold text-[var(--text-primary)] w-8 text-center tabular-nums">{{ fontSize }}</span>
                <button
                  class="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform text-[14px] font-bold text-[var(--text-secondary)]"
                  @click="$emit('update:fontSize', Math.min(28, fontSize + 1))"
                >
                  A<span class="text-[10px]">+</span>
                </button>
              </div>
            </div>

            <!-- Line Height -->
            <div class="flex items-center justify-between gap-3">
              <span class="text-[14px] text-[var(--text-primary)] font-medium shrink-0">行距</span>
              <div class="flex items-center gap-3">
                <button
                  class="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                  @click="$emit('update:lineHeight', Math.max(1.2, +(lineHeight - 0.1).toFixed(1)))"
                >
                  <i class="ph ph-minus text-[14px] text-[var(--text-secondary)]"></i>
                </button>
                <span class="text-[15px] font-semibold text-[var(--text-primary)] w-8 text-center tabular-nums">{{ lineHeight.toFixed(1) }}</span>
                <button
                  class="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                  @click="$emit('update:lineHeight', Math.min(2.5, +(lineHeight + 0.1).toFixed(1)))"
                >
                  <i class="ph ph-plus text-[14px] text-[var(--text-secondary)]"></i>
                </button>
              </div>
            </div>

            <!-- Theme -->
            <div class="flex items-center justify-between gap-3">
              <span class="text-[14px] text-[var(--text-primary)] font-medium shrink-0">阅读方式</span>
              <div class="flex items-center p-1 rounded-full bg-black/5 dark:bg-white/10">
                <button
                  class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                  :class="pageMode === 'scroll' ? 'bg-white dark:bg-[#1f1f21] text-[var(--text-primary)] font-semibold shadow-sm' : 'text-[var(--text-secondary)]'"
                  @click="$emit('update:pageMode', 'scroll')"
                >
                  滚动
                </button>
                <button
                  class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                  :class="pageMode === 'paginate' ? 'bg-white dark:bg-[#1f1f21] text-[var(--text-primary)] font-semibold shadow-sm' : 'text-[var(--text-secondary)]'"
                  @click="$emit('update:pageMode', 'paginate')"
                >
                  翻页
                </button>
              </div>
            </div>

            <!-- Theme -->
            <div class="flex items-center justify-between gap-3">
              <span class="text-[14px] text-[var(--text-primary)] font-medium shrink-0">背景</span>
              <div class="flex items-center gap-2.5 sm:gap-3">
                <button
                  v-for="t in themeOptions"
                  :key="t.value"
                  class="w-9 h-9 rounded-full border-2 transition-all active:scale-90"
                  :class="theme === t.value ? 'border-[var(--primary-color)] scale-110 shadow-md' : 'border-black/10 dark:border-white/10'"
                  :style="{ background: t.color }"
                  @click="$emit('update:theme', t.value)"
                >
                  <i v-if="theme === t.value" class="ph-bold ph-check text-[12px]" :style="{ color: t.checkColor }"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  fontSize: { type: Number, default: 17 },
  lineHeight: { type: Number, default: 1.8 },
  theme: { type: String, default: 'light' },
  pageMode: { type: String, default: 'scroll' }
})

defineEmits(['close', 'update:fontSize', 'update:lineHeight', 'update:theme', 'update:pageMode'])

const themeOptions = [
  { value: 'light', color: '#FAFAF8', checkColor: '#333' },
  { value: 'sepia', color: '#F5E6C8', checkColor: '#5B4636' },
  { value: 'dark', color: '#1c1c1e', checkColor: '#fff' }
]
</script>

<style scoped>
.settings-sheet-enter-active {
  transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.settings-sheet-leave-active {
  transition: all 0.25s ease-in;
}
.settings-sheet-enter-from,
.settings-sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
