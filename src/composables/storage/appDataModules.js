// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */

import { sanitizeMiniMaxGroupId } from '../../utils/minimaxConfig'
import {
  normalizeStickerGroups,
  normalizeStickers,
  sanitizeStickerGroupSelection
} from '../../utils/stickerGroups'
import { normalizeMcpServerIds } from '../../utils/mcpServers'
import {
  createDefaultCloudSyncSettings,
  createDefaultLivenessSettings,
  createDefaultSettingsSnapshot,
  createDefaultThemeLibraryState,
  createDefaultToolCallingSettings,
  createDefaultVoiceSettings
} from '../../stores/settingsDefaults'
import {
  normalizeSettingsSnapshotValue,
  SETTINGS_SNAPSHOT_FIELD_KEYS
} from '../../stores/settingsSchema'
import {
  createDefaultThemeAppIcons,
  createDefaultThemeState
} from '../../utils/themeDefaults'
import { normalizeCloudSyncConfig } from '../../utils/cloudSyncConfig'
import { inferSTTProviderFromUrl, normalizeSTTProvider } from '../../utils/sttProviders'
import { ensureLorebookDefaults } from './lorebookDefaults'

/**
 * @typedef {{
 *   id: string
 *   defaults: () => Record<string, unknown>
 *   normalize?: (normalized: StorageAppData, context: AppDataNormalizeContext) => void
 * }} AppDataModule
 */

/**
 * @typedef {{
 *   source: Record<string, unknown> | null
 *   rawSettings: Record<string, unknown> | null
 *   defaultSettings: Record<string, unknown>
 *   defaultVoiceSettings: Record<string, unknown>
 *   defaultLivenessSettings: Record<string, unknown>
 *   defaultCloudSyncSettings: Record<string, unknown>
 *   defaultToolCallingSettings: Record<string, unknown>
 * }} AppDataNormalizeContext
 */

const DEFAULT_PLANNER_CATEGORIES = [
  { id: 'work', name: '工作', icon: 'local_cafe', color: '#b8e0d2' },
  { id: 'personal', name: '个人', icon: 'potted_plant', color: '#f4c2c2' },
  { id: 'ideas', name: '灵感', icon: 'lightbulb', color: '#fff1a8' }
]

function createDefaultConfigSnapshot() {
  return {
    id: 'default',
    name: 'OpenAI',
    url: 'https://api.openai.com/v1',
    key: '',
    model: 'gpt-3.5-turbo',
    temperature: null,
    maxTokens: null
  }
}

export function createDefaultPlannerData() {
  return {
    events: [],
    diaryEntries: [],
    categories: DEFAULT_PLANNER_CATEGORIES.map(category => ({ ...category })),
    characterSchedules: {}
  }
}

export function createDefaultOfflinePresets() {
  return {
    presets: [],
    activePresetId: null,
    regexRules: [],
    theme: 'ttk',
    layout: 'classic',
    avatarMode: 'side',
    themeConfig: {
      customCss: '',
      fontFamily: '',
      fontImport: ''
    }
  }
}

function createDefaultHomeState() {
  const themeLibraryState = createDefaultThemeLibraryState()
  return {
    theme: themeLibraryState.theme,
    widgets: [],
    savedThemes: themeLibraryState.savedThemes,
    activeThemeId: themeLibraryState.activeThemeId
  }
}

function normalizeOptionalNumber(value, min, max, integer = false) {
  if (value === null || value === undefined || value === '') return null
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return null
  if (numericValue < min || numericValue > max) return null
  return integer ? Math.floor(numericValue) : numericValue
}

function normalizeUrlLikeString(value) {
  return String(value || '').trim()
}

function normalizeToolCallingServer(server) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) return null

  const next = {}
  for (const [key, value] of Object.entries(server)) {
    if (key === 'args' && Array.isArray(value)) {
      next.args = value.map((item) => String(item ?? '').trim()).filter(Boolean)
      continue
    }
    if (key === 'env' && value && typeof value === 'object' && !Array.isArray(value)) {
      next.env = Object.fromEntries(
        Object.entries(value)
          .map(([envKey, envValue]) => [String(envKey || '').trim(), String(envValue ?? '').trim()])
          .filter(([envKey]) => !!envKey)
      )
      continue
    }
    if (typeof value === 'string') {
      next[key] = value.trim()
      continue
    }
    if (typeof value === 'boolean') {
      next[key] = value
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = value
      continue
    }
    if (value === null) {
      next[key] = null
    }
  }

  const hasIdentity = !!(
    String(next.name || '').trim() ||
    String(next.id || '').trim() ||
    String(next.command || '').trim() ||
    String(next.url || '').trim()
  )
  if (!hasIdentity) return null

  if (!Object.prototype.hasOwnProperty.call(next, 'enabled')) {
    next.enabled = true
  }

  return next
}

function normalizeToolCallingConfig(rawConfig, fallbackConfig) {
  const raw = (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) ? rawConfig : {}
  const fallback = (fallbackConfig && typeof fallbackConfig === 'object' && !Array.isArray(fallbackConfig))
    ? fallbackConfig
    : {}

  const fallbackRounds = Number.isFinite(Number(fallback.maxToolRounds)) ? Number(fallback.maxToolRounds) : 3
  const rawRounds = Number(raw.maxToolRounds)
  const maxToolRounds = Number.isFinite(rawRounds)
    ? Math.max(1, Math.min(8, Math.round(rawRounds)))
    : Math.max(1, Math.min(8, Math.round(fallbackRounds)))

  const fallbackServers = Array.isArray(fallback.mcpServers)
    ? fallback.mcpServers.map(normalizeToolCallingServer).filter(Boolean)
    : []
  const fallbackDirectServers = Array.isArray(fallback.mcpDirectServers)
    ? fallback.mcpDirectServers.map(normalizeToolCallingServer).filter(Boolean)
    : []

  return {
    maxToolRounds,
    showToolLog: Object.prototype.hasOwnProperty.call(raw, 'showToolLog')
      ? !!raw.showToolLog
      : !!fallback.showToolLog,
    mcpBridgeUrl: normalizeUrlLikeString(raw.mcpBridgeUrl || fallback.mcpBridgeUrl || ''),
    mcpBridgeEnabled: Object.prototype.hasOwnProperty.call(raw, 'mcpBridgeEnabled')
      ? !!raw.mcpBridgeEnabled
      : !!fallback.mcpBridgeEnabled,
    mcpServers: Array.isArray(raw.mcpServers)
      ? raw.mcpServers.map(normalizeToolCallingServer).filter(Boolean)
      : fallbackServers,
    mcpDirectServers: Array.isArray(raw.mcpDirectServers)
      ? raw.mcpDirectServers.map(normalizeToolCallingServer).filter(Boolean)
      : fallbackDirectServers
  }
}

function sanitizeVoiceTtsConfig(rawConfig, fallbackConfig) {
  const raw = (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) ? rawConfig : {}
  const fallback = (fallbackConfig && typeof fallbackConfig === 'object' && !Array.isArray(fallbackConfig))
    ? fallbackConfig
    : {}

  const edgeEndpoint = normalizeUrlLikeString(raw.edgeEndpoint || fallback.edgeEndpoint || '')
  const edgeVoiceId = String(raw.edgeVoiceId ?? fallback.edgeVoiceId ?? '').trim()
  const minimaxEndpoint = normalizeUrlLikeString(raw.minimaxEndpoint || fallback.minimaxEndpoint || '')
  const minimaxApiKey = String(raw.minimaxApiKey ?? fallback.minimaxApiKey ?? '').trim()
  const minimaxGroupId = sanitizeMiniMaxGroupId(raw.minimaxGroupId ?? fallback.minimaxGroupId ?? '', minimaxEndpoint)
  const minimaxVoiceId = String(raw.minimaxVoiceId ?? fallback.minimaxVoiceId ?? '').trim()
  const minimaxModel = String(raw.minimaxModel ?? fallback.minimaxModel ?? '').trim()
    || String(fallback.minimaxModel || 'speech-02-turbo')

  return {
    edgeEndpoint,
    edgeVoiceId,
    minimaxEndpoint,
    minimaxApiKey,
    minimaxGroupId,
    minimaxVoiceId,
    minimaxModel
  }
}

function normalizeReaderChatState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      visible: false,
      messages: [],
      contextText: '',
      selectedText: ''
    }
  }
  return {
    visible: !!raw.visible,
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    contextText: typeof raw.contextText === 'string' ? raw.contextText : '',
    selectedText: typeof raw.selectedText === 'string' ? raw.selectedText : ''
  }
}

function normalizeReaderChatSessions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  /** @type {Record<string, Record<string, unknown>>} */
  const next = {}
  Object.entries(raw).forEach(([key, value]) => {
    if (!key || typeof key !== 'string') return
    next[key] = normalizeReaderChatState(value)
  })
  return next
}

function createNormalizeContext(source) {
  const rawSettings = (source && source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings))
    ? source.settings
    : null

  return {
    source,
    rawSettings,
    defaultSettings: createDefaultSettingsSnapshot(),
    defaultVoiceSettings: createDefaultVoiceSettings(),
    defaultLivenessSettings: createDefaultLivenessSettings(),
    defaultCloudSyncSettings: createDefaultCloudSyncSettings(),
    defaultToolCallingSettings: createDefaultToolCallingSettings()
  }
}

/** @type {AppDataModule[]} */
export const APP_DATA_MODULES = [
  {
    id: 'core',
    defaults() {
      return {
        version: 1,
        localUpdatedAt: 0,
        contacts: [],
        configs: [createDefaultConfigSnapshot()],
        activeConfigId: 'default',
        settings: createDefaultSettingsSnapshot(),
        wallpaper: null,
        lockScreenWallpaper: null
      }
    },
    normalize(normalized, context) {
      const defaultConfig = createDefaultConfigSnapshot()
      if (!Array.isArray(normalized.contacts)) normalized.contacts = []
      if (!Array.isArray(normalized.configs) || normalized.configs.length === 0) {
        normalized.configs = [createDefaultConfigSnapshot()]
      }
      normalized.configs = normalized.configs.map((cfg, index) => {
        const next = (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) ? { ...cfg } : {}
        const id = String(next.id || (index === 0 ? defaultConfig.id : `cfg_${Date.now()}_${index}`))
        return {
          ...next,
          id,
          name: typeof next.name === 'string' ? next.name : (index === 0 ? defaultConfig.name : ''),
          url: typeof next.url === 'string' ? next.url : defaultConfig.url,
          key: typeof next.key === 'string' ? next.key : '',
          model: typeof next.model === 'string' ? next.model : defaultConfig.model,
          temperature: normalizeOptionalNumber(next.temperature, 0, 2),
          maxTokens: normalizeOptionalNumber(next.maxTokens, 1, 32768, true)
        }
      })

      if (!normalized.activeConfigId || !normalized.configs.find(config => config.id === normalized.activeConfigId)) {
        normalized.activeConfigId = normalized.configs[0].id
      }

      const rawNormalizedSettings = (normalized.settings && typeof normalized.settings === 'object' && !Array.isArray(normalized.settings))
        ? normalized.settings
        : {}
      normalized.settings = { ...context.defaultSettings, ...rawNormalizedSettings }
      normalized.localUpdatedAt = Math.max(0, Number(normalized.localUpdatedAt || 0) || 0)
      normalized.settings.allowPlannerAI = !!normalized.settings.allowPlannerAI

      const hasAllowAIPlannerCapture = !!(
        context.rawSettings &&
        Object.prototype.hasOwnProperty.call(context.rawSettings, 'allowAIPlannerCapture')
      )
      normalized.settings.allowAIPlannerCapture = hasAllowAIPlannerCapture
        ? normalized.settings.allowAIPlannerCapture
        : normalized.settings.allowPlannerAI

      const legacySttEngine = String(normalized.settings.sttEngine || '').trim()
      const legacySttApiUrl = normalizeUrlLikeString(normalized.settings.whisperApiUrl || '')
      const legacySttApiKey = String(normalized.settings.whisperApiKey || '').trim()
      const legacySttApiModel = String(normalized.settings.whisperApiModel || '').trim()
      normalized.settings.sttEngine = (legacySttEngine === 'online' || legacySttEngine === 'whisper-api')
        ? 'online'
        : 'browser'
      normalized.settings.sttTriggerMode = String(normalized.settings.sttTriggerMode || '').trim().toLowerCase() === 'manual'
        ? 'manual'
        : 'auto'
      normalized.settings.sttApiUrl = normalizeUrlLikeString(normalized.settings.sttApiUrl || legacySttApiUrl || '')
      normalized.settings.sttProvider = normalizeSTTProvider(
        normalized.settings.sttProvider || inferSTTProviderFromUrl(normalized.settings.sttApiUrl)
      )
      normalized.settings.sttApiKey = String(normalized.settings.sttApiKey || legacySttApiKey || '').trim()
      normalized.settings.sttApiModel = String(normalized.settings.sttApiModel || legacySttApiModel || '').trim()

      SETTINGS_SNAPSHOT_FIELD_KEYS.forEach((key) => {
        normalized.settings[key] = normalizeSettingsSnapshotValue(key, normalized.settings[key])
      })

      if (!hasAllowAIPlannerCapture) {
        normalized.settings.allowAIPlannerCapture = !!normalized.settings.allowPlannerAI
      }

      normalized.settings.cloudSyncConfig = normalizeCloudSyncConfig(
        normalized.settings.cloudSyncConfig,
        context.defaultCloudSyncSettings.cloudSyncConfig
      )

      try {
        const mode = normalized.settings.voiceTtsMode
        const defaultVoiceConfig = context.defaultVoiceSettings.voiceTtsConfig
        const nextVoiceConfig = sanitizeVoiceTtsConfig(normalized.settings.voiceTtsConfig || {}, defaultVoiceConfig)
        normalized.settings.voiceTtsConfig = nextVoiceConfig
        if (mode === 'edge' && !String(nextVoiceConfig.edgeEndpoint || '').trim()) {
          normalized.settings.voiceTtsMode = 'browser'
        }
      } catch {
        // ignore
      }

      if (!normalized.settings.livenessConfig || typeof normalized.settings.livenessConfig !== 'object' || Array.isArray(normalized.settings.livenessConfig)) {
        normalized.settings.livenessConfig = { ...context.defaultLivenessSettings.livenessConfig }
      } else {
        normalized.settings.livenessConfig = {
          ...context.defaultLivenessSettings.livenessConfig,
          ...normalized.settings.livenessConfig
        }
      }

      normalized.settings.toolCallingConfig = normalizeToolCallingConfig(
        normalized.settings.toolCallingConfig,
        context.defaultToolCallingSettings.toolCallingConfig
      )
    }
  },
  {
    id: 'library',
    defaults() {
      return {
        lorebook: [],
        personas: [],
        defaultPersonaId: null,
        stickers: [],
        stickerGroups: [],
        customGifts: []
      }
    },
    normalize(normalized) {
      if (!Array.isArray(normalized.lorebook)) normalized.lorebook = []
      normalized.lorebook = ensureLorebookDefaults(normalized.lorebook)
      if (!Array.isArray(normalized.personas)) normalized.personas = []
      if (normalized.defaultPersonaId !== null && normalized.defaultPersonaId !== undefined && typeof normalized.defaultPersonaId !== 'string') {
        normalized.defaultPersonaId = null
      }
      if (!Array.isArray(normalized.stickers)) normalized.stickers = []
      if (!Array.isArray(normalized.stickerGroups)) normalized.stickerGroups = []
      if (!Array.isArray(normalized.customGifts)) normalized.customGifts = []
    }
  },
  {
    id: 'forum',
    defaults() {
      return {
        forum: [],
        forumUser: null,
        forumFollowing: [],
        forumContactGroups: [],
        forumContactGroupMap: {}
      }
    },
    normalize(normalized) {
      if (!Array.isArray(normalized.forum)) normalized.forum = []
      if (normalized.forumUser !== null && normalized.forumUser !== undefined && (typeof normalized.forumUser !== 'object' || Array.isArray(normalized.forumUser))) {
        normalized.forumUser = null
      }
      if (!Array.isArray(normalized.forumFollowing)) normalized.forumFollowing = []
      if (!Array.isArray(normalized.forumContactGroups)) normalized.forumContactGroups = []
      if (!normalized.forumContactGroupMap || typeof normalized.forumContactGroupMap !== 'object' || Array.isArray(normalized.forumContactGroupMap)) {
        normalized.forumContactGroupMap = {}
      }
    }
  },
  {
    id: 'home',
    defaults() {
      return createDefaultHomeState()
    },
    normalize(normalized) {
      const defaultTheme = createDefaultThemeState()
      if (!normalized.theme || typeof normalized.theme !== 'object' || Array.isArray(normalized.theme)) {
        normalized.theme = defaultTheme
      } else {
        normalized.theme = Object.assign(defaultTheme, normalized.theme)
      }
      if (!normalized.theme.appIcons || typeof normalized.theme.appIcons !== 'object' || Array.isArray(normalized.theme.appIcons)) {
        normalized.theme.appIcons = createDefaultThemeAppIcons()
      } else {
        normalized.theme.appIcons = Object.assign(createDefaultThemeAppIcons(), normalized.theme.appIcons)
      }
      if (!Array.isArray(normalized.widgets)) normalized.widgets = []
      if (!Array.isArray(normalized.savedThemes)) normalized.savedThemes = []
      if (typeof normalized.activeThemeId !== 'string') normalized.activeThemeId = ''
    }
  },
  {
    id: 'vn',
    defaults() {
      return {
        vnProjects: [],
        vnCurrentProjectId: null,
        vnImageGenConfig: null,
        vnTtsConfig: null
      }
    },
    normalize(normalized) {
      if (!Array.isArray(normalized.vnProjects)) normalized.vnProjects = []
      if (normalized.vnCurrentProjectId === undefined) normalized.vnCurrentProjectId = null
      if (normalized.vnCurrentProjectId !== null && typeof normalized.vnCurrentProjectId !== 'string') {
        normalized.vnCurrentProjectId = null
      }
      if (normalized.vnImageGenConfig !== null && normalized.vnImageGenConfig !== undefined && (typeof normalized.vnImageGenConfig !== 'object' || Array.isArray(normalized.vnImageGenConfig))) {
        normalized.vnImageGenConfig = null
      }
      if (normalized.vnTtsConfig !== null && normalized.vnTtsConfig !== undefined && (typeof normalized.vnTtsConfig !== 'object' || Array.isArray(normalized.vnTtsConfig))) {
        normalized.vnTtsConfig = null
      }
    }
  },
  {
    id: 'resources',
    defaults() {
      return {
        callResources: {},
        characterResources: {}
      }
    },
    normalize(normalized) {
      if (!normalized.callResources || typeof normalized.callResources !== 'object' || Array.isArray(normalized.callResources)) {
        normalized.callResources = {}
      }
      if (!normalized.characterResources || typeof normalized.characterResources !== 'object' || Array.isArray(normalized.characterResources)) {
        normalized.characterResources = {}
      }
    }
  },
  {
    id: 'meet',
    defaults() {
      return {
        meetMeetings: [],
        meetPresets: [],
        meetCurrentMeetingId: null,
        meetAssetSources: null
      }
    },
    normalize(normalized) {
      if (!Array.isArray(normalized.meetMeetings)) normalized.meetMeetings = []
      if (!Array.isArray(normalized.meetPresets)) normalized.meetPresets = []
      if (normalized.meetCurrentMeetingId !== null && normalized.meetCurrentMeetingId !== undefined && typeof normalized.meetCurrentMeetingId !== 'string') {
        normalized.meetCurrentMeetingId = null
      }
      if (normalized.meetAssetSources !== null && normalized.meetAssetSources !== undefined && (typeof normalized.meetAssetSources !== 'object' || Array.isArray(normalized.meetAssetSources))) {
        normalized.meetAssetSources = null
      }
    }
  },
  {
    id: 'album',
    defaults() {
      return {
        albumPhotos: []
      }
    },
    normalize(normalized) {
      if (!Array.isArray(normalized.albumPhotos)) normalized.albumPhotos = []
    }
  },
  {
    id: 'featureState',
    defaults() {
      return {
        music: null,
        planner: createDefaultPlannerData(),
        offlinePresets: createDefaultOfflinePresets()
      }
    },
    normalize(normalized) {
      const defaultPlannerData = createDefaultPlannerData()
      if (!normalized.planner || typeof normalized.planner !== 'object' || Array.isArray(normalized.planner)) {
        normalized.planner = defaultPlannerData
      } else {
        const nextPlanner = normalized.planner
        normalized.planner = {
          events: Array.isArray(nextPlanner.events) ? nextPlanner.events : [],
          diaryEntries: Array.isArray(nextPlanner.diaryEntries) ? nextPlanner.diaryEntries : [],
          categories: Array.isArray(nextPlanner.categories) && nextPlanner.categories.length
            ? nextPlanner.categories
            : defaultPlannerData.categories,
          characterSchedules: nextPlanner.characterSchedules && typeof nextPlanner.characterSchedules === 'object' && !Array.isArray(nextPlanner.characterSchedules)
            ? nextPlanner.characterSchedules
            : {}
        }
      }

      const defaultOfflineData = createDefaultOfflinePresets()
      if (Array.isArray(normalized.offlinePresets)) {
        normalized.offlinePresets = {
          ...defaultOfflineData,
          presets: normalized.offlinePresets
        }
      } else if (!normalized.offlinePresets || typeof normalized.offlinePresets !== 'object' || Array.isArray(normalized.offlinePresets)) {
        normalized.offlinePresets = { ...defaultOfflineData }
      } else {
        const next = Object.assign({}, defaultOfflineData, normalized.offlinePresets)
        if (!Array.isArray(next.presets)) next.presets = []
        if (typeof next.activePresetId !== 'string') next.activePresetId = null
        if (!Array.isArray(next.regexRules)) next.regexRules = []
        if (typeof next.theme !== 'string') next.theme = defaultOfflineData.theme
        if (typeof next.layout !== 'string') next.layout = defaultOfflineData.layout
        if (typeof next.avatarMode !== 'string') next.avatarMode = defaultOfflineData.avatarMode
        const rawThemeConfig = (next.themeConfig && typeof next.themeConfig === 'object' && !Array.isArray(next.themeConfig))
          ? next.themeConfig
          : {}
        next.themeConfig = {
          customCss: String(rawThemeConfig.customCss || ''),
          fontFamily: String(rawThemeConfig.fontFamily || '').trim(),
          fontImport: String(rawThemeConfig.fontImport || '').trim()
        }
        normalized.offlinePresets = next
      }

      if (!normalized.music || typeof normalized.music !== 'object' || Array.isArray(normalized.music)) {
        normalized.music = null
      }
    }
  },
  {
    id: 'reader',
    defaults() {
      return {
        readerBooks: [],
        readerSettings: null,
        readerAISettings: null,
        readerWindowSize: null,
        readerAIChat: null,
        readerAIChatSessions: null,
        readerSelectionChatSessions: null,
        readerCurrentChatSessionKey: ''
      }
    },
    normalize(normalized) {
      if (!Array.isArray(normalized.readerBooks)) normalized.readerBooks = []
      normalized.readerBooks = normalized.readerBooks.map((book) => {
        if (!book || typeof book !== 'object' || Array.isArray(book)) return book
        return {
          ...book,
          chapterSummaries: Array.isArray(book.chapterSummaries) ? book.chapterSummaries : [],
          notes: Array.isArray(book.notes) ? book.notes : []
        }
      })

      if (normalized.readerSettings !== null && normalized.readerSettings !== undefined && (typeof normalized.readerSettings !== 'object' || Array.isArray(normalized.readerSettings))) {
        normalized.readerSettings = null
      }

      if (!normalized.readerWindowSize || typeof normalized.readerWindowSize !== 'object' || Array.isArray(normalized.readerWindowSize)) {
        normalized.readerWindowSize = null
      } else {
        const width = Number(normalized.readerWindowSize.width)
        const height = Number(normalized.readerWindowSize.height)
        normalized.readerWindowSize = {
          width: Number.isFinite(width) ? Math.max(280, Math.min(980, Math.round(width))) : null,
          height: Number.isFinite(height) ? Math.max(360, Math.min(1200, Math.round(height))) : null
        }
      }

      if (!normalized.readerAIChat || typeof normalized.readerAIChat !== 'object' || Array.isArray(normalized.readerAIChat)) {
        normalized.readerAIChat = null
      } else {
        normalized.readerAIChat = normalizeReaderChatState(normalized.readerAIChat)
      }

      if (normalized.readerAISettings && typeof normalized.readerAISettings === 'object' && !Array.isArray(normalized.readerAISettings)) {
        if (typeof normalized.readerAISettings.customSystemPrompt !== 'string') {
          normalized.readerAISettings.customSystemPrompt = ''
        }
      } else {
        normalized.readerAISettings = null
      }

      normalized.readerAIChatSessions = normalizeReaderChatSessions(normalized.readerAIChatSessions)
      normalized.readerSelectionChatSessions = normalizeReaderChatSessions(normalized.readerSelectionChatSessions)
      if (typeof normalized.readerCurrentChatSessionKey !== 'string') {
        normalized.readerCurrentChatSessionKey = ''
      }
    }
  },
  {
    id: 'snoop',
    defaults() {
      return {
        snoop: {}
      }
    },
    normalize(normalized) {
      if (!normalized.snoop || typeof normalized.snoop !== 'object' || Array.isArray(normalized.snoop)) {
        normalized.snoop = {}
      }
    }
  }
]

/**
 * @returns {StorageAppData}
 */
export function buildDefaultAppData() {
  /** @type {Record<string, unknown>} */
  const payload = {}
  APP_DATA_MODULES.forEach((module) => {
    Object.assign(payload, module.defaults())
  })
  return /** @type {StorageAppData} */ (payload)
}

function finalizeNormalizedContacts(normalized) {
  normalized.stickerGroups = normalizeStickerGroups(normalized.stickerGroups)
  normalized.stickers = normalizeStickers(normalized.stickers, normalized.stickerGroups)

  if (!Array.isArray(normalized.contacts)) return

  normalized.contacts = normalized.contacts.map((contact) => {
    if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return contact
    const next = { ...contact }
    next.stickerGroupIds = sanitizeStickerGroupSelection(
      Array.isArray(contact.stickerGroupIds) ? contact.stickerGroupIds : [],
      normalized.stickerGroups
    )
    next.mcpServerIds = normalizeMcpServerIds(contact.mcpServerIds)
    next.lastMsgId = contact.lastMsgId ?? null
    next.lastMsgPreview = typeof contact.lastMsgPreview === 'string' ? contact.lastMsgPreview : ''
    next.lastMsgSenderName = typeof contact.lastMsgSenderName === 'string' ? contact.lastMsgSenderName : ''
    next.lastMsgTime = Number(contact.lastMsgTime || 0) || 0
    next.msgCount = Math.max(0, Number(contact.msgCount || (Array.isArray(contact.msgs) ? contact.msgs.length : 0)) || 0)

    if (Array.isArray(contact.members)) {
      next.members = contact.members.map((member) => {
        if (!member || typeof member !== 'object' || Array.isArray(member)) return member
        return {
          ...member,
          stickerGroupIds: sanitizeStickerGroupSelection(member.stickerGroupIds, normalized.stickerGroups),
          mcpServerIds: normalizeMcpServerIds(member.mcpServerIds)
        }
      })
    }

    return next
  })
}

/**
 * @param {StorageAppData} normalized
 * @param {unknown} sourceData
 * @returns {StorageAppData}
 */
export function normalizeAppData(normalized, sourceData) {
  const source = (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData))
    ? /** @type {Record<string, unknown>} */ (sourceData)
    : null
  const context = createNormalizeContext(source)

  APP_DATA_MODULES.forEach((module) => {
    module.normalize?.(normalized, context)
  })
  finalizeNormalizedContacts(normalized)

  return normalized
}
