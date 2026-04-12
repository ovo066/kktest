<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div
      :key="bgKey"
      class="absolute inset-0 bg-cover bg-center bg-no-repeat vn-bg-anim"
      :class="transitionClass"
      :style="bgStyle"
    ></div>
    <!-- Vignette overlay -->
    <div class="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/40 pointer-events-none"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  bg: { type: Object, default: null },
  transition: { type: String, default: 'fade' }
})

const bgKey = computed(() => props.bg?.url || props.bg?.name || 'vn_bg_none')

const bgStyle = computed(() => {
  const url = props.bg?.url
  if (!url) {
    return { backgroundImage: 'linear-gradient(135deg, #0f0c29, #302b63 50%, #24243e)' }
  }
  return { backgroundImage: `url('${url}')` }
})

const transitionClass = computed(() => {
  const t = props.transition || 'fade'
  return t ? `vn-bg-transition-${t}` : ''
})
</script>

<style scoped>
.vn-bg-anim {
  animation: subtleZoom 60s infinite alternate linear;
}

@keyframes subtleZoom {
  from { transform: scale(1.0); }
  to { transform: scale(1.06); }
}
</style>
