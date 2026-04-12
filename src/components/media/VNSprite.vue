<template>
  <div
    class="absolute bottom-[18vh] h-[72vh] w-[70vw] max-w-[420px] select-none transition-all duration-700 ease-out"
    :style="positionStyle"
  >
    <div
      class="absolute inset-0 flex items-end justify-center"
      :class="[idleClass, animClass]"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        class="h-full w-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
        :alt="vnName || characterId"
        draggable="false"
      >
      <div
        v-else
        class="w-full h-full rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 text-sm px-4 text-center"
      >
        {{ vnName || characterId }}
        <span v-if="expression" class="opacity-50 ml-1"> · {{ expression }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  characterId: { type: String, default: '' },
  vnName: { type: String, default: '' },
  expression: { type: String, default: '' },
  position: { type: String, default: 'center' },
  animation: { type: String, default: null },
  imageUrl: { type: String, default: '' },
  isExiting: { type: Boolean, default: false }
})

const positionStyle = computed(() => {
  const map = {
    left: { left: '4%', transform: 'translateX(0)' },
    center: { left: '50%', transform: 'translateX(-50%)' },
    right: { right: '4%', transform: 'translateX(0)' }
  }
  return map[props.position] || map.center
})

const idleClass = computed(() => {
  return props.isExiting ? '' : 'vn-sprite-idle'
})

const animClass = computed(() => {
  const a = (props.animation || '').trim()
  if (!a) return ''

  if (props.isExiting) return `vn-sprite-exit-${a}`

  const enterSet = new Set(['fadeIn', 'slideLeft', 'slideRight', 'slideUp', 'bounce'])
  const emotionSet = new Set(['shake', 'jump', 'nod'])

  if (enterSet.has(a)) return `vn-sprite-enter-${a}`
  if (emotionSet.has(a)) return `vn-sprite-emotion-${a}`

  return ''
})
</script>
