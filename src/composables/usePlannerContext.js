/**
 * 日程/日记上下文注入策略
 *
 * Layer 1 — 触发式日程上下文 (~100-200 tokens)
 *   触发条件：用户消息含日程关键词 OR 当天有 shareWithAI 的待办/日程
 *   内容：<schedule_context> 今日待办 + 近3天重要事件 </schedule_context>
 *
 * Layer 2 — 日记交换上下文 (~120 tokens)
 *   触发条件：当前角色在某日记的 sharedWithContacts 中，且 injectToChat=true
 *   内容：<diary_exchange> 日记摘要 </diary_exchange>
 *
 * Layer 3 — 角色当前状态 (~30-60 tokens)
 *   只注入前一个/当前/下一个时段，让角色知道"自己在干嘛"
 */

import { usePlannerStore } from '../stores/planner'
import { useConfigsStore } from '../stores/configs'
import { useSettingsStore } from '../stores/settings'
import { applyOptionalMaxTokens } from './api/chatCompletions'
import { toLocalDateKey } from '../utils/dateKey'
import { getBeijingTimeHHMM } from '../utils/beijingTime'

// Layer 1 关键词触发
const PLANNER_KEYWORDS = /日程|待办|计划|安排|要做|任务|备考|考试|复习|deadline|ddl|打卡|准备|学习|工作|生日|纪念日|周年|长期计划|目标/i

export function shouldTriggerPlannerContext(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return false
  return PLANNER_KEYWORDS.test(userMessage)
}

/**
 * 构建 Layer 1 日程上下文
 */
function buildScheduleLayer(_contact) {
  const plannerStore = usePlannerStore()
  const today = toLocalDateKey()

  // 当天待办
  const todayEvents = plannerStore.getEventsForDate(today).filter(e => e.shareWithAI)
  // 近3天事件
  const upcoming = plannerStore.getUpcomingEvents(3).filter(e => e.shareWithAI && e.dueDate > today)

  if (todayEvents.length === 0 && upcoming.length === 0) return ''

  const lines = []

  if (todayEvents.length > 0) {
    lines.push('【今日待办】')
    for (const e of todayEvents) {
      const time = (e.startTime || e.dueTime) ? ` ${e.startTime || e.dueTime}` : ''
      const endTime = e.endTime ? `-${e.endTime}` : ''
      const done = e.completed ? ' ✓' : ''
      const start = e.startDate || e.dueDate
      const end = e.endDate || e.dueDate || start
      const rangeTag = (start && end && start !== end) ? ` [${start}~${end}]` : ''
      const kindTag = e.kind === 'anniversary' ? '[纪念日] ' : ''
      lines.push(`- ${kindTag}${e.title}${time}${endTime}${rangeTag}${done}`)
    }
  }

  if (upcoming.length > 0) {
    lines.push('【即将到来】')
    for (const e of upcoming) {
      const start = e.startDate || e.dueDate
      const end = e.endDate || e.dueDate || start
      const d = new Date(start + 'T00:00:00')
      const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`
      const time = (e.startTime || e.dueTime) ? ` ${e.startTime || e.dueTime}` : ''
      const rangeTag = (start !== end) ? ` ~${new Date(end + 'T00:00:00').getMonth() + 1}月${new Date(end + 'T00:00:00').getDate()}日` : ''
      const kindTag = e.kind === 'anniversary' ? '[纪念日] ' : ''
      lines.push(`- ${kindTag}${e.title}（${dateLabel}${rangeTag}${time}）`)
    }
  }

  return `<schedule_context>\n你记得ta最近有这些事（ta聊到相关话题时可以自然提起）：\n${lines.join('\n')}\n</schedule_context>`
}

/**
 * 构建 Layer 2 日记交换上下文
 */
function buildDiaryLayer(contact) {
  if (!contact) return ''
  const plannerStore = usePlannerStore()

  const sharedDiaries = plannerStore.getSharedDiaryForContact(contact.id)
  if (!sharedDiaries || sharedDiaries.length === 0) return ''

  // 取最近的2篇
  const recent = [...sharedDiaries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2)

  const lines = []
  for (const diary of recent) {
    const d = new Date(diary.date + 'T00:00:00')
    const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`
    const mood = diary.mood ? ` [${diary.mood}]` : ''
    const preview = diary.content.slice(0, 120) + (diary.content.length > 120 ? '...' : '')
    lines.push(`${dateLabel}${mood}：${preview}`)
  }

  return `<diary_exchange>\nta最近和你分享了日记（如果聊到相关话题可以自然提起）：\n${lines.join('\n\n')}\n</diary_exchange>`
}

/**
 * 在 slots 中找到当前时间对应的 index
 * 返回正在进行的时段 index，或即将开始的时段 index
 */
function findCurrentSlotIndex(slots) {
  const nowTime = getBeijingTimeHHMM()
  // 精确匹配：当前时间在某个时段内
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].startTime <= nowTime && nowTime < slots[i].endTime) {
      return i
    }
  }
  // 落在间隙中：找下一个即将开始的时段
  for (let i = 0; i < slots.length; i++) {
    if (nowTime < slots[i].startTime) {
      return i
    }
  }
  // 所有时段已结束
  return slots.length - 1
}

/**
 * 构建 Layer 3 角色当前状态
 * 只注入 prev/current/next 三个时段（~30-60 tokens），不列全天日程
 */
function buildCharacterScheduleLayer(contact) {
  if (!contact) return ''
  const plannerStore = usePlannerStore()
  const todayStr = toLocalDateKey()
  const schedule = plannerStore.getCharacterSchedule(contact.id, todayStr)
  if (!schedule?.slots?.length) return ''

  const slots = schedule.slots
  const idx = findCurrentSlotIndex(slots)
  const nowTime = getBeijingTimeHHMM()

  const formatSlot = s => {
    let text = `${s.startTime}-${s.endTime} ${s.activity}`
    if (s.location) text += `（${s.location}）`
    return text
  }

  const lines = []
  const current = slots[idx]
  const isInSlot = current && current.startTime <= nowTime && nowTime < current.endTime

  // 上一个时段
  if (idx > 0) {
    lines.push(`刚结束：${formatSlot(slots[idx - 1])}`)
  }

  // 当前时段
  if (isInSlot) {
    lines.push(`正在：${formatSlot(current)}`)
  }

  // 下一个时段
  const nextIdx = isInSlot ? idx + 1 : idx
  if (nextIdx < slots.length && nextIdx !== idx) {
    lines.push(`之后：${formatSlot(slots[nextIdx])}`)
  } else if (!isInSlot && current) {
    // 在间隙中，current 就是下一个要做的事
    lines.push(`即将：${formatSlot(current)}`)
  }

  if (lines.length === 0) return ''

  return `<character_schedule>\n${lines.join('\n')}\n</character_schedule>`
}

function buildPlannerCaptureLayer(contact) {
  if (!contact || contact.type === 'group') return ''

  return `<planner_capture>
聊天中听到对方提起重要的日子、计划、想做的事，你可以悄悄记下来，自然聊天就好。
比如考试、出行、生日、纪念日、ta的目标、随口提到的”下周要……”，以及你们之间有意义的事。

在回复末尾追加即可（用户看不到）：
<planner_add>
title: 事项标题
date: YYYY-MM-DD
time: HH:mm
type: todo/anniversary
note: 备注
</planner_add>
日期时间不确定可留空。生日纪念日用 type: anniversary。像真正在意ta的人那样，挑重要的记。
</planner_capture>`
}

/**
 * 主入口：构建所有 planner 相关 prompt 层
 */
export function buildPlannerPromptLayers(contact, userMessage) {
  const settingsStore = useSettingsStore()
  const allowPlannerRead = !!settingsStore.allowPlannerAI
  const allowPlannerCapture = !!settingsStore.allowAIPlannerCapture
  if (!allowPlannerRead && !allowPlannerCapture) {
    return { layer1: '', layer2: '', layer3: '', action: '' }
  }

  const layer1 = allowPlannerRead && shouldTriggerPlannerContext(userMessage)
    ? buildScheduleLayer(contact)
    : (allowPlannerRead ? checkAutoTrigger(contact) : '')

  const layer2 = allowPlannerRead ? buildDiaryLayer(contact) : ''
  const layer3 = allowPlannerRead ? buildCharacterScheduleLayer(contact) : ''
  const action = allowPlannerCapture ? buildPlannerCaptureLayer(contact) : ''

  return { layer1, layer2, layer3, action }
}

/**
 * 自动触发：当天有 shareWithAI 事件时注入（不依赖关键词）
 */
function checkAutoTrigger(contact) {
  const plannerStore = usePlannerStore()
  const today = toLocalDateKey()
  const todayEvents = plannerStore.getEventsForDate(today).filter(e => e.shareWithAI && !e.completed)
  if (todayEvents.length === 0) return ''
  return buildScheduleLayer(contact)
}

/**
 * 为日记交换生成 AI 回复（由 DiaryDetailView 调用）
 */
export async function generateDiaryReply(contact, diaryEntry) {
  try {
    const configsStore = useConfigsStore()
    const configId = contact.configId
    const cfg = configsStore.configs?.find(c => c.id === configId) || configsStore.configs?.[0]
    if (!cfg || !cfg.url || !cfg.key) return null

    const d = new Date(diaryEntry.date + 'T00:00:00')
    const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`
    const mood = diaryEntry.mood ? ` [心情：${diaryEntry.mood}]` : ''
    const weather = diaryEntry.weather ? ` [天气：${diaryEntry.weather}]` : ''

    const systemPrompt = contact.prompt ||
      `你是${contact.name}，正在以角色身份阅读用户分享的日记并写下你的感想。`

    const userText = `用户在${dateLabel}的日记${mood}${weather}：\n\n${diaryEntry.content}\n\n请以你的身份（${contact.name}）写下读到这篇日记后的感想（2-4句话，自然真诚，不要说"作为AI"）。`

    const url = cfg.url.replace(/\/$/, '') + '/chat/completions'
    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      temperature: 0.8,
      stream: false
    }
    applyOptionalMaxTokens(body, cfg.maxTokens)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.key}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) return null
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}
