import { ref } from 'vue'
import { useContactsStore } from '../../../stores/contacts'
import { useConfigsStore } from '../../../stores/configs'
import { useLorebookStore } from '../../../stores/lorebook'
import { usePersonasStore } from '../../../stores/personas'
import { useSettingsStore } from '../../../stores/settings'
import { useOfflineStore } from '../../../stores/offline'
import { useMemory } from '../../../composables/useMemory'
import {
  getTemplateVars,
  applyTemplateVars,
  insertLorebookEntries,
  buildPersonaSystemPrompt
} from '../../../composables/api/prompts'
import { applyOptionalMaxTokens, parseOptionalMaxTokens } from '../../../composables/api/chatCompletions'
import { createApiError, createApiFailureResult } from '../../../composables/api/errors'
import { runOpenAICompatTextStream } from '../../../composables/api/openaiCompatTextStream'
import { buildHistorySearchQueries, searchMessages, formatRetrievedContext, rerankWithLLM } from '../../../composables/retrieval/useHistorySearch'
import { makeId } from '../../../utils/id'
import { resolveOfflineRegexBindings } from '../../../utils/offlineRegex'
import { applyPromptRegexRules } from '../utils/offlineRichText'

const RP_FORMAT_TEMPLATE = `你正在和 {{user}} 进行沉浸式角色扮演。
用小说叙事体写作，混合对话、动作、心理和环境描写。
对话用引号包裹，动作和心理用 *斜体*。
每次 2-4 段，不要代替 {{user}} 行动。`

function createOfflinePromptStore(contact, { lorebookStore, personasStore, settingsStore }) {
  return {
    activeChat: contact,
    get lorebook() {
      return lorebookStore.lorebook
    },
    get globalPresetLorebookEnabled() {
      return settingsStore.globalPresetLorebookEnabled
    },
    getPersonaForContact(contactId) {
      return personasStore.getPersonaForContact(contactId)
    }
  }
}

function resolveConfig(configsStore, configId) {
  const byId = Array.isArray(configsStore.configs)
    ? configsStore.configs.find(c => c.id === configId)
    : null
  if (byId) return byId
  return configsStore.getConfig || null
}

function buildFailure(code, message, context = {}, options = {}) {
  return createApiFailureResult(
    createApiError(code, message, context, options),
    { context }
  )
}

function buildOfflineReplyMeta(streamResult, genStartTime) {
  const stats = { duration: Date.now() - genStartTime }
  const usage = streamResult?.usage
  const finishReason = streamResult?.finishReason || null
  const truncated = finishReason === 'length'

  if (finishReason) stats.finishReason = finishReason
  if (truncated) stats.truncated = true
  if (usage && typeof usage === 'object') {
    if (usage.prompt_tokens != null) stats.promptTokens = usage.prompt_tokens
    if (usage.completion_tokens != null) stats.completionTokens = usage.completion_tokens
    if (usage.total_tokens != null) stats.totalTokens = usage.total_tokens
  }

  return { stats, finishReason, truncated }
}

export function useOfflineApi() {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const lorebookStore = useLorebookStore()
  const personasStore = usePersonasStore()
  const settingsStore = useSettingsStore()
  const offlineStore = useOfflineStore()
  const { buildMemoryPrompt } = useMemory()
  const isGenerating = ref(false)
  const streamingText = ref('')
  let abortController = null

  function getContact(contactId) {
    return contactsStore.contacts.find(c => c.id === contactId) || null
  }

  function buildEffectiveRegexRules(contact) {
    const presetId = String(offlineStore.activePresetId || '').trim()
    const preset = presetId ? offlineStore.getPreset(presetId) : null
    return resolveOfflineRegexBindings({
      globalRules: offlineStore.regexRules || [],
      presetRules: preset?.regexRules || [],
      characterRules: contact?.offlineRegexRules || []
    }).combinedRules
  }

  /**
   * Build a compact <recent_chat> block from the last few main chat messages.
   * Only injected when offlineMsgs is empty (start of a new offline session)
   * so the AI can naturally continue from the recent conversation context.
   */
  function buildRecentChatBridge(contact, options = {}) {
    const mainMsgs = Array.isArray(contact.msgs) ? contact.msgs : []
    const offlineMsgs = Array.isArray(contact.offlineMsgs) ? contact.offlineMsgs : []
    const forceSessionStart = options.forceSessionStart === true

    // Only inject at session start (no offline messages yet)
    if (!forceSessionStart && offlineMsgs.length > 0) return ''

    // Check for meet scene context (from accepted meet invitation)
    const meetScene = contact.meetSceneContext
    if (meetScene) {
      let sceneDesc = `你们约好在${meetScene.location}见面。`
      if (meetScene.time) sceneDesc += `时间：${meetScene.time}。`
      if (meetScene.note) sceneDesc += meetScene.note

      const meetBlock = [
        '<meet_scene>',
        sceneDesc,
        '请以这个场景为开头，描写你们线下见面的情景。',
        '</meet_scene>'
      ].join('\n')

      // Build recent chat bridge alongside meet scene
      const chatBridge = buildChatBridgeLines(contact, mainMsgs)
      return chatBridge ? chatBridge + '\n\n' + meetBlock : meetBlock
    }

    return buildChatBridgeLines(contact, mainMsgs)
  }

  function buildChatBridgeLines(contact, mainMsgs) {
    if (mainMsgs.length === 0) return ''

    // Collect last N text messages (skip images, stickers, system cards)
    const MAX_RECENT = 6
    const MAX_CHAR_PER_MSG = 80
    const candidates = []
    for (let i = mainMsgs.length - 1; i >= 0 && candidates.length < MAX_RECENT; i--) {
      const m = mainMsgs[i]
      if (!m || !m.content) continue
      if (m.isImage || m.isSticker) continue
      if (m.type === 'offlineCard') continue
      if (m.role !== 'user' && m.role !== 'assistant') continue
      candidates.unshift(m)
    }

    if (candidates.length === 0) return ''

    const lines = candidates.map(m => {
      const who = m.role === 'user' ? '{{user}}' : '{{char}}'
      const text = String(m.content).replace(/\n+/g, ' ').trim()
      const truncated = text.length > MAX_CHAR_PER_MSG
        ? text.slice(0, MAX_CHAR_PER_MSG) + '…'
        : text
      return `${who}: ${truncated}`
    })

    return [
      '<recent_chat>',
      '以下是你们在线上聊天中最近的对话，请自然地衔接这些话题展开线下互动：',
      lines.join('\n'),
      '</recent_chat>'
    ].join('\n')
  }

  function buildSystemMessages(contact, options = {}) {
    const promptStore = createOfflinePromptStore(contact, { lorebookStore, personasStore, settingsStore })
    const templateVars = getTemplateVars(promptStore, contact.name)

    // Character prompt
    const charPromptRaw = String(contact.prompt || '')
    const charPrompt = applyTemplateVars(charPromptRaw, templateVars)

    // RP format prompt
    const rpPrompt = applyTemplateVars(RP_FORMAT_TEMPLATE, templateVars)

    // Persona
    const personaPrompt = applyTemplateVars(buildPersonaSystemPrompt(promptStore, contact.id), templateVars)

    // Memory
    const memoryPrompt = buildMemoryPrompt(contact)

    // Recent main chat context bridge (only at session start)
    const recentChatBridge = buildRecentChatBridge(contact, options)

    // Build main system message
    const parts = [charPrompt]
    if (personaPrompt) parts.push(personaPrompt)
    parts.push(rpPrompt)
    if (memoryPrompt) parts.push(`<memory>\n${memoryPrompt}\n</memory>`)
    if (recentChatBridge) parts.push(applyTemplateVars(recentChatBridge, templateVars))

    const messages = [{ role: 'system', content: parts.join('\n\n') }]

    // Inject lorebook entries
    const enriched = insertLorebookEntries(promptStore, messages, templateVars)

    return enriched
  }

  /**
   * Retrieve relevant history from main chat messages for context injection.
   * Uses the same TF-IDF + optional LLM reranking as the main chat system.
   */
  async function retrieveMainChatMemory(contact, query) {
    if (!settingsStore.offlineRetrieveMainMemory) return ''
    const mainMsgs = Array.isArray(contact.msgs) ? contact.msgs : []
    if (mainMsgs.length === 0 || !query) return ''

    const settings = contact.memorySettings || {}
    const maxResults = settings.historyRetrievalCount || 3
    const maxTokens = settings.maxRetrievalTokens || 320

    const queryVariants = [
      { text: String(query || '').trim(), weight: 1.8 },
      ...buildHistorySearchQueries(mainMsgs).slice(0, 4)
    ]

    const results = searchMessages(mainMsgs, query, {
      maxResults: maxResults * 2,
      excludeRecent: 0,
      maxTokens,
      queryVariants
    })
    if (results.length === 0) return ''

    let finalResults = results
    if (settings.historyRetrievalMode === 'llm' && results.length > 1) {
      try {
        finalResults = await rerankWithLLM(results, query, contact)
      } catch {
        finalResults = results
      }
    }

    return formatRetrievedContext(finalResults, mainMsgs, { maxTokens })
  }

  function buildPresetMessages(contact) {
    const presetId = offlineStore.activePresetId
    if (!presetId) return []
    const preset = offlineStore.getPreset(presetId)
    if (!preset) return []

    const entries = (preset.promptEntries || [])
      .filter(e => e.enabled && String(e.content || '').trim())
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    const promptStore = createOfflinePromptStore(contact, { lorebookStore, personasStore, settingsStore })
    const templateVars = getTemplateVars(promptStore, contact.name)
    const messages = []

    // System prompt from preset
    if (preset.systemPrompt) {
      messages.push({ role: 'system', content: applyTemplateVars(preset.systemPrompt, templateVars) })
    }

    // Prompt entries
    for (const entry of entries) {
      if (entry.injectionDepth === 0 || entry.injectionPosition !== 'in_chat') {
        messages.push({ role: entry.role || 'system', content: applyTemplateVars(entry.content, templateVars) })
      }
    }

    return messages
  }

  function hasSelectedPreset() {
    const presetId = offlineStore.activePresetId
    if (!presetId) return false
    return !!offlineStore.getPreset(presetId)
  }

  function buildChatMessages(contact) {
    const msgs = contact.offlineMsgs || []
    const regexRules = buildEffectiveRegexRules(contact)
    return msgs.map(m => ({
      role: m.role,
      content: applyPromptRegexRules(m.content, regexRules)
    }))
  }

  function getPresetParams() {
    const presetId = offlineStore.activePresetId
    if (!presetId) return {}
    const preset = offlineStore.getPreset(presetId)
    if (!preset) return {}
    const params = {}
    if (preset.temperature != null) params.temperature = preset.temperature
    const presetMaxTokens = parseOptionalMaxTokens(preset.maxTokens)
    if (presetMaxTokens != null) params.max_tokens = presetMaxTokens
    if (preset.topP != null) params.top_p = preset.topP
    if (preset.frequencyPenalty != null) params.frequency_penalty = preset.frequencyPenalty
    if (preset.presencePenalty != null) params.presence_penalty = preset.presencePenalty
    return params
  }

  async function sendMessage(contactId, userContent, onDelta) {
    const contact = getContact(contactId)
    if (!contact) {
      return buildFailure('CONTACT_NOT_FOUND', '联系人不存在', {
        feature: 'offline',
        action: 'sendMessage',
        contactId
      })
    }

    const configId = contact?.configId || configsStore.activeConfigId
    const cfg = resolveConfig(configsStore, configId)
    if (!cfg?.key) {
      return buildFailure('CONFIG_MISSING', '请先配置 API Key', {
        feature: 'offline',
        action: 'sendMessage',
        contactId
      })
    }

    const wasSessionStart = !Array.isArray(contact.offlineMsgs) || contact.offlineMsgs.length === 0
    const usedMeetScene = wasSessionStart && !!contact.meetSceneContext
    const regexRules = buildEffectiveRegexRules(contact)

    const promptUserContent = applyPromptRegexRules(userContent, regexRules)
    const historyChatMsgs = buildChatMessages(contact)

    // Add user message for UI immediately after prompt context is captured.
    const userMsg = {
      id: makeId('omsg'),
      role: 'user',
      content: userContent,
      time: Date.now()
    }
    if (!contact.offlineMsgs) contact.offlineMsgs = []
    contact.offlineMsgs.push(userMsg)

    isGenerating.value = true
    streamingText.value = ''
    abortController = new AbortController()
    const genStartTime = Date.now()

    try {
      const usePresetOnly = hasSelectedPreset()
      const systemMsgs = usePresetOnly ? [] : buildSystemMessages(contact, { forceSessionStart: wasSessionStart })
      const presetMsgs = buildPresetMessages(contact)
      const presetParams = getPresetParams()

      // Inject depth-based preset entries
      const preset = offlineStore.activePresetId ? offlineStore.getPreset(offlineStore.activePresetId) : null
      const depthEntries = (preset?.promptEntries || [])
        .filter(e => e.enabled && String(e.content || '').trim() && e.injectionDepth > 0 && e.injectionPosition === 'in_chat')
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      // Insert depth entries into chat messages
      let finalChatMsgs = [...historyChatMsgs, { role: 'user', content: promptUserContent }]
      const promptStore = createOfflinePromptStore(contact, { lorebookStore, personasStore, settingsStore })
      const templateVars = getTemplateVars(promptStore, contact.name)
      for (const entry of depthEntries) {
        const depth = Math.min(entry.injectionDepth, finalChatMsgs.length)
        const insertIdx = finalChatMsgs.length - depth
        finalChatMsgs.splice(insertIdx, 0, {
          role: entry.role || 'system',
          content: applyTemplateVars(entry.content, templateVars)
        })
      }

      // Jailbreak prompt
      if (preset?.jailbreakPrompt) {
        finalChatMsgs.push({ role: 'system', content: applyTemplateVars(preset.jailbreakPrompt, templateVars) })
      }

      // Retrieve relevant history from main chat
      let retrievedCtx = ''
      try {
        retrievedCtx = await retrieveMainChatMemory(contact, userContent)
      } catch {
        // silently skip retrieval errors
      }

      const messages = [
        ...systemMsgs,
        ...presetMsgs,
        ...(retrievedCtx ? [{ role: 'system', content: retrievedCtx }] : []),
        ...finalChatMsgs
      ]

      const body = {
        model: cfg.model,
        messages,
        stream: true,
        ...presetParams
      }

      // Temperature keeps preset priority; max_tokens keeps API-config priority.
      if (!('temperature' in presetParams) && cfg.temperature != null) body.temperature = cfg.temperature
      // max_tokens priority: user API config > offline preset
      applyOptionalMaxTokens(body, cfg.maxTokens, presetParams.max_tokens)
      const { text: fullText, streamResult } = await runOpenAICompatTextStream({
        cfg,
        body,
        signal: abortController.signal,
        errorPrefix: 'API 错误',
        includeStatusInMessage: true,
        onDelta(delta) {
          if (onDelta) onDelta(delta)
        },
        onText(text) {
          streamingText.value = text
        }
      })

      if (!fullText.trim()) {
        return buildFailure('EMPTY_REPLY', 'AI 回复为空', {
          feature: 'offline',
          action: 'sendMessage',
          contactId
        })
      }

      const { stats, finishReason, truncated } = buildOfflineReplyMeta(streamResult, genStartTime)

      // Add assistant message
      const assistantMsg = {
        id: makeId('omsg'),
        role: 'assistant',
        content: fullText.trim(),
        time: Date.now(),
        stats,
        finishReason,
        truncated
      }
      contact.offlineMsgs.push(assistantMsg)
      if (usedMeetScene) {
        contact.meetSceneContext = null
      }

      return {
        success: true,
        content: fullText.trim(),
        finishReason,
        truncated
      }
    } catch (e) {
      return createApiFailureResult(e, {
        context: {
          feature: 'offline',
          action: 'sendMessage',
          contactId
        }
      })
    } finally {
      isGenerating.value = false
      streamingText.value = ''
      abortController = null
    }
  }

  async function generateOpening(contactId, onDelta) {
    const contact = getContact(contactId)
    if (!contact) {
      return buildFailure('CONTACT_NOT_FOUND', '联系人不存在', {
        feature: 'offline',
        action: 'generateOpening',
        contactId
      })
    }
    if (Array.isArray(contact.offlineMsgs) && contact.offlineMsgs.length > 0) {
      return buildFailure('API_ERROR', '已有线下内容', {
        feature: 'offline',
        action: 'generateOpening',
        contactId
      })
    }

    const configId = contact?.configId || configsStore.activeConfigId
    const cfg = resolveConfig(configsStore, configId)
    if (!cfg?.key) {
      return buildFailure('CONFIG_MISSING', '请先配置 API Key', {
        feature: 'offline',
        action: 'generateOpening',
        contactId
      })
    }

    const usedMeetScene = !!contact.meetSceneContext
    const openingInstruction = '请直接开始线下见面的第一幕，用自然开场承接当前邀约，不要等待用户先说话。'

    isGenerating.value = true
    streamingText.value = ''
    abortController = new AbortController()
    const genStartTime = Date.now()

    try {
      const shouldUsePresetForOpening = settingsStore.meetOpeningUseOfflinePreset !== false
      const preset = shouldUsePresetForOpening && offlineStore.activePresetId
        ? offlineStore.getPreset(offlineStore.activePresetId)
        : null
      const usePresetOnly = !!preset
      const systemMsgs = usePresetOnly ? [] : buildSystemMessages(contact, { forceSessionStart: true })
      const presetMsgs = preset ? buildPresetMessages(contact) : []
      const presetParams = preset ? getPresetParams() : {}

      let retrievedCtx = ''
      try {
        retrievedCtx = await retrieveMainChatMemory(contact, openingInstruction)
      } catch {
        // silently skip retrieval errors
      }

      let finalChatMsgs = [{ role: 'user', content: openingInstruction }]
      if (preset) {
        const depthEntries = (preset.promptEntries || [])
          .filter(e => e.enabled && String(e.content || '').trim() && e.injectionDepth > 0 && e.injectionPosition === 'in_chat')
          .sort((a, b) => (a.order || 0) - (b.order || 0))

        const promptStore = createOfflinePromptStore(contact, { lorebookStore, personasStore, settingsStore })
        const templateVars = getTemplateVars(promptStore, contact.name)

        for (const entry of depthEntries) {
          const depth = Math.min(entry.injectionDepth, finalChatMsgs.length)
          const insertIdx = finalChatMsgs.length - depth
          finalChatMsgs.splice(insertIdx, 0, {
            role: entry.role || 'system',
            content: applyTemplateVars(entry.content, templateVars)
          })
        }

        if (preset.jailbreakPrompt) {
          finalChatMsgs.push({
            role: 'system',
            content: applyTemplateVars(preset.jailbreakPrompt, templateVars)
          })
        }
      }

      const messages = [
        ...systemMsgs,
        ...presetMsgs,
        ...(retrievedCtx ? [{ role: 'system', content: retrievedCtx }] : []),
        ...finalChatMsgs
      ]

      const body = {
        model: cfg.model,
        messages,
        stream: true,
        ...presetParams
      }

      if (!('temperature' in presetParams) && cfg.temperature != null) body.temperature = cfg.temperature
      applyOptionalMaxTokens(body, cfg.maxTokens, presetParams.max_tokens)
      const { text: fullText, streamResult } = await runOpenAICompatTextStream({
        cfg,
        body,
        signal: abortController.signal,
        errorPrefix: 'API 错误',
        includeStatusInMessage: true,
        onDelta(delta) {
          if (onDelta) onDelta(delta)
        },
        onText(text) {
          streamingText.value = text
        }
      })

      if (!fullText.trim()) {
        return buildFailure('EMPTY_REPLY', 'AI 回复为空', {
          feature: 'offline',
          action: 'generateOpening',
          contactId
        })
      }

      const { stats, finishReason, truncated } = buildOfflineReplyMeta(streamResult, genStartTime)

      if (!contact.offlineMsgs) contact.offlineMsgs = []
      contact.offlineMsgs.push({
        id: makeId('omsg'),
        role: 'assistant',
        content: fullText.trim(),
        time: Date.now(),
        stats,
        finishReason,
        truncated
      })
      if (usedMeetScene) {
        contact.meetSceneContext = null
      }

      return {
        success: true,
        content: fullText.trim(),
        finishReason,
        truncated
      }
    } catch (e) {
      return createApiFailureResult(e, {
        context: {
          feature: 'offline',
          action: 'generateOpening',
          contactId
        }
      })
    } finally {
      isGenerating.value = false
      streamingText.value = ''
      abortController = null
    }
  }

  async function regenerate(contactId, onDelta) {
    const contact = getContact(contactId)
    if (!contact || !contact.offlineMsgs?.length) {
      return buildFailure('API_ERROR', '没有消息可重新生成', {
        feature: 'offline',
        action: 'regenerate',
        contactId
      })
    }

    // Remove last assistant message
    const lastIdx = contact.offlineMsgs.length - 1
    if (contact.offlineMsgs[lastIdx]?.role === 'assistant') {
      contact.offlineMsgs.splice(lastIdx, 1)
    }

    // Find last user message to resend
    const lastUser = [...contact.offlineMsgs].reverse().find(m => m.role === 'user')
    if (!lastUser) {
      return buildFailure('API_ERROR', '没有用户消息', {
        feature: 'offline',
        action: 'regenerate',
        contactId
      })
    }

    // Remove the last user message to resend
    const userIdx = contact.offlineMsgs.lastIndexOf(lastUser)
    contact.offlineMsgs.splice(userIdx, 1)

    return sendMessage(contactId, lastUser.content, onDelta)
  }

  function cancelGeneration() {
    if (abortController) {
      abortController.abort()
    }
  }

  return {
    isGenerating,
    streamingText,
    generateOpening,
    sendMessage,
    regenerate,
    cancelGeneration
  }
}
