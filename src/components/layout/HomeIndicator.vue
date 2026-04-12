<template>
  <div
    v-if="variant !== 'hidden'"
    class="home-indicator"
    :class="{ 'home-indicator-subtle': variant === 'subtle' }"
    :style="{ bottom: indicatorBottom }"
    @click="$emit('click')"
  ></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'ios'
  }
})

defineEmits(['click'])

const indicatorBottom = computed(() => {
  if (props.variant === 'subtle') {
    return 'max(2px, calc(4px + var(--app-safe-bottom) * 0.25))'
  }
  return 'calc(8px + var(--app-safe-bottom))'
})
</script>

<style scoped>
.home-indicator {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 130px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  z-index: 50;
  cursor: pointer;
  transition: all 0.25s ease;
}
.dark .home-indicator {
  background: rgba(255, 255, 255, 0.75);
}

.home-indicator-subtle {
  width: 86px;
  height: 3px;
  opacity: 0.45;
  background: rgba(255, 255, 255, 0.7);
}
.dark .home-indicator-subtle {
  background: rgba(255, 255, 255, 0.6);
}
</style>
