export const MAX_REFERENCE_LONG_SIDE = 1024
export const MAX_VIBE_REFERENCES = 16

export function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  if (number < min) return min
  if (number > max) return max
  return number
}

export function clampSeed(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.max(0, Math.min(4294967295, Math.round(number)))
}

export function normalizeCharacterRefMode(value, fallback = 'character_style') {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return fallback
  if (text === 'character' || text === 'character_only') return 'character_only'
  if (text === 'character&style' || text === 'character_and_style' || text === 'character_style') return 'character_style'
  return fallback
}

export function newVibeId() {
  return `vibe_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

export function normalizeStrengths(values, maxTotal = 1) {
  const list = Array.isArray(values) ? values.map((value) => clampNumber(value, 0, 1, 0)) : []
  const sum = list.reduce((acc, value) => acc + value, 0)
  if (sum <= 0 || sum <= maxTotal) return list
  const factor = maxTotal / sum
  return list.map((value) => clampNumber(value * factor, 0, 1, 0))
}

export function createDefaultGenerationPrefs() {
  return {
    fixedSeedEnabled: false,
    fixedSeed: null,
    reuseBaseSeedForExpressions: true,
    keepArtistTagsOnNonCharacterImage: false,
    characterRefEnabled: false,
    characterRefImage: '',
    characterRefImageRef: '',
    characterRefStrength: 0.65,
    characterRefFidelity: 0.5,
    characterRefMode: 'character_style',
    vibeReferences: []
  }
}

function normalizeVibeReference(item, fallbackIdFactory = newVibeId) {
  if (!item || typeof item !== 'object') return null
  const image = String(item.image || '').trim()
  if (!image) return null
  return {
    id: String(item.id || fallbackIdFactory()),
    image,
    imageRef: String(item.imageRef || '').trim(),
    strength: clampNumber(item.strength, 0, 1, 0.65),
    informationExtracted: clampNumber(item.informationExtracted, 0, 1, 1)
  }
}

export function normalizeGenerationPrefs(raw, options = {}) {
  const createId = typeof options.createId === 'function' ? options.createId : newVibeId
  const defaults = createDefaultGenerationPrefs()
  const prefs = raw && typeof raw === 'object' ? raw : {}
  const characterRefFidelitySource = prefs.characterRefFidelity !== undefined
    ? prefs.characterRefFidelity
    : prefs.characterRefInfoExtracted

  return {
    ...defaults,
    fixedSeedEnabled: !!prefs.fixedSeedEnabled,
    fixedSeed: clampSeed(prefs.fixedSeed),
    reuseBaseSeedForExpressions: prefs.reuseBaseSeedForExpressions !== false,
    keepArtistTagsOnNonCharacterImage: !!prefs.keepArtistTagsOnNonCharacterImage,
    characterRefEnabled: !!prefs.characterRefEnabled,
    characterRefImage: String(prefs.characterRefImage || '').trim(),
    characterRefImageRef: String(prefs.characterRefImageRef || '').trim(),
    characterRefStrength: clampNumber(prefs.characterRefStrength, 0, 1, defaults.characterRefStrength),
    characterRefFidelity: clampNumber(characterRefFidelitySource, 0, 1, defaults.characterRefFidelity),
    characterRefMode: normalizeCharacterRefMode(
      prefs.characterRefMode !== undefined
        ? prefs.characterRefMode
        : (prefs.characterRefStyleAware === false ? 'character_only' : defaults.characterRefMode),
      defaults.characterRefMode
    ),
    vibeReferences: Array.isArray(prefs.vibeReferences)
      ? prefs.vibeReferences.map((item) => normalizeVibeReference(item, createId)).filter(Boolean)
      : []
  }
}

export function snapshotGenerationPrefs(raw, options = {}) {
  const normalized = normalizeGenerationPrefs(raw, options)
  return {
    ...normalized,
    fixedSeed: normalized.fixedSeedEnabled ? normalized.fixedSeed : null
  }
}

export function randomSeed(randomFn = Math.random) {
  const candidate = Number(randomFn())
  const safeValue = Number.isFinite(candidate) ? candidate : Math.random()
  return Math.floor(Math.max(0, Math.min(0.9999999999999999, safeValue)) * 4294967295)
}

export function resolveBaseSeed(generationPrefs, randomFn = Math.random) {
  const fixedSeed = snapshotGenerationPrefs(generationPrefs).fixedSeed
  return fixedSeed ?? randomSeed(randomFn)
}

export function resolveExpressionSeed(generationPrefs, baseSeed, randomFn = Math.random) {
  const normalized = snapshotGenerationPrefs(generationPrefs)
  if (normalized.fixedSeed !== null) return normalized.fixedSeed
  if (normalized.reuseBaseSeedForExpressions) {
    const reusedSeed = clampSeed(baseSeed)
    if (reusedSeed !== null) return reusedSeed
  }
  return randomSeed(randomFn)
}
