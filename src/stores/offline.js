import { defineStore } from 'pinia'
import { ref } from 'vue'
import { makeId } from '../utils/id'
import { clampNumber, normalizePromptEntries, parseOptionalInteger } from '../utils/presetNormalization'
import { normalizeOfflineRegexRules } from '../utils/offlineRegex'

const DEFAULT_OFFLINE_THEME = 'ttk'
const DEFAULT_OFFLINE_LAYOUT = 'classic'
const DEFAULT_OFFLINE_AVATAR_MODE = 'side'

const OFFLINE_THEME_IDS = new Set([DEFAULT_OFFLINE_THEME])
const OFFLINE_LAYOUT_IDS = new Set([DEFAULT_OFFLINE_LAYOUT, 'st', 'floor'])
const OFFLINE_AVATAR_MODE_IDS = new Set([DEFAULT_OFFLINE_AVATAR_MODE, 'top', 'hidden'])

const DEFAULT_THEME_CONFIG = Object.freeze({
  customCss: '',
  fontFamily: '',
  fontImport: ''
})

function cloneThemeConfig(source = DEFAULT_THEME_CONFIG) {
  const src = source && typeof source === 'object' ? source : DEFAULT_THEME_CONFIG
  return {
    customCss: String(src.customCss || ''),
    fontFamily: String(src.fontFamily || '').trim(),
    fontImport: String(src.fontImport || '').trim()
  }
}

function normalizePreset(rawPreset = {}) {
  const source = rawPreset && typeof rawPreset === 'object' ? rawPreset : {}
  return {
    id: String(source.id || makeId('preset')),
    name: String(source.name || '新预设').trim() || '新预设',
    source: source.source || 'custom',
    systemPrompt: String(source.systemPrompt || ''),
    jailbreakPrompt: String(source.jailbreakPrompt || ''),
    temperature: clampNumber(source.temperature, 0.8, { min: 0, max: 2 }),
    maxTokens: parseOptionalInteger(source.maxTokens, { min: 1, max: 65535, clamp: true }),
    topP: clampNumber(source.topP, 1.0, { min: 0, max: 1 }),
    frequencyPenalty: clampNumber(source.frequencyPenalty, 0, { min: -2, max: 2 }),
    presencePenalty: clampNumber(source.presencePenalty, 0, { min: -2, max: 2 }),
    promptEntries: normalizePromptEntries(source.promptEntries),
    regexRules: normalizeOfflineRegexRules(source.regexRules)
  }
}

export const useOfflineStore = defineStore('offline', () => {
  const presets = ref([])
  const activePresetId = ref(null)
  const regexRules = ref([])
  const theme = ref(DEFAULT_OFFLINE_THEME)
  const layout = ref(DEFAULT_OFFLINE_LAYOUT)
  const avatarMode = ref(DEFAULT_OFFLINE_AVATAR_MODE)
  const themeConfig = ref(cloneThemeConfig(DEFAULT_THEME_CONFIG))

  function createPreset(data = {}) {
    const preset = normalizePreset({ ...data, id: data.id || makeId('preset') })
    presets.value.push(preset)
    return preset
  }

  function updatePreset(presetId, patch = {}) {
    const p = presets.value.find(x => x.id === presetId)
    if (!p) return false
    const nextPatch = { ...patch }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'maxTokens')) {
      nextPatch.maxTokens = parseOptionalInteger(nextPatch.maxTokens, { min: 1, max: 65535, clamp: true })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'promptEntries')) {
      nextPatch.promptEntries = normalizePromptEntries(nextPatch.promptEntries)
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'temperature')) {
      nextPatch.temperature = clampNumber(nextPatch.temperature, p.temperature ?? 0.8, { min: 0, max: 2 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'topP')) {
      nextPatch.topP = clampNumber(nextPatch.topP, p.topP ?? 1, { min: 0, max: 1 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'frequencyPenalty')) {
      nextPatch.frequencyPenalty = clampNumber(nextPatch.frequencyPenalty, p.frequencyPenalty ?? 0, { min: -2, max: 2 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'presencePenalty')) {
      nextPatch.presencePenalty = clampNumber(nextPatch.presencePenalty, p.presencePenalty ?? 0, { min: -2, max: 2 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'regexRules')) {
      nextPatch.regexRules = normalizeOfflineRegexRules(nextPatch.regexRules)
    }
    Object.assign(p, nextPatch)
    return true
  }

  function deletePreset(presetId) {
    const idx = presets.value.findIndex(p => p.id === presetId)
    if (idx !== -1) presets.value.splice(idx, 1)
    if (activePresetId.value === presetId) activePresetId.value = null
  }

  function getPreset(presetId) {
    return presets.value.find(p => p.id === presetId) || null
  }

  function setActivePreset(presetId) {
    const nextId = typeof presetId === 'string' ? presetId.trim() : ''
    if (!nextId) {
      activePresetId.value = null
      return true
    }
    if (!presets.value.some(p => p.id === nextId)) {
      activePresetId.value = null
      return false
    }
    activePresetId.value = nextId
    return true
  }

  function setTheme(themeId) {
    const id = String(themeId || '').trim()
    theme.value = OFFLINE_THEME_IDS.has(id) ? id : DEFAULT_OFFLINE_THEME
  }

  function setLayout(layoutId) {
    const id = String(layoutId || '').trim()
    layout.value = OFFLINE_LAYOUT_IDS.has(id) ? id : DEFAULT_OFFLINE_LAYOUT
  }

  function setAvatarMode(modeId) {
    const id = String(modeId || '').trim()
    avatarMode.value = OFFLINE_AVATAR_MODE_IDS.has(id) ? id : DEFAULT_OFFLINE_AVATAR_MODE
  }

  function setThemeConfig(config) {
    themeConfig.value = cloneThemeConfig(config)
  }

  function exportData() {
    return JSON.parse(JSON.stringify({
      presets: presets.value,
      activePresetId: activePresetId.value || null,
      regexRules: regexRules.value,
      theme: theme.value,
      layout: layout.value,
      avatarMode: avatarMode.value,
      themeConfig: cloneThemeConfig(themeConfig.value)
    }))
  }

  function importData(data) {
    // Backward compatibility: old data only stored preset array.
    if (Array.isArray(data)) {
      presets.value = data.map(preset => normalizePreset(preset))
      if (activePresetId.value && !presets.value.some(p => p.id === activePresetId.value)) {
        activePresetId.value = null
      }
      return
    }
    if (!data || typeof data !== 'object') return
    if (Array.isArray(data.presets)) {
      presets.value = data.presets.map(preset => normalizePreset(preset))
    }
    setActivePreset(data.activePresetId)
    regexRules.value = normalizeOfflineRegexRules(data.regexRules)
    setTheme(data.theme)
    setLayout(data.layout)
    setAvatarMode(data.avatarMode)
    setThemeConfig(data.themeConfig)
    if (activePresetId.value && !presets.value.some(p => p.id === activePresetId.value)) {
      activePresetId.value = null
    }
  }

  return {
    presets,
    activePresetId,
    regexRules,
    theme,
    layout,
    avatarMode,
    themeConfig,
    createPreset,
    updatePreset,
    deletePreset,
    getPreset,
    setActivePreset,
    setTheme,
    setLayout,
    setAvatarMode,
    setThemeConfig,
    exportData,
    importData
  }
})
