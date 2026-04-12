import { LIVENESS_SETTINGS_STATE_FIELDS } from './settingsSchema'
import { createSettingsSubsetStore } from './settingsSubsetStore'

export const useLivenessSettingsStore = createSettingsSubsetStore('settings-liveness', LIVENESS_SETTINGS_STATE_FIELDS)
