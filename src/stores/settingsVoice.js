import { VOICE_SETTINGS_STATE_FIELDS } from './settingsSchema'
import { createSettingsSubsetStore } from './settingsSubsetStore'

export const useVoiceStore = createSettingsSubsetStore('settings-voice', VOICE_SETTINGS_STATE_FIELDS)
