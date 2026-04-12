<template>
  <div class="widget-glass w-full h-full flex flex-col p-3">
    <!-- Header -->
    <div class="text-center mb-2">
      <div class="text-xs text-white/80">{{ monthYear }}</div>
    </div>

    <!-- Mini calendar or single day -->
    <div v-if="!config.showFullMonth" class="flex-1 flex flex-col items-center justify-center">
      <div class="text-4xl font-bold text-white drop-shadow-md">{{ day }}</div>
      <div class="text-sm text-white/90">{{ weekday }}</div>
    </div>

    <!-- Full month view -->
    <div v-else class="flex-1 overflow-hidden">
      <!-- Weekday headers -->
      <div class="grid grid-cols-7 gap-0.5 text-center mb-1">
        <div v-for="d in weekdayHeaders" :key="d" class="text-[8px] text-white/60">
          {{ d }}
        </div>
      </div>
      <!-- Days -->
      <div class="grid grid-cols-7 gap-0.5 text-center">
        <div
          v-for="(day, i) in calendarDays"
          :key="i"
          class="text-[9px] w-full aspect-square flex items-center justify-center rounded-full"
          :class="{
            'text-white/30': !day.current,
            'text-white': day.current,
            'bg-white/40': day.isToday && config.highlightToday
          }"
        >
          {{ day.num }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineProps({
  config: {
    type: Object,
    default: () => ({ showFullMonth: false, highlightToday: true })
  }
})

const now = new Date()
const day = computed(() => now.getDate())
const weekday = computed(() => {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[now.getDay()]
})
const monthYear = computed(() => `${now.getFullYear()}年${now.getMonth() + 1}月`)

const weekdayHeaders = ['日', '一', '二', '三', '四', '五', '六']

const calendarDays = computed(() => {
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days = []

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ num: daysInPrevMonth - i, current: false, isToday: false })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      num: i,
      current: true,
      isToday: i === now.getDate()
    })
  }

  // Next month days to fill 6 rows
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ num: i, current: false, isToday: false })
  }

  return days
})
</script>

<style scoped>
.widget-glass {
  @apply rounded-[20px] bg-white/30 backdrop-blur-md border border-white/40 shadow-lg;
}
</style>
