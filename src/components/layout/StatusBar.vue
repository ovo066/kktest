<template>
  <div
    class="h-[47px] w-full flex justify-between items-end px-6 pb-2 z-50 bg-transparent absolute top-0 font-medium transition-colors duration-300 select-none pointer-events-none"
    :class="textColorClass"
  >
    <div class="text-[16px] font-semibold w-20 pl-2 leading-none">{{ time }}</div>
    <div class="w-[112px] h-[32px] bg-black rounded-[20px] absolute left-1/2 transform -translate-x-1/2 top-[11px] z-50"></div>
    <div class="flex items-center gap-[6px] w-20 justify-end pr-2">
      <!-- Signal -->
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
        <path d="M1 10C1 9.45 1.45 9 2 9s1 .45 1 1v1c0 .55-.45 1-1 1s-1-.45-1-1v-1zM6 7c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1s-1-.45-1-1V7zm5-3c0-.55.45-1 1-1s1 .45 1 1v7c0 .55-.45 1-1 1s-1-.45-1-1V4zm5-3c0-.55.45-1 1-1s1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V1z"/>
      </svg>
      <!-- WiFi -->
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
        <path d="M8 8.4c-1 0-1.9.5-2.5 1l2 2.4c.3.3.7.3 1 0l2-2.4c-.6-.5-1.5-1-2.5-1zm5-2c-1.4-1.5-3.1-2.3-5-2.3s-3.6.8-5 2.3l1.6 1.9c.9-.6 2.1-1 3.4-1s2.5.4 3.4 1L13 6.4zm2.6-3C13.6 1.3 11 0 8 0S2.4 1.3.4 3.5L2 5.4c1.6-1.6 3.7-2.6 6-2.6s4.4 1 6 2.6l1.6-1.9z"/>
      </svg>
      <!-- Battery -->
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="currentColor" stroke-opacity="0.4"/>
        <rect x="2" y="2" :width="batteryFillWidth" height="8" rx="1.5" fill="currentColor"/>
        <path d="M23 4c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1V4z" fill="currentColor" fill-opacity="0.4"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBattery } from '../../composables/useBattery'

const props = defineProps({
  textColor: {
    type: String,
    default: 'white'
  }
})

const time = ref('9:41')
const { batteryPct } = useBattery()

const batteryFillWidth = computed(() => {
  const pct = typeof batteryPct.value === 'number' ? Math.max(0, Math.min(100, batteryPct.value)) : null
  if (pct == null) return 18
  // SVG viewBox inner width is 18 units (x=2..20). Keep a minimum sliver visible.
  return Math.max(2, Math.round(18 * pct / 100))
})

const textColorClass = computed(() => {
  if (props.textColor === 'white') {
    return 'text-white'
  }
  return 'text-black dark:text-white'
})

function updateClock() {
  const now = new Date()
  time.value = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0')
}

let clockInterval = null

onMounted(() => {
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (clockInterval) {
    clearInterval(clockInterval)
  }
})
</script>
