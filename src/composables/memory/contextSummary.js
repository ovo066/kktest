import { normalizeRoleAliasesToTemplateVars } from '../api/prompts'
import { DEFAULT_MEMORY_SETTINGS, initContactMemory } from './shared'

// 刷新上下文摘要（带变化量阈值优化）
export async function refreshContextSummary(contact, deps = {}) {
  const { callSummaryAPI } = deps
  if (!contact?.msgs?.length || typeof callSummaryAPI !== 'function') return null
  initContactMemory(contact)

  const settings = contact.memorySettings || DEFAULT_MEMORY_SETTINGS
  if (!settings.smartContext || !settings.contextAutoSummarize) return null

  // Import splitIntoRounds lazily to avoid circular dependency
  const { splitIntoRounds } = await import('../api/contextWindow.js')
  const rounds = splitIntoRounds(contact.msgs)

  const headRounds = settings.contextHeadRounds || 2
  const tailRounds = settings.contextTailRounds || 5

  // Not enough rounds to warrant a summary
  if (rounds.length <= headRounds + tailRounds) return null

  const middleRounds = rounds.slice(headRounds, rounds.length - tailRounds)
  const middleMsgs = middleRounds.flat()

  if (middleMsgs.length < 3) return null

  // Check if summary is still fresh (based on last message in middle section)
  const lastMiddleMsgId = middleMsgs[middleMsgs.length - 1]?.id
  if (contact.memory.contextSummary?.lastMsgId === lastMiddleMsgId) {
    return contact.memory.contextSummary
  }

  // 变化量阈值检查：中间区域消息数相比上次摘要时增加不足 threshold 条则跳过
  const MIDDLE_CHANGE_THRESHOLD = 10
  const lastMiddleMsgCount = contact.memory.contextSummary?.middleMsgCount || 0
  if (lastMiddleMsgCount > 0 && middleMsgs.length - lastMiddleMsgCount < MIDDLE_CHANGE_THRESHOLD) {
    return contact.memory.contextSummary
  }

  const msgText = middleMsgs
    .filter(m => m.content && !m.isImage && !m.isSticker)
    .slice(-40) // Cap to avoid huge prompts
    .map(m => {
      const who = m.role === 'user' ? '{{user}}' : (m.senderName || '{{char}}')
      return `${who}: ${m.content}`
    })
    .join('\n')

  if (!msgText.trim()) return null

  const prompt = [
    '请将以下对话总结为结构化概要，保持简洁（不超过200字）。',
    '使用{{char}}和{{user}}。',
    '',
    '【事件】关键事件和决定',
    '【关系】角色间关系变化、称呼、亲密度',
    '【情绪】{{user}}当前情绪状态和情感需求',
    '【偏好】{{user}}表达的喜好和习惯',
    '',
    '只输出有内容的项，没有的跳过。'
  ].join('\n')

  const result = await callSummaryAPI(prompt, msgText, contact, { temperature: 0.3 })
  if (!result.success) return null

  contact.memory.contextSummary = {
    content: normalizeRoleAliasesToTemplateVars(result.content),
    lastMsgId: lastMiddleMsgId,
    middleMsgCount: middleMsgs.length,
    lastComputedAt: Date.now()
  }

  return contact.memory.contextSummary
}
