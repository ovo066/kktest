<template>
  <CallOverlay ref="overlayRef" :contact="contact" />
</template>

<script setup>
import { ref } from 'vue'
import { CallOverlay } from '../../../features/call/ui'

defineProps({
  contact: { type: Object, default: null }
})

const overlayRef = ref(null)

function startCall(contactId, mode) {
  overlayRef.value?.startCall(contactId, mode)
}

function receiveCall(contactId, mode, text) {
  overlayRef.value?.receiveCall(contactId, mode, text)
}

defineExpose({
  startCall,
  receiveCall
})
</script>
