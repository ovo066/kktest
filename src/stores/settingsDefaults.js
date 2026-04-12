import { BEIJING_TIME_ZONE, TIME_ZONE_MODE_BEIJING } from '../utils/beijingTime'
import {
  DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY,
  DEFAULT_CLOUD_SYNC_CUSTOM_POLICY
} from '../composables/cloudSync/policy'
import { STT_PROVIDER_OPENAI_COMPAT } from '../utils/sttProviders'
import { createDefaultCloudSyncConfig } from '../utils/cloudSyncConfig'
import { createDefaultThemeState } from '../utils/themeDefaults'
import { createDefaultSoundConfig } from '../utils/soundEffects'

export function createDefaultThemeSettings() {
  return {
    isDark: false
  }
}

export function createDefaultThemeLibraryState() {
  return {
    savedThemes: [],
    activeThemeId: '',
    theme: createDefaultThemeState()
  }
}

export function createDefaultGeneralSettings() {
  return {
    showChatAvatars: false,
    showChatTimestamps: true,
    sendTimestampsToAI: false,
    allowAIStickers: true,
    allowAIImageGeneration: false,
    globalPresetLorebookEnabled: true,
    syncForumToAI: false,
    showNarrations: true,
    showTokenCapsule: true,
    allowAIFavorite: false,
    allowAITransfer: false,
    allowAIGift: false,
    allowAIVoice: false,
    allowAIEmotionTag: false,
    allowAICall: true,
    allowAIMockImage: false,
    allowAIMusicRecommend: false,
    musicSearchApiUrl: '',
    enableWeatherContext: false,
    weatherLocationMode: 'auto',
    weatherManualCity: '',
    weatherRefreshMinutes: 60,
    timeZoneMode: TIME_ZONE_MODE_BEIJING,
    customTimeZone: BEIJING_TIME_ZONE,
    offlineKeepHistory: true,
    offlineInjectToChat: false,
    offlineRetrieveMainMemory: false,
    allowPlannerAI: false,
    allowAIPlannerCapture: false,
    plannerReminderMode: 'toast',
    allowCharacterSchedule: false,
    allowAIMeet: false,
    meetOpeningUseOfflinePreset: true,
    soundConfig: createDefaultSoundConfig()
  }
}

export function createDefaultVoiceSettings() {
  return {
    voiceTtsMode: 'simulated',
    voiceTtsConfig: {
      edgeEndpoint: '',
      edgeVoiceId: 'zh-CN-XiaoxiaoNeural',
      minimaxEndpoint: 'https://api.minimax.io/v1/t2a_v2',
      minimaxApiKey: '',
      minimaxGroupId: '',
      minimaxVoiceId: '',
      minimaxModel: 'speech-02-turbo'
    },
    sttEngine: 'browser',
    sttTriggerMode: 'auto',
    sttProvider: STT_PROVIDER_OPENAI_COMPAT,
    sttApiUrl: '',
    sttApiKey: '',
    sttApiModel: ''
  }
}

export function createDefaultLivenessSettings() {
  return {
    allowLivenessEngine: false,
    livenessConfig: {
      heartbeatInterval: 600000,
      decisionConfigId: '',
      replyDelayBase: 2000,
      replyDelayPerChar: 50,
      replyDelayJitter: 3000,
      proactiveDelayMin: 5,
      proactiveDelayMax: 120,
      simulateReadReceipt: true,
      simulateTypingIndicator: true,
      proactiveCooldown: 1800000,
      globalProactiveCooldown: 720000,
      proactiveDailyCap: 2,
      proactiveGlobalDailyCap: 6,
      quietHoursStart: 23,
      quietHoursEnd: 7,
      notifyMode: 'island',
      allowProactiveMoments: true,
      allowChatReadOnly: true,
      showReadOnlyReasonToast: false,
      backgroundKeepAlive: false,
      pushEnabled: false,
      pushApiBase: '/api',
      pushAuthToken: ''
    }
  }
}

export function createDefaultCloudSyncSettings() {
  return {
    cloudSyncEnabled: false,
    cloudSyncAutoSync: true,
    cloudSyncAutoSyncPolicy: DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY,
    cloudSyncCustomMinIntervalMs: DEFAULT_CLOUD_SYNC_CUSTOM_POLICY.minIntervalMs,
    cloudSyncCustomMinDeltaBytes: DEFAULT_CLOUD_SYNC_CUSTOM_POLICY.minDeltaBytes,
    cloudSyncIncludeMedia: false,
    cloudSyncProvider: 'firebase',
    cloudSyncDeviceId: '',
    cloudSyncConfig: createDefaultCloudSyncConfig()
  }
}

export function createDefaultToolCallingSettings() {
  return {
    allowToolCalling: false,
    toolCallingConfig: {
      maxToolRounds: 3,
      showToolLog: false,
      mcpBridgeUrl: 'http://localhost:3099',
      mcpBridgeEnabled: false,
      mcpServers: [],
      mcpDirectServers: []
    }
  }
}

export function createDefaultSettingsSnapshot() {
  return {
    ...createDefaultThemeSettings(),
    ...createDefaultGeneralSettings(),
    ...createDefaultVoiceSettings(),
    ...createDefaultLivenessSettings(),
    ...createDefaultCloudSyncSettings(),
    ...createDefaultToolCallingSettings()
  }
}
