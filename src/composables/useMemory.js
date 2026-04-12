/**
 * 记忆系统核心逻辑
 * - 小总结：每 N 条文本消息生成
 * - 大总结：多个小总结合并
 * - 核心记忆：用户手动/关键词提取/AI 自动提取
 */

import { useConfigsStore } from '../stores/configs'
import { usePersonasStore } from '../stores/personas'
import { estimateTokens } from '../utils/tokens'
import { addCoreMemory, checkKeywordTrigger, deleteCoreMemory, updateCoreMemory } from './memory/coreMemory'
import { refreshContextSummary as refreshContextSummaryImpl } from './memory/contextSummary'
import { extractMemoriesWithAI as extractMemoriesWithAIImpl } from './memory/extraction'
import { buildMemoryPrompt as buildMemoryPromptImpl, checkAutoSummaryTrigger } from './memory/injection'
import { callSummaryAPI as callSummaryAPIImpl } from './memory/summaryApi'
import {
  checkAndMergeLongTerm as checkAndMergeLongTermImpl,
  deleteSummary as deleteSummaryImpl,
  generateShortSummary as generateShortSummaryImpl,
  rerollSummary as rerollSummaryImpl,
  updateSummary as updateSummaryImpl
} from './memory/summaryLifecycle'
import { DEFAULT_MEMORY_SETTINGS, getEmbeddingConfig, getSummaryConfig as getSummaryConfigImpl, initContactMemory } from './memory/shared'

export { DEFAULT_MEMORY_SETTINGS, initContactMemory } from './memory/shared'
export { runMemoryManager } from './memory/manager'

function createMemoryStoreAdapter(configsStore, personasStore) {
  return {
    get configs() {
      return configsStore.configs
    },
    get getConfig() {
      return configsStore.getConfig
    },
    getPersonaForContact(contactId) {
      return personasStore.getPersonaForContact(contactId)
    }
  }
}

export function useMemory() {
  const configsStore = useConfigsStore()
  const personasStore = usePersonasStore()
  const memoryStore = createMemoryStoreAdapter(configsStore, personasStore)

  // contactId -> in-flight / cooldown. Kept in-memory only (no persistence).
  const aiExtractInFlight = new Map()
  const aiExtractLastAttemptAt = new Map()

  // 获取总结用的API配置
  function getSummaryConfig(contact) {
    return getSummaryConfigImpl(memoryStore, contact)
  }

  async function callSummaryAPI(prompt, messages, contact, options = {}) {
    return callSummaryAPIImpl(memoryStore, prompt, messages, contact, options)
  }

  // 生成小总结
  async function generateShortSummary(contact, request = null) {
    return generateShortSummaryImpl(contact, request, { callSummaryAPI })
  }

  // 合并小总结为大总结
  async function checkAndMergeLongTerm(contact) {
    return checkAndMergeLongTermImpl(contact, { callSummaryAPI })
  }

  function buildMemoryPrompt(contact) {
    return buildMemoryPromptImpl(contact, { store: memoryStore })
  }

  function invalidateRoundVectors(contact) {
    if (!contact?.id) return
    initContactMemory(contact)
    contact.memory.roundVectorsDirty = true
    contact.memory.lastVectorizedMsgId = null
    import('./memory/vectorStore.js').then(({ createVectorStore }) => {
      createVectorStore(contact.id).deleteByType('round')
    }).catch(() => {})
  }

  async function extractMemoriesWithAI(contact) {
    return extractMemoriesWithAIImpl(contact, {
      aiExtractInFlight,
      aiExtractLastAttemptAt,
      callSummaryAPI
    })
  }

  // 刷新上下文摘要（带变化量阈值优化）
  async function refreshContextSummary(contact) {
    return refreshContextSummaryImpl(contact, { callSummaryAPI })
  }

  // 处理消息发送后的记忆检查
  async function onMessageSent(contact, content, scheduleSave) {
    if (!contact) return
    initContactMemory(contact)
    const settings = contact.memorySettings || DEFAULT_MEMORY_SETTINGS
    if (!settings.enabled) return

    // 检查关键词触发
    const extracted = checkKeywordTrigger(content, contact)
    if (extracted) {
      const mem = addCoreMemory(contact, extracted, 'keyword')
      if (scheduleSave) scheduleSave()
      // 返回提取的记忆，供调用方显示提示
      return { type: 'keyword', memory: mem }
    }

    // 检查自动总结触发
    if (checkAutoSummaryTrigger(contact)) {
      const sumResult = await generateShortSummary(contact)
      if (sumResult.success && scheduleSave) scheduleSave()
    }
  }

  async function onAssistantReplied(contact, scheduleSave) {
    if (!contact) return null
    initContactMemory(contact)

    const settings = contact.memorySettings || DEFAULT_MEMORY_SETTINGS
    if (!settings.enabled) return null

    const lastMsg = contact.msgs?.[contact.msgs.length - 1] || null
    const lastIsAssistant = lastMsg?.role === 'assistant'
    const lastIsError = typeof lastMsg?.content === 'string' && lastMsg.content.startsWith('⚠️ ')
    if (!lastIsAssistant || lastIsError) return null

    const result = { autoMemories: null, summary: null }

    if (settings.aiAutoMemory) {
      const r = await extractMemoriesWithAI(contact)
      result.autoMemories = r
      if ((r.cursorUpdated || r.added?.length || r.updated?.length) && scheduleSave) scheduleSave()
    }

    // Allow assistant messages to also trigger auto-summary (e.g. group chat splits into multiple messages).
    if (checkAutoSummaryTrigger(contact)) {
      const sumResult = await generateShortSummary(contact)
      result.summary = sumResult.success ? sumResult.summary : null
      if (sumResult.success && scheduleSave) scheduleSave()
    }

    // 独立检查中间摘要是否需要刷新（解耦 autoSummary 触发）
    // refreshContextSummary 内部自带变化量阈值，不会每次都实际调用 API
    if (settings.smartContext && settings.contextAutoSummarize) {
      refreshContextSummary(contact).then(() => {
        if (scheduleSave) scheduleSave()
      }).catch(() => {})
    }

    // 刷新动态总结缓存
    import('./useMomentsContext.js').then(({ refreshMomentsSummary }) => {
      refreshMomentsSummary(contact, callSummaryAPI).then(() => {
        if (scheduleSave) scheduleSave()
      }).catch(() => {})
    }).catch(() => {})

    // Realtime vector indexing — embed new conversation rounds after each reply
    if (settings.vectorSearchEnabled && settings.vectorIndexMode === 'realtime') {
      const embConfig = getEmbeddingConfig(contact)
      if (embConfig) {
        import('./retrieval/useHistorySearch.js').then(({ ensureRoundVectors }) => {
          ensureRoundVectors(contact, contact.msgs, embConfig).then(() => {
            if (scheduleSave) scheduleSave()
          }).catch(() => {})
        }).catch(() => {})
      }
    }

    // Trigger memory manager if enabled and conditions are met
    if (settings.memoryManagerEnabled) {
      const managedCore = (contact.memory.core || []).filter(m => m && m.content)
      const coreCount = managedCore.length
      const coreTokens = managedCore.reduce((sum, m) => sum + estimateTokens(m.content), 0)

      const triggerCount = Number(settings.memoryManagerTriggerCount)
      const triggerTokens = Number(settings.memoryManagerTriggerTokens)
      const autoAddedCount = result.autoMemories?.added?.length || 0
      const burstTrigger = autoAddedCount >= 2 && coreCount >= 10

      const shouldTrigger =
        (Number.isFinite(triggerCount) && triggerCount > 0 && coreCount >= triggerCount) ||
        (Number.isFinite(triggerTokens) && triggerTokens > 0 && coreTokens >= triggerTokens) ||
        burstTrigger

      const lastRunAt = contact.memory.lastManagerRunAt || 0
      const intervalMs = (settings.memoryManagerInterval || 10) * 60 * 1000
      if (shouldTrigger && coreCount >= 5 && Date.now() - lastRunAt >= intervalMs) {
        import('./memory/manager.js').then(({ runMemoryManager }) => {
          runMemoryManager(contact, scheduleSave).catch(() => {})
        }).catch(() => {})
      }
    }

    return result
  }

  function deleteSummary(contact, summaryId, type = 'short') {
    return deleteSummaryImpl(contact, summaryId, type)
  }

  function updateSummary(contact, summaryId, content, type = 'short') {
    return updateSummaryImpl(contact, summaryId, content, type)
  }

  async function rerollSummary(contact, summaryId, type = 'short') {
    return rerollSummaryImpl(contact, summaryId, type, { callSummaryAPI })
  }

  return {
    initContactMemory,
    getSummaryConfig,
    callSummaryAPI,
    generateShortSummary,
    checkAndMergeLongTerm,
    checkKeywordTrigger,
    addCoreMemory,
    updateCoreMemory,
    deleteCoreMemory,
    deleteSummary,
    updateSummary,
    rerollSummary,
    checkAutoSummaryTrigger,
    buildMemoryPrompt,
    invalidateRoundVectors,
    onMessageSent,
    onAssistantReplied,
    refreshContextSummary,
    DEFAULT_MEMORY_SETTINGS
  }
}
