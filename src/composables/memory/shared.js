import { normalizeRoleAliasesToTemplateVars } from '../api/prompts'

export const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 }

export const CATEGORY_LABELS = {
  preference: '偏好',
  relationship: '关系',
  emotion: '情绪',
  fact: '事实',
  routine: '日常',
  people: '人物',
  other: '其他'
}

export const DEFAULT_MEMORY_SETTINGS = {
  enabled: true,
  autoSummary: false,
  summaryFrequency: 40,
  summaryConfigId: null,
  summarySystemPrompt: '',
  keywordTrigger: true,
  keywords: ['记住', '别忘了', '记得', '重要'],
  shortTermMergeThreshold: 5,
  maxInjectTokens: 600,
  aiAutoMemory: false,
  aiAutoMemoryNotify: true,
  aiAutoMemoryTriggerRounds: 40,
  aiAutoMemoryTriggerTokens: 3000,
  aiAutoMemoryMinNewMessages: 10,
  smartContext: true,
  contextHeadRounds: 2,
  contextTailRounds: 5,
  contextAutoSummarize: true,
  memoryManagerEnabled: true,
  memoryManagerTriggerCount: 24,
  memoryManagerTriggerTokens: 1600,
  memoryManagerInterval: 15,
  memoryManagerConfigId: null,
  historyRetrievalEnabled: true,
  historyRetrievalCount: 2,
  maxRetrievalTokens: 320,
  historyRetrievalMode: 'keyword',
  vectorSearchEnabled: false,
  embeddingApiUrl: '',
  embeddingApiKey: '',
  embeddingModel: '',
  embeddingDimensions: 0,
  vectorIndexMode: 'realtime'
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeKeywords(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map(k => String(k || '').trim())
      .filter(k => k)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,，]/)
      .map(k => k.trim())
      .filter(k => k)
  }
  return null
}

export function normalizeMemoryContent(str) {
  return String(str || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[，,。.!！？?；;：:、】【\[\]（）(){}<>《》“”‘’'"`~·、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildCharBigrams(str) {
  const s = String(str || '')
  if (s.length < 2) return new Set()
  const set = new Set()
  for (let i = 0; i < s.length - 1; i += 1) {
    set.add(s.slice(i, i + 2))
  }
  return set
}

function overlapCoefficient(aSet, bSet) {
  const denom = Math.min(aSet.size, bSet.size)
  if (denom <= 0) return 0
  let inter = 0
  for (const value of aSet) {
    if (bSet.has(value)) inter += 1
  }
  return inter / denom
}

export function isNearDuplicateMemoryContent(candidate, existing) {
  const a = normalizeMemoryContent(candidate).toLowerCase()
  const b = normalizeMemoryContent(existing).toLowerCase()
  if (!a || !b) return false
  if (a === b) return true

  const MIN_FUZZY_LEN = 16
  if (a.length >= MIN_FUZZY_LEN && b.includes(a)) return true
  if (b.length >= MIN_FUZZY_LEN && a.includes(b)) return true

  const compactA = a.replace(/\s+/g, '')
  const compactB = b.replace(/\s+/g, '')
  const MIN_SIM_LEN = 12
  if (compactA.length >= MIN_SIM_LEN && compactB.length >= MIN_SIM_LEN) {
    const score = overlapCoefficient(buildCharBigrams(compactA), buildCharBigrams(compactB))
    if (score >= 0.88) return true
  }

  return false
}

export function applySimpleTemplateVars(text, vars = {}) {
  if (typeof text !== 'string' || !text) return text
  const normalizedText = normalizeRoleAliasesToTemplateVars(text)
  const char = vars.char || '角色'
  const user = vars.user || '用户'
  return normalizedText.replace(/\{\{\s*(char|user)\s*\}\}/gi, (_, key) => {
    return key.toLowerCase() === 'char' ? char : user
  })
}

export function getTemplateVarsForContact(store, contact) {
  const persona = contact?.id ? store?.getPersonaForContact?.(contact.id) : null
  return {
    char: String(contact?.name || '角色').trim() || '角色',
    user: String(persona?.name || '用户').trim() || '用户'
  }
}

export function renderMemoryText(text, contact, store) {
  return applySimpleTemplateVars(String(text || ''), getTemplateVarsForContact(store, contact))
}

export function stripCodeFences(text) {
  const s = String(text || '').trim()
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (m ? m[1] : s).trim()
}

export function tryParseJsonArray(text) {
  const cleaned = stripCodeFences(text)
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // fallthrough
  }

  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore
    }
  }

  return null
}

export function tryParseJsonObject(text) {
  const cleaned = stripCodeFences(text)
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    // fallthrough
  }

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      // ignore
    }
  }

  return null
}

function takeNextAmCode(memory) {
  if (!memory || typeof memory !== 'object') {
    return 'AM01'
  }
  const counter = (memory.amCounter || 0) + 1
  memory.amCounter = counter
  return 'AM' + String(counter).padStart(2, '0')
}

export function assignAmCode(contact) {
  initContactMemory(contact)
  return takeNextAmCode(contact.memory)
}

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function shortErrorText(text, maxLen = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).trimEnd() + '...'
}

export function isSummarizableTextMessage(message) {
  if (!message) return false
  if (message.hideInChat) return false
  if (message.isImage || message.isSticker) return false
  if (!message.content) return false
  if (typeof message.content === 'string' && message.content.startsWith('⚠️ ')) return false
  return true
}

export function getSummaryConfig(store, contact) {
  const configId = contact?.memorySettings?.summaryConfigId
  if (configId) {
    const cfg = store?.configs?.find(c => c.id === configId)
    if (cfg) return cfg
  }

  if (contact?.configId) {
    const cfg = store?.configs?.find(c => c.id === contact.configId)
    if (cfg) return cfg
  }

  return store?.getConfig
}

export function getEmbeddingConfig(contact) {
  const settings = contact?.memorySettings
  if (!settings?.vectorSearchEnabled) return null
  const url = (settings.embeddingApiUrl || '').trim()
  const key = (settings.embeddingApiKey || '').trim()
  const model = (settings.embeddingModel || '').trim()
  if (!url || !key || !model) return null
  return { url, key, model, dimensions: settings.embeddingDimensions || 0 }
}

export function getNewTextMessages(contact, startMsgId, endMsgId = null) {
  if (!contact?.msgs?.length) return []
  const msgs = contact.msgs
  const lastId = startMsgId || contact.memory?.lastSummaryMsgId
  const lastIndex = lastId ? msgs.findIndex(m => m.id === lastId) : -1
  const fromIndex = Math.max(0, lastIndex + 1)
  let toIndex = msgs.length - 1
  if (endMsgId) {
    const endIndex = msgs.findIndex(m => m.id === endMsgId)
    if (endIndex !== -1) toIndex = endIndex
  }
  if (fromIndex > toIndex) return []
  return msgs.slice(fromIndex, toIndex + 1).filter(isSummarizableTextMessage)
}

export function getTextMessagesInStrictRange(contact, startMsgId, endMsgId) {
  if (!contact?.msgs?.length) {
    return { success: false, error: '没有消息记录', messages: [] }
  }

  const msgs = contact.msgs
  const startIndex = msgs.findIndex(m => m.id === startMsgId)
  if (startIndex === -1) {
    return { success: false, error: '未找到范围起点消息', messages: [] }
  }

  const endIndex = msgs.findIndex(m => m.id === endMsgId)
  if (endIndex === -1) {
    return { success: false, error: '未找到范围终点消息', messages: [] }
  }

  const from = Math.min(startIndex, endIndex)
  const to = Math.max(startIndex, endIndex)
  return {
    success: true,
    messages: msgs.slice(from, to + 1).filter(isSummarizableTextMessage)
  }
}

export function normalizeSummaryRequestOptions(input) {
  if (typeof input === 'string') {
    return { startMsgId: input }
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { ...input }
  }
  return {}
}

export function isValidMemoryPriority(value) {
  return PRIORITY_ORDER[value] != null
}

export function isValidMemoryCategory(value) {
  return !!CATEGORY_LABELS[value]
}

function rankMemorySource(source) {
  const value = String(source || '')
  if (value === 'manual') return 0
  if (value === 'keyword') return 1
  if (value === 'manager') return 2
  if (value === 'promoted') return 3
  if (value === 'extracted') return 4
  return 5
}

export function pickPreferredMemoryDuplicate(a, b) {
  const aInjected = a?.enabled === true
  const bInjected = b?.enabled === true
  if (aInjected !== bInjected) return aInjected ? a : b

  const aRank = PRIORITY_ORDER[a?.priority] ?? 1
  const bRank = PRIORITY_ORDER[b?.priority] ?? 1
  if (aRank !== bRank) return aRank < bRank ? a : b

  const aTime = a?.time || 0
  const bTime = b?.time || 0
  if (aTime !== bTime) return aTime > bTime ? a : b

  const aSourceRank = rankMemorySource(a?.source)
  const bSourceRank = rankMemorySource(b?.source)
  if (aSourceRank !== bSourceRank) return aSourceRank < bSourceRank ? a : b

  return a
}

function normalizeSummaryList(list, type = 'short') {
  if (!Array.isArray(list)) return []
  const now = Date.now()
  return list
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const next = item
      if (typeof next.content !== 'string') next.content = String(next.content || '').trim()
      if (!Number.isFinite(next.time)) next.time = now
      if (!next.msgRange || typeof next.msgRange !== 'object') {
        next.msgRange = { start: null, end: null, count: 0 }
      } else {
        next.msgRange = {
          start: next.msgRange.start || null,
          end: next.msgRange.end || null,
          count: clampNumber(next.msgRange.count, 0, 99999, 0)
        }
      }

      const status = String(next.status || '').trim()
      if (!status) next.status = 'ok'
      else if (status !== 'ok' && status !== 'truncated' && status !== 'failed') next.status = 'ok'

      if (next.status === 'failed' && !next.content) {
        next.content = type === 'long'
          ? '（长期总结失败，点击重Roll重试）'
          : '（总结失败，点击重Roll重试）'
      }

      if (type === 'short' && typeof next.merged !== 'boolean') next.merged = false
      return next
    })
}

export function initContactMemory(contact) {
  if (!contact || typeof contact !== 'object') return contact

  if (!contact.memory || typeof contact.memory !== 'object') {
    contact.memory = {
      core: [],
      longTerm: [],
      shortTerm: [],
      lastSummaryMsgId: null,
      lastLongTermTime: null,
      lastAIMemoryMsgId: null,
      contextSummary: null,
      lastManagerRunAt: null,
      momentsSummary: null,
      momentTurnCount: 0,
      amCounter: 0,
      lastVectorizedMsgId: null,
      roundVectorsDirty: false
    }
  } else {
    if (!Array.isArray(contact.memory.core)) contact.memory.core = []
    if (!Array.isArray(contact.memory.longTerm)) contact.memory.longTerm = []
    if (!Array.isArray(contact.memory.shortTerm)) contact.memory.shortTerm = []
    if (!('lastSummaryMsgId' in contact.memory)) contact.memory.lastSummaryMsgId = null
    if (!('lastLongTermTime' in contact.memory)) contact.memory.lastLongTermTime = null
    if (!('lastAIMemoryMsgId' in contact.memory)) contact.memory.lastAIMemoryMsgId = null
    if (!('contextSummary' in contact.memory)) contact.memory.contextSummary = null
    if (!('lastManagerRunAt' in contact.memory)) contact.memory.lastManagerRunAt = null
    if (!('momentsSummary' in contact.memory)) contact.memory.momentsSummary = null
    if (!('momentTurnCount' in contact.memory)) contact.memory.momentTurnCount = 0
    if (!('amCounter' in contact.memory)) contact.memory.amCounter = 0
    if (!('lastVectorizedMsgId' in contact.memory)) contact.memory.lastVectorizedMsgId = null
    if (!('roundVectorsDirty' in contact.memory)) contact.memory.roundVectorsDirty = false
  }

  if (!contact.memorySettings || typeof contact.memorySettings !== 'object') {
    contact.memorySettings = { ...DEFAULT_MEMORY_SETTINGS }
  } else {
    for (const [key, value] of Object.entries(DEFAULT_MEMORY_SETTINGS)) {
      if (!(key in contact.memorySettings)) {
        contact.memorySettings[key] = value
      }
    }
  }

  const settings = contact.memorySettings
  settings.enabled = !!settings.enabled
  settings.autoSummary = !!settings.autoSummary
  settings.keywordTrigger = !!settings.keywordTrigger
  settings.aiAutoMemory = !!settings.aiAutoMemory
  settings.aiAutoMemoryNotify = settings.aiAutoMemoryNotify !== false
  settings.smartContext = settings.smartContext !== false
  settings.contextAutoSummarize = settings.contextAutoSummarize !== false
  settings.memoryManagerEnabled = !!settings.memoryManagerEnabled
  settings.historyRetrievalEnabled = !!settings.historyRetrievalEnabled

  settings.summaryFrequency = clampNumber(settings.summaryFrequency, 5, 500, DEFAULT_MEMORY_SETTINGS.summaryFrequency)
  settings.shortTermMergeThreshold = clampNumber(settings.shortTermMergeThreshold, 2, 50, DEFAULT_MEMORY_SETTINGS.shortTermMergeThreshold)
  settings.maxInjectTokens = clampNumber(settings.maxInjectTokens, 50, 5000, DEFAULT_MEMORY_SETTINGS.maxInjectTokens)
  settings.aiAutoMemoryTriggerRounds = clampNumber(settings.aiAutoMemoryTriggerRounds, 0, 400, DEFAULT_MEMORY_SETTINGS.aiAutoMemoryTriggerRounds)
  settings.aiAutoMemoryTriggerTokens = clampNumber(settings.aiAutoMemoryTriggerTokens, 0, 50000, DEFAULT_MEMORY_SETTINGS.aiAutoMemoryTriggerTokens)
  settings.aiAutoMemoryMinNewMessages = clampNumber(settings.aiAutoMemoryMinNewMessages, 1, 30, DEFAULT_MEMORY_SETTINGS.aiAutoMemoryMinNewMessages)
  settings.contextHeadRounds = clampNumber(settings.contextHeadRounds, 0, 10, DEFAULT_MEMORY_SETTINGS.contextHeadRounds)
  settings.contextTailRounds = clampNumber(settings.contextTailRounds, 2, 20, DEFAULT_MEMORY_SETTINGS.contextTailRounds)
  settings.memoryManagerTriggerCount = clampNumber(settings.memoryManagerTriggerCount, 0, 200, DEFAULT_MEMORY_SETTINGS.memoryManagerTriggerCount)
  settings.memoryManagerTriggerTokens = clampNumber(settings.memoryManagerTriggerTokens, 0, 20000, DEFAULT_MEMORY_SETTINGS.memoryManagerTriggerTokens)
  settings.memoryManagerInterval = clampNumber(settings.memoryManagerInterval, 5, 120, DEFAULT_MEMORY_SETTINGS.memoryManagerInterval)
  settings.historyRetrievalCount = clampNumber(settings.historyRetrievalCount, 1, 10, DEFAULT_MEMORY_SETTINGS.historyRetrievalCount)
  settings.maxRetrievalTokens = clampNumber(settings.maxRetrievalTokens, 100, 2000, DEFAULT_MEMORY_SETTINGS.maxRetrievalTokens)

  if (!['keyword', 'llm'].includes(settings.historyRetrievalMode)) {
    settings.historyRetrievalMode = DEFAULT_MEMORY_SETTINGS.historyRetrievalMode
  }

  settings.vectorSearchEnabled = !!settings.vectorSearchEnabled
  if (typeof settings.embeddingApiUrl !== 'string') settings.embeddingApiUrl = ''
  if (typeof settings.embeddingApiKey !== 'string') settings.embeddingApiKey = ''
  if (typeof settings.embeddingModel !== 'string') settings.embeddingModel = ''
  settings.embeddingDimensions = clampNumber(settings.embeddingDimensions, 0, 8192, 0)
  if (!['realtime', 'ondemand'].includes(settings.vectorIndexMode)) {
    settings.vectorIndexMode = DEFAULT_MEMORY_SETTINGS.vectorIndexMode
  }

  if (settings.summaryConfigId === '' || settings.summaryConfigId === undefined) settings.summaryConfigId = null
  if (settings.memoryManagerConfigId === '' || settings.memoryManagerConfigId === undefined) settings.memoryManagerConfigId = null

  if (Array.isArray(contact.memory.core)) {
    for (const memory of contact.memory.core) {
      if (!memory || typeof memory !== 'object') continue
      if (typeof memory.enabled !== 'boolean') {
        memory.enabled = memory.source === 'extracted' ? false : true
      }
      if (!isValidMemoryPriority(memory.priority)) memory.priority = 'normal'
      if (memory.category && !isValidMemoryCategory(memory.category)) memory.category = null
      if (!memory.source) memory.source = 'manual'
      if (!Number.isFinite(memory.time)) memory.time = Date.now()
    }
  }

  contact.memory.shortTerm = normalizeSummaryList(contact.memory.shortTerm, 'short')
  contact.memory.longTerm = normalizeSummaryList(contact.memory.longTerm, 'long')

  // Backfill AM codes on existing summaries that don't have one
  const allSummaries = [...contact.memory.shortTerm, ...contact.memory.longTerm]
  const needsBackfill = allSummaries.filter(s => !s.amCode)
  if (needsBackfill.length) {
    needsBackfill.sort((a, b) => (a.time || 0) - (b.time || 0))
    for (const s of needsBackfill) {
      s.amCode = takeNextAmCode(contact.memory)
    }
  }

  const normalizedKeywords = normalizeKeywords(settings.keywords)
  if (normalizedKeywords && normalizedKeywords.length) {
    const current = Array.isArray(settings.keywords) ? settings.keywords : []
    const unchanged =
      current.length === normalizedKeywords.length &&
      current.every((value, index) => value === normalizedKeywords[index])
    if (!unchanged) settings.keywords = normalizedKeywords
  } else {
    settings.keywords = [...DEFAULT_MEMORY_SETTINGS.keywords]
  }

  return contact
}
