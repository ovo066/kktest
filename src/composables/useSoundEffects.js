import { watch } from 'vue'
import { Howl, Howler } from 'howler'
import { useChatStore } from '../stores/chat'
import { useSettingsStore } from '../stores/settings'
import { useStorage } from './useStorage'
import {
  MAX_CUSTOM_SOUND_COUNT,
  MAX_CUSTOM_SOUND_SIZE_BYTES,
  findCustomSoundById,
  getKitDefinition,
  getKitSprite,
  getSoundEventDefinition,
  isBuiltinSoundId,
  normalizeSoundConfig,
  normalizeKitId
} from '../utils/soundEffects'

let sharedApi = null

function makeCustomSoundId() {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取音效文件失败'))
    reader.readAsDataURL(file)
  })
}

export function useSoundEffects() {
  if (sharedApi) return sharedApi

  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()
  const { scheduleSave } = useStorage()

  // Kit sprite Howl instances (one per kit, lazily loaded)
  const kitHowls = new Map()
  // Custom sound Howl instances
  const customHowlCache = new Map()

  const eventLastPlayedAt = new Map()
  let stopTypingWatch = null
  let runtimeStarted = false
  let interactionListenersBound = false

  function getConfig() {
    return normalizeSoundConfig(settingsStore.soundConfig)
  }

  function applyConfig(nextConfig, saveOptions = {}) {
    settingsStore.soundConfig = normalizeSoundConfig(nextConfig)
    cleanupUnusedCustomHowls()
    scheduleSave(saveOptions)
    return settingsStore.soundConfig
  }

  function updateConfig(mutator, saveOptions = {}) {
    const current = getConfig()
    const next = typeof mutator === 'function'
      ? mutator(current)
      : { ...current, ...(mutator || {}) }
    return applyConfig(next, saveOptions)
  }

  // ---- Audio context ----

  function resumeAudioContext() {
    try {
      const ctx = Howler.ctx
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume()
      }
    } catch {
      // Ignore unlock errors
    }
  }

  function bindInteractionListeners() {
    if (interactionListenersBound || typeof document === 'undefined') return
    interactionListenersBound = true
    document.addEventListener('pointerdown', resumeAudioContext, { capture: true, passive: true })
    document.addEventListener('keydown', resumeAudioContext, { capture: true })
  }

  function unbindInteractionListeners() {
    if (!interactionListenersBound || typeof document === 'undefined') return
    interactionListenersBound = false
    document.removeEventListener('pointerdown', resumeAudioContext, { capture: true })
    document.removeEventListener('keydown', resumeAudioContext, { capture: true })
  }

  // ---- Kit sprite Howl management ----

  function getOrCreateKitHowl(kitId) {
    const id = normalizeKitId(kitId)
    if (kitHowls.has(id)) return kitHowls.get(id)

    const kit = getKitDefinition(id)
    const howl = new Howl({
      src: [kit.spriteUrl],
      sprite: getKitSprite(id),
      preload: true,
      html5: false,
      volume: getConfig().volume
    })

    kitHowls.set(id, howl)
    return howl
  }

  function playKitSound(kitId, soundName, volume) {
    resumeAudioContext()
    try {
      const howl = getOrCreateKitHowl(kitId)
      howl.volume(volume)
      howl.play(soundName)
      return true
    } catch {
      return false
    }
  }

  // ---- Custom sound Howl management ----

  function getCustomHowl(soundId, source) {
    const cached = customHowlCache.get(soundId)
    if (cached && cached.source === source) return cached.howl

    if (cached) {
      cached.howl.unload()
      customHowlCache.delete(soundId)
    }

    const howl = new Howl({
      src: [source],
      preload: true,
      html5: false,
      volume: getConfig().volume
    })

    customHowlCache.set(soundId, { howl, source })
    return howl
  }

  function playCustomSound(soundId, source, volume) {
    resumeAudioContext()
    try {
      const howl = getCustomHowl(soundId, source)
      howl.volume(volume)
      howl.play()
      return true
    } catch {
      return false
    }
  }

  function cleanupUnusedCustomHowls() {
    const config = getConfig()
    const validIds = new Set([
      ...Object.values(config.events || {}).map((e) => String(e?.soundId || '').trim()).filter(Boolean),
      ...config.customSounds.map((item) => item.id)
    ])

    customHowlCache.forEach((entry, soundId) => {
      if (validIds.has(soundId)) return
      entry.howl.unload()
      customHowlCache.delete(soundId)
    })
  }

  // ---- Public playback API ----

  function playSoundById(soundId, options = {}) {
    const config = getConfig()
    const volume = Math.max(0, Math.min(1, Number(options.volume ?? config.volume) || config.volume))

    // Built-in kit sound
    if (isBuiltinSoundId(soundId)) {
      return playKitSound(config.kit, soundId, volume)
    }

    // Custom sound
    const custom = findCustomSoundById(soundId, config.customSounds)
    if (custom?.source) {
      return playCustomSound(custom.id, custom.source, volume)
    }

    return false
  }

  function playEvent(eventKey, options = {}) {
    const config = getConfig()
    const eventConfig = config.events?.[eventKey]
    const definition = getSoundEventDefinition(eventKey)
    if (!definition || !eventConfig) return false

    if (!options.force && !config.enabled) return false
    if (!options.force && eventConfig.enabled === false) return false

    const cooldownMs = Math.max(0, Number(definition.cooldownMs || 0) || 0)
    const now = Date.now()
    const lastPlayedAt = Number(eventLastPlayedAt.get(eventKey) || 0)
    if (!options.force && cooldownMs > 0 && (now - lastPlayedAt) < cooldownMs) return false

    const played = playSoundById(options.soundId || eventConfig.soundId, {
      volume: options.volume ?? config.volume
    })
    if (played) {
      eventLastPlayedAt.set(eventKey, now)
    }
    return played
  }

  function previewSound(soundId) {
    return playSoundById(soundId, { force: true })
  }

  // ---- Config setters ----

  function setEnabled(enabled) {
    updateConfig((current) => ({ ...current, enabled: !!enabled }))
  }

  function setVolume(volume) {
    updateConfig((current) => ({
      ...current,
      volume: Math.max(0, Math.min(1, Number(volume) || 0))
    }))
  }

  function setKit(kitId) {
    const id = normalizeKitId(kitId)
    updateConfig((current) => ({ ...current, kit: id }))
    // Preload the new kit
    getOrCreateKitHowl(id)
  }

  function setEventEnabled(eventKey, enabled) {
    if (!getSoundEventDefinition(eventKey)) return
    updateConfig((current) => ({
      ...current,
      events: {
        ...current.events,
        [eventKey]: { ...(current.events?.[eventKey] || {}), enabled: !!enabled }
      }
    }))
  }

  function setEventSound(eventKey, soundId) {
    if (!getSoundEventDefinition(eventKey)) return
    updateConfig((current) => ({
      ...current,
      events: {
        ...current.events,
        [eventKey]: { ...(current.events?.[eventKey] || {}), soundId: String(soundId || '').trim() }
      }
    }))
  }

  // ---- Custom sound management ----

  async function addCustomSoundFromFile(file) {
    if (!file) return { ok: false, error: '未选择文件' }
    if (!String(file.type || '').startsWith('audio/')) {
      return { ok: false, error: '只支持音频文件' }
    }
    if (Number(file.size || 0) > MAX_CUSTOM_SOUND_SIZE_BYTES) {
      return { ok: false, error: '音效文件过大，请控制在 1 MB 以内' }
    }
    if (getConfig().customSounds.length >= MAX_CUSTOM_SOUND_COUNT) {
      return { ok: false, error: `最多只能保存 ${MAX_CUSTOM_SOUND_COUNT} 个自定义音效` }
    }

    const source = await readFileAsDataUrl(file)
    if (!source) return { ok: false, error: '读取音效文件失败' }

    const name = String(file.name || '自定义音效').replace(/\.[^.]+$/, '').trim() || '自定义音效'
    const item = {
      id: makeCustomSoundId(),
      name,
      source,
      mimeType: String(file.type || ''),
      size: Math.max(0, Number(file.size || 0) || 0),
      createdAt: Date.now()
    }

    updateConfig((current) => ({
      ...current,
      customSounds: [...current.customSounds, item]
    }), { urgent: true })

    return { ok: true, item }
  }

  function renameCustomSound(soundId, name) {
    const nextName = String(name || '').trim() || '自定义音效'
    updateConfig((current) => ({
      ...current,
      customSounds: current.customSounds.map((item) => (
        item.id === soundId ? { ...item, name: nextName } : item
      ))
    }))
  }

  function removeCustomSound(soundId) {
    const soundKey = String(soundId || '').trim()
    if (!soundKey) return

    const cached = customHowlCache.get(soundKey)
    if (cached) {
      cached.howl.unload()
      customHowlCache.delete(soundKey)
    }

    updateConfig((current) => ({
      ...current,
      customSounds: current.customSounds.filter((item) => item.id !== soundKey)
    }), { urgent: true })
  }

  // ---- Runtime lifecycle ----

  function startRuntime() {
    if (runtimeStarted) return
    runtimeStarted = true
    bindInteractionListeners()

    // Preload the active kit
    const config = getConfig()
    getOrCreateKitHowl(config.kit)

    stopTypingWatch = watch(
      () => chatStore.ui.isTyping,
      (typing, previous) => {
        if (typing && !previous) {
          playEvent('typing')
        }
      }
    )
  }

  function cleanup() {
    if (stopTypingWatch) {
      stopTypingWatch()
      stopTypingWatch = null
    }
    runtimeStarted = false
    unbindInteractionListeners()

    kitHowls.forEach((howl) => howl.unload())
    kitHowls.clear()
    customHowlCache.forEach((entry) => entry.howl.unload())
    customHowlCache.clear()
    eventLastPlayedAt.clear()
  }

  sharedApi = {
    addCustomSoundFromFile,
    cleanup,
    playEvent,
    previewSound,
    removeCustomSound,
    renameCustomSound,
    setEnabled,
    setEventEnabled,
    setEventSound,
    setKit,
    setVolume,
    startRuntime,
    updateConfig
  }

  return sharedApi
}
