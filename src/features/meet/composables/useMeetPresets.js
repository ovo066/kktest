import { computed } from 'vue'
import { useMeetStore } from '../../../stores/meet'
import { useStorage } from '../../../composables/useStorage'
import { parseSTPresetPayload } from '../../../utils/stPreset'

export function useMeetPresets() {
  const meetStore = useMeetStore()
  const { scheduleSave } = useStorage()

  const presets = computed(() => meetStore.presets)

  function createPreset(data = {}) {
    const preset = meetStore.createPreset(data)
    scheduleSave()
    return preset
  }

  function updatePreset(id, patch) {
    meetStore.updatePreset(id, patch)
    scheduleSave()
  }

  function deletePreset(id) {
    meetStore.deletePreset(id)
    scheduleSave()
  }

  function importSTPreset(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') return []
    const parsed = parseSTPresetPayload(jsonData)
    if (parsed.length === 0) return []

    const imported = parsed.map(data => meetStore.createPreset(data))
    scheduleSave()
    return imported
  }

  function exportPreset(id) {
    const preset = meetStore.presets.find(p => p.id === id)
    if (!preset) return null
    return JSON.stringify(preset, null, 2)
  }

  return {
    presets,
    createPreset,
    updatePreset,
    deletePreset,
    importSTPreset,
    exportPreset
  }
}
