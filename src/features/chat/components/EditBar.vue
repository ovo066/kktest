<template>
  <div v-if="visible" class="px-4 py-2 bg-[#FFF9E6] dark:bg-[#3d3a2e] border-t flex justify-between items-center">
    <div class="flex flex-col border-l-2 border-[#FF9500] pl-2 flex-1 min-w-0">
      <span class="text-[11px] text-[#FF9500] font-semibold">编辑消息</span>
      <span class="text-[13px] text-gray-500 truncate">{{ text }}</span>
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
