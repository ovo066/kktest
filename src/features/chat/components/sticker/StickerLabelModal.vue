<template>
  <div v-if="visible" class="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
    <div class="bg-[var(--card-bg)] rounded-2xl w-full max-w-xs overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] text-center">
        <span class="font-semibold text-[17px] text-[var(--text-primary)]">添加贴纸</span>
      </div>
      <div class="p-4 flex flex-col items-center gap-3">
        <img :src="imageUrl" class="w-20 h-20 object-contain rounded-lg bg-gray-100 dark:bg-gray-800">
        <input
          :value="modelValue"
          type="text"
          placeholder="输入标签"
          class="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-[15px] outline-none bg-transparent text-[var(--text-primary)] text-center"
          @input="$emit('update:modelValue', $event.target.value)"
        >
      </div>
      <div class="flex border-t border-[var(--border-color)]">
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] border-r border-[var(--border-color)]" @click="$emit('cancel')">取消</button>
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] font-semibold" @click="$emit('confirm')">添加</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  modelValue: { type: String, default: '' }
})

defineEmits(['update:modelValue', 'cancel', 'confirm'])
</script>
