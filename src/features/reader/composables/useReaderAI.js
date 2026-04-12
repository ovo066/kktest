/**
 * useReaderAI: handles "reading together" chat and streaming response.
 * Provides two independent chat channels:
 *   - main chat (avatar/toolbar): general book discussion with AI character
 *   - selection chat (选文胶囊): discuss specific selected text
 */
import { ref } from 'vue'
import { useContactsStore } from '../../../stores/contacts'
import { useConfigsStore } from '../../../stores/configs'
import { useLorebookStore } from '../../../stores/lorebook'
import { usePersonasStore } from '../../../stores/personas'
import { useSettingsStore } from '../../../stores/settings'
import { useReaderStore } from '../../../stores/reader'
import { useMusicStore } from '../../../stores/music'
import { applyOptionalMaxTokens } from '../../../composables/api/chatCompletions'
import { getTemplateVars, applyTemplateVars, buildPersonaSystemPrompt, insertLorebookEntries } from '../../../composables/api/prompts'
import { buildContextMessages, splitIntoRounds } from '../../../composables/api/contextWindow'
import { runOpenAICompatTextStream } from '../../../composables/api/openaiCompatTextStream'
import { useMemory } from '../../../composables/useMemory'

function trimText(text, maxLength) {
  if (!text) return ''
  const normalized = String(text).trim()
  if (!maxLength || normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
}

function toInlineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function formatTimeLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Build a compact summary string for the middle context section.
 * This summary is injected via contextWindow's middleSummary.
 */
function buildReaderMiddleSummary(middleMsgs, roleLabels = {}) {
  if (!Array.isArray(middleMsgs) || middleMsgs.length === 0) return ''

  const assistantLabel = trimText(toInlineText(roleLabels.assistant), 40) || 'Assistant'
  const userLabel = trimText(toInlineText(roleLabels.user), 40) || 'User'

  let sampled = middleMsgs
  if (middleMsgs.length > 24) {
    sampled = [...middleMsgs.slice(0, 8), ...middleMsgs.slice(-16)]
  }

  const lines = sampled
    .map((msg) => {
      const role = msg?.role === 'assistant' ? assistantLabel : userLabel
      const content = trimText(toInlineText(msg?.content), 140)
      if (!content) return ''
      return `${role}: ${content}`
    })
    .filter(Boolean)

  if (!lines.length) return ''
  const header = middleMsgs.length > sampled.length
    ? `Earlier chat memory (${middleMsgs.length} messages, sampled):`
    : `Earlier chat memory (${middleMsgs.length} messages):`
  return trimText([header, ...lines].join('\n'), 2400)
}

const READER_CONTEXT_HEAD_ROUNDS = 1
const DEFAULT_READER_KEEP_COUNT = 20
const MIN_READER_KEEP_COUNT = 8
const MAX_READER_KEEP_COUNT = 200

function normalizeReaderKeepCount(keepCount) {
  if (keepCount === null || keepCount === undefined || keepCount === '') return DEFAULT_READER_KEEP_COUNT
  const n = Number(keepCount)
  if (!Number.isFinite(n)) return DEFAULT_READER_KEEP_COUNT
  if (n <= 0) return 0
  return Math.max(MIN_READER_KEEP_COUNT, Math.min(MAX_READER_KEEP_COUNT, Math.round(n)))
}

function resolveTailRoundsByKeepCount(rounds, keepCount) {
  if (!Array.isArray(rounds) || rounds.length === 0) return 1
  if (keepCount <= 0) return rounds.length

  let collected = 0
  let tailRounds = 0
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    collected += rounds[i].length
    tailRounds += 1
    if (collected >= keepCount) break
  }
  return Math.max(1, tailRounds)
}

/**
 * Build reader chat context by reusing the main chat smart context helper.
 * keepCount = 0 means "keep all" (no compression / deletion).
 */
function buildReaderContextMessages(allMessages, keepCountSetting, roleLabels = {}) {
  if (!Array.isArray(allMessages) || allMessages.length === 0) return []

  const keepCount = normalizeReaderKeepCount(keepCountSetting)
  if (keepCount === 0) return allMessages.slice()
  if (allMessages.length <= keepCount) return allMessages.slice()

  const rounds = splitIntoRounds(allMessages)
  if (!rounds.length) return allMessages.slice(-keepCount)

  const maxTailRounds = Math.max(1, rounds.length - READER_CONTEXT_HEAD_ROUNDS)
  const tailRounds = Math.min(resolveTailRoundsByKeepCount(rounds, keepCount), maxTailRounds)

  let middleSummary = ''
  if (rounds.length > READER_CONTEXT_HEAD_ROUNDS + tailRounds) {
    const middleMsgs = rounds.slice(READER_CONTEXT_HEAD_ROUNDS, rounds.length - tailRounds).flat()
    middleSummary = buildReaderMiddleSummary(middleMsgs, roleLabels)
  }

  return buildContextMessages(allMessages, {
    headRounds: READER_CONTEXT_HEAD_ROUNDS,
    tailRounds,
    middleSummary
  })
}

function cleanPromptForReader(prompt) {
  if (!prompt) return ''
  return String(prompt)
    .replace(/你正在.*?手机聊天.*?\n?/g, '')
    .replace(/每一行必须.*?\n?/g, '')
    .replace(/引用回复.*?\n?/g, '')
    .replace(/\[(?:quote|引用)[:：][^\]]+\].*?\n?/gi, '')
    .trim()
}

function getReaderCustomPrompt(readerStore) {
  const raw = readerStore?.readerAISettings?.customSystemPrompt
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

function resolveConfig(store, configId) {
  const byId = Array.isArray(store.configs)
    ? store.configs.find(c => c.id === configId)
    : null
  if (byId) return byId

  if (store.getConfig && typeof store.getConfig === 'object' && 'value' in store.getConfig) {
    return store.getConfig.value
  }
  return store.getConfig || null
}

function createReaderContextStore({ contactsStore, configsStore, lorebookStore, personasStore, settingsStore }) {
  return {
    get activeChat() {
      return contactsStore.activeChat
    },
    get activeConfigId() {
      return configsStore.activeConfigId
    },
    get configs() {
      return configsStore.configs
    },
    get getConfig() {
      return configsStore.getConfig
    },
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

function buildSystemPrompt(store, readerStore, {
  selectedText,
  contextText,
  memoryPrompt,
  chapterSummariesText,
  chatHistoryText,
  musicContext
}) {
  const contact = store.activeChat
  if (!contact) return ''

  const book = readerStore.activeBook
  if (!book) return ''

  const templateVars = getTemplateVars(store, contact.name)
  const userName = templateVars.user
  const customPrompt = getReaderCustomPrompt(readerStore)
  const rolePromptRaw = contact.prompt || ''
  const rolePrompt = cleanPromptForReader(rolePromptRaw) || rolePromptRaw
  const safeRolePrompt = rolePrompt || `You are ${contact.name || 'the reading companion'}.`
  const personaPrompt = buildPersonaSystemPrompt(store, contact.id)

  const chapterIndex = book.progress?.chapterIndex ?? 0
  const chapterTitle = book.chapterTitles?.[chapterIndex] || `Chapter ${chapterIndex + 1}`
  const ctxText = trimText(contextText, 900)
  const selText = trimText(selectedText, 500)

  const sections = []
  sections.push(`<role>\n${safeRolePrompt}\n\n[Current scene: You are now in a shared reading session with ${userName}, not in a chat conversation. Respond accordingly.]\n</role>`)

  if (customPrompt) {
    sections.push(`<user_preferences>\n${customPrompt}\n</user_preferences>`)
  }

  if (personaPrompt) {
    sections.push(`<user_persona>\n${personaPrompt.replace('用户面具：\n', '')}\n</user_persona>`)
  }

  const readingParts = [
    `You are reading together with ${userName}.`,
    `Book: ${book.title || 'Unknown Book'}`,
    `Current chapter: ${chapterTitle}`
  ]

  if (ctxText) {
    readingParts.push(`Current page content:\n---\n${ctxText}\n---`)
  }

  if (selText) {
    readingParts.push(`User selected text:\n---\n${selText}\n---`)
  }

  sections.push(`<reading_together>\n${readingParts.join('\n')}\n</reading_together>`)

  if (musicContext?.title) {
    const musicParts = [
      `用户当前歌曲：《${musicContext.title}》 - ${musicContext.artist || '未知歌手'}`,
      `状态：${musicContext.isPlaying ? '播放中' : '已暂停'}`
    ]
    if (musicContext.duration > 0) {
      musicParts.push(`进度：${formatTimeLabel(musicContext.progress)} / ${formatTimeLabel(musicContext.duration)}`)
    }
    if (musicContext.listenTogether) {
      musicParts.push('用户已开启一起听模式，可自然评论当前歌曲并联动阅读氛围。')
    }
    sections.push(`<music_context>\n${musicParts.join('\n')}\n</music_context>`)
  }

  if (memoryPrompt) {
    sections.push(`<shared_memory>\n${memoryPrompt}\n</shared_memory>`)
  }

  if (chatHistoryText) {
    sections.push(`<recent_chat_history>\nRecent messages from your main chat with ${userName} (for context continuity):\n${chatHistoryText}\n</recent_chat_history>`)
  }

  if (chapterSummariesText) {
    sections.push(`<chapter_summaries>\n${chapterSummariesText}\n</chapter_summaries>`)
  }

  sections.push(`<output_style>
Stay in character — keep the speaking style, tone, and personality defined in your role prompt.
Focus on the shared reading scene and current discussion.
Keep the reply natural and concise, with short paragraphs.
When helpful, you may use lightweight markdown emphasis like *italic* and **bold**.
Do not output chat-only command formats (like [quote:], transfer markers, or image tokens) unless user explicitly asks.
</output_style>`)

  return applyTemplateVars(sections.join('\n\n'), templateVars)
}

function buildTurnPayload(userText, selectedText, contextText) {
  const blocks = [`User message: ${userText}`]

  const selText = trimText(selectedText, 600)
  if (selText) {
    blocks.push(`Selected text:\n---\n${selText}\n---`)
  }

  const ctxText = trimText(contextText, 1200)
  if (ctxText) {
    blocks.push(`Current page content:\n---\n${ctxText}\n---`)
  }

  return blocks.join('\n\n')
}

/**
 * Creates an independent chat channel with its own streaming state.
 * @param {object} opts
 * @param {Function} opts.getChatState - returns the reactive chat state object ({ messages, selectedText, contextText })
 * @param {Function} opts.addMessage - (role, content) => void
 * @param {Function} opts.onChatUpdated - called after message changes
 */
function createChatChannel(store, readerStore, opts, memorySystem) {
  const isStreaming = ref(false)
  const abortController = ref(null)
  const musicStore = useMusicStore()

  function buildAPIMessages() {
    const chatState = opts.getChatState()
    const contact = store.activeChat
    if (!contact) return null

    const aiSettings = readerStore.readerAISettings
    const templateVars = getTemplateVars(store, contact?.name || '')
    const roleLabels = {
      assistant: contact?.name || 'Assistant',
      user: templateVars.user || 'User'
    }
    let memoryPrompt = ''
    if (contact && memorySystem && aiSettings.shareMemory !== false) {
      try { memoryPrompt = memorySystem.buildMemoryPrompt(contact) } catch { /* ignore */ }
    }

    let chatHistoryText = ''
    const historyCount = aiSettings.shareChatHistoryCount || 0
    if (aiSettings.shareMemory !== false && historyCount > 0 && contact?.msgs?.length) {
      const recentMsgs = contact.msgs
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-historyCount)
      if (recentMsgs.length) {
        chatHistoryText = recentMsgs
          .map(m => `${m.role === 'user' ? roleLabels.user : roleLabels.assistant}: ${String(m.content || '').slice(0, 200)}`)
          .join('\n')
      }
    }

    let chapterSummariesText = ''
    const book = readerStore.activeBook
    if (book) {
      const chapterIndex = book.progress?.chapterIndex ?? 0
      const maxChapters = aiSettings.maxSummaryChapters || 5
      const allSummaries = readerStore.getChapterSummariesUpTo(book.id, chapterIndex + 1)
      const summaries = allSummaries.slice(-maxChapters)
      if (summaries.length) {
        chapterSummariesText = summaries
          .map(s => `Chapter ${s.chapterIndex + 1}: ${s.summary}`)
          .join('\n')
      }
    }

    const systemPrompt = buildSystemPrompt(store, readerStore, {
      selectedText: chatState.selectedText,
      contextText: chatState.contextText,
      memoryPrompt,
      chapterSummariesText,
      chatHistoryText,
      musicContext: musicStore.getMusicContext()
    })
    const messages = [{ role: 'system', content: systemPrompt }]

    const contextMessages = buildReaderContextMessages(chatState.messages, aiSettings.chatWindowMemoryKeepCount, roleLabels)
    let latestUserIndex = -1
    for (let i = contextMessages.length - 1; i >= 0; i--) {
      if (contextMessages[i]?.role === 'user') {
        latestUserIndex = i
        break
      }
    }
    contextMessages.forEach((msg, index) => {
      let content = msg.content
      if (msg.role === 'user' && index === latestUserIndex) {
        content = buildTurnPayload(content, chatState.selectedText, chatState.contextText)
      }
      messages.push({ role: msg.role, content })
    })

    // Inject lorebook entries if enabled (reuse main chat's bound lorebooks)
    if (aiSettings.shareLorebook) {
      const templateVars = getTemplateVars(store, contact?.name || '')
      const finalMessages = insertLorebookEntries(store, messages, templateVars)
      return { messages: finalMessages, contact }
    }

    return { messages, contact }
  }

  async function streamResponse() {
    const result = buildAPIMessages()
    if (!result) return

    const { messages, contact } = result
    const chatState = opts.getChatState()
    const configId = contact?.configId || store.activeConfigId
    const config = resolveConfig(store, configId)
    if (!config?.url || !config?.key) {
      opts.addMessage('assistant', '（未配置 API，请先在设置中添加 API 配置）')
      opts.onChatUpdated()
      return
    }

    isStreaming.value = true
    abortController.value = new AbortController()

    opts.addMessage('assistant', '')
    const assistantMsg = chatState.messages[chatState.messages.length - 1]

    try {
      const body = {
        model: config.model || 'gpt-3.5-turbo',
        messages,
        stream: true
      }

      if (config.temperature != null) body.temperature = config.temperature
      if (config.maxTokens != null) body.max_tokens = config.maxTokens

      await runOpenAICompatTextStream({
        cfg: config,
        body,
        signal: abortController.value.signal,
        onText(text) {
          assistantMsg.content = text
        }
      })
    } catch (err) {
      if (err?.name !== 'AbortError') {
        if (Number.isFinite(Number(err?.status))) {
          assistantMsg.content = `（API 错误: ${err.status} ${err?.message || 'unknown error'}）`
        } else {
          assistantMsg.content = `（请求失败: ${err?.message || 'unknown error'}）`
        }
      }
    } finally {
      isStreaming.value = false
      abortController.value = null
      opts.onChatUpdated()
    }
  }

  async function sendMessage(userText) {
    const normalizedText = userText?.trim()
    if (!normalizedText || isStreaming.value) return
    if (!store.activeChat) return

    opts.addMessage('user', normalizedText)
    opts.onChatUpdated()
    await streamResponse()
  }

  function stopStreaming() {
    abortController.value?.abort()
  }

  async function regenerateMessage(msgId) {
    if (isStreaming.value) return
    const chatState = opts.getChatState()
    const msgs = chatState.messages
    const idx = msgs.findIndex(m => m.id === msgId)
    if (idx === -1 || msgs[idx].role !== 'assistant') return
    msgs.splice(idx, 1)
    opts.onChatUpdated()
    // Only regenerate if there's still a user message in history
    if (msgs.some(m => m.role === 'user')) {
      await streamResponse()
    }
  }

  return { isStreaming, sendMessage, stopStreaming, regenerateMessage }
}

export async function generateChapterSummary(chapterText, bookId, chapterIndex) {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const lorebookStore = useLorebookStore()
  const personasStore = usePersonasStore()
  const settingsStore = useSettingsStore()
  const store = createReaderContextStore({ contactsStore, configsStore, lorebookStore, personasStore, settingsStore })
  const readerStore = useReaderStore()

  const contact = store.activeChat
  const configId = contact?.configId || store.activeConfigId
  const config = resolveConfig(store, configId)
  if (!config?.url || !config?.key) return null

  const trimmed = trimText(chapterText, 3000)
  if (!trimmed) return null

  try {
    const url = config.url.replace(/\/+$/, '') + '/chat/completions'
    const body = {
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: '请用2-3句话总结这一章的主要内容和情节发展。只输出总结，不要加前缀。' },
        { role: 'user', content: trimmed }
      ],
      temperature: 0.3
    }
    applyOptionalMaxTokens(body, config.maxTokens)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) return null

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()
    if (!summary) return null

    readerStore.addChapterSummary(bookId, chapterIndex, summary)
    return summary
  } catch {
    return null
  }
}

export function useReaderAI(options = {}) {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const lorebookStore = useLorebookStore()
  const personasStore = usePersonasStore()
  const settingsStore = useSettingsStore()
  const store = createReaderContextStore({ contactsStore, configsStore, lorebookStore, personasStore, settingsStore })
  const readerStore = useReaderStore()
  const memorySystem = useMemory()
  const onChatUpdated = typeof options.onChatUpdated === 'function' ? options.onChatUpdated : () => {}

  // Main AI chat channel (avatar / toolbar)
  const mainChat = createChatChannel(store, readerStore, {
    getChatState: () => readerStore.aiChat,
    addMessage: (role, content) => readerStore.sendAIChatMessage(role, content),
    onChatUpdated
  }, memorySystem)

  // Selection capsule chat channel (选文胶囊)
  const selectionChat = createChatChannel(store, readerStore, {
    getChatState: () => readerStore.selectionChat,
    addMessage: (role, content) => readerStore.sendSelectionChatMessage(role, content),
    onChatUpdated
  }, memorySystem)

  return {
    isStreaming: mainChat.isStreaming,
    sendMessage: mainChat.sendMessage,
    stopStreaming: mainChat.stopStreaming,
    regenerateMessage: mainChat.regenerateMessage,
    selectionIsStreaming: selectionChat.isStreaming,
    sendSelectionMessage: selectionChat.sendMessage,
    stopSelectionStreaming: selectionChat.stopStreaming,
    regenerateSelectionMessage: selectionChat.regenerateMessage
  }
}

