<template>
  <Teleport to="body">
    <Transition name="focus-overlay">
      <div
        v-if="visible"
        class="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-[2px]"
        @click="$emit('hide')"
      ></div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="visible"
        class="fixed bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(30,30,30,0.85)] backdrop-blur-xl rounded-xl shadow-2xl w-48 z-[1002] overflow-hidden border border-white/20 dark:border-white/10 origin-top-left ring-1 ring-black/5"
        :style="{ left: x + 'px', top: y + 'px' }"
      >
        <div class="flex flex-col divide-y divide-[var(--border-color)] text-[var(--text-primary)]">
          <button
            class="px-4 py-3 text-[15px] font-medium flex justify-between items-center active:bg-black/5 dark:active:bg-white/10 transition-colors"
            @click="$emit('toggle-narrations')"
          >
            {{ showNarrations ? '隐藏旁白' : '显示旁白' }}
            <i class="ph-bold" :class="showNarrations ? 'ph-eye-slash' : 'ph-eye'"></i>
          </button>
          <button
            class="px-4 py-3 text-[15px] font-medium flex justify-between items-center active:bg-black/5 dark:active:bg-white/10 transition-colors"
            @click="$emit('copy')"
          >
            复制 <i class="ph-bold ph-copy"></i>
          </button>
          <button
            class="px-4 py-3 text-[15px] font-medium flex justify-between items-center active:bg-black/5 dark:active:bg-white/10 transition-colors"
            @click="$emit('multi-select')"
          >
            多选 <i class="ph-bold ph-check-square-offset"></i>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  showNarrations: { type: Boolean, default: true }
})

defineEmits(['hide', 'toggle-narrations', 'copy', 'multi-select'])
</script>

<style scoped>
.focus-overlay-enter-active,
.focus-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.focus-overlay-enter-from,
.focus-overlay-leave-to {
  opacity: 0;
}

/* 旁白菜单动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}
</style>

