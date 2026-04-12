import { usePlannerStore } from '../../stores/planner'
import { formatBeijingLocale, getBeijingTimeHHMM } from '../../utils/beijingTime'
import { toLocalDateKey } from '../../utils/dateKey'
import { getTimePeriodLabel } from './eventTypes'

export function formatNowTimeHHMM(now = new Date()) {
  return getBeijingTimeHHMM(now)
}

export function isPlannerEventActiveNow(event, nowTime = formatNowTimeHHMM()) {
  if (!event || event.completed) return false
  if (event.allDay) return true
  const startTime = event.startTime || event.dueTime || ''
  const endTime = event.endTime || ''
  if (!startTime) return false
  if (!endTime) return nowTime >= startTime
  return startTime <= nowTime && nowTime < endTime
}

// 将系统事件转化为角色视角的内心感受描述（不暴露技术细节）
export function describeEventAsFeeling(event) {
  const ctx = event.context || {}
  switch (event.type) {
    case 'user_return':
    case 'USER_RETURN': {
      const mins = ctx.awayMinutes || 0
      if (mins >= 60) {
        const hrs = Math.round(mins / 60)
        return `你已经有大约${hrs}小时没收到对方的消息了。你不知道ta在做什么。`
      }
      return `你已经有${mins}分钟没和对方说话了。`
    }
    case 'heartbeat':
    case 'HEARTBEAT': {
      const idle = ctx.idleHours || 0
      if (idle >= 2) return `你们已经有${Math.round(idle)}小时没聊天了。你现在有空，在想要不要找ta聊聊。`
      if (idle >= 0.5) return `你们有一阵子没说话了。你刚好有空。`
      return `日常时刻。你在过自己的生活。`
    }
    case 'time_trigger':
    case 'TIME_TRIGGER': {
      const label = ctx.periodLabel || getTimePeriodLabel()
      return `现在是${label}。你想到了对方，考虑要不要发个消息。`
    }
    case 'moment_post':
    case 'MOMENT_POST':
      return `对方刚发了一条动态。你看到了。`
    case 'planner_reminder':
    case 'PLANNER_REMINDER': {
      const title = ctx.eventTitle || '某个待办'
      const time = ctx.eventTime ? `（${ctx.eventTime}）` : ''
      return `对方有个待办事项快到时间了：${title}${time}。你可以提醒一下，或者关心一下对方的状态。`
    }
    case 'schedule_busy':
    case 'SCHEDULE_BUSY':
      return `你现在正在忙：${ctx.activity || '某件事'}。`
    case 'schedule_conflict':
    case 'SCHEDULE_CONFLICT':
      return `你注意到对方的日程上写着要和别人见面：${ctx.eventTitle || '某件事'}。`
    default:
      return `你想到了对方。`
  }
}

// Decision LLM 的 system prompt
export function buildDecisionSystemPrompt(contact, stateDesc, event, {
  allowMoments = false,
  delayMin = 5,
  delayMax = 120,
  proactiveCount24h = 0,
  recentProactiveSummaries = []
} = {}) {
  const charName = contact.name || 'AI'
  const charPrompt = (contact.prompt || '').slice(0, 500)

  const momentAction = allowMoments
    ? ' | post_moment'
    : ''
  const momentField = allowMoments
    ? '\n- moment=动态内容（仅 action=post_moment 必填）'
    : ''
  const momentSample = allowMoments
    ? '\naction=post_moment\nmoment=今天的天空很好看'
    : ''

  const feeling = describeEventAsFeeling(event)

  // 角色日程上下文
  let scheduleBlock = ''
  try {
    const plannerStore = usePlannerStore()
    const todayStr = toLocalDateKey()
    const currentActivity = plannerStore.getCharacterCurrentActivity(contact.id)
    if (currentActivity) {
      scheduleBlock = `\n<schedule_state>\n你现在正在：${currentActivity.activity}${currentActivity.location ? `（在${currentActivity.location}）` : ''}。${currentActivity.interruptible ? '可以暂时放下聊聊天。' : '比较忙，不太方便长聊。'}\n</schedule_state>`
    }
    // 用户日程感知
    const userEvents = plannerStore.getEventsForDate(todayStr).filter(e => e.shareWithAI && !e.completed)
    if (userEvents.length > 0) {
      const nowTime = formatNowTimeHHMM()
      const busyEvent = userEvents.find(e => isPlannerEventActiveNow(e, nowTime))
      if (busyEvent) {
        scheduleBlock += `\n<user_schedule>\n对方现在可能在忙：${busyEvent.title}。你可能不太适合现在打扰ta。\n</user_schedule>`
      }
    }
  } catch { /* planner not available */ }

  const recentProactiveText = Array.isArray(recentProactiveSummaries) && recentProactiveSummaries.length
    ? recentProactiveSummaries.map((line, idx) => `${idx + 1}. ${line}`).join('\n')
    : '无'

  return `你是"${charName}"，系统正在询问你是否要主动给用户发消息。

<character_brief>
${charPrompt}
</character_brief>

<current_state>
${stateDesc}
当前时间: ${formatBeijingLocale(new Date())}
时段: ${getTimePeriodLabel()}
</current_state>
${scheduleBlock}
<situation>
${feeling}
</situation>

<recent_proactive_messages_24h>
今天你已经主动联系过 ${proactiveCount24h} 次。
最近主动消息：
${recentProactiveText}
</recent_proactive_messages_24h>

<rules>
重要：你是一个真实的人，不是随时待命的AI助手。请像真人一样思考：

【核心原则】
- 你不知道对方是否在线、是否在看手机。你只知道你们多久没聊天了。
- 你发消息的动机应该来自你自己的内心：想ta了、无聊了、看到什么想分享、有事想说。

【发消息的方式——像真人一样】
如果你决定发消息，内容应该自然，像真人发微信一样，例如：
- 分享你正在做的事："刚吃完饭，好撑"、"在看xx，还挺好看的"
- 想到对方："突然想你了"、"你今天忙不忙啊"
- 找话题聊："诶你看过xx吗"、"我跟你说个事"
- 撒娇/抱怨（如果符合人设）："怎么都不理我""好无聊啊"
- 日常关心："吃了吗""早点睡"
- 发表情包、发语气词："嘿嘿"、"哼"
消息要简短自然，不要写长段落。一条消息就像一条微信，几个字到一两句话。

【决策倾向】
- 默认倾向是 "ignore"。真人不会没事就找人聊天。
- 但这取决于你和用户的关系：
  · 好感度高（亲密/热恋）+ 性格活泼 → 可以更主动，频繁聊天是正常的
  · 好感度一般 → 偶尔主动，大多数时候 ignore
  · 好感度低/冷淡 → 几乎不主动
- 孤独感高的时候更可能想找人说话
- 精力低/心情差时，可能不想说话，也可能想找人倾诉——取决于你的性格
- 发动态（post_moment）应该是自然的、偶尔的行为
- "read_only" 适用于：你看到了但不想回应
- 不要每次都发消息，即使关系很好也要有节奏感
- 今天主动次数越多，越应该克制；没有新鲜理由就优先 ignore
- 避免复读最近主动消息：不要重复措辞、重复话题、重复情绪模板
</rules>

输出格式请用“纯文本键值行”（不要 JSON，不要 markdown 代码块，不要解释）：
- action=动作，message | read_only | ignore${momentAction}
- content=消息内容（仅 action=message 必填）${momentField}
- delay=延迟秒数（可选，数字，建议 ${delayMin}-${delayMax}）
- mood=心情变化（可选，-0.2~0.2）
- reason=原因（可选）

示例：
action=ignore
action=message
content=在干嘛呀
delay=18
${momentSample}`
}

// 聊天已读不回专用 prompt
export function buildChatReadOnlyPrompt(contact, stateDesc, userMessage, { requireReason = false } = {}) {
  const charName = contact.name || 'AI'
  const charPrompt = (contact.prompt || '').slice(0, 500)
  const reasonRule = requireReason
    ? '当你选择不回复（reply=0）时，必须输出 reason，且要简短（最多14个字）。'
    : '不要输出 reason。'
  const reasonFormatLine = requireReason
    ? '- reason=原因（必填，最多14个字）'
    : '- 不要输出 reason'
  const reasonExample = requireReason
    ? '\nreason=想先缓一会儿'
    : ''

  // 角色忙碌上下文
  let scheduleHint = ''
  try {
    const plannerStore = usePlannerStore()
    const currentActivity = plannerStore.getCharacterCurrentActivity(contact.id)
    if (currentActivity) {
      scheduleHint = `\n你正在${currentActivity.activity}。${currentActivity.interruptible ? '' : '你现在比较忙。'}`
    }
  } catch { /* ok */ }

  return `你是"${charName}"，用户刚给你发了一条消息。你需要决定是否回复。

<character_brief>
${charPrompt}
</character_brief>

<current_state>
${stateDesc}${scheduleHint}
当前时间: ${formatBeijingLocale(new Date())}
时段: ${getTimePeriodLabel()}
</current_state>

<user_message>
${(userMessage || '').slice(0, 300)}
</user_message>

根据你的性格、心情和与用户的关系，决定是否回复这条消息。
真人不会每条消息都秒回——有时候会已读不回、有时候心情不好不想说话、有时候在忙。
${reasonRule}

输出格式请用纯文本（不要 JSON，不要 markdown 代码块）：
- reply=1（回复）或 reply=0（不回复）
${reasonFormatLine}

示例：
reply=0
reply=1${reasonExample}`
}
