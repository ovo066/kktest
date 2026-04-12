<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toastVisible"
        class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-xl text-sm z-[9999] pointer-events-none"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useToast } from '../../composables/useToast'

const { toastMessage, toastVisible } = useToast()
</script>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>
