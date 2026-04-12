<template>
  <ChatCallSheets
    :call-mode-visible="callModeVisible"
    :incoming-visible="incomingVisible"
    :incoming-info="incomingInfo"
    @close-call-mode-sheet="$emit('close-call-mode-sheet')"
    @start-call="$emit('start-call', $event)"
    @start-offline="$emit('start-offline')"
    @accept-call="$emit('accept-call')"
    @decline-call="$emit('decline-call')"
  />

  <CallHistoryModal
    v-if="callHistoryVisible"
    :visible="callHistoryVisible"
    :contact-name="contact?.name || ''"
    :records="callHistoryRecords"
    @close="$emit('close-call-history')"
  />

  <ChatCallOverlayIntegration
    v-if="!isLeavingToMessages"
    ref="overlayIntegrationRef"
    :contact="contact"
  />
</template>

<script setup>
import { ref } from 'vue'
import { CallHistoryModal } from '../chatAsyncComponents'
import ChatCallSheets from './ChatCallSheets.vue'
import ChatCallOverlayIntegration from '../../../components/integrations/chat/ChatCallOverlayIntegration.vue'

defineProps({
  callModeVisible: { type: Boolean, default: false },
  incomingVisible: { type: Boolean, default: false },
  incomingInfo: { type: Object, default: null },
  callHistoryVisible: { type: Boolean, default: false },
  callHistoryRecords: { type: Array, default: () => [] },
  contact: { type: Object, default: null },
  isLeavingToMessages: { type: Boolean, default: false }
})

defineEmits([
  'close-call-mode-sheet',
  'start-call',
  'start-offline',
  'accept-call',
  'decline-call',
  'close-call-history'
])

const overlayIntegrationRef = ref(null)

function startCall(contactId, mode) {
  overlayIntegrationRef.value?.startCall(contactId, mode)
}

function receiveCall(contactId, mode, text) {
  overlayIntegrationRef.value?.receiveCall(contactId, mode, text)
}

defineExpose({
  startCall,
  receiveCall
})
</script>
