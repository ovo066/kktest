import { describe, expect, it, vi } from 'vitest'
import { defaultAppData } from './appData'
import {
  applySettingsToStore,
  applyStorageSnapshot,
  buildSnapshotSettings,
  buildStorageSnapshot
} from './stateBridge'

function createStoreSnapshotSeed() {
  const data = defaultAppData()
  return {
    configs: structuredClone(data.configs),
    activeConfigId: data.activeConfigId,
    ...structuredClone(data.settings),
    voiceTtsConfig: structuredClone(data.settings.voiceTtsConfig),
    livenessConfig: structuredClone(data.settings.livenessConfig),
    toolCallingConfig: structuredClone(data.settings.toolCallingConfig)
  }
}

function createBridgeDeps(overrides = {}) {
  const data = defaultAppData()
  const store = {
    configs: structuredClone(data.configs),
    activeConfigId: data.activeConfigId,
    ...structuredClone(data.settings),
    voiceTtsConfig: structuredClone(data.settings.voiceTtsConfig),
    livenessConfig: structuredClone(data.settings.livenessConfig),
    toolCallingConfig: structuredClone(data.settings.toolCallingConfig),
    contacts: structuredClone(data.contacts),
    theme: structuredClone(data.theme),
    lorebook: { books: structuredClone(data.lorebook) },
    personas: structuredClone(data.personas),
    defaultPersonaId: data.defaultPersonaId,
    stickers: structuredClone(data.stickers),
    stickerGroups: structuredClone(data.stickerGroups),
    wallpaper: data.wallpaper,
    wallpaperRef: '',
    lockScreenWallpaper: data.lockScreenWallpaper,
    lockScreenWallpaperRef: '',
    widgets: structuredClone(data.widgets),
    savedThemes: structuredClone(data.savedThemes),
    activeThemeId: data.activeThemeId,
    vnProjects: structuredClone(data.vnProjects),
    vnCurrentProjectId: data.vnCurrentProjectId,
    vnImageGenConfig: {},
    vnTtsConfig: {},
    meetMeetings: structuredClone(data.meetMeetings),
    meetPresets: structuredClone(data.meetPresets),
    meetCurrentMeetingId: data.meetCurrentMeetingId,
    meetAssetSources: {},
    readerBooks: structuredClone(data.readerBooks),
    readerSettings: { fontSize: 17 },
    readerWindowSize: { width: 420, height: 620 },
    readerAIChat: {
      visible: false,
      messages: [],
      contextText: '',
      selectedText: ''
    },
    setWidgets(widgets) {
      this.widgets = widgets
    },
    applyTheme() {},
    setDarkMode(value) {
      this.isDark = value
      this.lastDarkMode = value
    }
  }

  const deps = {
    store,
    momentsStore: {
      moments: [],
      forumUser: {
        id: 'user_seed',
        name: '匿名用户',
        avatar: null,
        bio: '',
        avatarRef: ''
      },
      following: [],
      contactGroups: [],
      contactGroupMap: {}
    },
    readerStore: {
      readerAISettings: { shareMemory: true },
      exportReaderChatSessions: () => null,
      importReaderChatSessions: vi.fn()
    },
    charResStore: {
      exportData: () => ({}),
      importData: vi.fn()
    },
    albumStore: {
      photos: []
    },
    livenessStore: {
      exportData: () => ({ states: {} }),
      importData: vi.fn()
    },
    musicStore: {
      exportData: () => ({ library: [], volume: 0.8, playMode: 'order' }),
      importData: vi.fn()
    },
    offlineStore: {
      exportData: () => structuredClone(data.offlinePresets),
      importData: vi.fn()
    },
    plannerStore: {
      exportData: () => structuredClone(data.planner),
      importData: vi.fn()
    },
    importCallResources: vi.fn(),
    exportCallResources: () => ({ resources: [] }),
    scheduleSave: vi.fn(),
    externalizeStateMedia(input) {
      return {
        ...input,
        rootMedia: {
          wallpaper: input.wallpaper,
          wallpaperRef: 'media:wallpaper',
          lockScreenWallpaper: input.lockScreenWallpaper,
          lockScreenWallpaperRef: 'media:lock'
        },
        mediaEntries: new Map()
      }
    }
  }

  return { ...deps, ...overrides }
}

describe('stateBridge settings schema', () => {
  it('normalizes snapshot settings from store state', () => {
    const store = createStoreSnapshotSeed()
    store.showTokenCapsule = undefined
    store.allowAIFavorite = true
    store.allowAICall = undefined
    store.weatherLocationMode = 'unexpected'
    store.weatherRefreshMinutes = '500'
    store.timeZoneMode = ''
    store.customTimeZone = 'Invalid/Zone'
    store.sttTriggerMode = 'unexpected'
    store.sttProvider = 'unexpected'
    store.cloudSyncAutoSyncPolicy = 'custom'
    store.cloudSyncCustomMinIntervalMs = '5400000'
    store.cloudSyncCustomMinDeltaBytes = '3145728'
    store.soundConfig = {
      enabled: true,
      volume: '1.8',
      customSounds: [
        { id: 'custom_ping', name: 'Ping', source: 'data:audio/wav;base64,AAAA', size: 128 }
      ],
      events: {
        messageReceive: {
          enabled: true,
          soundId: 'missing-sound'
        }
      }
    }

    const settings = buildSnapshotSettings(store)

    expect(settings.showTokenCapsule).toBe(true)
    expect(settings.allowAIFavorite).toBe(true)
    expect(settings.allowAICall).toBe(true)
    expect(settings.weatherLocationMode).toBe('auto')
    expect(settings.weatherRefreshMinutes).toBe(360)
    expect(settings.timeZoneMode).toBe('beijing')
    expect(settings.customTimeZone).toBe('Asia/Shanghai')
    expect(settings.sttTriggerMode).toBe('auto')
    expect(settings.sttProvider).toBe('openai-compatible')
    expect(settings.cloudSyncAutoSyncPolicy).toBe('custom')
    expect(settings.cloudSyncCustomMinIntervalMs).toBe(90 * 60 * 1000)
    expect(settings.cloudSyncCustomMinDeltaBytes).toBe(3 * 1024 * 1024)
    expect(settings.soundConfig.enabled).toBe(true)
    expect(settings.soundConfig.volume).toBe(1)
    expect(settings.soundConfig.customSounds).toHaveLength(1)
    expect(settings.soundConfig.events.messageReceive.soundId).toBe('notification')
    expect(settings.toolCallingConfig.maxToolRounds).toBe(3)
  })

  it('applies normalized settings back into the store', () => {
    const store = createStoreSnapshotSeed()

    applySettingsToStore({
      configs: [{ id: 'cfg', name: 'Test' }],
      activeConfigId: 'cfg',
      values: {
        showTokenCapsule: undefined,
        allowAIFavorite: true,
        allowAICall: false,
        weatherLocationMode: 'manual',
        weatherManualCity: 'Hangzhou',
        weatherRefreshMinutes: '9',
        timeZoneMode: 'device',
        customTimeZone: 'Asia/Tokyo',
        voiceTtsMode: '',
        sttEngine: '',
        sttTriggerMode: 'manual',
        sttProvider: 'deepgram',
        cloudSyncAutoSyncPolicy: 'custom',
        cloudSyncCustomMinIntervalMs: '5400000',
        cloudSyncCustomMinDeltaBytes: '3145728',
        plannerReminderMode: '',
        allowPlannerAI: 1,
        soundConfig: {
          enabled: true,
          volume: -2,
          customSounds: [
            { id: 'custom_ping', name: 'Ping', source: 'data:audio/wav;base64,AAAA', size: 128 }
          ],
          events: {
            notification: {
              enabled: true,
              soundId: 'custom_ping'
            },
            typing: {
              enabled: true,
              soundId: 'missing'
            }
          }
        },
        voiceTtsConfig: {
          edgeEndpoint: 'https://tts.example.com'
        },
        livenessConfig: {
          heartbeatInterval: 1234
        },
        toolCallingConfig: {
          maxToolRounds: 5,
          mcpBridgeEnabled: true,
          mcpBridgeUrl: 'http://localhost:4010'
        }
      }
    }, store)

    expect(store.configs).toEqual([{ id: 'cfg', name: 'Test' }])
    expect(store.activeConfigId).toBe('cfg')
    expect(store.showTokenCapsule).toBe(true)
    expect(store.allowAIFavorite).toBe(true)
    expect(store.allowAICall).toBe(false)
    expect(store.weatherLocationMode).toBe('manual')
    expect(store.weatherManualCity).toBe('Hangzhou')
    expect(store.weatherRefreshMinutes).toBe(10)
    expect(store.timeZoneMode).toBe('device')
    expect(store.customTimeZone).toBe('Asia/Tokyo')
    expect(store.voiceTtsMode).toBe('simulated')
    expect(store.sttEngine).toBe('browser')
    expect(store.sttTriggerMode).toBe('manual')
    expect(store.sttProvider).toBe('deepgram')
    expect(store.cloudSyncAutoSyncPolicy).toBe('custom')
    expect(store.cloudSyncCustomMinIntervalMs).toBe(90 * 60 * 1000)
    expect(store.cloudSyncCustomMinDeltaBytes).toBe(3 * 1024 * 1024)
    expect(store.plannerReminderMode).toBe('toast')
    expect(store.allowPlannerAI).toBe(true)
    expect(store.soundConfig.enabled).toBe(true)
    expect(store.soundConfig.volume).toBe(0)
    expect(store.soundConfig.events.notification.soundId).toBe('custom_ping')
    expect(store.soundConfig.events.typing.soundId).toBe('type_01')
    expect(store.voiceTtsConfig.edgeEndpoint).toBe('https://tts.example.com')
    expect(store.livenessConfig.heartbeatInterval).toBe(1234)
    expect(store.toolCallingConfig.maxToolRounds).toBe(5)
    expect(store.toolCallingConfig.mcpBridgeEnabled).toBe(true)
    expect(store.toolCallingConfig.mcpBridgeUrl).toBe('http://localhost:4010')
  })

  it('builds a snapshot from registered storage modules', () => {
    const deps = createBridgeDeps()
    deps.store.allowAIFavorite = true
    deps.store.contacts = [{ id: 'contact_1', name: 'Alice', msgs: [] }]
    deps.store.personas = [{ id: 'persona_1', name: 'User Persona' }]
    deps.store.savedThemes = [{ id: 'theme_1', name: 'Warm' }]
    deps.store.meetMeetings = [{ id: 'meet_1', name: 'Cafe' }]
    deps.momentsStore.moments = [{ id: 'moment_1', content: 'Hello' }]
    deps.readerStore.exportReaderChatSessions = () => ({
      aiSessions: { session_1: { visible: false, messages: [] } },
      selectionSessions: null,
      currentSessionKey: 'book::role'
    })

    const packed = buildStorageSnapshot(deps)

    expect(packed.snapshot.version).toBe(1)
    expect(packed.snapshot.settings.allowAIFavorite).toBe(true)
    expect(packed.snapshot.contacts).toEqual(deps.store.contacts)
    expect(packed.snapshot.personas).toEqual(deps.store.personas)
    expect(packed.snapshot.savedThemes).toEqual(deps.store.savedThemes)
    expect(packed.snapshot.forum).toEqual(deps.momentsStore.moments)
    expect(packed.snapshot.meetMeetings).toEqual(deps.store.meetMeetings)
    expect(packed.snapshot.readerCurrentChatSessionKey).toBe('book::role')
    expect(deps.store.wallpaperRef).toBe('media:wallpaper')
    expect(deps.store.lockScreenWallpaperRef).toBe('media:lock')
  })

  it('applies storage modules and schedules a save after forum migration', () => {
    const deps = createBridgeDeps()
    const data = defaultAppData()
    data.settings.isDark = true
    data.contacts = [{
      id: 'contact_1',
      name: 'Alice',
      prompt: '',
      msgs: [],
      callHistory: []
    }, {
      id: 'group_1',
      type: 'group',
      name: 'Team',
      prompt: '',
      msgs: [],
      members: [{
        id: 'member_1',
        contactId: 'contact_1',
        name: 'Alice'
      }]
    }]
    data.widgets = [{ id: 'widget_1', type: 'clock' }]
    data.forumUser = {
      id: 'user_real',
      name: 'Me',
      avatar: '🙂',
      bio: 'bio'
    }
    data.forum = [{
      id: 'moment_legacy',
      title: '旧标题',
      content: '旧内容',
      authorId: 'user',
      replies: [{ id: 'reply_1', authorId: 'user' }]
    }]

    applyStorageSnapshot(data, deps)

    expect(deps.scheduleSave).toHaveBeenCalledTimes(1)
    expect(deps.store.widgets).toEqual([{ id: 'widget_1', type: 'clock' }])
    expect(deps.store.contacts[0].prompt).not.toBe('')
    expect(deps.store.contacts[0].mcpServerIds).toEqual([])
    expect(deps.store.contacts[1].mcpServerIds).toEqual([])
    expect(deps.store.contacts[1].members[0].mcpServerIds).toEqual([])
    expect(deps.store.lastDarkMode).toBe(true)
    expect(deps.momentsStore.moments[0].content).toBe('旧标题\n旧内容')
    expect(deps.momentsStore.moments[0].authorId).toBe('user_real')
    expect(deps.momentsStore.moments[0].replies[0].authorId).toBe('user_real')
  })
})
