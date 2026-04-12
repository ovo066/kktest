/**
 * AI 角色日程生成 — 按需调用 LLM 为角色生成日程
 */
import { usePlannerStore } from '../stores/planner'
import { useConfigsStore } from '../stores/configs'
import { useContactsStore } from '../stores/contacts'
import { usePersonasStore } from '../stores/personas'
import { useSettingsStore } from '../stores/settings'
import { fetchOpenAICompat } from './api/openaiCompat'
import { applyOptionalMaxTokens } from './api/chatCompletions'
import { useStorage } from './useStorage'
import { makeId } from '../utils/id'

const SCHEDULE_CACHE_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * 检查角色日程是否需要刷新
 */
export function needsScheduleRefresh(contactId, dateStr) {
  const plannerStore = usePlannerStore()
  const schedule = plannerStore.getCharacterSchedule(contactId, dateStr)
  if (!schedule) return true
  const generatedAt = Number(schedule.generatedAt)
  if (!Number.isFinite(generatedAt) || generatedAt <= 0) return true
  if (!Array.isArray(schedule.slots) || schedule.slots.length === 0) return true
  return Date.now() - generatedAt > SCHEDULE_CACHE_MS
}

/**
 * 从角色 prompt 中提取人设相关内容，过滤掉格式指令/输出规则等
 * 保留全部人设内容，不做字数截断
 */
function extractPersonaFromPrompt(prompt) {
  if (!prompt) return ''
  const lines = prompt.split(/\r?\n/)
  const filtered = lines.filter(line => {
    const trimmed = line.trim()
    if (!trimmed) return true
    // 过滤输出格式/token 语法等与人设无关的指令行
    if (/^(输出|格式|规则|注意|要求|token|指令|禁止|不[要得]|必须|每[一条行]|回复时|仅在|独占一行)/i.test(trimmed)) return false
    if (/^\d+[.)、]\s*(每|不[要得]|必须|输出|禁止|保持|回复|使用|避免)/i.test(trimmed)) return false
    if (/\(sticker:|image:|voice:|call:|transfer:|gift:|music:|camera:/i.test(trimmed)) return false
    if (/danbooru|tag|token/i.test(trimmed) && /格式|输出|规则/i.test(trimmed)) return false
    return true
  })
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 从 contact.memory 构建日程生成用的上下文
 * 包含：核心记忆（关系/偏好/事实）+ 近期对话摘要（约定/动态）
 */
function buildMemoryContextForSchedule(contact) {
  const memory = contact?.memory
  if (!memory) return ''

  const parts = []

  // 核心记忆 — 关系、偏好、约定等长期信息
  const coreMemories = (memory.core || []).filter(m => m && m.enabled && m.content)
  if (coreMemories.length > 0) {
    const relevant = coreMemories
      .filter(m => m.priority !== 'low')
      .map(m => m.content.trim())
      .filter(Boolean)
      .slice(0, 12)
    if (relevant.length > 0) {
      parts.push(relevant.join('；'))
    }
  }

  // 近期对话摘要 — 可能包含约定、计划、正在进行的事
  const summaries = []
  const longTerm = (memory.longTerm || [])
    .filter(s => s && s.content && s.status !== 'failed')
    .slice(-1)
  const shortTerm = (memory.shortTerm || [])
    .filter(s => s && s.content && s.status !== 'failed' && !s.merged)
    .slice(-2)
  for (const s of [...longTerm, ...shortTerm]) {
    const text = s.content.trim()
    if (text) summaries.push(text.slice(0, 300))
  }
  if (summaries.length > 0) {
    parts.push('近期动态：' + summaries.join('\n'))
  }

  return parts.length > 0 ? parts.join('\n') : ''
}

/**
 * 获取用户信息（面具名称 + 描述）
 */
function getUserInfo(contactId) {
  try {
    const personasStore = usePersonasStore()
    const persona = personasStore.getPersonaForContact(contactId)
    if (!persona) return ''
    const parts = []
    if (persona.name) parts.push(persona.name)
    if (persona.description) parts.push(persona.description)
    return parts.join('，')
  } catch {
    return ''
  }
}

function buildPreviousScheduleSummary(schedule) {
  if (!Array.isArray(schedule?.slots) || schedule.slots.length === 0) return ''
  return schedule.slots
    .map(slot => `- ${slot.startTime}-${slot.endTime} ${slot.activity}${slot.location ? ` @${slot.location}` : ''}`)
    .join('\n')
}

/**
 * 生成角色日程
 */
export async function generateCharacterSchedule(contactId, dateStr, options = {}) {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const plannerStore = usePlannerStore()
  const settingsStore = useSettingsStore()
  const { scheduleSave } = useStorage()
  const force = options && options.force === true
  const regenerate = options && options.regenerate === true

  // 检查缓存
  if (!force && !needsScheduleRefresh(contactId, dateStr)) {
    return plannerStore.getCharacterSchedule(contactId, dateStr)
  }

  const contact = contactsStore.contacts?.find(c => c.id === contactId)
  if (!contact || contact.type === 'group') return null

  // 获取 API 配置
  const config = settingsStore.livenessConfig || {}
  const cfgId = config.decisionConfigId || contact.configId
  const cfg = configsStore.configs?.find(c => c.id === cfgId) || configsStore.configs?.[0]
  if (!cfg?.key || !cfg?.url) return null

  const charPrompt = extractPersonaFromPrompt(contact.prompt)
  const dateObj = new Date(dateStr + 'T00:00:00')
  const dayOfWeek = dateObj.toLocaleDateString('zh-CN', { weekday: 'long' })
  const dayIndex = dateObj.getDay() // 0=周日
  const isWeekend = dayIndex === 0 || dayIndex === 6
  const memoryContext = buildMemoryContextForSchedule(contact)
  const userInfo = getUserInfo(contactId)
  const previousSchedule = plannerStore.getCharacterSchedule(contactId, dateStr)
  const previousScheduleSummary = buildPreviousScheduleSummary(previousSchedule)
  const regenerationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // 用户当天的安排（若有）
  let userScheduleBlock = ''
  const userEvents = plannerStore.getEventsForDate(dateStr).filter(e => e.shareWithAI)
  if (userEvents.length > 0) {
    const lines = userEvents.map(e => {
      const time = e.startTime || e.dueTime || ''
      return `- ${time ? time + ' ' : ''}${e.title}`
    })
    userScheduleBlock = `\n用户当天的安排：\n${lines.join('\n')}\n`
  }

  let previousScheduleBlock = ''
  if (regenerate && previousScheduleSummary) {
    previousScheduleBlock = `\n上一次已生成过这份日程，请避免只是换个措辞重复它：\n${previousScheduleSummary}\n`
  }

  // 用引导而非规则：让 LLM 进入角色视角思考，而不是执行清单
  const weekdayHint = isWeekend
    ? `今天是${dayOfWeek}，是休息日。想想你周末一般做什么——是在家放松、出去玩、还是有别的安排？`
    : `今天是${dayOfWeek}，是工作日。想想你这天具体会做什么——上班/上学的节奏、午休怎么过、下班/放学后会干嘛？`

  const systemPrompt = `你就是"${contact.name}"。今天是${dateStr}，${dayOfWeek}。请具体规划你今天这一天怎么过。

<persona>
${charPrompt}
</persona>${memoryContext ? `\n\n<memory>\n${memoryContext}\n</memory>` : ''}${userInfo ? `\n\n用户：${userInfo}` : ''}${userScheduleBlock}${previousScheduleBlock}
${weekdayHint}

重要：这是你今天（${dateStr}，${dayOfWeek}）确定的日程，不是通用模板。每个时段写一件确定要做的事，不要写"A或B"这样的选择，也不要写"可能会……"。直接决定你这天要做什么。日程要体现今天是一周中的哪天：工作日和周末不一样，周一和周五的心情也不一样。
如果记忆里和用户有过约定或计划（比如答应一起做某事），把它安排进去。${regenerate ? '\n这次是重新生成，请在保持设定合理的前提下，给出与上一版明显不同的新安排，不要只改几个词。' : ''}

输出 JSON 数组（6-10个时段），interruptible 表示这个时段你是否方便回消息：
[{"startTime":"HH:MM","endTime":"HH:MM","activity":"一件具体的事","location":"具体地点","interruptible":true,"mood":""}]
只输出 JSON。`

  try {
    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: regenerate
          ? `请重新生成${contact.name}在${dateStr}（${dayOfWeek}）的日程安排。记住今天是${dayOfWeek}，每件事要具体确定，不要用"或"。变体编号：${regenerationSeed}`
          : `请生成${contact.name}在${dateStr}（${dayOfWeek}）的日程安排。记住每件事要具体确定，不要用"或"。` }
      ],
      temperature: regenerate ? 1 : 0.9,
      stream: false
    }
    applyOptionalMaxTokens(body, cfg.maxTokens)

    const { response: res } = await fetchOpenAICompat(cfg.url, {
      apiKey: cfg.key,
      body
    })

    if (!res.ok) {
      console.warn('[CharacterSchedule] API error:', res.status)
      return null
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''

    // 解析 JSON（处理 markdown 代码块）
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()
    let slots
    try {
      slots = JSON.parse(cleaned)
    } catch {
      // 尝试提取 JSON 数组
      const match = cleaned.match(/\[[\s\S]*\]/)
      if (match) {
        slots = JSON.parse(match[0])
      } else {
        console.warn('[CharacterSchedule] Failed to parse response:', cleaned.slice(0, 200))
        return null
      }
    }

    if (!Array.isArray(slots)) return null

    const normalizedSlots = slots
      .map(s => ({
        id: makeId('slot'),
        startTime: String(s?.startTime || '').trim(),
        endTime: String(s?.endTime || '').trim(),
        activity: String(s?.activity || '').trim(),
        location: String(s?.location || '').trim(),
        interruptible: s?.interruptible !== false,
        mood: String(s?.mood || '').trim()
      }))
      .filter(s => s.startTime && s.endTime && s.activity)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    if (normalizedSlots.length === 0) return null

    plannerStore.setCharacterSchedule(contactId, dateStr, {
      slots: normalizedSlots,
      generatedByModel: cfg.model,
      generationVersion: regenerate ? Math.max(Number(previousSchedule?.generationVersion) || 1, 1) + 1 : Number(previousSchedule?.generationVersion) || 1,
      regeneratedFrom: regenerate ? Number(previousSchedule?.generatedAt) || null : null,
      regenerationSeed: regenerate ? regenerationSeed : ''
    })
    scheduleSave()

    return plannerStore.getCharacterSchedule(contactId, dateStr)
  } catch (err) {
    console.warn('[CharacterSchedule] Generation failed:', err.message)
    return null
  }
}
