<template>
  <MemoryPanel
    :visible="panelVisible"
    @close="emit('close-panel')"
    @settings="emit('open-settings')"
  />

  <MemorySettings
    :visible="settingsVisible"
    @back="emit('back-from-settings')"
  />
</template>

<script setup>
import { MemoryPanel, MemorySettings } from '../../../features/memory/ui'

defineProps({
  panelVisible: { type: Boolean, default: false },
  settingsVisible: { type: Boolean, default: false }
})

const emit = defineEmits(['close-panel', 'open-settings', 'back-from-settings'])
</script>
