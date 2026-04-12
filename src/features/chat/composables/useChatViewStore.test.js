import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../../stores/settings'
import { useChatViewStore } from './useChatViewStore'

describe('useChatViewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('proxies allowAIImageGeneration from settings store', () => {
    const settingsStore = useSettingsStore()
    settingsStore.allowAIImageGeneration = true

    const chatViewStore = useChatViewStore()
    expect(chatViewStore.allowAIImageGeneration).toBe(true)

    chatViewStore.allowAIImageGeneration = false
    expect(settingsStore.allowAIImageGeneration).toBe(false)
  })

  it('proxies allowPlannerAI from settings store', () => {
    const settingsStore = useSettingsStore()
    settingsStore.allowPlannerAI = true

    const chatViewStore = useChatViewStore()
    expect(chatViewStore.allowPlannerAI).toBe(true)

    chatViewStore.allowPlannerAI = false
    expect(settingsStore.allowPlannerAI).toBe(false)
  })

  it('proxies allowAIPlannerCapture from settings store', () => {
    const settingsStore = useSettingsStore()
    settingsStore.allowAIPlannerCapture = true

    const chatViewStore = useChatViewStore()
    expect(chatViewStore.allowAIPlannerCapture).toBe(true)

    chatViewStore.allowAIPlannerCapture = false
    expect(settingsStore.allowAIPlannerCapture).toBe(false)
  })
})
