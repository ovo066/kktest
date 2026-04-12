import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCloudSyncSettingsStore } from './settingsCloudSync'
import { useLivenessSettingsStore } from './settingsLiveness'
import { useSettingsStore } from './settings'
import { useThemeStore } from './settingsTheme'
import { useVoiceStore } from './settingsVoice'

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes theme library state required by chat and storage adapters', () => {
    const store = useSettingsStore()

    expect(store.theme).toBeTruthy()
    expect(Array.isArray(store.savedThemes)).toBe(true)
    expect(typeof store.activeThemeId).toBe('string')

    store.theme.showWatermark = false
    expect(store.theme.showWatermark).toBe(false)
  })

  it('keeps legacy child stores wired to the main settings source of truth', () => {
    const settingsStore = useSettingsStore()
    const voiceStore = useVoiceStore()
    const livenessStore = useLivenessSettingsStore()
    const cloudSyncStore = useCloudSyncSettingsStore()

    settingsStore.voiceTtsMode = 'edge'
    settingsStore.allowLivenessEngine = true
    settingsStore.cloudSyncEnabled = true

    expect(voiceStore.voiceTtsMode).toBe('edge')
    expect(livenessStore.allowLivenessEngine).toBe(true)
    expect(cloudSyncStore.cloudSyncEnabled).toBe(true)

    voiceStore.sttApiKey = 'test-key'
    livenessStore.livenessConfig = { ...livenessStore.livenessConfig, pushEnabled: true }
    cloudSyncStore.cloudSyncDeviceId = 'device-1'

    expect(settingsStore.sttApiKey).toBe('test-key')
    expect(settingsStore.livenessConfig.pushEnabled).toBe(true)
    expect(settingsStore.cloudSyncDeviceId).toBe('device-1')
  })

  it('keeps proxied theme library state synced with the theme store', () => {
    const settingsStore = useSettingsStore()
    const themeStore = useThemeStore()

    settingsStore.savedThemes = [{ id: 'theme_1', name: 'Warm', data: {}, createdAt: 1 }]
    settingsStore.activeThemeId = 'theme_1'

    expect(themeStore.savedThemes).toEqual(settingsStore.savedThemes)
    expect(themeStore.activeThemeId).toBe('theme_1')

    themeStore.savedThemes = [{ id: 'theme_2', name: 'Cool', data: {}, createdAt: 2 }]
    themeStore.activeThemeId = 'theme_2'

    expect(settingsStore.savedThemes).toEqual(themeStore.savedThemes)
    expect(settingsStore.activeThemeId).toBe('theme_2')

    const themeId = settingsStore.saveThemeAs('Saved from settings')

    expect(themeStore.activeThemeId).toBe(themeId)
    expect(settingsStore.activeThemeId).toBe(themeId)
    expect(settingsStore.savedThemes.at(-1)?.name).toBe('Saved from settings')
    expect(themeStore.savedThemes.at(-1)?.name).toBe('Saved from settings')
  })
})
