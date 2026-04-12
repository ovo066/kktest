<template>
  <div class="widget-glass w-full h-full flex items-center justify-between p-3 px-4">
    <div class="flex flex-col">
      <span class="text-lg font-medium text-white drop-shadow-md">{{ config.city }}</span>
      <span class="text-xs text-white/80">{{ conditionText }}</span>
    </div>
    <div class="flex items-center gap-1">
      <span class="text-3xl">{{ weatherIcon }}</span>
      <span class="text-2xl font-light text-white drop-shadow-md">
        {{ config.temp }}{{ config.unit === 'celsius' ? '°C' : '°F' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({ city: '北京', temp: '25', condition: 'sunny', unit: 'celsius' })
  }
})

const conditionMap = {
  sunny: { text: '晴', icon: '☀️' },
  cloudy: { text: '多云', icon: '⛅' },
  overcast: { text: '阴', icon: '☁️' },
  rainy: { text: '雨', icon: '🌧️' },
  snowy: { text: '雪', icon: '❄️' },
  windy: { text: '大风', icon: '💨' },
  foggy: { text: '雾', icon: '🌫️' },
  thunderstorm: { text: '雷雨', icon: '⛈️' }
}

const conditionText = computed(() => {
  return conditionMap[props.config.condition]?.text || '晴'
})

const weatherIcon = computed(() => {
  return conditionMap[props.config.condition]?.icon || '☀️'
})
</script>

<style scoped>
.widget-glass {
  @apply rounded-[20px] bg-white/30 backdrop-blur-md border border-white/40 shadow-lg;
}
</style>
