<template>
  <div
    class="w-[51px] h-[31px] rounded-full relative cursor-pointer transition-colors duration-200 shrink-0"
    :style="{
      backgroundColor: modelValue ? activeColor : 'var(--avatar-bg, #E9E9EB)',
      flex: '0 0 auto'
    }"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <div
      class="w-[27px] h-[27px] bg-white rounded-full shadow absolute top-[2px] left-[2px] transition-transform duration-200"
      :style="{ transform: modelValue ? 'translateX(20px)' : 'translateX(0)' }"
    ></div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  activeColor: {
    type: String,
    default: '#34C759'
  }
})

defineEmits(['update:modelValue'])
</script>
