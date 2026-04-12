import { defineStore } from 'pinia'
import { reactive } from 'vue'
import {
  createDefaultGenerationPrefs,
  normalizeGenerationPrefs
} from '../features/vn'

export const useCharacterResourcesStore = defineStore('characterResources', () => {
  // { [contactId]: { artistTags, negativePrompt, basePrompt, baseImage, expressions, customExpressions, generationPrefs, updatedAt } }
  const resources = reactive({})

  function createDefaultEntry() {
    return {
      artistTags: '',
      negativePrompt: '',
      basePrompt: '',
      baseImage: null,
      expressions: {},
      customExpressions: ['normal', 'happy', 'sad', 'angry', 'surprised', 'shy'],
      generationPrefs: createDefaultGenerationPrefs(),
      updatedAt: 0
    }
  }

  function normalizeEntry(raw) {
    const defaults = createDefaultEntry()
    const entry = raw && typeof raw === 'object' ? { ...raw } : {}
    return {
      ...defaults,
      ...entry,
      artistTags: String(entry.artistTags || ''),
      negativePrompt: String(entry.negativePrompt || ''),
      basePrompt: String(entry.basePrompt || ''),
      baseImage: entry.baseImage && typeof entry.baseImage === 'object' ? entry.baseImage : null,
      expressions: entry.expressions && typeof entry.expressions === 'object' ? entry.expressions : {},
      customExpressions: Array.isArray(entry.customExpressions) && entry.customExpressions.length > 0
        ? entry.customExpressions.map((value) => String(value || '').trim()).filter(Boolean)
        : defaults.customExpressions,
      generationPrefs: normalizeGenerationPrefs(entry.generationPrefs),
      updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0
    }
  }

  function ensureEntry(contactId) {
    if (!resources[contactId]) {
      resources[contactId] = createDefaultEntry()
    } else {
      resources[contactId] = normalizeEntry(resources[contactId])
    }
    return resources[contactId]
  }

  function getSprite(contactId, expression) {
    const entry = resources[contactId]
    if (!entry) return null
    if (expression === 'normal' || !expression) {
      return entry.baseImage?.url || null
    }
    return entry.expressions?.[expression]?.url || entry.baseImage?.url || null
  }

  function getEntry(contactId) {
    return resources[contactId] || null
  }

  function setBaseImage(contactId, data) {
    const entry = ensureEntry(contactId)
    entry.baseImage = data
    entry.updatedAt = Date.now()
  }

  function setExpression(contactId, exprName, data) {
    const entry = ensureEntry(contactId)
    entry.expressions[exprName] = data
    entry.updatedAt = Date.now()
  }

  function removeExpression(contactId, exprName) {
    const entry = resources[contactId]
    if (!entry) return
    delete entry.expressions[exprName]
    entry.updatedAt = Date.now()
  }

  function updateCharacterConfig(contactId, patch) {
    const entry = ensureEntry(contactId)
    if ('artistTags' in patch) entry.artistTags = patch.artistTags
    if ('negativePrompt' in patch) entry.negativePrompt = patch.negativePrompt
    if ('basePrompt' in patch) entry.basePrompt = patch.basePrompt
    if ('customExpressions' in patch) entry.customExpressions = patch.customExpressions
    if ('generationPrefs' in patch) entry.generationPrefs = normalizeGenerationPrefs(patch.generationPrefs)
    entry.updatedAt = Date.now()
  }

  function removeCharacter(contactId) {
    delete resources[contactId]
  }

  function exportData() {
    return JSON.parse(JSON.stringify(resources))
  }

  function importData(data) {
    if (!data || typeof data !== 'object') return
    Object.keys(resources).forEach((key) => delete resources[key])
    Object.keys(data).forEach((contactId) => {
      resources[contactId] = normalizeEntry(data[contactId])
    })
  }

  return {
    resources,
    ensureEntry,
    getSprite,
    getEntry,
    setBaseImage,
    setExpression,
    removeExpression,
    updateCharacterConfig,
    removeCharacter,
    exportData,
    importData
  }
})
