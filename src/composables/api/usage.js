import { estimateTokensForModel } from '../../utils/tokenEstimate'

function toSafeTokenInt(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function hasUsageTokens(usage) {
  if (!usage || typeof usage !== 'object') return false
  return (
    toSafeTokenInt(usage.promptTokens) > 0 ||
    toSafeTokenInt(usage.completionTokens) > 0 ||
    toSafeTokenInt(usage.totalTokens) > 0
  )
}

function pickTokenFromKeys(source, keys) {
  if (!source || typeof source !== 'object') return 0
  for (const key of keys) {
    const val = toSafeTokenInt(source[key])
    if (val > 0) return val
  }
  return 0
}

function normalizeUsageShape(raw) {
  if (!raw || typeof raw !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }

  const candidates = [raw]
  if (raw.usage && typeof raw.usage === 'object') candidates.push(raw.usage)
  if (raw.token_usage && typeof raw.token_usage === 'object') candidates.push(raw.token_usage)
  if (raw.usageMetadata && typeof raw.usageMetadata === 'object') candidates.push(raw.usageMetadata)
  if (raw.meta?.usage && typeof raw.meta.usage === 'object') candidates.push(raw.meta.usage)

  const promptKeys = [
    'prompt_tokens',
    'input_tokens',
    'promptTokens',
    'inputTokens',
    'prompt_token_count',
    'promptTokenCount',
    'inputTokenCount',
    'tokens_in'
  ]
  const completionKeys = [
    'completion_tokens',
    'output_tokens',
    'completionTokens',
    'outputTokens',
    'completion_token_count',
    'candidatesTokenCount',
    'outputTokenCount',
    'tokens_out'
  ]
  const totalKeys = [
    'total_tokens',
    'totalTokens',
    'total_token_count',
    'totalTokenCount',
    'total'
  ]

  for (const source of candidates) {
    const promptTokens = pickTokenFromKeys(source, promptKeys)
    const completionTokens = pickTokenFromKeys(source, completionKeys)
    const totalTokens = pickTokenFromKeys(source, totalKeys) || (promptTokens + completionTokens)
    if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
      return { promptTokens, completionTokens, totalTokens }
    }
  }

  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

function updateEstimateScale(stats, apiUsage, fallbackUsage) {
  if (!hasUsageTokens(apiUsage) || !hasUsageTokens(fallbackUsage)) return
  if (!stats.estimateScale || typeof stats.estimateScale !== 'object') {
    stats.estimateScale = { prompt: 1, completion: 1, total: 1, samples: 0 }
  }

  const scale = stats.estimateScale
  let updated = false

  const blend = (field, actual, estimated) => {
    if (actual <= 0 || estimated <= 0) return
    const ratio = clampNumber(actual / estimated, 0.55, 1.8)
    const prev = Number(scale[field])
    scale[field] = Number.isFinite(prev) && prev > 0
      ? (prev * 0.75 + ratio * 0.25)
      : ratio
    updated = true
  }

  blend('prompt', apiUsage.promptTokens, fallbackUsage.promptTokens)
  blend('completion', apiUsage.completionTokens, fallbackUsage.completionTokens)
  blend('total', apiUsage.totalTokens, fallbackUsage.totalTokens)

  if (updated) {
    const prevSamples = Number(scale.samples)
    scale.samples = Number.isFinite(prevSamples) && prevSamples > 0
      ? Math.round(prevSamples + 1)
      : 1
  }
}

function estimateRoughTokens(text, model = '') {
  return estimateTokensForModel(text, model)
}

function estimateContentTokensForUsage(content, model = '') {
  if (typeof content === 'string') {
    return estimateRoughTokens(content, model)
  }
  if (Array.isArray(content)) {
    let total = 0
    content.forEach((part) => {
      if (!part) return
      if (typeof part === 'string') {
        total += estimateRoughTokens(part, model)
        return
      }
      if (part.type === 'text') {
        total += estimateRoughTokens(part.text || '', model)
        return
      }
      if (part.type === 'image_url') {
        // Rough cost for vision parts in OpenAI-compatible APIs.
        total += 85
        return
      }
      try {
        total += estimateRoughTokens(JSON.stringify(part), model)
      } catch {
        total += 0
      }
    })
    return total
  }
  if (content == null) return 0
  return estimateRoughTokens(String(content), model)
}

function extractTagBlocks(text, tagName) {
  if (!text) return []
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tagName}>`, 'gi')
  return String(text).match(re) || []
}

function sumTokenCounts(texts = [], model = '') {
  if (!Array.isArray(texts) || texts.length === 0) return 0
  return texts.reduce((sum, text) => sum + estimateRoughTokens(String(text || ''), model), 0)
}

function removeMatchedBlocks(text, blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).reduce((acc, block) => {
    if (!block) return acc
    return acc.replace(block, '')
  }, String(text || ''))
}

function wrapTagContent(tagName, innerText) {
  const content = String(innerText || '').trim()
  if (!content) return ''
  return `<${tagName}>\n${content}\n</${tagName}>`
}

function splitFeatureBlock(featureBlock = '') {
  const inner = String(featureBlock || '')
    .replace(/^<features(?:\s[^>]*)?>/i, '')
    .replace(/<\/features>\s*$/i, '')
    .trim()
  if (!inner) return { sticker: '', remainder: '' }

  const stickerStart = inner.indexOf('贴纸：')
  if (stickerStart === -1) {
    return { sticker: '', remainder: inner }
  }

  const afterSticker = inner.slice(stickerStart)
  const endMarkers = [
    '\n引用回复：',
    '\n以下 token 独占一行，仅在有意图时使用：',
    '\n语气标签：',
    '\n你有朋友圈功能。'
  ]
  let stickerEnd = afterSticker.length
  endMarkers.forEach((marker) => {
    const idx = afterSticker.indexOf(marker)
    if (idx >= 0 && idx < stickerEnd) stickerEnd = idx
  })

  const sticker = afterSticker.slice(0, stickerEnd).trim()
  const remainder = (
    inner.slice(0, stickerStart) +
    '\n' +
    afterSticker.slice(stickerEnd)
  ).trim()

  return { sticker, remainder }
}

function createEmptyPromptBreakdown() {
  return {
    persona: 0,
    lorebook: 0,
    history: 0,
    system: 0,
    total: 0,
    personaParts: {
      characterPersona: 0,
      userPersona: 0,
      total: 0
    },
    systemParts: {
      systemCore: 0,
      outputFormat: 0,
      presetImageRule: 0,
      sticker: 0,
      total: 0
    }
  }
}

function normalizeScaledFields(source, fields) {
  const result = {}
  fields.forEach((field) => {
    result[field] = toSafeTokenInt(source?.[field])
  })
  return result
}

function scaleFieldsToTarget(source, fields, targetTotal) {
  const target = toSafeTokenInt(targetTotal)
  const values = normalizeScaledFields(source, fields)
  const currentTotal = fields.reduce((sum, field) => sum + values[field], 0)

  if (target <= 0 || currentTotal <= 0) {
    return fields.reduce((acc, field) => {
      acc[field] = 0
      return acc
    }, {})
  }

  if (target === currentTotal) return values

  const ratio = target / currentTotal
  const scaled = {}
  const fractions = []
  let assigned = 0

  fields.forEach((field) => {
    const raw = values[field] * ratio
    const floored = Math.floor(raw)
    scaled[field] = floored
    assigned += floored
    fractions.push({ field, frac: raw - floored })
  })

  let diff = target - assigned
  if (diff > 0) {
    fractions.sort((a, b) => b.frac - a.frac)
    for (let i = 0; i < fractions.length && diff > 0; i++) {
      scaled[fractions[i].field] += 1
      diff -= 1
    }
  } else if (diff < 0) {
    fractions.sort((a, b) => a.frac - b.frac)
    for (let i = 0; i < fractions.length && diff < 0; i++) {
      const field = fractions[i].field
      if (scaled[field] <= 0) continue
      scaled[field] -= 1
      diff += 1
    }
  }

  return fields.reduce((acc, field) => {
    acc[field] = toSafeTokenInt(scaled[field])
    return acc
  }, {})
}

function estimateSystemMessageBreakdown(content, model = '') {
  const text = String(content || '')
  const breakdown = createEmptyPromptBreakdown()
  if (!text) return breakdown

  // Dedicated lorebook message shape.
  if (/^\s*<world_book\b/i.test(text)) {
    breakdown.lorebook = estimateRoughTokens(text, model)
    return breakdown
  }

  const roleBlocks = extractTagBlocks(text, 'role')
  const userPersonaBlocks = extractTagBlocks(text, 'user_persona')
  const outputFormatBlocks = extractTagBlocks(text, 'output_format')
  const imageGenerationBlocks = extractTagBlocks(text, 'image_generation')
  const featureBlocks = extractTagBlocks(text, 'features')

  breakdown.personaParts.characterPersona = sumTokenCounts(roleBlocks, model)
  breakdown.personaParts.userPersona = sumTokenCounts(userPersonaBlocks, model)
  breakdown.systemParts.outputFormat = sumTokenCounts(outputFormatBlocks, model)
  breakdown.systemParts.presetImageRule = sumTokenCounts(imageGenerationBlocks, model)

  featureBlocks.forEach((block) => {
    const { sticker, remainder } = splitFeatureBlock(block)
    if (sticker) {
      breakdown.systemParts.sticker += estimateRoughTokens(sticker, model)
    }
    if (remainder) {
      breakdown.systemParts.systemCore += estimateRoughTokens(wrapTagContent('features', remainder), model)
    }
  })

  const remainder = removeMatchedBlocks(text, [
    ...roleBlocks,
    ...userPersonaBlocks,
    ...outputFormatBlocks,
    ...imageGenerationBlocks,
    ...featureBlocks
  ])
  breakdown.systemParts.systemCore += estimateRoughTokens(remainder, model)

  return breakdown
}

function normalizePromptBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return null

  const personaParts = {
    characterPersona: toSafeTokenInt(breakdown.personaParts?.characterPersona),
    userPersona: toSafeTokenInt(breakdown.personaParts?.userPersona)
  }
  personaParts.total = personaParts.characterPersona + personaParts.userPersona

  const systemParts = {
    systemCore: toSafeTokenInt(breakdown.systemParts?.systemCore),
    outputFormat: toSafeTokenInt(breakdown.systemParts?.outputFormat),
    presetImageRule: toSafeTokenInt(breakdown.systemParts?.presetImageRule),
    sticker: toSafeTokenInt(breakdown.systemParts?.sticker)
  }
  systemParts.total = systemParts.systemCore + systemParts.outputFormat + systemParts.presetImageRule + systemParts.sticker

  const persona = personaParts.total > 0 ? personaParts.total : toSafeTokenInt(breakdown.persona)
  const lorebook = toSafeTokenInt(breakdown.lorebook)
  const history = toSafeTokenInt(breakdown.history)
  const system = systemParts.total > 0 ? systemParts.total : toSafeTokenInt(breakdown.system)
  const total = persona + lorebook + history + system
  if (total <= 0) return null
  return {
    persona,
    lorebook,
    history,
    system,
    total,
    personaParts,
    systemParts
  }
}

function scalePromptBreakdownToTarget(breakdown, targetTotal) {
  const normalized = normalizePromptBreakdown(breakdown)
  const target = toSafeTokenInt(targetTotal)
  if (!normalized) return null
  if (target <= 0 || normalized.total <= 0) return normalized
  if (target === normalized.total) return normalized

  const topLevel = scaleFieldsToTarget(normalized, ['persona', 'lorebook', 'history', 'system'], target)
  const personaParts = scaleFieldsToTarget(
    normalized.personaParts,
    ['characterPersona', 'userPersona'],
    topLevel.persona
  )
  const systemParts = scaleFieldsToTarget(
    normalized.systemParts,
    ['systemCore', 'outputFormat', 'presetImageRule', 'sticker'],
    topLevel.system
  )
  const total = topLevel.persona + topLevel.lorebook + topLevel.history + topLevel.system

  return {
    persona: topLevel.persona,
    lorebook: topLevel.lorebook,
    history: topLevel.history,
    system: topLevel.system,
    total: Math.max(0, total),
    personaParts: {
      ...personaParts,
      total: personaParts.characterPersona + personaParts.userPersona
    },
    systemParts: {
      ...systemParts,
      total: systemParts.systemCore + systemParts.outputFormat + systemParts.presetImageRule + systemParts.sticker
    }
  }
}

export function estimatePromptBreakdownFromMessages(messages, model = '') {
  const breakdown = createEmptyPromptBreakdown()
  breakdown.systemParts.systemCore = 2 // align with estimateUsageFromMessages base overhead

  const items = Array.isArray(messages) ? messages : []
  items.forEach((msg) => {
    const overhead = 4
    if (msg?.role !== 'system') {
      breakdown.history += estimateContentTokensForUsage(msg?.content, model) + overhead
      return
    }

    const content = msg?.content
    if (typeof content !== 'string') {
      breakdown.systemParts.systemCore += estimateContentTokensForUsage(content, model) + overhead
      return
    }

    const split = estimateSystemMessageBreakdown(content, model)
    breakdown.personaParts.characterPersona += split.personaParts.characterPersona
    breakdown.personaParts.userPersona += split.personaParts.userPersona
    breakdown.lorebook += split.lorebook
    breakdown.systemParts.systemCore += split.systemParts.systemCore + overhead
    breakdown.systemParts.outputFormat += split.systemParts.outputFormat
    breakdown.systemParts.presetImageRule += split.systemParts.presetImageRule
    breakdown.systemParts.sticker += split.systemParts.sticker
  })

  return normalizePromptBreakdown(breakdown)
}

export function estimateUsageFromMessages(messages, completionText, model = '') {
  const promptTokens = Math.max(0, Math.round((messages || []).reduce((sum, msg) => {
    return sum + estimateContentTokensForUsage(msg?.content, model) + 4
  }, 2)))
  const completionTokens = Math.max(0, Math.round(estimateRoughTokens(completionText || '', model) + (completionText ? 4 : 0)))
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    estimated: true
  }
}

export function recordUsage(contact, streamInfo, fallbackUsage = null, model = '', options = {}) {
  if (!contact) return
  if (!contact.tokenStats) {
    contact.tokenStats = { totalPromptTokens: 0, totalCompletionTokens: 0, callCount: 0, lastCalls: [] }
  }
  const stats = contact.tokenStats
  if (!Array.isArray(stats.lastCalls)) stats.lastCalls = []

  const apiUsage = normalizeUsageShape(streamInfo?.usage)
  const fallback = normalizeUsageShape(fallbackUsage)
  const hasRealUsage = hasUsageTokens(apiUsage)
  const usage = hasRealUsage ? apiUsage : fallback
  const promptTokens = toSafeTokenInt(usage.promptTokens)
  const completionTokens = toSafeTokenInt(usage.completionTokens)
  const totalTokens = toSafeTokenInt(usage.totalTokens) || (promptTokens + completionTokens)
  const promptBreakdown = normalizePromptBreakdown(options?.promptBreakdown)
  const scaledPromptBreakdown = scalePromptBreakdownToTarget(promptBreakdown, promptTokens)

  if (hasUsageTokens(usage)) {
    stats.totalPromptTokens += promptTokens
    stats.totalCompletionTokens += completionTokens
    const callInfo = {
      time: Date.now(),
      model: model || '',
      promptTokens,
      completionTokens,
      totalTokens,
      estimated: !hasRealUsage
    }
    if (scaledPromptBreakdown) {
      callInfo.promptBreakdown = scaledPromptBreakdown
      callInfo.promptBreakdownEstimated = !hasRealUsage
    }
    stats.lastCalls.unshift(callInfo)
    if (stats.lastCalls.length > 50) {
      stats.lastCalls.length = 50
    }
  }

  if (hasRealUsage) {
    updateEstimateScale(stats, apiUsage, fallback)
  }

  stats.callCount = (stats.callCount || 0) + 1
}
