<template>
  <div class="vn-progress-track">
    <div
      class="vn-progress-fill"
      :style="{ width: `${percentage}%` }"
    ></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  variant: { type: String, default: 'default' }
})

const percentage = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})
</script>

<style scoped>
.vn-progress-track {
  width: 100%;
  height: 8px;
  background: #f1f5f9;
  border-radius: 9999px;
  overflow: hidden;
}

.vn-progress-fill {
  height: 100%;
  background: linear-gradient(to right, #818cf8, #6366f1, #4f46e5);
  border-radius: 9999px;
  transition: width 0.5s ease-out;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
  position: relative;
}
</style>
