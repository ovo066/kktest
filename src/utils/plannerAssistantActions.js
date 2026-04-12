import { extractTaskScheduleFromText } from './taskDateTime'

const PLANNER_BLOCK_REGEX = /<planner_add>\s*([\s\S]*?)\s*<\/planner_add>/gi
const KEY_VALUE_REGEX = /^[\-\*\u2022]?\s*([^:：=]+?)\s*[:：=]\s*(.*)$/i
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_KEY_REGEX = /^\d{2}:\d{2}$/
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', '是', '全天'])
const KEY_ALIASES = {
  title: ['title', 'name', 'task', 'content', 'summary', '标题', '事项', '任务', '内容', '主题'],
  when: ['when', 'datetime', 'date_time', '时间说明', '日期时间', '何时'],
  date: ['date', '日期', '开始日期', '开始'],
  time: ['time', '时间', '开始时间'],
  end_date: ['end_date', 'enddate', '结束日期'],
  end_time: ['end_time', 'endtime', '结束时间'],
  note: ['note', 'description', 'remark', '备注', '说明', '补充'],
  type: ['type', 'kind', '类型', '分类'],
  all_day: ['all_day', 'allday', '全天']
}
const KEY_ALIAS_LOOKUP = new Map(
  Object.entries(KEY_ALIASES).flatMap(([canonical, aliases]) =>
    aliases.map(alias => [normalizeFieldKeyToken(alias), canonical])
  )
)

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeFieldKeyToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function normalizePlannerFieldKey(value) {
  const normalized = normalizeFieldKeyToken(value)
  return KEY_ALIAS_LOOKUP.get(normalized) || ''
}

function normalizeDateKey(value) {
  const raw = normalizeText(value)
  return DATE_KEY_REGEX.test(raw) ? raw : ''
}

function normalizeTimeKey(value) {
  const raw = normalizeText(value)
  return TIME_KEY_REGEX.test(raw) ? raw : ''
}

function normalizeKind(value, fallback = 'todo') {
  const raw = normalizeText(value).toLowerCase()
  if (['anniversary', 'memorial', '纪念日', '生日', '周年'].includes(raw)) return 'anniversary'
  if (['todo', 'task', 'plan', '待办', '任务', '计划'].includes(raw)) return 'todo'
  return fallback
}

function normalizeAllDay(value, fallback = false) {
  const raw = normalizeText(value).toLowerCase()
  if (!raw) return fallback
  return TRUE_VALUES.has(raw)
}

function cleanupAssistantText(text) {
  return stripPlannerActionBlocksForDisplay(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

export function stripPlannerActionBlocksForDisplay(text) {
  if (!text || typeof text !== 'string') return ''

  let result = String(text || '').replace(PLANNER_BLOCK_REGEX, '')
  const openMatches = Array.from(result.matchAll(/<planner_add\b[^>]*>/gi))
  if (openMatches.length > 0) {
    const lastOpen = openMatches[openMatches.length - 1]
    const tail = result.slice(lastOpen.index)
    if (!/<\/planner_add>/i.test(tail)) {
      result = result.slice(0, lastOpen.index)
    }
  }

  return result.replace(/\n{3,}/g, '\n\n').trim()
}

function parsePlannerBlock(blockText) {
  const jsonFields = tryParsePlannerBlockJson(blockText)
  if (jsonFields) return jsonFields

  const lines = String(blockText || '').split(/\r?\n/)
  const fields = {}
  const rawLines = []
  let activeKey = ''

  lines.forEach((line) => {
    const raw = String(line || '').trim()
    if (!raw) return
    const matched = raw.match(KEY_VALUE_REGEX)
    if (matched) {
      const normalizedKey = normalizePlannerFieldKey(matched[1])
      if (normalizedKey) {
        activeKey = normalizedKey
        fields[activeKey] = matched[2].trim()
        return
      }
      activeKey = ''
      rawLines.push(raw)
      return
    }
    if (activeKey) {
      fields[activeKey] = `${fields[activeKey] || ''}\n${raw}`.trim()
      return
    }
    rawLines.push(raw)
  })

  if (rawLines.length > 0) {
    fields.raw_text = rawLines.join('\n')
  }
  return fields
}

function tryParsePlannerBlockJson(blockText) {
  const raw = normalizeText(blockText)
  if (!raw || !raw.startsWith('{') || !raw.endsWith('}')) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const fields = {}
    Object.entries(parsed).forEach(([key, value]) => {
      const normalizedKey = normalizePlannerFieldKey(key)
      const nextValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
      if (!nextValue) return
      if (normalizedKey) {
        fields[normalizedKey] = nextValue
      }
    })
    return Object.keys(fields).length > 0 ? fields : null
  } catch {
    return null
  }
}

function getFallbackTitleFromRawText(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map(line => normalizeText(line))
    .find(Boolean) || ''
}

function getFallbackNoteFromRawText(rawText, fallbackTitle) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map(line => normalizeText(line))
    .filter(Boolean)
  if (lines.length <= 1) return ''
  if (fallbackTitle && normalizeText(lines[0]) === normalizeText(fallbackTitle)) {
    return lines.slice(1).join('\n')
  }
  return lines.join('\n')
}

function buildDraftFromFields(fields, options = {}) {
  const now = options.now || new Date()
  const rawText = normalizeText(fields.raw_text || '')
  const fallbackTitle = getFallbackTitleFromRawText(rawText)
  const rawTitle = normalizeText(fields.title || fields.name || fields.task || fields.content || fallbackTitle)
  const rawWhen = normalizeText(fields.when || fields.datetime || '')
  const rawDate = normalizeText(fields.date || '')
  const rawTime = normalizeText(fields.time || '')
  const rawEndDate = normalizeText(fields.end_date || fields.enddate || '')
  const rawEndTime = normalizeText(fields.end_time || fields.endtime || '')
  const rawNote = normalizeText(fields.note || fields.description || fields.remark || getFallbackNoteFromRawText(rawText, fallbackTitle))
  const kind = normalizeKind(fields.type || fields.kind)

  const titleParsed = rawTitle ? extractTaskScheduleFromText(rawTitle, { now }) : null
  const whenParsed = rawWhen ? extractTaskScheduleFromText(rawWhen, { now }) : null
  const rawTextParsed = rawText ? extractTaskScheduleFromText(rawText, { now }) : null
  const dateTimeParsed = (rawDate || rawTime)
    ? extractTaskScheduleFromText([rawDate, rawTime].filter(Boolean).join(' '), { now })
    : null

  const title = normalizeText(
    titleParsed?.cleanedText ||
    rawTitle ||
    whenParsed?.cleanedText ||
    rawTextParsed?.cleanedText ||
    ''
  )
  const startDate = normalizeDateKey(rawDate) || dateTimeParsed?.startDate || whenParsed?.startDate || titleParsed?.startDate || rawTextParsed?.startDate || ''
  const endDate = normalizeDateKey(rawEndDate) || dateTimeParsed?.endDate || whenParsed?.endDate || titleParsed?.endDate || rawTextParsed?.endDate || startDate
  const startTime = normalizeTimeKey(rawTime) || dateTimeParsed?.startTime || whenParsed?.startTime || titleParsed?.startTime || rawTextParsed?.startTime || ''
  const endTime = normalizeTimeKey(rawEndTime) || dateTimeParsed?.endTime || whenParsed?.endTime || titleParsed?.endTime || rawTextParsed?.endTime || ''
  const allDay = normalizeAllDay(fields.all_day || fields.allday, Boolean(startDate) && !startTime)

  return {
    title,
    description: rawNote,
    startDate,
    endDate,
    startTime: allDay ? '' : startTime,
    endTime: allDay ? '' : endTime,
    allDay,
    kind
  }
}

function normalizeEventTitle(value) {
  return normalizeText(value).replace(/\s+/g, ' ')
}

function isDuplicateEvent(existingEvents = [], draft = {}) {
  const title = normalizeEventTitle(draft.title)
  const startDate = normalizeText(draft.startDate)
  const startTime = normalizeText(draft.startTime)
  const kind = normalizeKind(draft.kind)

  return (Array.isArray(existingEvents) ? existingEvents : []).some((event) => {
    if (normalizeEventTitle(event?.title) !== title) return false
    if (normalizeText(event?.startDate || event?.dueDate || '') !== startDate) return false
    if (normalizeText(event?.startTime || event?.dueTime || '') !== startTime) return false
    return normalizeKind(event?.kind) === kind
  })
}

export function extractPlannerActionBlocks(content) {
  const blocks = []
  const text = String(content || '')
  let matched
  while ((matched = PLANNER_BLOCK_REGEX.exec(text)) !== null) {
    const raw = String(matched[0] || '')
    const body = String(matched[1] || '')
    blocks.push({
      raw,
      body,
      fields: parsePlannerBlock(body)
    })
  }
  return blocks
}

export function applyAssistantPlannerActions({ plannerStore, activeChat, message, now = new Date(), enabled = true }) {
  if (!message) {
    return { cleanedContent: String(message?.content || ''), addedEvents: [], blockCount: 0, duplicateCount: 0, invalidCount: 0 }
  }

  const blocks = extractPlannerActionBlocks(message.content)
  if (blocks.length === 0) {
    return { cleanedContent: String(message.content || ''), addedEvents: [], blockCount: 0, duplicateCount: 0, invalidCount: 0 }
  }

  const cleanedContent = cleanupAssistantText(message.content)
  message.content = cleanedContent
  if (message.displayContent != null) {
    message.displayContent = cleanedContent
  }
  message.hideInChat = !cleanedContent

  const addedEvents = []
  let duplicateCount = 0
  let invalidCount = 0
  const canPersist = enabled && plannerStore && typeof plannerStore.addEvent === 'function'

  blocks.forEach((block) => {
    const draft = buildDraftFromFields(block.fields, { now })
    if (!draft.title) {
      invalidCount += 1
      return
    }
    if (!canPersist) return
    if (isDuplicateEvent(plannerStore.events, draft)) {
      duplicateCount += 1
      return
    }

    const event = plannerStore.addEvent({
      ...draft,
      category: draft.kind === 'anniversary' ? 'personal' : undefined,
      shareWithAI: true,
      source: 'assistant',
      sourceChatId: activeChat?.id || '',
      sourceContactId: activeChat?.id || '',
      sourceMessageId: message.id || '',
      extractedAt: Date.now()
    })
    if (event) {
      addedEvents.push(event)
    } else {
      invalidCount += 1
    }
  })

  return {
    cleanedContent,
    addedEvents,
    blockCount: blocks.length,
    duplicateCount,
    invalidCount
  }
}
