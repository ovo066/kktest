import { estimateTokens } from '../../utils/tokens'
import { addCoreMemory } from './coreMemory'
import {
  DEFAULT_MEMORY_SETTINGS,
  clampNumber,
  initContactMemory,
  isNearDuplicateMemoryContent,
  PRIORITY_ORDER,
  tryParseJsonArray
} from './shared'

export function buildAutoMemoryExtractionPrompt() {
  return [
    '请作为“严格记忆筛选器”，从以下对话中提取值得长期记住的信息。使用{{char}}和{{user}}。',
    '',
    '硬性要求（宁可漏记，也不要乱记）：',
    '1) 只记录“明确 + 稳定 + 未来复用价值高”的信息（半年后仍可能有用）。',
    '2) 仅记录用户明确表达或双方已确认的信息；禁止推测/脑补/虚构。',
    '3) 不记录：当前任务步骤、一次性请求/临时安排、仅对本次话题有效的细节、寒暄、虚构设定、任何敏感隐私（身份证/银行卡/密码/住址/精确联系方式/健康隐私等）。',
    '4) 情绪类：只记录“长期/反复/基线”状态（例如长期焦虑），不要记录“今天/此刻”的短期情绪。',
    '5) 每条 content 必须原子化、短句、<= 30 字。',
    '输出严格 JSON 数组（不要 Markdown，不要解释），格式：',
    '[{"content":"...", "priority":"high|normal|low", "category":"preference|relationship|emotion|fact|routine|people", "confidence":"high|medium|low"}]',
    '- routine(日常)：日常习惯、作息规律、固定行程',
    '- people(人物)：用户提到的重要的人（家人、朋友、同事等）及其关系',
    '- confidence：用户明确说出且事实确凿的用 high，上下文可推断的用 medium，不太确定的用 low',
    '没有要记住的就输出：[]'
  ].join('\n')
}

export function buildConversationSnippet(contact, startMsgId, options = {}) {
  if (!contact?.msgs?.length) {
    return { snippet: '', totalNewTextMsgs: 0, processedLastMsgId: null, lastMsgId: null }
  }

  const minMessages = clampNumber(options.minMessages, 1, 30, DEFAULT_MEMORY_SETTINGS.aiAutoMemoryMinNewMessages)
  const maxMessages = clampNumber(options.maxMessages, 4, 24, 12)

  const lastId = startMsgId || contact.memory?.lastAIMemoryMsgId
  const lastIndex = lastId ? contact.msgs.findIndex(m => m.id === lastId) : -1
  const newMsgs = contact.msgs.slice(lastIndex + 1)
  const lastMsgId = contact.msgs?.[contact.msgs.length - 1]?.id || null

  const textMsgs = newMsgs.filter(m => {
    if (!m) return false
    if (m.hideInChat) return false
    if (m.isImage || m.isSticker) return false
    if (!m.content) return false
    if (typeof m.content === 'string' && m.content.startsWith('⚠️ ')) return false
    return true
  })

  const roundCount = textMsgs.reduce((sum, m) => sum + (m.role === 'user' ? 1 : 0), 0)
  const tokenEstimate = textMsgs.reduce((sum, m) => sum + estimateTokens(String(m.content || '')), 0)

  if (textMsgs.length < minMessages) {
    return {
      snippet: '',
      totalNewTextMsgs: textMsgs.length,
      processedLastMsgId: null,
      lastMsgId,
      roundCount,
      tokenEstimate
    }
  }

  // Keep extracted memories relevant: process the most recent chunk.
  const chunk = textMsgs.slice(-maxMessages)
  const snippet = chunk.map(m => {
    const who = m.role === 'user' ? '用户' : (m.senderName || '助手')
    return `${who}: ${m.content}`
  }).join('\n')

  return {
    snippet,
    totalNewTextMsgs: textMsgs.length,
    processedLastMsgId: chunk[chunk.length - 1]?.id || null,
    lastMsgId,
    roundCount,
    tokenEstimate
  }
}

export function shouldAttemptAutoMemoryExtraction(snippet) {
  const s = String(snippet || '').trim()
  if (!s) return false

  const lines = s.split('\n').filter(Boolean)
  const userLines = lines
    .filter(line => line.startsWith('用户:'))
    .map(line => line.replace(/^用户:\s*/, '').trim())
    .filter(Boolean)

  // Skip if no user messages at all
  if (!userLines.length) return false

  // Skip if all user messages are very short greetings/reactions (avg < 8 chars)
  const avgLen = userLines.reduce((sum, l) => sum + l.length, 0) / userLines.length
  if (avgLen < 8) return false

  // At least one user message > 15 chars suggests substantive content
  if (userLines.some(l => l.length > 15)) return true

  // Check both user and assistant text for stable-fact cues
  const allText = lines
    .map(line => line.replace(/^(用户|助手|AI):\s*/, '').trim())
    .filter(Boolean)
    .join('\n')

  const cue = /(我(叫|是|住在|来自|工作|职业|学校|生日|年龄|属|岁)|我(很)?(喜欢|不喜欢|讨厌|害怕|介意|爱|想)|偏好|习惯|忌口|过敏|称呼|昵称|每天|每周|一直|总是|从不|通常|一般|经常|请你?(记住|以后)|以后(请|别|不要)|别(再)?(叫|提)|不要(再)?(叫|提)|叫我|称呼我|我(妈|爸|姐|弟|哥|妹|老婆|老公|男友|女友|朋友|同事|闺蜜|室友))/i
  return cue.test(allText)
}

export async function extractMemoriesWithAI(contact, deps = {}) {
  const {
    aiExtractInFlight,
    aiExtractLastAttemptAt,
    callSummaryAPI
  } = deps

  if (!contact) return { added: [], updated: [], skipped: true, cursorUpdated: false }
  if (typeof callSummaryAPI !== 'function' || !(aiExtractInFlight instanceof Map) || !(aiExtractLastAttemptAt instanceof Map)) {
    return { added: [], updated: [], error: '自动记忆提取器未初始化', cursorUpdated: false }
  }

  initContactMemory(contact)

  const settings = contact.memorySettings || DEFAULT_MEMORY_SETTINGS
  if (!settings.enabled || !settings.aiAutoMemory) return { added: [], updated: [], skipped: true, cursorUpdated: false }

  const contactId = contact.id || 'active'
  if (aiExtractInFlight.get(contactId)) return { added: [], updated: [], skipped: true, cursorUpdated: false }

  const lastAttemptAt = aiExtractLastAttemptAt.get(contactId) || 0
  // Simple throttle to avoid repeated extraction when the user spams "regen".
  if (Date.now() - lastAttemptAt < 15 * 1000) return { added: [], updated: [], skipped: true, cursorUpdated: false }
  aiExtractLastAttemptAt.set(contactId, Date.now())

  const coreCount = (contact.memory?.core || []).filter(m => m && m.content).length
  const dynamicMinMessages = coreCount >= 20
    ? Math.max(settings.aiAutoMemoryMinNewMessages, 18)
    : (coreCount >= 12 ? Math.max(settings.aiAutoMemoryMinNewMessages, 14) : settings.aiAutoMemoryMinNewMessages)

  const triggerRounds = Number(settings.aiAutoMemoryTriggerRounds)
  const triggerTokens = Number(settings.aiAutoMemoryTriggerTokens)
  const hasThresholdTrigger =
    (Number.isFinite(triggerRounds) && triggerRounds > 0) ||
    (Number.isFinite(triggerTokens) && triggerTokens > 0)

  const snippetResult = buildConversationSnippet(contact, null, {
    minMessages: hasThresholdTrigger ? 1 : dynamicMinMessages,
    maxMessages: 12
  })
  const snippet = snippetResult.snippet
  const lastMsgId = snippetResult.lastMsgId

  const reachedRounds =
    Number.isFinite(triggerRounds) &&
    triggerRounds > 0 &&
    (snippetResult.roundCount || 0) >= triggerRounds
  const reachedTokens =
    Number.isFinite(triggerTokens) &&
    triggerTokens > 0 &&
    (snippetResult.tokenEstimate || 0) >= triggerTokens
  const reachedFallbackCount =
    !hasThresholdTrigger &&
    (snippetResult.totalNewTextMsgs || 0) >= dynamicMinMessages

  if (!(reachedRounds || reachedTokens || reachedFallbackCount)) {
    if ((snippetResult.totalNewTextMsgs || 0) === 0 && lastMsgId) {
      contact.memory.lastAIMemoryMsgId = lastMsgId
      return { added: [], updated: [], skipped: true, cursorUpdated: true }
    }
    return { added: [], updated: [], skipped: true, cursorUpdated: false }
  }

  if (!snippet.trim()) {
    // No new text: advance cursor to avoid re-processing images/stickers forever.
    if ((snippetResult.totalNewTextMsgs || 0) === 0 && lastMsgId) {
      contact.memory.lastAIMemoryMsgId = lastMsgId
      return { added: [], updated: [], skipped: true, cursorUpdated: true }
    }
    // Not enough new text yet: accumulate until threshold is met.
    return { added: [], updated: [], skipped: true, cursorUpdated: false }
  }

  if (!shouldAttemptAutoMemoryExtraction(snippet)) {
    // Enough new messages, but no obvious stable memory cues — skip the API call
    // and advance the cursor to avoid repeated irrelevant prompts.
    if (lastMsgId) contact.memory.lastAIMemoryMsgId = lastMsgId
    return { added: [], updated: [], skipped: true, cursorUpdated: true }
  }

  aiExtractInFlight.set(contactId, true)
  try {
    const prompt = buildAutoMemoryExtractionPrompt()
    const result = await callSummaryAPI(prompt, snippet, contact, { temperature: 0.2 })
    if (!result.success) return { added: [], updated: [], error: result.error, cursorUpdated: false }

    const arr = tryParseJsonArray(result.content)
    if (!arr) return { added: [], updated: [], error: 'AI 输出无法解析为 JSON 数组', cursorUpdated: false }

    const existingIds = new Set((contact.memory.core || []).map(m => m?.id).filter(Boolean))
    const added = []
    const updated = []

    const MAX_ITEMS = coreCount >= 18 ? 1 : 3
    let count = 0
    for (const item of arr) {
      if (count >= MAX_ITEMS) break

      const content = item && typeof item === 'object' ? item.content : null
      const priority = item && typeof item === 'object' ? item.priority : null
      const confidence = item && typeof item === 'object' ? item.confidence : null
      if (typeof content !== 'string' || !content.trim()) continue

      const trimmed = content.trim()
      // Avoid extremely long "memories" cluttering the prompt.
      const normalized = trimmed.length > 240 ? (trimmed.slice(0, 240).trimEnd() + '...') : trimmed
      if (normalized.length < 8) continue

      const isNearDuplicate = (contact.memory.core || []).some(m => isNearDuplicateMemoryContent(normalized, m?.content))
      if (isNearDuplicate) continue

      // Auto-promote high-confidence extractions
      const autoPromote = confidence === 'high'

      const mem = addCoreMemory(contact, normalized, 'extracted', {
        priority: PRIORITY_ORDER[priority] != null ? priority : 'normal',
        category: item.category || null,
        enabled: autoPromote
      })
      if (!mem) continue

      if (existingIds.has(mem.id)) updated.push(mem)
      else added.push(mem)

      count++
    }

    // Mark as processed to avoid repeated extraction on the same messages.
    contact.memory.lastAIMemoryMsgId = snippetResult.processedLastMsgId || lastMsgId
    return { added, updated, cursorUpdated: true }
  } finally {
    aiExtractInFlight.delete(contactId)
  }
}
