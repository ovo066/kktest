<template>
  <div
    v-if="visible"
    class="absolute left-1/2 -translate-x-1/2 bottom-20 z-10 pointer-events-none"
  >
    <div
      class="inline-flex items-center gap-1.5 py-2 px-4 rounded-full bg-black/40 text-white text-[12px] font-medium backdrop-blur-md cursor-pointer pointer-events-auto active:bg-black/60 transition-all hover:scale-105 shadow-lg border border-white/10"
      @click="$emit('toggle')"
    >
      <i class="ph-bold ph-eye-slash text-[14px]"></i>
      <span>旁白已隐藏</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['toggle'])
</script>

