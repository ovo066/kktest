<template>
  <div v-if="visible" class="flex items-center mr-2 self-center shrink-0">
    <div
      class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
      :class="selected ? 'bg-[var(--primary-color)] border-[var(--primary-color)]' : 'border-[var(--border-color)]'"
    >
      <i v-if="selected" class="ph ph-check text-white text-[12px]"></i>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})
</script>
