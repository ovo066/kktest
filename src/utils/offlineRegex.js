import { clampNumber } from './presetNormalization'
import { makeId } from './id'

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function firstStringValue(...values) {
  for (const value of values) {
    if (typeof value === 'string') return value
  }
  return ''
}

export function parseRegexLiteral(rawPattern, rawFlags) {
  const source = String(rawPattern || '').trim()
  let flags = String(rawFlags || '').trim()
  if (!source) return { pattern: '', flags: 'gi' }

  if (source.startsWith('/') && source.length > 1) {
    for (let i = source.length - 1; i > 0; i -= 1) {
      if (source[i] !== '/' || source[i - 1] === '\\') continue
      const body = source.slice(1, i)
      const trailingFlags = source.slice(i + 1).trim()
      if (!flags && /^[dgimsuvy]*$/.test(trailingFlags)) {
        return { pattern: body, flags: trailingFlags || 'gi' }
      }
      return { pattern: body, flags: /^[dgimsuvy]*$/.test(flags) ? flags : 'gi' }
    }
  }

  return { pattern: source, flags: /^[dgimsuvy]*$/.test(flags) ? flags : 'gi' }
}

export function normalizeRegexScope(rawRule) {
  const explicit = String(rawRule?.scope || '').trim().toLowerCase()
  if (explicit === 'display' || explicit === 'prompt' || explicit === 'both') return explicit

  if (rawRule?.promptOnly === true) return 'prompt'
  if (rawRule?.displayOnly === true || rawRule?.markdownOnly === true) return 'display'

  const placementRaw = rawRule?.placement ?? rawRule?.placements ?? rawRule?.target ?? rawRule?.targets
  const placementList = Array.isArray(placementRaw)
    ? placementRaw
    : (placementRaw == null ? [] : [placementRaw])

  if (placementList.length === 0) return 'both'

  const tags = placementList
    .flatMap(value => String(value).split(/[,\|]/))
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean)

  const hasBoth = tags.some(tag => ['3', 'both', 'all', 'any'].includes(tag))
  const hasDisplay = tags.some(tag => ['1', 'display', 'output', 'assistant', 'ai', 'ai_output'].includes(tag))
  const hasPrompt = tags.some(tag => ['2', 'prompt', 'input', 'user', 'user_input'].includes(tag))

  if (hasBoth || (hasDisplay && hasPrompt)) return 'both'
  if (hasPrompt) return 'prompt'
  if (hasDisplay) return 'display'
  return 'both'
}

export function normalizeImportedRegex(rawRule, fallbackOrder = 0) {
  if (!rawRule || typeof rawRule !== 'object') return null
  const rawPattern = firstNonEmptyString(
    rawRule.pattern,
    rawRule.findRegex,
    rawRule.find_regex,
    rawRule.regex,
    rawRule.searchPattern
  )
  if (!rawPattern) return null

  const { pattern, flags } = parseRegexLiteral(
    rawPattern,
    firstNonEmptyString(rawRule.flags, rawRule.flag)
  )
  if (!pattern) return null

  return {
    name: firstNonEmptyString(rawRule.name, rawRule.scriptName, rawRule.script_name, rawRule.title) || '导入规则',
    enabled: rawRule.enabled !== false && rawRule.disabled !== true && rawRule.active !== false,
    scope: normalizeRegexScope(rawRule),
    pattern,
    flags,
    replacement: firstStringValue(rawRule.replacement, rawRule.replaceString, rawRule.replace_string, rawRule.replace),
    order: Number.isFinite(Number(rawRule.order)) ? Number(rawRule.order) : fallbackOrder
  }
}

export function collectImportedRegexRules(payload) {
  const queue = [payload]
  const visited = new Set()
  const dedupe = new Set()
  const collected = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue
    if (visited.has(current)) continue
    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item)
      continue
    }

    const normalized = normalizeImportedRegex(current, collected.length)
    if (normalized) {
      const key = `${normalized.pattern}__${normalized.flags}__${normalized.scope}__${normalized.replacement}`
      if (!dedupe.has(key)) {
        dedupe.add(key)
        collected.push(normalized)
      }
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') queue.push(value)
    }
  }

  return collected
}

export function normalizeOfflineRegexRule(rawRule, fallbackOrder = 0) {
  if (!rawRule || typeof rawRule !== 'object') return null

  const rawPattern = firstNonEmptyString(
    rawRule.pattern,
    rawRule.findRegex,
    rawRule.find_regex,
    rawRule.regex,
    rawRule.searchPattern
  )
  if (!rawPattern) return null

  const { pattern, flags } = parseRegexLiteral(
    rawPattern,
    firstNonEmptyString(rawRule.flags, rawRule.flag)
  )
  if (!pattern) return null

  return {
    id: String(rawRule.id || makeId('regex')),
    name: firstNonEmptyString(rawRule.name, rawRule.scriptName, rawRule.script_name, rawRule.title) || '未命名规则',
    enabled: rawRule.enabled !== false && rawRule.disabled !== true && rawRule.active !== false,
    scope: normalizeRegexScope(rawRule),
    pattern,
    flags,
    replacement: firstStringValue(rawRule.replacement, rawRule.replaceString, rawRule.replace_string, rawRule.replace),
    order: clampNumber(rawRule.order, fallbackOrder, { min: -9999, max: 9999, integer: true })
  }
}

export function normalizeOfflineRegexRules(rules) {
  if (!Array.isArray(rules)) return []
  return rules
    .map((rule, idx) => normalizeOfflineRegexRule(rule, idx))
    .filter(Boolean)
    .sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0)
      if (orderDiff !== 0) return orderDiff
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
    })
}

export function createEmptyOfflineRegexRule(order = 0) {
  return {
    id: makeId('regex'),
    name: '',
    enabled: true,
    scope: 'display',
    pattern: '',
    flags: 'gi',
    replacement: '',
    order: clampNumber(order, 0, { min: -9999, max: 9999, integer: true })
  }
}

function buildRegexSignature(rule) {
  return [
    String(rule.pattern || ''),
    String(rule.flags || ''),
    String(rule.scope || ''),
    String(rule.replacement || '')
  ].join('__')
}

function decorateRegexLayer(rules, bindingScope, baseOrder) {
  const normalized = normalizeOfflineRegexRules(rules)
  return normalized.map((rule, idx) => ({
    ...rule,
    bindingScope,
    order: baseOrder + clampNumber(rule.order, idx, { min: -9999, max: 9999, integer: true }),
    localOrder: clampNumber(rule.order, idx, { min: -9999, max: 9999, integer: true })
  }))
}

export function resolveOfflineRegexBindings({
  globalRules = [],
  presetRules = [],
  characterRules = []
} = {}) {
  const globalNormalized = normalizeOfflineRegexRules(globalRules)
  const presetNormalized = normalizeOfflineRegexRules(presetRules)
  const characterNormalized = normalizeOfflineRegexRules(characterRules)

  const layered = [
    ...decorateRegexLayer(globalNormalized, 'global', 0),
    ...decorateRegexLayer(characterNormalized, 'character', 10000),
    ...decorateRegexLayer(presetNormalized, 'preset', 20000)
  ]

  const deduped = new Map()
  for (const rule of layered) {
    const key = buildRegexSignature(rule)
    const existing = deduped.get(key)
    if (!existing || existing.order <= rule.order) {
      deduped.set(key, rule)
    }
  }

  const combinedRules = [...deduped.values()].sort((a, b) => {
    const orderDiff = (a.order || 0) - (b.order || 0)
    if (orderDiff !== 0) return orderDiff
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
  })

  return {
    globalRules: globalNormalized,
    presetRules: presetNormalized,
    characterRules: characterNormalized,
    combinedRules
  }
}
