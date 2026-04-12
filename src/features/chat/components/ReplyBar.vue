<template>
  <div v-if="visible" class="px-4 py-2 bg-[var(--card-bg)] border-t border-[var(--border-color)] flex justify-between items-center">
    <div class="flex flex-col border-l-2 border-[var(--primary-color)] pl-2 flex-1 min-w-0">
      <span class="text-[11px] text-[var(--primary-color)] font-semibold">回复消息</span>
      <span class="text-[13px] text-[var(--text-secondary)] truncate">{{ text }}</span>
    </div>
    <button class="text-gray-400 ml-2" @click="$emit('cancel')">
      <i class="ph-fill ph-x-circle text-xl"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  text: { type: String, default: '' }
})

defineEmits(['cancel'])
</script>
