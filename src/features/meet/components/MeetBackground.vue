<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  bg: { type: Object, default: () => ({ name: '', url: '' }) }
})

// Dual-layer crossfade: new bg fades in on top of old bg
const layer1 = ref({ url: '', active: true })
const layer2 = ref({ url: '', active: false })
let currentLayer = 1
let initialized = false

watch(() => props.bg?.url, (newUrl) => {
  // First time: just set layer 1 directly (no crossfade)
  if (!initialized) {
    if (newUrl) {
      layer1.value = { url: newUrl, active: true }
    }
    initialized = true
    return
  }

  // Subsequent: crossfade between layers
  if (currentLayer === 1) {
    layer2.value = { url: newUrl || '', active: true }
    setTimeout(() => {
      layer1.value = { url: newUrl || '', active: true }
      layer2.value = { url: '', active: false }
    }, 1200)
    currentLayer = 2
  } else {
    layer1.value = { url: newUrl || '', active: true }
    setTimeout(() => {
      layer2.value = { url: newUrl || '', active: true }
      layer1.value = { url: '', active: false }
    }, 1200)
    currentLayer = 1
  }
}, { immediate: true })

const bgStyle1 = computed(() => ({
  backgroundImage: layer1.value.url ? `url('${layer1.value.url}')` : 'none',
  opacity: layer1.value.active && layer1.value.url ? 1 : 0
}))

const bgStyle2 = computed(() => ({
  backgroundImage: layer2.value.url ? `url('${layer2.value.url}')` : 'none',
  opacity: layer2.value.active && layer2.value.url ? 1 : 0
}))

const hasBg = computed(() => !!props.bg?.url)
</script>

<template>
  <div class="meet-background-container">
    <!-- Layer 1 -->
    <div
      class="meet-bg-layer"
      :class="{ 'has-image': bgStyle1.backgroundImage !== 'none' }"
      :style="bgStyle1"
    ></div>
    <!-- Layer 2 (overlaps layer 1) -->
    <div
      class="meet-bg-layer"
      :class="{ 'has-image': bgStyle2.backgroundImage !== 'none' }"
      :style="bgStyle2"
    ></div>
    <!-- Gradient overlay -->
    <div class="meet-overlay"></div>
    <!-- Noise/grain texture -->
    <div class="meet-noise"></div>
    <!-- Fallback gradient when no bg image -->
    <div v-if="!hasBg" class="meet-bg-fallback"></div>
  </div>
</template>

<style scoped>
.meet-background-container {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #0c0c0c;
  overflow: hidden;
}

.meet-bg-layer {
  position: absolute;
  inset: -5%;
  background-size: cover;
  background-position: center;
  width: 110%;
  height: 110%;
  transition: opacity 1.2s ease-in-out;
  opacity: 0;
}

.meet-bg-layer.has-image {
  animation: kenBurns 40s ease-in-out infinite alternate;
}

.meet-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(12, 12, 12, 0.15) 0%,
    transparent 35%,
    transparent 65%,
    rgba(12, 12, 12, 0.4) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.meet-bg-fallback {
  position: absolute;
  inset: 0;
  background: #1a1a1a;
  z-index: 0;
}

.meet-noise {
  position: absolute;
  inset: 0;
  z-index: 2;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E");
  pointer-events: none;
}

@keyframes kenBurns {
  0% { transform: scale(1) translate(0, 0); }
  50% { transform: scale(1.08) translate(-1%, -1%); }
  100% { transform: scale(1) translate(0, 0); }
}
</style>
