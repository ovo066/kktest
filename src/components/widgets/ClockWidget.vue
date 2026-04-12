<template>
  <div class="widget-glass w-full h-full flex flex-col items-center justify-center p-3">
    <div v-if="config.style === 'digital'" class="text-center">
      <div class="text-2xl font-light text-white drop-shadow-md" style="font-feature-settings: 'tnum';">
        {{ time }}
      </div>
      <div v-if="config.showDate" class="text-xs text-white/80 mt-1">
        {{ date }}
      </div>
    </div>
    <div v-else class="relative w-16 h-16">
      <!-- Analog clock face -->
      <div class="absolute inset-0 rounded-full border-2 border-white/60 bg-white/20"></div>
      <!-- Hour hand -->
      <div
        class="absolute left-1/2 bottom-1/2 w-1 bg-white rounded-full origin-bottom"
        :style="{ height: '20px', transform: `translateX(-50%) rotate(${hourRotation}deg)` }"
      ></div>
      <!-- Minute hand -->
      <div
        class="absolute left-1/2 bottom-1/2 w-0.5 bg-white rounded-full origin-bottom"
        :style="{ height: '26px', transform: `translateX(-50%) rotate(${minuteRotation}deg)` }"
      ></div>
      <!-- Second hand -->
      <div
        v-if="config.showSeconds"
        class="absolute left-1/2 bottom-1/2 w-px bg-red-400 rounded-full origin-bottom"
        :style="{ height: '28px', transform: `translateX(-50%) rotate(${secondRotation}deg)` }"
      ></div>
      <!-- Center dot -->
      <div class="absolute left-1/2 top-1/2 w-2 h-2 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({ style: 'digital', showSeconds: false, showDate: true })
  }
})

const now = ref(new Date())
let timer = null

const time = computed(() => {
  const h = now.value.getHours().toString().padStart(2, '0')
  const m = now.value.getMinutes().toString().padStart(2, '0')
  const s = now.value.getSeconds().toString().padStart(2, '0')
  return props.config.showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`
})

const date = computed(() => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${now.value.getMonth() + 1}月${now.value.getDate()}日 ${weekdays[now.value.getDay()]}`
})

const hourRotation = computed(() => {
  const h = now.value.getHours() % 12
  const m = now.value.getMinutes()
  return (h + m / 60) * 30
})

const minuteRotation = computed(() => {
  return now.value.getMinutes() * 6
})

const secondRotation = computed(() => {
  return now.value.getSeconds() * 6
})

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.widget-glass {
  @apply rounded-[20px] bg-white/30 backdrop-blur-md border border-white/40 shadow-lg;
}
</style>
