import { useOfflineStore } from '../../../stores/offline'
import { parseSTPresetImportPayload } from '../../../utils/stPreset'

export function useOfflinePresets() {
  const offlineStore = useOfflineStore()

  function importFromSillyTavern(payload) {
    const parsed = parseSTPresetImportPayload(payload)
    const presets = []
    let regexCount = 0

    for (const data of parsed) {
      const preset = offlineStore.createPreset(data)
      presets.push(preset)
      regexCount += Array.isArray(preset.regexRules) ? preset.regexRules.length : 0
    }

    return {
      presets,
      regexCount
    }
  }

  function importFromJson(jsonText) {
    try {
      const payload = JSON.parse(jsonText)
      return importFromSillyTavern(payload)
    } catch {
      return []
    }
  }

  return {
    presets: offlineStore.presets,
    createPreset: offlineStore.createPreset,
    updatePreset: offlineStore.updatePreset,
    deletePreset: offlineStore.deletePreset,
    getPreset: offlineStore.getPreset,
    importFromSillyTavern,
    importFromJson
  }
}
