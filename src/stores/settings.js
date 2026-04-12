import { defineStore } from 'pinia'
import { ref, toRef, watch } from 'vue'
import {
  BEIJING_TIME_ZONE,
  normalizeTimeZoneMode,
  sanitizeIanaTimeZone,
  setTimeZonePreference
} from '../utils/beijingTime'
import {
  createDefaultCloudSyncSettings,
  createDefaultGeneralSettings,
  createDefaultLivenessSettings,
  createDefaultToolCallingSettings,
  createDefaultVoiceSettings
} from './settingsDefaults'
import {
  CLOUD_SYNC_SETTINGS_STATE_FIELDS,
  GENERAL_SETTINGS_STATE_FIELDS,
  LIVENESS_SETTINGS_STATE_FIELDS,
  THEME_SETTINGS_STATE_FIELDS,
  TOOL_CALLING_SETTINGS_STATE_FIELDS,
  VOICE_SETTINGS_STATE_FIELDS
} from './settingsSchema'
import { useThemeStore } from './settingsTheme'

const THEME_PROXY_STATE_FIELDS = [
  ...THEME_SETTINGS_STATE_FIELDS,
  'savedThemes',
  'activeThemeId',
  'theme'
]

const THEME_MEMBER_FIELDS = [
  'presetThemes',
  'setDarkMode',
  'applyTheme',
  'getThemeData',
  'applyThemeData',
  'saveThemeAs',
  'updateSavedTheme',
  'loadSavedTheme',
  'deleteSavedTheme',
  'renameSavedTheme',
  'exportTheme',
  'importTheme',
  'resetTheme',
  'resetAppIcons',
  'applyPresetTheme'
]

function pickStoreMembers(store, keys) {
  return Object.fromEntries(keys.map((key) => [key, store[key]]))
}

function createStoreStateRefs(store, keys) {
  return Object.fromEntries(keys.map((key) => [key, toRef(store.$state, key)]))
}

function createRefState(defaults, keys = Object.keys(defaults)) {
  return Object.fromEntries(keys.map((key) => [key, ref(defaults[key])]))
}

export const useSettingsStore = defineStore('settings', () => {
  const themeStore = useThemeStore()
  const generalState = createRefState(createDefaultGeneralSettings(), GENERAL_SETTINGS_STATE_FIELDS)
  const voiceState = createRefState(createDefaultVoiceSettings(), VOICE_SETTINGS_STATE_FIELDS)
  const livenessState = createRefState(createDefaultLivenessSettings(), LIVENESS_SETTINGS_STATE_FIELDS)
  const cloudSyncState = createRefState(createDefaultCloudSyncSettings(), CLOUD_SYNC_SETTINGS_STATE_FIELDS)
  const toolCallingState = createRefState(createDefaultToolCallingSettings(), TOOL_CALLING_SETTINGS_STATE_FIELDS)

  const wallpaper = ref(null)
  const wallpaperRef = ref('')
  const lockScreenWallpaper = ref(null)
  const lockScreenWallpaperRef = ref('')

  function applyTimeZoneSettings() {
    generalState.timeZoneMode.value = normalizeTimeZoneMode(generalState.timeZoneMode.value)
    generalState.customTimeZone.value = sanitizeIanaTimeZone(generalState.customTimeZone.value, BEIJING_TIME_ZONE)
    setTimeZonePreference({
      mode: generalState.timeZoneMode.value,
      customTimeZone: generalState.customTimeZone.value
    })
  }

  watch([generalState.timeZoneMode, generalState.customTimeZone], applyTimeZoneSettings, { immediate: true })

  return {
    ...generalState,
    wallpaper,
    wallpaperRef,
    lockScreenWallpaper,
    lockScreenWallpaperRef,
    ...createStoreStateRefs(themeStore, THEME_PROXY_STATE_FIELDS),
    ...pickStoreMembers(themeStore, THEME_MEMBER_FIELDS),
    ...voiceState,
    ...livenessState,
    ...cloudSyncState,
    ...toolCallingState
  }
})
