import { DEFAULT_PROMPT } from '../../stores/contacts'
import {
  normalizeSettingsSnapshotValue,
  SETTINGS_SNAPSHOT_FIELD_KEYS
} from '../../stores/settingsSchema'
import { createDefaultSettingsSnapshot } from '../../stores/settingsDefaults'
import { applyContactMessageSummary } from '../../utils/contactMessageSummary'
import { normalizeMcpServerIds } from '../../utils/mcpServers'
import { createDefaultPlannerData } from './appDataModules'
import { ensureLorebookDefaults } from './lorebookDefaults'

function assignArrayIfPresent(target, key, value) {
  if (Array.isArray(value)) {
    target[key] = value
  }
}

function assignNullableOwnProperty(source, key, target, targetKey = key) {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    target[targetKey] = source[key] || null
  }
}

function mergeObjectIfPresent(target, key, value) {
  if (!value || typeof value !== 'object') return
  if (!target[key] || typeof target[key] !== 'object') return
  Object.assign(target[key], value)
}

const DEFAULT_SNAPSHOT_SETTINGS = createDefaultSettingsSnapshot()

function cloneSnapshotConfig(value, fallback = {}) {
  if (value && typeof value === 'object') {
    return { ...value }
  }
  return { ...fallback }
}

export function buildSnapshotSettings(store) {
  const settings = Object.fromEntries(
    SETTINGS_SNAPSHOT_FIELD_KEYS.map((key) => [key, normalizeSettingsSnapshotValue(key, store[key])])
  )

  settings.voiceTtsConfig = cloneSnapshotConfig(store.voiceTtsConfig, DEFAULT_SNAPSHOT_SETTINGS.voiceTtsConfig)
  settings.livenessConfig = cloneSnapshotConfig(store.livenessConfig, DEFAULT_SNAPSHOT_SETTINGS.livenessConfig)
  settings.cloudSyncConfig = cloneSnapshotConfig(store.cloudSyncConfig, DEFAULT_SNAPSHOT_SETTINGS.cloudSyncConfig)
  settings.toolCallingConfig = cloneSnapshotConfig(store.toolCallingConfig, DEFAULT_SNAPSHOT_SETTINGS.toolCallingConfig)

  return settings
}

export function applySettingsToStore(settings, store) {
  store.configs = settings.configs
  store.activeConfigId = settings.activeConfigId

  SETTINGS_SNAPSHOT_FIELD_KEYS.forEach((key) => {
    store[key] = normalizeSettingsSnapshotValue(key, settings.values[key])
  })

  if (settings.values.voiceTtsConfig && typeof settings.values.voiceTtsConfig === 'object') {
    Object.assign(store.voiceTtsConfig, settings.values.voiceTtsConfig)
  }

  if (settings.values.livenessConfig && typeof settings.values.livenessConfig === 'object') {
    Object.assign(store.livenessConfig, settings.values.livenessConfig)
  }

  if (settings.values.cloudSyncConfig && typeof settings.values.cloudSyncConfig === 'object') {
    Object.assign(store.cloudSyncConfig, settings.values.cloudSyncConfig)
  }

  if (settings.values.toolCallingConfig && typeof settings.values.toolCallingConfig === 'object') {
    Object.assign(store.toolCallingConfig, settings.values.toolCallingConfig)
  }
}

function buildReaderSnapshot(context) {
  const { store, readerStore, externalized } = context
  const readerChatSnapshot = readerStore.exportReaderChatSessions
    ? readerStore.exportReaderChatSessions()
    : null

  return {
    readerBooks: Array.isArray(externalized.readerBooks) ? externalized.readerBooks : (store.readerBooks || []),
    readerSettings: store.readerSettings ? { ...store.readerSettings } : null,
    readerAISettings: readerStore.readerAISettings ? { ...readerStore.readerAISettings } : null,
    readerWindowSize: store.readerWindowSize ? { ...store.readerWindowSize } : null,
    readerAIChat: store.readerAIChat ? {
      visible: false,
      messages: Array.isArray(store.readerAIChat.messages) ? store.readerAIChat.messages : [],
      contextText: store.readerAIChat.contextText || '',
      selectedText: store.readerAIChat.selectedText || ''
    } : null,
    readerAIChatSessions: readerChatSnapshot?.aiSessions || null,
    readerSelectionChatSessions: readerChatSnapshot?.selectionSessions || null,
    readerCurrentChatSessionKey: readerChatSnapshot?.currentSessionKey || ''
  }
}

function applyThemeState(theme, store) {
  if (!theme) return
  Object.assign(store.theme, theme)
  if (theme.appIconRefs && typeof theme.appIconRefs === 'object') {
    store.theme.appIconRefs = { ...theme.appIconRefs }
  } else if (store.theme.appIconRefs) {
    delete store.theme.appIconRefs
  }
  store.applyTheme()
}

function applyReaderState(data, store, readerStore) {
  assignArrayIfPresent(store, 'readerBooks', data.readerBooks)
  mergeObjectIfPresent(store, 'readerSettings', data.readerSettings)
  mergeObjectIfPresent(readerStore, 'readerAISettings', data.readerAISettings)
  mergeObjectIfPresent(store, 'readerWindowSize', data.readerWindowSize)

  if (readerStore.importReaderChatSessions) {
    readerStore.importReaderChatSessions(
      data.readerAIChatSessions,
      data.readerSelectionChatSessions,
      data.readerAIChat,
      data.readerCurrentChatSessionKey
    )
    return
  }

  if (!data.readerAIChat || typeof data.readerAIChat !== 'object') return

  store.readerAIChat.visible = false
  store.readerAIChat.messages = Array.isArray(data.readerAIChat.messages) ? data.readerAIChat.messages : []
  store.readerAIChat.contextText = typeof data.readerAIChat.contextText === 'string' ? data.readerAIChat.contextText : ''
  store.readerAIChat.selectedText = typeof data.readerAIChat.selectedText === 'string' ? data.readerAIChat.selectedText : ''
}

function applyForumState(data, momentsStore) {
  momentsStore.moments.splice(0, momentsStore.moments.length, ...(data.forum || []))

  if (data.forumUser) {
    if (data.forumUser.id) {
      momentsStore.forumUser.id = data.forumUser.id
    }
    momentsStore.forumUser.name = data.forumUser.name || '匿名用户'
    momentsStore.forumUser.avatar = data.forumUser.avatar || null
    momentsStore.forumUser.bio = data.forumUser.bio || ''
    if (data.forumUser.avatarRef) momentsStore.forumUser.avatarRef = data.forumUser.avatarRef
  }

  momentsStore.following.splice(0, momentsStore.following.length, ...(data.forumFollowing || []))
  momentsStore.contactGroups.splice(0, momentsStore.contactGroups.length, ...(data.forumContactGroups || []))
  momentsStore.contactGroupMap = { ...(data.forumContactGroupMap || {}) }
}

function normalizeContactRuntimeShape(store) {
  if (!Array.isArray(store.contacts)) return

  store.contacts.forEach((contact) => {
    if (contact?.type === 'group') {
      if (typeof contact.prompt !== 'string') contact.prompt = ''
    } else if (typeof contact.prompt !== 'string' || !contact.prompt.trim()) {
      contact.prompt = DEFAULT_PROMPT
    }
    if (!Array.isArray(contact.boundLorebooks)) contact.boundLorebooks = []
    if (contact.personaId === undefined) contact.personaId = null
    if (!Array.isArray(contact.stickerGroupIds)) contact.stickerGroupIds = []
    contact.mcpServerIds = normalizeMcpServerIds(contact.mcpServerIds)
    if (!Array.isArray(contact.msgs)) contact.msgs = []
    if (!Array.isArray(contact.callHistory)) contact.callHistory = []

    if (Array.isArray(contact.members)) {
      contact.members = contact.members.map((member) => {
        if (!member || typeof member !== 'object') return member
        if (!Array.isArray(member.stickerGroupIds)) {
          member.stickerGroupIds = []
        }
        member.mcpServerIds = normalizeMcpServerIds(member.mcpServerIds)
        return member
      })
    }

    if (!Array.isArray(contact.offlineMsgs)) contact.offlineMsgs = []
    if (!contact.offlinePresetId) contact.offlinePresetId = null
    if (!Array.isArray(contact.offlineRegexRules)) contact.offlineRegexRules = []
    if (!Array.isArray(contact.offlineSessions)) contact.offlineSessions = []
    if (!Array.isArray(contact.offlineSnapshots)) contact.offlineSnapshots = []
    if (!Number.isFinite(Number(contact.offlineArchiveCursor))) contact.offlineArchiveCursor = 0

    applyContactMessageSummary(contact)
  })
}

function ensureDemoContact(store) {
  if (Array.isArray(store.contacts) && store.contacts.length > 0) return

  store.contacts = [
    {
      id: 'demo',
      name: 'AI 助手',
      avatarType: 'emoji',
      avatar: '🤖',
      prompt: DEFAULT_PROMPT,
      boundLorebooks: [],
      personaId: null,
      callHistory: [],
      msgs: [{ id: 1, role: 'assistant', content: '你好！有什么我可以帮你的？', time: Date.now() }]
    }
  ]

  applyContactMessageSummary(store.contacts[0])
}

export const STORAGE_SNAPSHOT_MODULES = [
  {
    id: 'core',
    snapshot(context) {
      const { store, externalized } = context
      return {
        contacts: externalized.contacts,
        configs: store.configs,
        activeConfigId: store.activeConfigId,
        settings: buildSnapshotSettings(store),
        wallpaper: externalized.rootMedia.wallpaper || null,
        wallpaperRef: externalized.rootMedia.wallpaperRef || '',
        lockScreenWallpaper: externalized.rootMedia.lockScreenWallpaper || null,
        lockScreenWallpaperRef: externalized.rootMedia.lockScreenWallpaperRef || ''
      }
    }
  },
  {
    id: 'library',
    snapshot(context) {
      const { store, externalized } = context
      return {
        lorebook: store.lorebook?.books || [],
        personas: externalized.personas,
        defaultPersonaId: store.defaultPersonaId || null,
        stickers: externalized.stickers,
        stickerGroups: store.stickerGroups || [],
        customGifts: store.customGifts || []
      }
    }
  },
  {
    id: 'forum',
    snapshot(context) {
      const { momentsStore, externalized } = context
      return {
        forum: externalized.forum,
        forumUser: externalized.forumUser,
        forumFollowing: momentsStore.following || [],
        forumContactGroups: momentsStore.contactGroups || [],
        forumContactGroupMap: momentsStore.contactGroupMap || {}
      }
    }
  },
  {
    id: 'home',
    snapshot(context) {
      const { store, externalized } = context
      return {
        theme: externalized.theme,
        widgets: externalized.widgets,
        savedThemes: externalized.savedThemes,
        activeThemeId: store.activeThemeId || ''
      }
    }
  },
  {
    id: 'vn',
    snapshot(context) {
      const { store, externalized } = context
      return {
        vnProjects: externalized.vnProjects,
        vnCurrentProjectId: store.vnCurrentProjectId || null,
        vnImageGenConfig: store.vnImageGenConfig ? { ...store.vnImageGenConfig } : null,
        vnTtsConfig: store.vnTtsConfig ? { ...store.vnTtsConfig } : null
      }
    }
  },
  {
    id: 'resources',
    snapshot(context) {
      const { externalized } = context
      return {
        callResources: externalized.callResources,
        characterResources: externalized.characterResources
      }
    }
  },
  {
    id: 'meet',
    snapshot(context) {
      const { store, externalized } = context
      return {
        meetMeetings: externalized.meetMeetings,
        meetPresets: store.meetPresets || [],
        meetCurrentMeetingId: store.meetCurrentMeetingId || null,
        meetAssetSources: store.meetAssetSources ? { ...store.meetAssetSources } : null
      }
    }
  },
  {
    id: 'album',
    snapshot(context) {
      return {
        albumPhotos: context.externalized.albumPhotos
      }
    }
  },
  {
    id: 'featureState',
    snapshot(context) {
      const { offlineStore, livenessStore, musicStore, externalized } = context
      return {
        offlinePresets: offlineStore.exportData(),
        liveness: livenessStore.exportData(),
        music: musicStore.exportData(),
        planner: externalized.planner
      }
    }
  },
  {
    id: 'reader',
    snapshot(context) {
      return buildReaderSnapshot(context)
    }
  },
  {
    id: 'snoop',
    snapshot(context) {
      const { snoopStore } = context
      return {
        snoop: snoopStore ? snoopStore.exportData() : {}
      }
    }
  }
]

export const STORAGE_APPLY_MODULES = [
  {
    id: 'core',
    apply(data, deps) {
      const { store } = deps

      applySettingsToStore({
        configs: data.configs,
        activeConfigId: data.activeConfigId,
        values: data.settings
      }, store)

      store.wallpaper = data.wallpaper || null
      store.wallpaperRef = data.wallpaperRef || ''
      store.lockScreenWallpaper = data.lockScreenWallpaper || null
      store.lockScreenWallpaperRef = data.lockScreenWallpaperRef || ''
      store.contacts = data.contacts
    }
  },
  {
    id: 'featureState',
    apply(data, deps) {
      const { livenessStore, plannerStore, musicStore, offlineStore } = deps

      if (data.liveness) {
        livenessStore.importData(data.liveness)
      }

      plannerStore.importData(data.planner || createDefaultPlannerData())

      if (data.music) {
        musicStore.importData(data.music)
      }

      if (data.offlinePresets) {
        offlineStore.importData(data.offlinePresets)
      }
    }
  },
  {
    id: 'library',
    apply(data, deps) {
      const { store } = deps

      store.lorebook.books = ensureLorebookDefaults(data.lorebook)
      store.personas = data.personas
      store.defaultPersonaId = data.defaultPersonaId || null
      store.stickers = data.stickers
      store.stickerGroups = data.stickerGroups || []
      store.customGifts = data.customGifts || []
    }
  },
  {
    id: 'home',
    apply(data, deps) {
      const { store } = deps

      if (Array.isArray(data.widgets)) {
        store.setWidgets(data.widgets)
      }

      applyThemeState(data.theme, store)
      assignArrayIfPresent(store, 'savedThemes', data.savedThemes)
      store.activeThemeId = data.activeThemeId || ''
    }
  },
  {
    id: 'vn',
    apply(data, deps) {
      const { store } = deps

      assignArrayIfPresent(store, 'vnProjects', data.vnProjects)
      assignNullableOwnProperty(data, 'vnCurrentProjectId', store)
      mergeObjectIfPresent(store, 'vnImageGenConfig', data.vnImageGenConfig)
      mergeObjectIfPresent(store, 'vnTtsConfig', data.vnTtsConfig)
    }
  },
  {
    id: 'resources',
    apply(data, deps) {
      const { importCallResources, charResStore } = deps

      if (data.callResources) {
        importCallResources(data.callResources)
      }

      if (data.characterResources) {
        charResStore.importData(data.characterResources)
      }
    }
  },
  {
    id: 'meet',
    apply(data, deps) {
      const { store } = deps

      assignArrayIfPresent(store, 'meetMeetings', data.meetMeetings)
      assignArrayIfPresent(store, 'meetPresets', data.meetPresets)
      assignNullableOwnProperty(data, 'meetCurrentMeetingId', store)
      mergeObjectIfPresent(store, 'meetAssetSources', data.meetAssetSources)
    }
  },
  {
    id: 'album',
    apply(data, deps) {
      assignArrayIfPresent(deps.albumStore, 'photos', data.albumPhotos)
    }
  },
  {
    id: 'reader',
    apply(data, deps) {
      applyReaderState(data, deps.store, deps.readerStore)
    }
  },
  {
    id: 'forum',
    apply(data, deps) {
      applyForumState(data, deps.momentsStore)
    }
  },
  {
    id: 'snoop',
    apply(data, deps) {
      if (deps.snoopStore && data.snoop) {
        deps.snoopStore.importData(data.snoop)
      }
    }
  }
]

export function finalizeAppliedSnapshot(deps) {
  normalizeContactRuntimeShape(deps.store)
  ensureDemoContact(deps.store)
  deps.store.setDarkMode(deps.store.isDark)
}

