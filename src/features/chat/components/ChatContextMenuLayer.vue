<template>
  <Teleport to="body">
    <Transition name="focus-overlay">
      <div
        v-if="visible"
        class="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-[2px] transition-all duration-200"
        @click="$emit('hide')"
      ></div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="visible && focusedBubble"
      class="fixed z-[1001] pointer-events-none focused-bubble-wrapper"
      :style="{
        top: focusedBubble.top + 'px',
        left: focusedBubble.left + 'px'
      }"
    >
      <div :class="focusedBubble.className" v-html="focusedBubble.innerHTML"></div>
    </div>
  </Teleport>

  <ContextMenu
    :visible="visible"
    :x="x"
    :y="y"
    :max-height="maxHeight"
    :anchor="anchor"
    :is-user="isUser"
    :favorited="favorited"
    @reply="$emit('reply')"
    @copy="$emit('copy')"
    @edit="$emit('edit')"
    @regen="$emit('regen')"
    @delete="$emit('delete')"
    @multi-select="$emit('multi-select')"
    @favorite="$emit('favorite')"
  />
</template>

<script setup>
import ContextMenu from './ContextMenu.vue'

defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  maxHeight: { type: Number, default: 0 },
  anchor: { type: String, default: 'top' },
  isUser: { type: Boolean, default: false },
  favorited: { type: Boolean, default: false },
  focusedBubble: { type: Object, default: null }
})

defineEmits(['hide', 'reply', 'copy', 'edit', 'regen', 'delete', 'multi-select', 'favorite'])
</script>

<style>
/* 聚焦气泡克隆 - 隐藏小尾巴的伪元素 */
.focused-bubble-wrapper .bubble::before,
.focused-bubble-wrapper .bubble::after {
  display: none !important;
}
.focused-bubble-wrapper .bubble {
  border-radius: var(--bubble-radius, 18px) !important;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.4));
  transform: scale(1.02);
}
</style>

<style scoped>
.focus-overlay-enter-active,
.focus-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.focus-overlay-enter-from,
.focus-overlay-leave-to {
  opacity: 0;
}
</style>

