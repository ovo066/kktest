<template>
  <div
    v-if="visible"
    class="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] bg-[var(--card-bg)] shadow-up z-40"
  >
    <button
      class="text-[16px] font-medium text-[var(--primary-color)] active:opacity-60 transition-opacity"
      @click="$emit('cancel')"
    >
      取消
    </button>
    <span class="text-[15px] font-semibold text-[var(--text-primary)]">
      已选择 {{ selectedCount }} 条
    </span>
    <div class="flex items-center gap-4">
      <button
        class="text-[16px] font-medium text-amber-500 active:opacity-60 transition-opacity"
        :class="{ 'opacity-40': favoriteDisabled }"
        :disabled="favoriteDisabled"
        @click="$emit('favorite')"
      >
        收藏
      </button>
      <button
        class="text-[16px] font-medium text-red-500 active:opacity-60 transition-opacity"
        :class="{ 'opacity-40': deleteDisabled }"
        :disabled="deleteDisabled"
        @click="$emit('delete')"
      >
        删除
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  selectedCount: { type: Number, default: 0 },
  favoriteDisabled: { type: Boolean, default: false },
  deleteDisabled: { type: Boolean, default: false }
})

defineEmits(['cancel', 'favorite', 'delete'])
</script>

<style scoped>
.shadow-up {
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
}
</style>
