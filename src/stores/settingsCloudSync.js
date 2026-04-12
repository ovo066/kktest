import { CLOUD_SYNC_SETTINGS_STATE_FIELDS } from './settingsSchema'
import { createSettingsSubsetStore } from './settingsSubsetStore'

export const useCloudSyncSettingsStore = createSettingsSubsetStore('settings-cloud-sync', CLOUD_SYNC_SETTINGS_STATE_FIELDS)
