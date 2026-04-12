function stripMarkdownCodeFence(text) {
  return String(text || '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

function extractFirstJsonObject(text) {
  const src = String(text || '')
  const start = src.indexOf('{')
  if (start < 0) return ''

  let depth = 0
  let inString = false
  let quote = ''
  let escaped = false

  for (let i = start; i < src.length; i += 1) {
    const ch = src[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) {
        inString = false
        quote = ''
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }

    if (ch === '{') {
      depth += 1
      continue
    }

    if (ch === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }

  return ''
}

function normalizeJsonLike(text) {
  let s = String(text || '').trim()
  if (!s) return ''

  s = s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[：]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')

  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
  s = s.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":')
  s = s.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, val) => {
    const escaped = String(val).replace(/"/g, '\\"')
    return `:"${escaped}"`
  })
  s = s.replace(/,\s*([}\]])/g, '$1')

  return s
}

function toObjectIfPossible(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (Array.isArray(value)) {
    const firstObj = value.find(v => v && typeof v === 'object' && !Array.isArray(v))
    return firstObj || null
  }
  return null
}

function tryParseLooseObject(text) {
  const cleaned = stripMarkdownCodeFence(text)
  const extracted = extractFirstJsonObject(cleaned)
  const candidates = [cleaned, extracted].filter(Boolean)

  for (const candidate of candidates) {
    const variants = [candidate, normalizeJsonLike(candidate)]
    for (const variant of variants) {
      if (!variant) continue
      try {
        const parsed = JSON.parse(variant)
        const obj = toObjectIfPossible(parsed)
        if (obj) return obj
      } catch {
        // continue
      }
    }
  }
  return null
}

function getObjectField(obj, keys = []) {
  if (!obj || typeof obj !== 'object') return undefined
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
      return obj[key]
    }
  }
  return undefined
}

function parseLooseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const m = String(value ?? '').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function parseLooseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return null

  if (['true', '1', 'yes', 'y', 'reply'].includes(raw)) return true
  if (['false', '0', 'no', 'n', 'ignore', 'read_only'].includes(raw)) return false

  if (raw.includes('不回复') || raw.includes('已读不回') || raw.includes('不用回')) return false
  if (raw.includes('回复')) return true
  return null
}

function pickFirstRegex(text, regexList = []) {
  const src = String(text || '')
  for (const re of regexList) {
    const m = src.match(re)
    if (!m || m[1] == null) continue
    const value = String(m[1]).trim()
    if (value) return value
  }
  return ''
}

function parseKeyValueLines(text) {
  const lines = String(text || '').split(/\r?\n/)
  const result = {}
  for (const raw of lines) {
    const line = String(raw || '').trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*|动作|内容|文本|消息|动态|延迟|心情|原因|回复)\s*[:=]\s*(.+)$/)
    if (!m) continue
    const key = String(m[1] || '').trim().toLowerCase()
    if (!key || Object.prototype.hasOwnProperty.call(result, key)) continue
    let value = String(m[2] || '').trim()
    value = value.replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1').trim()
    result[key] = value
  }
  return result
}

export function parseDecision(text, { delayMin = 5, delayMax = 120 } = {}) {
  const validActions = ['message', 'read_only', 'ignore', 'post_moment']
  const cleaned = stripMarkdownCodeFence(text)
  const obj = tryParseLooseObject(cleaned)
  const kv = parseKeyValueLines(cleaned)

  const rawAction = obj
    ? getObjectField(obj, ['action', 'a', 'type'])
    : (kv.action || kv.a || kv.type || kv['动作'] || '')
  const actionCandidate = rawAction || pickFirstRegex(cleaned, [
    /"(?:action|a|type)"\s*:\s*"(message|read_only|ignore|post_moment)"/i,
    /(?:^|[\s,{])(?:action|a|type)\s*[:=]\s*(message|read_only|ignore|post_moment)\b/i,
    /(?:^|\n)\s*动作\s*[:=]\s*(message|read_only|ignore|post_moment)\b/i
  ])
  const action = validActions.includes(String(actionCandidate || '').trim().toLowerCase())
    ? String(actionCandidate).trim().toLowerCase()
    : 'ignore'

  const content = String(
    obj
      ? getObjectField(obj, ['content', 'c', 'message', 'msg']) || ''
      : (kv.content || kv.c || kv.message || kv.msg || kv['内容'] || kv['文本'] || kv['消息'] || pickFirstRegex(cleaned, [
        /"(?:content|c|message|msg)"\s*:\s*"([^"]*)"/i,
        /(?:^|[\s,{])(?:content|c|message|msg)\s*[:=]\s*["']([^"'\n]+)["']/i,
        /(?:^|\n)\s*(?:content|c|message|msg)\s*[:=]\s*([^\n]+)/i,
        /(?:^|\n)\s*(?:内容|文本|消息)\s*[:=]\s*([^\n]+)/i
      ]))
  )
  const momentContent = String(
    obj
      ? getObjectField(obj, ['moment_content', 'm', 'moment', 'post']) || ''
      : (kv.moment_content || kv.m || kv.moment || kv.post || kv['动态'] || pickFirstRegex(cleaned, [
        /"(?:moment_content|m|moment|post)"\s*:\s*"([^"]*)"/i,
        /(?:^|[\s,{])(?:moment_content|m|moment|post)\s*[:=]\s*["']([^"'\n]+)["']/i,
        /(?:^|\n)\s*(?:moment_content|m|moment|post)\s*[:=]\s*([^\n]+)/i,
        /(?:^|\n)\s*动态\s*[:=]\s*([^\n]+)/i
      ]))
  )
  const delayRaw = obj
    ? getObjectField(obj, ['delay_seconds', 'd', 'delay'])
    : (kv.delay_seconds || kv.d || kv.delay || kv['延迟'] || pickFirstRegex(cleaned, [
      /"(?:delay_seconds|d|delay)"\s*:\s*(-?\d+(?:\.\d+)?)/i,
      /(?:^|[\s,{])(?:delay_seconds|d|delay)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
      /(?:^|\n)\s*(?:delay_seconds|d|delay|延迟)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i
    ]))
  const moodRaw = obj
    ? getObjectField(obj, ['mood_delta', 'md', 'mood'])
    : (kv.mood_delta || kv.md || kv.mood || kv['心情'] || pickFirstRegex(cleaned, [
      /"(?:mood_delta|md|mood)"\s*:\s*(-?\d+(?:\.\d+)?)/i,
      /(?:^|[\s,{])(?:mood_delta|md|mood)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
      /(?:^|\n)\s*(?:mood_delta|md|mood|心情)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i
    ]))
  const reason = String(
    obj
      ? getObjectField(obj, ['reason', 'r']) || ''
      : (kv.reason || kv.r || kv['原因'] || pickFirstRegex(cleaned, [
        /"(?:reason|r)"\s*:\s*"([^"]*)"/i,
        /(?:^|[\s,{])(?:reason|r)\s*[:=]\s*["']([^"'\n]+)["']/i,
        /(?:^|\n)\s*(?:reason|r|原因)\s*[:=]\s*([^\n]+)/i
      ]))
  )

  const delayNum = parseLooseNumber(delayRaw)
  const moodNum = parseLooseNumber(moodRaw)
  const hasAnySignal = !!(actionCandidate || content || momentContent || reason || delayNum !== null || moodNum !== null)

  return {
    action,
    content,
    momentContent,
    delaySeconds: Math.max(delayMin, Math.min(delayMax, delayNum ?? delayMin)),
    moodDelta: Math.max(-0.3, Math.min(0.3, moodNum ?? 0)),
    reason: reason || (hasAnySignal ? '' : 'parse_error')
  }
}

export function parseChatReadOnlyDecision(text) {
  const cleaned = stripMarkdownCodeFence(text)
  const obj = tryParseLooseObject(cleaned)
  const kv = parseKeyValueLines(cleaned)

  const rawReply = obj
    ? getObjectField(obj, ['should_reply', 'shouldReply', 'reply', 'sr'])
    : (kv.should_reply || kv.shouldreply || kv.reply || kv.sr || kv['回复'] || pickFirstRegex(cleaned, [
      /"(?:should_reply|shouldReply|reply|sr)"\s*:\s*("?(?:true|false|1|0)"?)/i,
      /(?:^|[\s,{])(?:should_reply|shouldReply|reply|sr)\s*[:=]\s*("?(?:true|false|1|0)"?)/i,
      /(?:^|\n)\s*(?:should_reply|shouldReply|reply|sr|回复)\s*[:=]\s*("?(?:true|false|1|0)"?)/i
    ]))
  let shouldReply = parseLooseBoolean(rawReply)

  if (shouldReply == null) {
    const hint = cleaned.toLowerCase()
    if (hint.includes('不回复') || hint.includes('已读不回') || /\b(ignore|read_only)\b/.test(hint)) shouldReply = false
    else if (hint.includes('回复') || /\breply\b/.test(hint)) shouldReply = true
  }

  const reason = String(
    obj
      ? getObjectField(obj, ['reason', 'r']) || ''
      : (kv.reason || kv.r || kv['原因'] || pickFirstRegex(cleaned, [
        /"(?:reason|r)"\s*:\s*"([^"]*)"/i,
        /(?:^|[\s,{])(?:reason|r)\s*[:=]\s*["']([^"'\n]+)["']/i,
        /(?:^|\n)\s*(?:reason|r|原因)\s*[:=]\s*([^\n]+)/i
      ]))
  )

  return {
    shouldReply: shouldReply !== false,
    reason: reason || (obj ? '' : 'parse_error')
  }
}

export function normalizeReadOnlyReason(reason, { maxChars = 14 } = {}) {
  let text = String(reason || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text === 'parse_error') return ''
  text = text.replace(/^原因[:：]?\s*/i, '').trim()
  if (!text) return ''

  const chars = Array.from(text)
  if (chars.length > maxChars) {
    text = chars.slice(0, maxChars).join('')
  }
  return text
}
