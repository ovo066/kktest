<template>
  <div
    v-if="text"
    class="absolute left-3 right-3 flex justify-center pointer-events-none z-30"
    style="bottom: calc(170px + var(--app-pb, 0px))"
  >
    <div class="subtitle-fade-in inline-block max-w-[88%] px-4 py-2.5 rounded-2xl glass-heavy">
      <p class="text-white/90 text-[14px] font-medium leading-relaxed text-center">{{ text }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' }
})
</script>
