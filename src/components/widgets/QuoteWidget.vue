<template>
  <div class="widget-glass w-full h-full flex flex-col items-center justify-center p-4">
    <div class="text-4xl text-white/60 mb-1">"</div>
    <p
      class="text-center text-white text-sm leading-relaxed drop-shadow-md px-2"
      :class="{ 'italic': config.fontStyle === 'italic' }"
    >
      {{ config.text || '生活不止眼前的苟且，还有诗和远方。' }}
    </p>
    <div
      v-if="config.author"
      class="text-xs text-white/70 mt-2"
    >
      — {{ config.author }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: {
    type: Object,
    default: () => ({ text: '生活不止眼前的苟且，还有诗和远方。', author: '', fontStyle: 'normal' })
  }
})
</script>

<style scoped>
.widget-glass {
  @apply rounded-[20px] bg-white/30 backdrop-blur-md border border-white/40 shadow-lg;
}
</style>
