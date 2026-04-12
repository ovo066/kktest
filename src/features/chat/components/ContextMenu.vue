<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="visible"
        class="context-menu-panel fixed bg-[var(--card-bg)] backdrop-blur-xl rounded-xl shadow-2xl w-48 z-[1002] overflow-y-auto border border-[var(--border-color)]"
        :style="{
          left: x + 'px',
          top: anchor === 'top' ? y + 'px' : 'auto',
          bottom: anchor === 'bottom' ? y + 'px' : 'auto',
          maxHeight: (maxHeight || 0) > 0 ? maxHeight + 'px' : 'calc(100dvh - 20px)'
        }"
      >
        <div class="flex flex-col divide-y divide-[var(--border-color)] text-[var(--text-primary)]">
          <button class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700" @click="$emit('reply')">
            回复 <i class="ph ph-arrow-u-up-left"></i>
          </button>
          <button class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700" @click="$emit('copy')">
            复制 <i class="ph ph-copy"></i>
          </button>
          <button class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700" @click="$emit('favorite')">
            {{ favorited ? '取消收藏' : '收藏' }} <i :class="favorited ? 'ph-fill ph-star text-amber-400' : 'ph ph-star'"></i>
          </button>
          <button class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700" @click="$emit('edit')">
            编辑 <i class="ph ph-pencil-simple"></i>
          </button>
          <button v-if="!isUser" class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700 text-[var(--primary-color)]" @click="$emit('regen')">
            重新生成 <i class="ph ph-arrows-clockwise"></i>
          </button>
          <button class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700" @click="$emit('multiSelect')">
            多选 <i class="ph ph-check-square"></i>
          </button>
          <button class="px-4 py-3 text-[15px] flex justify-between items-center active:bg-gray-200 dark:active:bg-gray-700 text-red-500" @click="$emit('delete')">
            删除 <i class="ph ph-trash"></i>
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
  maxHeight: { type: Number, default: 0 },
  anchor: { type: String, default: 'top' },
  isUser: { type: Boolean, default: false },
  favorited: { type: Boolean, default: false }
})

defineEmits(['reply', 'copy', 'edit', 'regen', 'delete', 'multiSelect', 'favorite'])
</script>

<style scoped>
.context-menu-panel {
  max-height: calc(100dvh - 20px);
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.2s ease;
}
.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
