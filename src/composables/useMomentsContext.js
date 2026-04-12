/**
 * 动态/朋友圈上下文分层注入策略
 *
 * Layer 0 — 常驻提示 (~25 tokens)：每次 API 调用注入
 * Layer 1 — 触发式上下文 (~80-120 tokens)：用户消息包含关键词时注入
 * Layer 2 — 定期暗示 (~15 tokens)：概率触发
 */

import { useMomentsStore } from '../stores/moments'
import { useContactsStore } from '../stores/contacts'
import { useSettingsStore } from '../stores/settings'
import { formatRelativeTime } from '../utils/relativeTime'

// Layer 1 触发关键词
const MOMENTS_KEYWORDS = /朋友圈|动态|刷圈|最近在干嘛|你发了什么|看看你的|你最近|发了什么|pengyouquan|moments/i

// Layer 2 暗示触发参数
const LAYER2_MIN_TURNS = 8
const LAYER2_MAX_TURNS = 15
const LAYER2_PROBABILITY = 0.2

/**
 * 检测用户消息是否应触发 Layer 1
 */
export function shouldTriggerMomentsContext(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return false
  return MOMENTS_KEYWORDS.test(userMessage)
}

/**
 * 构建 Layer 1 动态上下文（仅在触发时调用）
 * @param {string} charId - 角色 ID
 * @param {string} userMessage - 用户消息（用于 RAG 检索）
 * @returns {string} XML 片段
 */
export function buildMomentsContextPrompt(charId, _userMessage) {
  const momentsStore = useMomentsStore()
  const allMoments = momentsStore.moments

  if (!allMoments || allMoments.length === 0) return ''

  // 获取该角色的动态
  const charMoments = allMoments
    .filter(m => m.authorId === charId)
    .sort((a, b) => b.time - a.time)

  if (charMoments.length === 0) return ''

  // 优先使用记忆API总结（如果可用）
  const contactsStore = useContactsStore()
  const contact = contactsStore.activeChat
  const summary = contact?.memory?.momentsSummary
  if (summary?.content) {
    const age = Date.now() - (summary.computedAt || 0)
    const hasNewMoments = charMoments[0]?.id !== summary.lastMomentId
    // 总结未过期（<2小时）且无新动态时直接使用
    if (age < 2 * 60 * 60 * 1000 && !hasNewMoments) {
      return `<moments_context>\n${summary.content}\n</moments_context>`
    }
  }

  // 回退到直接取最近3条动态
  const recent = charMoments.slice(0, 3)
  const lines = recent.map(m => {
    const timeStr = formatRelativeTime(m.time, { maxRelativeDays: 6, dateLocale: 'zh-CN' })
    const likes = m.likes ? `, ${m.likes}赞` : ''
    const mood = m.mood ? ` ${m.mood}` : ''
    return `- "${m.content}"${mood} (${timeStr}${likes})`
  })

  const charName = contact?.name || '角色'
  return `<moments_context>\n${charName}最近的动态：\n${lines.join('\n')}\n</moments_context>`
}

/**
 * Layer 2 暗示检查
 * @param {object} contact - 联系人对象
 * @returns {string|null} 暗示文本或 null
 */
export function checkLayer2Hint(contact) {
  if (!contact?.memory) return null

  const turnCount = contact.memory.momentTurnCount || 0
  contact.memory.momentTurnCount = turnCount + 1

  if (turnCount < LAYER2_MIN_TURNS) return null
  if (turnCount > LAYER2_MAX_TURNS) {
    // 重置计数器
    contact.memory.momentTurnCount = 0
    return null
  }

  if (Math.random() > LAYER2_PROBABILITY) return null

  // 触发：重置计数器并返回暗示
  contact.memory.momentTurnCount = 0
  return '<inner_thought>今天过得挺有意思的，想到了一些可以分享的事。</inner_thought>'
}

/**
 * 刷新动态总结缓存（在 onAssistantReplied 中调用）
 */
export async function refreshMomentsSummary(contact, callSummaryAPI) {
  if (!contact?.memory) return null

  const momentsStore = useMomentsStore()
  const charMoments = momentsStore.moments
    .filter(m => m.authorId === contact.id)
    .sort((a, b) => b.time - a.time)

  // 至少5条动态才值得总结
  if (charMoments.length < 5) return null

  const currentSummary = contact.memory.momentsSummary
  // 没有新动态则跳过
  if (currentSummary?.lastMomentId === charMoments[0]?.id) return currentSummary

  // 取最近10条动态文本
  const momentsText = charMoments.slice(0, 10)
    .map(m => {
      const mood = m.mood ? ` [${m.mood}]` : ''
      return `- ${m.content}${mood}`
    })
    .join('\n')

  const prompt = '请用1-2句话概括以下朋友圈动态的氛围和话题。'
  const result = await callSummaryAPI(prompt, momentsText, contact, {
    temperature: 0.3
  })

  if (!result?.success) return null

  contact.memory.momentsSummary = {
    content: result.content,
    lastMomentId: charMoments[0]?.id,
    computedAt: Date.now()
  }

  return contact.memory.momentsSummary
}

/**
 * 集成入口：为当前 API 调用构建动态相关上下文
 * @returns {{ layer1: string, layer2: string|null }}
 */
export function buildMomentsPromptLayers(contact, userMessage) {
  const settingsStore = useSettingsStore()
  if (!settingsStore.syncForumToAI) return { layer1: '', layer2: null }

  let layer1 = ''
  if (shouldTriggerMomentsContext(userMessage)) {
    layer1 = buildMomentsContextPrompt(contact?.id, userMessage)
  }

  const layer2 = checkLayer2Hint(contact)

  return { layer1, layer2 }
}
