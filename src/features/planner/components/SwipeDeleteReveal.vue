<template>
  <div
    class="swipe-delete-reveal"
    :style="wrapperStyle"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
    @mousedown="onMouseDown"
    @click.capture="onClickCapture"
  >
    <div class="delete-backdrop" :class="{ visible: swipeX < 0 }">
      <button class="delete-action" type="button" aria-label="删除任务" title="删除任务" @click.stop="handleDelete">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>

    <div
      class="swipe-content"
      :class="{ swiping }"
      :style="{ transform: `translateX(${swipeX}px)` }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  actionWidth: { type: Number, default: 76 },
  radius: { type: Number, default: 16 }
})

const emit = defineEmits(['delete'])

const swipeX = ref(0)
const swiping = ref(false)

const wrapperStyle = computed(() => ({
  '--swipe-action-width': `${props.actionWidth}px`,
  '--swipe-radius': `${props.radius}px`
}))

let startX = 0
let startY = 0
let startOffset = 0
let trackingMouse = false
let suppressClick = false

function onTouchStart(event) {
  const touch = event.touches[0]
  if (!touch) return
  beginGesture(touch.clientX, touch.clientY)
}

function onTouchMove(event) {
  const touch = event.touches[0]
  if (!touch) return
  const handled = updateGesture(touch.clientX, touch.clientY)
  if (handled && event.cancelable) {
    event.preventDefault()
  }
}

function onTouchEnd() {
  finishGesture()
}

function onMouseDown(event) {
  if (event.button !== 0) return
  trackingMouse = true
  beginGesture(event.clientX, event.clientY)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(event) {
  if (!trackingMouse) return
  const handled = updateGesture(event.clientX, event.clientY)
  if (handled) {
    event.preventDefault()
  }
}

function onMouseUp() {
  trackingMouse = false
  cleanupMouseListeners()
  finishGesture()
}

function beginGesture(clientX, clientY) {
  startX = clientX
  startY = clientY
  startOffset = swipeX.value
  swiping.value = false
}

function updateGesture(clientX, clientY) {
  const dx = clientX - startX
  const dy = clientY - startY

  if (!swiping.value && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
    swiping.value = true
  }

  if (!swiping.value) return false

  suppressClick = true
  swipeX.value = clamp(startOffset + dx, -props.actionWidth, 0)
  return true
}

function finishGesture() {
  swipeX.value = swipeX.value < -props.actionWidth / 2 ? -props.actionWidth : 0
  swiping.value = false
}

function handleDelete() {
  swipeX.value = 0
  emit('delete')
}

function onClickCapture(event) {
  if (!suppressClick) return
  event.preventDefault()
  event.stopPropagation()
  suppressClick = false
}

function cleanupMouseListeners() {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

onBeforeUnmount(() => {
  cleanupMouseListeners()
})
</script>

<style scoped>
.swipe-delete-reveal {
  position: relative;
  overflow: hidden;
  border-radius: var(--swipe-radius);
  touch-action: pan-y;
  user-select: none;
}

.delete-backdrop {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--swipe-action-width);
  display: flex;
  align-items: stretch;
  justify-content: center;
  background: rgba(255, 107, 129, 0.92);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.delete-backdrop.visible {
  opacity: 1;
}

.delete-action {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: #fff;
  cursor: pointer;
}

.delete-action .material-symbols-outlined {
  font-size: 22px;
  font-variation-settings: 'FILL' 1, 'wght' 500;
}

.swipe-content {
  position: relative;
  z-index: 1;
  will-change: transform;
}

.swipe-content:not(.swiping) {
  transition: transform 0.2s ease;
}
</style>
