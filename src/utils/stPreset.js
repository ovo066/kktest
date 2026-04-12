import { clampNumber, parseOptionalInteger } from './presetNormalization'
import { collectImportedRegexRules, normalizeOfflineRegexRules } from './offlineRegex'

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase()
  if (raw === 'user' || raw === 'assistant' || raw === 'system') return raw
  return 'system'
}

function sanitizeId(value, fallback) {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  return raw.replace(/[^\w-]/g, '_')
}

function resolvePromptOrderList(rawPreset) {
  const promptOrder = Array.isArray(rawPreset?.prompt_order)
    ? rawPreset.prompt_order
    : (Array.isArray(rawPreset?.promptOrder) ? rawPreset.promptOrder : [])

  if (promptOrder.length === 0) return []

  // Some exports store order directly as [{ identifier, enabled }]
  if (promptOrder.some(item => item && typeof item === 'object' && (item.identifier || item.id))) {
    return promptOrder
  }

  // Some exports store order as [{ character_id, order: [...] }]
  const preferred = promptOrder.find(item =>
    item &&
    Array.isArray(item.order) &&
    String(item.character_id || item.characterId || '') === '100001'
  ) || promptOrder.find(item => item && Array.isArray(item.order))

  return Array.isArray(preferred?.order) ? preferred.order : []
}

function buildPromptOrderMap(rawPreset) {
  const map = new Map()
  const orderList = resolvePromptOrderList(rawPreset)
  orderList.forEach((item, idx) => {
    const identifier = String(item?.identifier || item?.id || '').trim()
    if (!identifier) return
    map.set(identifier, {
      enabled: item?.enabled !== false,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : idx
    })
  })
  return map
}

function getRawPromptEntries(rawPreset) {
  if (Array.isArray(rawPreset?.prompts)) return rawPreset.prompts
  if (Array.isArray(rawPreset?.prompt_entries)) return rawPreset.prompt_entries
  if (rawPreset?.prompts && typeof rawPreset.prompts === 'object') {
    return Object.values(rawPreset.prompts)
  }
  return []
}

function normalizePromptEntry(entry, idx, orderMap) {
  if (!entry || typeof entry !== 'object') return null

  const identifier = sanitizeId(
    entry.identifier || entry.id || entry.key || entry.name,
    `entry_${idx + 1}`
  )
  const orderInfo = orderMap.get(identifier)
  const content = firstString(entry.content, entry.text, entry.value, entry.prompt, entry.template)
  if (!content) return null

  return {
    id: `entry_${idx + 1}_${identifier}`,
    identifier,
    name: firstString(entry.name, entry.title, identifier) || identifier,
    role: normalizeRole(entry.role),
    content,
    enabled: orderInfo ? orderInfo.enabled : entry.enabled !== false,
    injectionDepth: clampNumber(
      entry.injection_depth ?? entry.injectionDepth ?? entry.insert_depth ?? entry.depth,
      0,
      { min: -50, max: 50, integer: true }
    ),
    injectionPosition: firstString(entry.injection_position, entry.injectionPosition, entry.position) || 'in_chat',
    order: orderInfo ? orderInfo.order : clampNumber(entry.order, idx, { min: -999, max: 999, integer: true })
  }
}

function toPresetData(rawPreset, index) {
  if (!rawPreset || typeof rawPreset !== 'object') return null

  const orderMap = buildPromptOrderMap(rawPreset)
  const promptEntries = getRawPromptEntries(rawPreset)
    .map((entry, idx) => normalizePromptEntry(entry, idx, orderMap))
    .filter(Boolean)

  const systemPrompt = firstString(rawPreset.system_prompt, rawPreset.systemPrompt)
  const jailbreakPrompt = firstString(rawPreset.jailbreak_prompt, rawPreset.jailbreakPrompt)
  const hasPromptEntries = promptEntries.length > 0
  const hasCorePrompt = !!(systemPrompt || jailbreakPrompt)
  if (!hasPromptEntries && !hasCorePrompt) return null

  const name = firstString(rawPreset.name, rawPreset.preset_name, rawPreset.title) || `ST Preset ${index + 1}`

  return {
    name,
    source: 'sillytavern',
    systemPrompt,
    jailbreakPrompt,
    temperature: clampNumber(rawPreset.temperature, 0.8, { min: 0, max: 2 }),
    maxTokens: parseOptionalInteger(rawPreset.max_tokens ?? rawPreset.max_length ?? rawPreset.maxTokens),
    topP: clampNumber(rawPreset.top_p ?? rawPreset.topP, 1, { min: 0, max: 1 }),
    frequencyPenalty: clampNumber(rawPreset.frequency_penalty ?? rawPreset.frequencyPenalty, 0, { min: -2, max: 2 }),
    presencePenalty: clampNumber(rawPreset.presence_penalty ?? rawPreset.presencePenalty, 0, { min: -2, max: 2 }),
    promptEntries
  }
}

function extractPresetCandidates(payload) {
  if (Array.isArray(payload)) {
    return payload.map(candidate => ({
      candidate,
      container: candidate
    }))
  }
  if (!payload || typeof payload !== 'object') return []

  const candidates = []
  if (Array.isArray(payload.presets)) {
    candidates.push(...payload.presets.map(candidate => ({ candidate, container: payload })))
  }
  if (Array.isArray(payload.data?.presets)) {
    candidates.push(...payload.data.presets.map(candidate => ({ candidate, container: payload.data })))
  }
  if (Array.isArray(payload.items)) {
    candidates.push(...payload.items.map(candidate => ({ candidate, container: payload })))
  }
  if (payload.preset && typeof payload.preset === 'object') {
    candidates.push({ candidate: payload.preset, container: payload })
  }

  if (candidates.length > 0) return candidates
  return [{
    candidate: payload,
    container: payload
  }]
}

function attachBundledRegex(payload, wrappers) {
  const rootRegexRules = normalizeOfflineRegexRules(collectImportedRegexRules(payload))

  return wrappers.map((wrapper, idx) => {
    const preset = toPresetData(wrapper?.candidate, idx)
    if (!preset) return null

    const candidateRegexRules = normalizeOfflineRegexRules(
      collectImportedRegexRules(wrapper?.candidate)
    )
    let regexRules = candidateRegexRules

    if (regexRules.length === 0 && wrapper?.container && wrapper.container !== wrapper.candidate) {
      regexRules = normalizeOfflineRegexRules(collectImportedRegexRules(wrapper.container))
    }

    if (regexRules.length === 0 && rootRegexRules.length > 0) {
      regexRules = rootRegexRules
    }

    return {
      ...preset,
      regexRules
    }
  }).filter(Boolean)
}

export function parseSTPresetPayload(payload) {
  return extractPresetCandidates(payload)
    .map((wrapper, idx) => toPresetData(wrapper?.candidate, idx))
    .filter(Boolean)
}

export function parseSTPresetImportPayload(payload) {
  return attachBundledRegex(payload, extractPresetCandidates(payload))
}

export function summarizeSTPresetPayload(payload) {
  const presets = parseSTPresetImportPayload(payload)
  const totalEntries = presets.reduce((sum, preset) => sum + (preset.promptEntries?.length || 0), 0)
  const promptPresetCount = presets.filter(preset => (preset.promptEntries?.length || 0) > 0).length
  const totalRegexRules = presets.reduce((sum, preset) => sum + (preset.regexRules?.length || 0), 0)

  return {
    valid: presets.length > 0,
    presetCount: presets.length,
    promptPresetCount,
    totalEntries,
    totalRegexRules,
    names: presets.slice(0, 6).map(preset => preset.name)
  }
}
