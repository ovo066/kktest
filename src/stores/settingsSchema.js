import {
  BEIJING_TIME_ZONE,
  normalizeTimeZoneMode,
  sanitizeIanaTimeZone,
  TIME_ZONE_MODE_BEIJING
} from '../utils/beijingTime'
import {
  createDefaultCloudSyncSettings,
  createDefaultGeneralSettings,
  createDefaultLivenessSettings,
  createDefaultSettingsSnapshot,
  createDefaultThemeSettings,
  createDefaultToolCallingSettings,
  createDefaultVoiceSettings
} from './settingsDefaults'
import {
  normalizeCloudSyncAutoSyncPolicy,
  normalizeCloudSyncCustomDeltaBytes,
  normalizeCloudSyncCustomIntervalMs
} from '../composables/cloudSync/policy'
import { normalizeSTTProvider } from '../utils/sttProviders'
import { normalizeSoundConfig } from '../utils/soundEffects'

const DEFAULT_SNAPSHOT_SETTINGS = createDefaultSettingsSnapshot()

export const THEME_SETTINGS_STATE_FIELDS = Object.freeze(Object.keys(createDefaultThemeSettings()))
export const GENERAL_SETTINGS_STATE_FIELDS = Object.freeze(Object.keys(createDefaultGeneralSettings()))
export const VOICE_SETTINGS_STATE_FIELDS = Object.freeze(Object.keys(createDefaultVoiceSettings()))
export const LIVENESS_SETTINGS_STATE_FIELDS = Object.freeze(Object.keys(createDefaultLivenessSettings()))
export const CLOUD_SYNC_SETTINGS_STATE_FIELDS = Object.freeze(Object.keys(createDefaultCloudSyncSettings()))
export const TOOL_CALLING_SETTINGS_STATE_FIELDS = Object.freeze(Object.keys(createDefaultToolCallingSettings()))

export const STORAGE_SETTINGS_PROXY_FIELDS = Object.freeze([
  ...new Set([
    ...THEME_SETTINGS_STATE_FIELDS,
    ...GENERAL_SETTINGS_STATE_FIELDS,
    'wallpaper',
    'wallpaperRef',
    'lockScreenWallpaper',
    'lockScreenWallpaperRef',
    ...VOICE_SETTINGS_STATE_FIELDS,
    ...LIVENESS_SETTINGS_STATE_FIELDS,
    ...CLOUD_SYNC_SETTINGS_STATE_FIELDS,
    ...TOOL_CALLING_SETTINGS_STATE_FIELDS,
    'savedThemes',
    'activeThemeId',
    'theme'
  ])
])

export const SETTINGS_SNAPSHOT_FIELD_DEFINITIONS = Object.freeze([
  { key: 'isDark', normalize: (value) => !!value },
  { key: 'showChatAvatars', normalize: (value) => !!value },
  { key: 'showChatTimestamps', normalize: (value) => value !== false },
  { key: 'sendTimestampsToAI', normalize: (value) => !!value },
  { key: 'allowAIStickers', normalize: (value) => value !== false },
  { key: 'allowAIImageGeneration', normalize: (value) => !!value },
  { key: 'globalPresetLorebookEnabled', normalize: (value) => value !== false },
  { key: 'syncForumToAI', normalize: (value) => !!value },
  { key: 'showNarrations', normalize: (value) => value !== false },
  { key: 'showTokenCapsule', normalize: (value) => value !== false },
  { key: 'allowAIFavorite', normalize: (value) => !!value },
  { key: 'allowAITransfer', normalize: (value) => !!value },
  { key: 'allowAIGift', normalize: (value) => !!value },
  { key: 'allowAIVoice', normalize: (value) => !!value },
  { key: 'allowAIEmotionTag', normalize: (value) => !!value },
  { key: 'allowAICall', normalize: (value) => value !== false },
  { key: 'allowAIMockImage', normalize: (value) => !!value },
  { key: 'allowAIMusicRecommend', normalize: (value) => !!value },
  { key: 'musicSearchApiUrl', normalize: (value) => value || '' },
  { key: 'enableWeatherContext', normalize: (value) => !!value },
  { key: 'weatherLocationMode', normalize: (value) => value === 'manual' ? 'manual' : 'auto' },
  { key: 'weatherManualCity', normalize: (value) => value || '' },
  {
    key: 'weatherRefreshMinutes',
    normalize: (value) => {
      const minutes = Number(value)
      if (!Number.isFinite(minutes)) return 60
      return Math.max(10, Math.min(360, Math.round(minutes)))
    }
  },
  {
    key: 'timeZoneMode',
    normalize: (value) => normalizeTimeZoneMode(value || TIME_ZONE_MODE_BEIJING)
  },
  {
    key: 'customTimeZone',
    normalize: (value) => sanitizeIanaTimeZone(value, BEIJING_TIME_ZONE)
  },
  { key: 'offlineKeepHistory', normalize: (value) => value !== false },
  { key: 'offlineInjectToChat', normalize: (value) => !!value },
  { key: 'offlineRetrieveMainMemory', normalize: (value) => !!value },
  { key: 'voiceTtsMode', normalize: (value) => value || 'simulated' },
  { key: 'sttEngine', normalize: (value) => value || 'browser' },
  { key: 'sttTriggerMode', normalize: (value) => value === 'manual' ? 'manual' : 'auto' },
  { key: 'sttProvider', normalize: (value) => normalizeSTTProvider(value) },
  { key: 'sttApiUrl', normalize: (value) => value || '' },
  { key: 'sttApiKey', normalize: (value) => value || '' },
  { key: 'sttApiModel', normalize: (value) => value || '' },
  { key: 'allowLivenessEngine', normalize: (value) => !!value },
  { key: 'allowPlannerAI', normalize: (value) => !!value },
  { key: 'allowAIPlannerCapture', normalize: (value) => !!value },
  { key: 'plannerReminderMode', normalize: (value) => value || 'toast' },
  { key: 'allowCharacterSchedule', normalize: (value) => !!value },
  { key: 'allowAIMeet', normalize: (value) => !!value },
  { key: 'meetOpeningUseOfflinePreset', normalize: (value) => value !== false },
  {
    key: 'soundConfig',
    normalize: (value) => normalizeSoundConfig(value, DEFAULT_SNAPSHOT_SETTINGS.soundConfig)
  },
  { key: 'cloudSyncEnabled', normalize: (value) => !!value },
  { key: 'cloudSyncAutoSync', normalize: (value) => value !== false },
  { key: 'cloudSyncAutoSyncPolicy', normalize: (value) => normalizeCloudSyncAutoSyncPolicy(value) },
  { key: 'cloudSyncCustomMinIntervalMs', normalize: (value) => normalizeCloudSyncCustomIntervalMs(value) },
  { key: 'cloudSyncCustomMinDeltaBytes', normalize: (value) => normalizeCloudSyncCustomDeltaBytes(value) },
  { key: 'cloudSyncIncludeMedia', normalize: (value) => !!value },
  { key: 'cloudSyncProvider', normalize: (value) => value || 'firebase' },
  { key: 'cloudSyncDeviceId', normalize: (value) => value || '' },
  { key: 'allowToolCalling', normalize: (value) => !!value }
])

export const SETTINGS_SNAPSHOT_FIELD_KEYS = Object.freeze(
  SETTINGS_SNAPSHOT_FIELD_DEFINITIONS.map(({ key }) => key)
)

const SETTINGS_SNAPSHOT_FIELD_MAP = new Map(
  SETTINGS_SNAPSHOT_FIELD_DEFINITIONS.map((definition) => [definition.key, definition])
)

export function normalizeSettingsSnapshotValue(key, value) {
  const definition = SETTINGS_SNAPSHOT_FIELD_MAP.get(key)
  if (!definition) return value
  return definition.normalize(value)
}
