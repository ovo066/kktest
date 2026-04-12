/**
 * Smart context window: replaces naive slice(-20) with head + summary + tail structure.
 * Preserves opening messages (character establishment) and recent messages (current topic),
 * summarizing the middle section.
 */

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) return n
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function formatMonthDay(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function truncateContextText(text, maxLen = 120) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLen) return normalized
  return normalized.slice(0, maxLen).trimEnd() + '...'
}

function getTranscriptSpeaker(message) {
  if (!message || message.role === 'system') return ''
  if (message.role === 'user') return '用户'
  const sender = String(message.senderName || '').trim()
  return sender || '对方'
}

function getTranscriptContent(message) {
  if (!message) return ''
  if (message.isImage) return '[图片]'
  if (message.isSticker) return '[贴纸]'
  return truncateContextText(message.content)
}

function buildRelationshipBootstrapTimeHint(headMsgs = []) {
  const firstTs = normalizeTimestamp(headMsgs[0]?.time)
  const lastTs = normalizeTimestamp(headMsgs[headMsgs.length - 1]?.time)
  if (!firstTs || !lastTs) return ''
  if (firstTs === lastTs) return formatMonthDay(firstTs)
  return `${formatMonthDay(firstTs)} ~ ${formatMonthDay(lastTs)}`
}

function buildRelationshipBootstrapBlock(headMsgs = []) {
  const transcript = headMsgs
    .map((message) => {
      const speaker = getTranscriptSpeaker(message)
      const content = getTranscriptContent(message)
      if (!speaker || !content) return ''
      return `${speaker}: ${content}`
    })
    .filter(Boolean)

  if (transcript.length === 0) return ''

  const timeHint = buildRelationshipBootstrapTimeHint(headMsgs)
  const lines = [
    '<relationship_bootstrap>',
    '以下是你和用户在更早阶段建立关系时的对话片段，仅用于维持熟悉感、称呼与关系连续性。',
    '这些内容不是当前正在发生的对话，不要把其中的问题或情绪当作本轮最后一句来直接回答。'
  ]
  if (timeHint) {
    lines.push('时间范围：' + timeHint)
  }
  lines.push(...transcript)
  lines.push('</relationship_bootstrap>')
  return lines.join('\n')
}

function buildCurrentDialogueBlock(headMsgs = [], tailMsgs = []) {
  const lastHeadTime = normalizeTimestamp(headMsgs[headMsgs.length - 1]?.time)
  const firstTailTime = normalizeTimestamp(tailMsgs[0]?.time)
  let gapLine = ''

  if (lastHeadTime && firstTailTime && firstTailTime > lastHeadTime) {
    const gapMs = firstTailTime - lastHeadTime
    if (gapMs >= GAP_THRESHOLD_MS) {
      gapLine = describeGapBrief(gapMs)
    }
  }

  const lines = [
    '<current_dialogue>',
    '以下是你现在正在经历的最近对话。只把这个段落里的最后一条用户消息当作本轮直接回复目标。'
  ]
  if (gapLine) {
    lines.push('与上方较早阶段片段之间：' + gapLine)
  }
  lines.push('</current_dialogue>')
  return lines.join('\n')
}

/**
 * Split messages into "rounds". A round starts with each user message
 * and includes all subsequent non-user messages until the next user message.
 * @param {Array} msgs - flat message array
 * @returns {Array<Array>} array of rounds, each round is an array of messages
 */
export function splitIntoRounds(msgs) {
  if (!msgs?.length) return []

  const rounds = []
  let current = []

  for (const m of msgs) {
    if (m.role === 'user' && current.length > 0) {
      rounds.push(current)
      current = []
    }
    current.push(m)
  }

  if (current.length > 0) {
    rounds.push(current)
  }

  return rounds
}

// Threshold for inserting a time gap marker between adjacent messages (30 min)
const GAP_THRESHOLD_MS = 30 * 60 * 1000

function describeGapBrief(gapMs) {
  const minutes = Math.floor(gapMs / 60000)
  if (minutes < 60) return '过了' + minutes + '分钟'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return '过了' + hours + '小时'
  const days = Math.floor(hours / 24)
  if (days === 1) return '过了1天'
  return '过了' + days + '天'
}

/**
 * Insert time-gap markers and a "[当前对话]" boundary into a flat message array.
 * - Any gap >= GAP_THRESHOLD_MS gets a brief "[过了X小时]" marker.
 * - The LAST such gap (i.e. the most recent return) also gets a "[当前对话]" tag
 *   so the LLM can clearly distinguish "previous session tail" from "current exchange".
 */
export function insertTimeGapMarkers(msgs) {
  if (msgs.length < 2) return msgs

  // First pass: find all gap positions
  const gaps = [] // { insertBefore: index, gapMs }
  for (let i = 1; i < msgs.length; i++) {
    const prevTime = normalizeTimestamp(msgs[i - 1]?.time)
    const currTime = normalizeTimestamp(msgs[i]?.time)
    if (!prevTime || !currTime) continue
    const gap = currTime - prevTime
    if (gap >= GAP_THRESHOLD_MS) {
      gaps.push({ insertBefore: i, gapMs: gap })
    }
  }

  if (gaps.length === 0) return msgs

  // Mark the last gap as the "current conversation" boundary
  const lastGapIdx = gaps.length - 1

  // Second pass: build result with markers (iterate in reverse to keep indices stable)
  const result = msgs.slice()
  for (let g = gaps.length - 1; g >= 0; g--) {
    const { insertBefore, gapMs } = gaps[g]
    const markers = []
    markers.push({ role: 'system', content: `[${describeGapBrief(gapMs)}]` })
    if (g === lastGapIdx) {
      markers.push({ role: 'system', content: '[当前对话]' })
    }
    result.splice(insertBefore, 0, ...markers)
  }

  return result
}

/**
 * Build context messages with head/tail preservation and optional middle summary.
 * Retrieved context (history_retrieval) is now handled separately in useApi.js
 * as part of post-history instructions for better attention placement.
 * @param {Array} allMsgs - all messages from the contact
 * @param {Object} options
 * @param {number} options.headRounds - number of initial rounds to keep (default 2)
 * @param {number} options.tailRounds - number of recent rounds to keep (default 5)
 * @param {string|null} options.middleSummary - summary text for middle section
 * @returns {Array} messages to send to the API
 */
export function buildContextMessages(allMsgs, options = {}) {
  if (!allMsgs?.length) return []

  const headRounds = options.headRounds ?? 2
  const tailRounds = options.tailRounds ?? 5

  const rounds = splitIntoRounds(allMsgs)

  // Short conversation: return everything, but still insert gap markers
  if (rounds.length <= headRounds + tailRounds) {
    return insertTimeGapMarkers(allMsgs.slice())
  }

  const headMsgs = rounds.slice(0, headRounds).flat()
  const tailMsgs = rounds.slice(rounds.length - tailRounds).flat()
  const headSet = new Set(headMsgs)
  const tailSet = new Set(tailMsgs)

  // Preserve important system messages (e.g. offlineCard) from the dropped middle section
  const middleMsgs = allMsgs.filter(m => !headSet.has(m) && !tailSet.has(m))
  const preservedMiddleMsgs = middleMsgs.filter(m =>
    m.role === 'system' && m.type === 'offlineCard' && m.content
  )

  const result = []

  const bootstrapBlock = buildRelationshipBootstrapBlock(headMsgs)
  if (bootstrapBlock) {
    result.push({
      role: 'system',
      content: bootstrapBlock
    })
  }

  // Add time passage marker between head and tail to prevent "just met" illusion
  const lastHeadTime = normalizeTimestamp(headMsgs[headMsgs.length - 1]?.time)
  const firstTailTime = normalizeTimestamp(tailMsgs[0]?.time)
  if (lastHeadTime && firstTailTime) {
    const daysBetween = Math.floor((firstTailTime - lastHeadTime) / 86400000)
    if (daysBetween >= 3) {
      result.push({
        role: 'system',
        content: `[以上对话发生在${daysBetween}天前]`
      })
    }
  }

  // Insert middle summary as a system message with time range context
  if (options.middleSummary) {
    const summaryTimeHint = buildSummaryTimeHint(headMsgs, tailMsgs)
    const summaryHeader = summaryTimeHint
      ? `(概要覆盖时段：${summaryTimeHint})\n`
      : ''
    result.push({
      role: 'system',
      content: `<context_summary>\n${summaryHeader}${options.middleSummary}\n</context_summary>`
    })
  }

  // Re-inject preserved middle messages (offlineCards) after summary
  if (preservedMiddleMsgs.length > 0) {
    result.push(...preservedMiddleMsgs)
  }

  result.push({
    role: 'system',
    content: buildCurrentDialogueBlock(headMsgs, tailMsgs)
  })

  // Insert time-gap markers and [当前对话] boundary within tail messages
  const tailWithGaps = insertTimeGapMarkers(tailMsgs)
  result.push(...tailWithGaps)

  return result
}

/**
 * Build a human-readable time hint for the summary section.
 * e.g. "3月10日 ~ 3月14日" or "2天前 ~ 5小时前"
 */
function buildSummaryTimeHint(headMsgs, tailMsgs) {
  const lastHeadTime = normalizeTimestamp(headMsgs[headMsgs.length - 1]?.time)
  const firstTailTime = normalizeTimestamp(tailMsgs[0]?.time)
  if (!lastHeadTime || !firstTailTime) return ''

  const fmt = (ts) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  return `${fmt(lastHeadTime)} ~ ${fmt(firstTailTime)}`
}
