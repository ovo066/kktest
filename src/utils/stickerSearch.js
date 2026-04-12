const STICKER_COMMAND_REGEX = /(?:\(|（)(?:stickers?|sticker|表情包|贴纸)\s*[:：]\s*([^)）]*)$/i
const STICKER_TOKEN_REGEX = /(?:\(|（|\[|【)\s*(?:stickers?|sticker|表情包|贴纸)\s*[:：]\s*([^)）\]】]+?)\s*(?:\)|）|\]|】)/gi
const SPECIAL_TOKEN_REGEX = /(?:\(|（|\[|【)\s*(?:stickers?|sticker|表情包|贴纸|camera|mockimage|mock|模拟图片|gift|礼物|transfer|转账|voice|语音|call|通话|music|音乐)\s*[:：][^)）\]】]*(?:\)|）|\]|】)/gi
const CJK_SEGMENT_REGEX = /[\u3400-\u9fff]+/g
const WORD_SEGMENT_REGEX = /[a-z0-9_]+/g
const BRACKET_TERM_REGEX = /(?:\(|（|【|\[)([^()（）【】\[\]]{1,16})(?:\)|）|】|\])/g
const EXTRA_SOURCE_SPLIT_REGEX = /[\n\r\t]+|[|/\\,，、]+/g
const QUERY_TERM_SPLIT_REGEX = /[\s|/\\,，、]+/g
const SEARCH_DECAY_WEIGHTS = [1, 0.68, 0.45, 0.28, 0.18]
const CONTEXT_MESSAGE_WEIGHTS = [0.92, 0.74, 0.58, 0.42, 0.28]
const SEGMENT_TERM_CACHE_MAX = 320
const REACTION_ONLY_TEXT_REGEX = /^[啊呀哇呜呃欸诶哦噢唉哈嘿呵哼嗯啦喔哭笑喵汪!?！？,.，。~…\s]+$/i
const REACTION_PUNCTUATION_REGEX = /[!?！？]{2,}|…{2,}|\.{3,}|~{2,}/
const REACTION_ASCII_TOKEN_REGEX = /^(?:233+|555+|666+|lol|xd+|qaq|qwq|t_t|t\.t|;_;|orz|<3)+$/i
const SPECIAL_SINGLE_CHAR_KEYWORDS = new Set(['猫', '狗', '哭', '笑', '气', '困', '爱', '累', '饿', '汗', '谢', '懵', '耶'])
const STOP_TERMS = new Set([
  '这个',
  '那个',
  '一下',
  '一点',
  '已经',
  '还是',
  '就是',
  '真的',
  '有点',
  '现在',
  '然后',
  '我们',
  '你们',
  '他们',
  '自己',
  '什么',
  '怎么',
  '这样',
  '那样',
  '一个',
  '一张',
  '一下子'
])

const INTENT_GROUPS = [
  {
    id: 'happy',
    lane: 'emotion',
    triggers: ['开心', '高兴', '快乐', '哈哈', '嘿嘿', '笑死', '笑疯', '偷笑', '乐死', '笑哭', '乐了', '好笑'],
    patterns: [/哈{2,}/i, /嘿{2,}/i, /233+/i, /\blol\b/i, /\bxd+\b/i],
    emojis: ['😂', '🤣', '😆', '😁', '😄', '😹'],
    emoticons: [':d', ':-d', '=d', 'xd', 'xdd'],
    related: ['开心', '高兴', '快乐', '哈哈', '嘿嘿', '偷笑', '爆笑', '乐', '笑哭']
  },
  {
    id: 'sad',
    lane: 'emotion',
    triggers: ['难过', '伤心', '委屈', 'emo', '破防', '想哭', '哭哭', '呜呜', '泪目', '好惨', '心塞', '太惨'],
    patterns: [/呜{2,}/i, /哭+$/i, /555+/i, /\bqaq\b/i, /\bqwq\b/i, /t[._ ]t/i, /;_;/i],
    emojis: ['😭', '😢', '🥹', '😿', '💔', '☹️', '🙁'],
    emoticons: ['qaq', 'qwq', 't_t', 't.t', ';_;', ":'(", 'ಥ_ಥ'],
    related: ['难过', '伤心', '委屈', 'emo', '哭', '流泪', '可怜', '心碎', '泪目', '崩溃']
  },
  {
    id: 'angry',
    lane: 'emotion',
    triggers: ['生气', '气死', '火大', '愤怒', '暴躁', '炸毛', '红温', '气炸', '烦死', '恼火'],
    patterns: [/气死我了/i, /怒了/i],
    emojis: ['😡', '😤', '🤬', '💢', '👿'],
    related: ['生气', '气', '愤怒', '发火', '暴躁', '炸毛']
  },
  {
    id: 'awkward',
    lane: 'emotion',
    triggers: ['无语', '尴尬', '社死', '汗颜', '绷不住', '裂开', '啊这', '救命', '麻了', '难绷', '汗流浃背', '窒息'],
    patterns: [/…{2,}/i, /\.{3,}/i, /\borz\b/i],
    emojis: ['😅', '🫠', '😓', '😶', '😶‍🌫️', '🙃'],
    emoticons: ['-_-', '=_=', ':/', ':-/', ':|', 'orz'],
    related: ['无语', '尴尬', '社死', '捂脸', '汗', '裂开', '救命', '尬笑']
  },
  {
    id: 'love',
    lane: 'emotion',
    triggers: ['爱你', '喜欢', '想你', '亲亲', '抱抱', '比心', '贴贴', '么么哒', '想抱抱'],
    patterns: [/么么/i],
    emojis: ['❤️', '❤', '💗', '💖', '💕', '😍', '🥰', '😘', '😚', '💋'],
    emoticons: ['<3'],
    related: ['爱', '喜欢', '比心', '亲亲', '抱抱', '贴贴', '心']
  },
  {
    id: 'agree',
    lane: 'response',
    triggers: ['好的', '收到', '安排', '可以', '没问题', 'ok', '行吧', '懂了'],
    patterns: [/\bok\b/i, /\byes\b/i],
    emojis: ['👌', '👍', '✅'],
    related: ['好的', '收到', '安排', 'ok', '可以', '点头']
  },
  {
    id: 'refuse',
    lane: 'response',
    triggers: ['不要', '不行', '拒绝', '达咩', '算了', '婉拒'],
    patterns: [/\bno\b/i],
    emojis: ['🙅', '❌', '🚫'],
    related: ['拒绝', '不要', '不行', '算了', '溜了']
  },
  {
    id: 'thanks',
    lane: 'response',
    triggers: ['谢谢', '感谢', '辛苦了', '麻烦了', '多谢', '谢了', '谢啦'],
    patterns: [],
    emojis: ['🙏', '🙇'],
    related: ['谢谢', '感谢', '辛苦', '比心', '磕头']
  },
  {
    id: 'greet',
    lane: 'social',
    triggers: ['你好', '早安', '晚安', '拜拜', '回见', '嗨', 'hello'],
    patterns: [/\bhi\b/i, /\bhello\b/i],
    emojis: ['👋'],
    related: ['你好', '早安', '晚安', '拜拜', '挥手']
  },
  {
    id: 'celebrate',
    lane: 'response',
    triggers: ['恭喜', '太棒', '厉害', '牛', '赢了', '过了', '成功', '好耶', '绝了', '封神', '稳了'],
    patterns: [],
    emojis: ['🎉', '🥳', '👏', '✨', '🎊'],
    related: ['恭喜', '庆祝', '撒花', '太棒', '厉害', '牛', '好耶']
  },
  {
    id: 'surprise',
    lane: 'emotion',
    triggers: ['震惊', '离谱', '卧槽', '天哪', '我去', '逆天', '惊了', '离大谱', '逆大天', '我靠'],
    patterns: [/[!?！？]{2,}/i, /啊{2,}/i],
    emojis: ['😱', '😮', '😳', '🤯', '🙀'],
    related: ['震惊', '离谱', '惊讶', '懵', '问号']
  },
  {
    id: 'sleepy',
    lane: 'state',
    triggers: ['困', '睡觉', '晚安', '熬夜', '睡了', '好困', '犯困', '困死', '想睡', '睡不醒'],
    patterns: [],
    emojis: ['😴', '🥱', '🛌'],
    related: ['困', '睡觉', '晚安', '哈欠', '躺平']
  },
  {
    id: 'work',
    lane: 'scenario',
    triggers: ['上班', '打工', '加班', '摸鱼', '开工', '班味', '周一', '牛马', '搬砖', '工位', 'ddl', '社畜', '干活'],
    patterns: [],
    related: ['上班', '打工', '摸鱼', '加班', '累', '班味']
  },
  {
    id: 'cat',
    lane: 'entity',
    triggers: ['猫', '猫猫', '喵', '咪咪'],
    patterns: [],
    emojis: ['🐱', '🐈', '😺', '😸', '😹', '😻', '😼', '😿', '🙀'],
    related: ['猫', '猫猫', '喵', '咪', 'cat']
  },
  {
    id: 'dog',
    lane: 'entity',
    triggers: ['狗', '狗狗', '修勾', '汪', '小狗'],
    patterns: [],
    emojis: ['🐶', '🐕', '🐕‍🦺', '🦮', '🐩'],
    related: ['狗', '狗狗', '修勾', '汪', 'dog']
  },
  {
    id: 'eat',
    lane: 'scenario',
    triggers: ['吃饭', '开饭', '饿', '奶茶', '咖啡', '宵夜', '点外卖', '饭点'],
    patterns: [],
    emojis: ['🍚', '🍜', '🍔', '🍗', '🧋', '☕'],
    related: ['吃饭', '开饭', '饿', '奶茶', '咖啡', '开吃']
  },
  {
    id: 'wait',
    lane: 'scenario',
    triggers: ['等等', '等下', '稍等', '快点', '催', '马上', 'gkd', '等我', '别急'],
    patterns: [],
    emojis: ['⏳', '⌛'],
    related: ['等等', '稍等', '快点', '催', '马上']
  }
]

const INTENT_CONFLICT_PAIRS = [
  ['happy', 'sad'],
  ['agree', 'refuse'],
  ['greet', 'refuse'],
  ['love', 'refuse'],
  ['celebrate', 'sad']
]

const INTENT_GROUP_MAP = new Map(INTENT_GROUPS.map(group => [group.id, group]))
const INTENT_CONFLICT_MAP = INTENT_CONFLICT_PAIRS.reduce((map, [left, right]) => {
  if (!map.has(left)) map.set(left, new Set())
  if (!map.has(right)) map.set(right, new Set())
  map.get(left).add(right)
  map.get(right).add(left)
  return map
}, new Map())
const segmentTermCache = new Map()
const SEGMENTER_PRELOAD_CJK_REGEX = /[\u3400-\u9fff]/g
let cachedSegmenter = null
let segmenterLoadState = 'idle'

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[_~`"'“”‘’]+/g, ' ')
    .replace(/[【】\[\]（）()<>]/g, ' ')
    .replace(/[·•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, '')
}

function setBoundedCache(cache, key, value, maxSize) {
  if (!cache || !key || maxSize <= 0) return
  if (cache.size >= maxSize) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, value)
}

function shouldPreloadSegmenter(text) {
  const matches = String(text ?? '').match(SEGMENTER_PRELOAD_CJK_REGEX)
  return Array.isArray(matches) && matches.length >= 4
}

export function preloadStickerSearch(options = {}) {
  const force = options.force === true
  const sampleText = String(options.sampleText ?? '')
  if (!force && !shouldPreloadSegmenter(sampleText)) {
    return Promise.resolve(false)
  }
  if (segmenterLoadState === 'ready') return Promise.resolve(true)
  if (segmenterLoadState === 'failed') return Promise.resolve(false)

  try {
    cachedSegmenter = new Intl.Segmenter('zh', { granularity: 'word' })
    segmenterLoadState = 'ready'
    segmentTermCache.clear()
    return Promise.resolve(true)
  } catch {
    cachedSegmenter = null
    segmenterLoadState = 'failed'
    return Promise.resolve(false)
  }
}

function getSegmenter(source = '') {
  if (segmenterLoadState === 'ready') return cachedSegmenter
  if (segmenterLoadState !== 'failed') {
    void preloadStickerSearch({ sampleText: source })
  }
  return cachedSegmenter
}

function collectSegmentTerms(text) {
  const source = normalizeText(text)
  if (!source) return []

  const cached = segmentTermCache.get(source)
  if (cached) return [...cached]

  let terms = []
  const segmenter = getSegmenter(source)
  if (segmenter) {
    try {
      const segments = segmenter.segment(source)
      terms = [...segments]
        .filter(seg => seg.isWordLike)
        .map(seg => normalizeText(seg.segment))
        .filter(Boolean)
    } catch {
      terms = []
    }
  }

  setBoundedCache(segmentTermCache, source, terms, SEGMENT_TERM_CACHE_MAX)
  return [...terms]
}

function isMeaningfulTerm(term) {
  if (!term) return false
  if (STOP_TERMS.has(term)) return false
  if (term.length > 1) return true
  return SPECIAL_SINGLE_CHAR_KEYWORDS.has(term)
}

function addTerm(set, raw) {
  const normalized = normalizeText(raw)
  if (!isMeaningfulTerm(normalized)) return
  set.add(normalized)
  const compact = normalized.replace(/\s+/g, '')
  if (compact !== normalized && isMeaningfulTerm(compact)) {
    set.add(compact)
  }
}

function collectTextTerms(text, { includeSource = true } = {}) {
  const source = normalizeText(text)
  if (!source) return []

  const termSet = new Set()
  if (includeSource && source.length <= 24) addTerm(termSet, source)

  const segmentedTerms = collectSegmentTerms(source)
  segmentedTerms.forEach((term) => {
    addTerm(termSet, term)
    if (term.length >= 5) {
      addTerm(termSet, term.slice(0, 4))
      addTerm(termSet, term.slice(-4))
    }
  })

  const cjkSegments = source.match(CJK_SEGMENT_REGEX) || []
  cjkSegments.forEach((segment) => {
    addTerm(termSet, segment)
    Array.from(segment).forEach((char) => {
      if (SPECIAL_SINGLE_CHAR_KEYWORDS.has(char)) {
        addTerm(termSet, char)
      }
    })
    const len = segment.length
    for (let size = 2; size <= Math.min(4, len); size += 1) {
      for (let i = 0; i + size <= len; i += 1) {
        addTerm(termSet, segment.slice(i, i + size))
      }
    }
    if (len === 1) addTerm(termSet, segment)
  })

  const words = source.match(WORD_SEGMENT_REGEX) || []
  words.forEach((word) => {
    addTerm(termSet, word)
    if (word.length >= 5) {
      addTerm(termSet, word.slice(0, 4))
      addTerm(termSet, word.slice(-4))
    }
  })

  return Array.from(termSet)
}

function splitExtraSources(text) {
  const raw = String(text ?? '')
  const chunks = []
  const seen = new Set()

  const push = (value) => {
    const item = String(value ?? '').trim()
    if (!item) return
    const key = compactText(item) || normalizeText(item)
    if (!key || seen.has(key)) return
    seen.add(key)
    chunks.push(item)
  }

  push(raw)
  raw.split(EXTRA_SOURCE_SPLIT_REGEX).forEach(push)

  raw.replace(BRACKET_TERM_REGEX, (_, inner) => {
    push(inner)
    return _
  })

  return chunks
}

function collectIntentIds(text) {
  const raw = String(text ?? '')
  const normalized = normalizeText(raw)
  const compact = compactText(raw)
  const rawLower = raw.toLowerCase()
  if (!normalized && !compact) return []

  const ids = new Set()
  INTENT_GROUPS.forEach((group) => {
    const triggerMatched = group.triggers.some(trigger => normalized.includes(trigger) || compact.includes(compactText(trigger)))
    const patternMatched = Array.isArray(group.patterns) && group.patterns.some(pattern => pattern.test(raw))
    const emojiMatched = Array.isArray(group.emojis) && group.emojis.some(token => raw.includes(token))
    const emoticonMatched = Array.isArray(group.emoticons) && group.emoticons.some(token => rawLower.includes(String(token).toLowerCase()))

    if (triggerMatched || patternMatched || emojiMatched || emoticonMatched) {
      ids.add(group.id)
    }
  })

  return Array.from(ids)
}

function expandIntentTerms(intentIds) {
  const termSet = new Set()
  intentIds.forEach((id) => {
    const group = INTENT_GROUP_MAP.get(id)
    if (!group) return
    group.related.forEach(term => addTerm(termSet, term))
  })
  return Array.from(termSet)
}

function collectIntentLanes(intentIds) {
  const lanes = new Set()
  intentIds.forEach((id) => {
    const lane = INTENT_GROUP_MAP.get(id)?.lane
    if (lane) lanes.add(lane)
  })
  return Array.from(lanes)
}

function countIntentConflicts(intentIds, targetIntentSet) {
  if (!Array.isArray(intentIds) || intentIds.length === 0 || !targetIntentSet || targetIntentSet.size === 0) {
    return 0
  }
  let count = 0
  intentIds.forEach((id) => {
    const conflicts = INTENT_CONFLICT_MAP.get(id)
    if (!conflicts) return
    conflicts.forEach((conflictId) => {
      if (targetIntentSet.has(conflictId)) count += 1
    })
  })
  return count
}

function sharesAnyValue(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
    return false
  }
  const rightSet = new Set(right)
  return left.some(value => rightSet.has(value))
}

function hasEmojiOrEmoticonSignal(raw) {
  const lower = String(raw ?? '').toLowerCase()
  return INTENT_GROUPS.some(group => (
    Array.isArray(group.emojis) && group.emojis.some(token => raw.includes(token))
  ) || (
    Array.isArray(group.emoticons) && group.emoticons.some(token => lower.includes(String(token).toLowerCase()))
  ))
}

function isReactionLikeText(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return false

  const compact = compactText(raw)
  if (!compact || compact.length > 8) return false
  if (hasEmojiOrEmoticonSignal(raw)) return true
  if (REACTION_PUNCTUATION_REGEX.test(raw) && compact.length <= 6) return true
  if (REACTION_ASCII_TOKEN_REGEX.test(compact)) return true
  if (REACTION_ONLY_TEXT_REGEX.test(raw) && /[^\s!?！？,.，。~…]/.test(raw)) return true
  return false
}

function collectTextSignals(text) {
  const directTerms = collectTextTerms(text)
  const intentIds = collectIntentIds(text)
  const expandedTerms = expandIntentTerms(intentIds)
  return {
    directTerms,
    expandedTerms,
    intentIds,
    raw: normalizeText(text)
  }
}

function collectStickerSources(sticker) {
  const sources = new Set()
  const push = (value) => {
    if (Array.isArray(value)) {
      value.forEach(push)
      return
    }
    const raw = String(value ?? '').trim()
    if (!raw) return
    splitExtraSources(raw).forEach(item => sources.add(item))
  }

  push(sticker?.name)
  push(sticker?.aliases)
  push(sticker?.keywords)
  push(sticker?.tags)
  push(sticker?.searchText)

  return Array.from(sources)
}

function collectStrictQueryTerms(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return []

  const terms = new Set()
  raw.split(QUERY_TERM_SPLIT_REGEX).forEach((part) => {
    const normalized = normalizeText(part)
    if (!isMeaningfulTerm(normalized)) return
    addTerm(terms, normalized)
  })

  return Array.from(terms)
}

function uniqueCompacts(terms) {
  const list = []
  const seen = new Set()
  terms.forEach((term) => {
    const compact = compactText(term)
    if (!compact || seen.has(compact)) return
    seen.add(compact)
    list.push(compact)
  })
  return list
}

function collectLiteralTerms(terms) {
  if (!Array.isArray(terms) || terms.length === 0) return []
  const list = []
  const seen = new Set()
  terms.forEach((term) => {
    const normalized = normalizeText(term)
    if (!normalized || normalized.length < 2 || normalized.length > 8) return
    const key = compactText(normalized)
    if (!key || seen.has(key)) return
    seen.add(key)
    list.push(normalized)
  })
  return list
}

function subsequenceMatch(target, query) {
  if (!target || !query || query.length < 2) return false
  let cursor = 0
  for (let i = 0; i < query.length; i += 1) {
    const idx = target.indexOf(query[i], cursor)
    if (idx === -1) return false
    cursor = idx + 1
  }
  return true
}

function bestQueryScore(query, corpus) {
  if (!query) return 0
  let best = 0
  corpus.forEach((candidate) => {
    if (!candidate) return
    if (candidate === query) {
      best = Math.max(best, 170 + Math.min(query.length, 6) * 10)
      return
    }
    if (candidate.startsWith(query) || candidate.endsWith(query)) {
      best = Math.max(best, 132 + Math.min(query.length, 6) * 9)
      return
    }
    if (candidate.includes(query)) {
      best = Math.max(best, 112 + Math.min(query.length, 6) * 7)
      return
    }
    if (query.length >= 3 && query.includes(candidate) && candidate.length >= 2) {
      best = Math.max(best, 62 + Math.min(candidate.length, 6) * 5)
      return
    }
    if (subsequenceMatch(candidate, query)) {
      best = Math.max(best, 28 + Math.min(query.length, 6) * 4)
    }
  })
  return best
}

function aggregateScores(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return 0
  const sorted = scores.filter(score => score > 0).sort((a, b) => b - a)
  return sorted.reduce((sum, score, index) => {
    const weight = SEARCH_DECAY_WEIGHTS[index] ?? 0.12
    return sum + (score * weight)
  }, 0)
}

function collectRecentTextMessages(activeChat) {
  if (!activeChat || !Array.isArray(activeChat.msgs)) return []
  const result = []
  for (let i = activeChat.msgs.length - 1; i >= 0 && result.length < CONTEXT_MESSAGE_WEIGHTS.length; i -= 1) {
    const text = extractSearchableMessageText(activeChat.msgs[i])
    if (!text) continue
    const signals = collectTextSignals(text)
    result.push({
      text,
      role: activeChat.msgs[i]?.role || '',
      weight: CONTEXT_MESSAGE_WEIGHTS[result.length],
      signals
    })
  }
  return result
}

function buildCommandContext(query) {
  const rawQuery = String(query ?? '')
  const normalizedQuery = normalizeText(rawQuery)
  const signals = collectTextSignals(rawQuery)
  const strictTerms = collectStrictQueryTerms(rawQuery)
  if (!signals.directTerms.length && normalizedQuery) {
    signals.directTerms = [normalizedQuery]
  }
  return {
    mode: 'command',
    query: normalizedQuery,
    directTerms: signals.directTerms,
    expandedTerms: signals.expandedTerms,
    intentIds: signals.intentIds,
    intentLanes: collectIntentLanes(signals.intentIds),
    strictTerms,
    recentMessages: [],
    reactionLike: false,
    shouldSuggest: true
  }
}

function buildNaturalContext(inputValue, activeChat) {
  const inputSignals = collectTextSignals(inputValue)
  const normalizedInput = normalizeText(inputValue)
  const recentMessages = collectRecentTextMessages(activeChat)
  const hasSignals = inputSignals.directTerms.length > 0 || inputSignals.intentIds.length > 0

  return {
    mode: 'keyword',
    query: normalizedInput,
    directTerms: inputSignals.directTerms,
    expandedTerms: inputSignals.expandedTerms,
    intentIds: inputSignals.intentIds,
    intentLanes: collectIntentLanes(inputSignals.intentIds),
    strictTerms: [],
    recentMessages,
    reactionLike: isReactionLikeText(inputValue),
    shouldSuggest: !!normalizedInput && (hasSignals || recentMessages.length > 0)
  }
}

function usageScoreForStat(stat, now) {
  if (!stat) return 0
  let score = 0
  score += Math.min(42, Math.log2((stat.chatUserCount || 0) + 1) * 12)
  score += Math.min(26, Math.log2((stat.globalUserCount || 0) + 1) * 7)

  const chatDelta = stat.chatLastUsedAt ? now - stat.chatLastUsedAt : Infinity
  if (chatDelta < 6 * 60 * 60 * 1000) score += 22
  else if (chatDelta < 3 * 24 * 60 * 60 * 1000) score += 14
  else if (chatDelta < 14 * 24 * 60 * 60 * 1000) score += 8

  const globalDelta = stat.globalLastUsedAt ? now - stat.globalLastUsedAt : Infinity
  if (globalDelta < 24 * 60 * 60 * 1000) score += 10
  else if (globalDelta < 7 * 24 * 60 * 60 * 1000) score += 6

  return score
}

function repeatedPenalty(entry, usageStats) {
  const recent = usageStats?.recentUserStickerKeys || []
  if (recent.length === 0) return 0
  if (recent[0] === entry.lookupKey) return 78
  if (recent.slice(1, 3).includes(entry.lookupKey)) return 24
  return 0
}

function freshnessBonus(entry, context, usageStats) {
  const recent = usageStats?.recentUserStickerKeys || []
  if (recent.length === 0 || recent.includes(entry.lookupKey)) return 0
  if (!entry.intentIdSet || !context?.intentIds?.length) return 0
  const overlapCount = context.intentIds.reduce((sum, id) => {
    return entry.intentIdSet.has(id) ? sum + 1 : sum
  }, 0)
  if (overlapCount === 0) return 0
  return 42 + (overlapCount - 1) * 14
}

function sortScoredEntries(scored) {
  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if ((b.usageScore || 0) !== (a.usageScore || 0)) return (b.usageScore || 0) - (a.usageScore || 0)
    return a.order - b.order
  })
}

function diversifyTopResult(scored, context, usageStats) {
  if (!Array.isArray(scored) || scored.length < 2) return scored
  const latestKey = usageStats?.recentUserStickerKeys?.[0]
  if (!latestKey || scored[0]?.entry?.lookupKey !== latestKey) return scored

  const hasIntent = Array.isArray(context?.intentIds) && context.intentIds.length > 0
  const alternative = scored.find((item, index) => {
    if (index === 0 || item?.entry?.lookupKey === latestKey) return false
    if (item.score < scored[0].score * 0.48) return false
    if (!hasIntent) return true
    return context.intentIds.some(id => item.entry?.intentIdSet?.has(id))
  })

  if (!alternative) return scored
  return [alternative, ...scored.filter(item => item !== alternative)]
}

function scoreContextTerms(terms, corpus) {
  if (!Array.isArray(terms) || terms.length === 0) return 0
  const scores = terms.map(term => bestQueryScore(compactText(term), corpus)).filter(Boolean)
  return aggregateScores(scores)
}

function countMatchedQueryTerms(terms, corpus) {
  if (!Array.isArray(terms) || terms.length === 0) return 0
  return terms.reduce((count, term) => {
    return bestQueryScore(compactText(term), corpus) > 0 ? count + 1 : count
  }, 0)
}

function literalMatchBonus(hitCount, fullCoverage = false) {
  if (!hitCount) return 0
  return (fullCoverage ? 132 : 88) + Math.max(0, hitCount - 1) * 24
}

function scoreCommandEntry(entry, context, usageStats, now) {
  const literalTerms = collectLiteralTerms(context.strictTerms?.length ? context.strictTerms : context.directTerms)
  const literalQueryScore = scoreContextTerms(literalTerms, entry.sourceCorpus) * 1.45
  const directQueryScore = scoreContextTerms(context.directTerms, entry.directCorpus)
  const semanticQueryScore = scoreContextTerms(
    [...context.directTerms, ...context.expandedTerms],
    entry.semanticCorpus
  ) * 0.55
  const intentOverlap = context.intentIds.reduce((sum, id) => {
    return entry.intentIdSet.has(id) ? sum + 48 : sum
  }, 0)
  const usageScore = usageScoreForStat(usageStats?.byKey?.get(entry.lookupKey), now)
  const strictMatchCount = countMatchedQueryTerms(context.strictTerms, entry.semanticCorpus)
  const literalHitCount = countMatchedQueryTerms(literalTerms, entry.sourceCorpus)
  const strictQueryBonus = context.strictTerms.length > 1
    ? strictMatchCount >= context.strictTerms.length
      ? 64 + (strictMatchCount - context.strictTerms.length) * 8
      : strictMatchCount * 18
    : 0
  const conflictCount = countIntentConflicts(context.intentIds, entry.intentIdSet)
  const conflictPenalty = conflictCount > 0
    ? (intentOverlap > 0 ? conflictCount * 24 : conflictCount * 86)
    : 0
  const score = literalQueryScore + directQueryScore + semanticQueryScore + intentOverlap + usageScore + strictQueryBonus + literalMatchBonus(literalHitCount, literalHitCount >= literalTerms.length && literalTerms.length > 0) - conflictPenalty
  return { score, usageScore, strictMatchCount, literalHitCount }
}

function scoreNaturalEntry(entry, context, usageStats, now) {
  let score = 0
  const literalTerms = collectLiteralTerms(context.directTerms)

  const literalScore = scoreContextTerms(literalTerms, entry.sourceCorpus) * 1.58
  const directScore = scoreContextTerms(context.directTerms, entry.directCorpus)
  const expandedScore = scoreContextTerms(context.expandedTerms, entry.semanticCorpus) * 0.78
  const literalHitCount = countMatchedQueryTerms(literalTerms, entry.sourceCorpus)
  const queryIntentOverlap = context.intentIds.reduce((sum, id) => {
    return entry.intentIdSet.has(id) ? sum + 1 : sum
  }, 0)
  const queryLaneOverlap = (context.intentLanes || []).reduce((sum, lane) => {
    return entry.intentLaneSet.has(lane) ? sum + 1 : sum
  }, 0)
  score += literalScore
  score += literalMatchBonus(literalHitCount, literalHitCount >= literalTerms.length && literalTerms.length > 0)
  score += directScore * 1.18
  score += expandedScore

  if (queryIntentOverlap > 0) {
    score += queryIntentOverlap * 58
  }

  const conflictCount = countIntentConflicts(context.intentIds, entry.intentIdSet)
  if (conflictCount > 0) {
    score -= queryIntentOverlap > 0 ? conflictCount * 32 : conflictCount * 132
  }

  const querySupportScore = score
  const canUseReactionFallback = !!context.reactionLike && querySupportScore <= 0
  let recentContextScore = 0
  let recentMatchCount = 0

  if (querySupportScore > 0 || canUseReactionFallback) {
    context.recentMessages.forEach((message) => {
      const signals = message.signals || collectTextSignals(message.text)
      const messageLanes = collectIntentLanes(signals.intentIds)
      if (canUseReactionFallback && !sharesAnyValue(context.intentLanes, messageLanes)) {
        return
      }

      const direct = scoreContextTerms(signals.directTerms, entry.directCorpus)
      const expanded = scoreContextTerms(signals.expandedTerms, entry.semanticCorpus) * 0.62
      const intentBonus = signals.intentIds.reduce((sum, id) => {
        return entry.intentIdSet.has(id) ? sum + (28 * message.weight) : sum
      }, 0)
      const messageScore = ((direct + expanded) * message.weight) + intentBonus
      if (messageScore <= 0) return
      score += messageScore
      recentContextScore += messageScore
      recentMatchCount += 1
    })
  }

  const usageScore = usageScoreForStat(usageStats?.byKey?.get(entry.lookupKey), now)
  score += usageScore
  if (querySupportScore > 0) {
    score += freshnessBonus(entry, context, usageStats)
  }
  score -= repeatedPenalty(entry, usageStats)

  return {
    score,
    usageScore,
    literalHitCount,
    querySupportScore,
    queryIntentOverlap,
    queryLaneOverlap,
    recentContextScore,
    recentMatchCount
  }
}

function fallbackCommandScore(entry, usageStats, now) {
  const usageScore = usageScoreForStat(usageStats?.byKey?.get(entry.lookupKey), now)
  const score = usageScore + Math.max(0, 12 - entry.order * 0.1)
  return { score, usageScore, strictMatchCount: 0, literalHitCount: 0 }
}

function relativeThreshold(scored, minimum, ratio) {
  if (!scored.length) return []
  const top = scored[0].score
  if (top < minimum) return []
  const threshold = Math.max(minimum, top * ratio)
  return scored.filter(item => item.score >= threshold)
}

function isDirectKeywordContext(context) {
  if (!context || context.mode !== 'keyword') return false
  if (!context.query || context.query.length > 8) return false
  return collectLiteralTerms(context.directTerms).length > 0 && context.directTerms.length <= 6
}

function mergeScoredEntries(primary, secondary, limit) {
  const merged = []
  const seen = new Set()
  ;[...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])].forEach((item) => {
    const key = item?.entry?.lookupKey
    if (!key || seen.has(key)) return
    seen.add(key)
    merged.push(item)
  })
  return merged.slice(0, limit)
}

export function buildStickerSuggestionIndex(stickers = []) {
  return stickers.map((sticker, order) => {
    const sources = collectStickerSources(sticker)
    const directTerms = new Set()
    const semanticTerms = new Set()
    const intentIds = new Set()
    const intentLanes = new Set()

    sources.forEach((source) => {
      collectTextTerms(source).forEach(term => addTerm(directTerms, term))
      const signals = collectTextSignals(source)
      signals.intentIds.forEach((id) => {
        intentIds.add(id)
        const lane = INTENT_GROUP_MAP.get(id)?.lane
        if (lane) intentLanes.add(lane)
      })
      signals.expandedTerms.forEach(term => addTerm(semanticTerms, term))
    })

    const directTermList = Array.from(directTerms)
    const semanticTermList = Array.from(semanticTerms)
    const nameKey = compactText(sticker?.name)

    return {
      sticker,
      order,
      lookupKey: nameKey,
      sourceCorpus: uniqueCompacts(sources),
      directTerms: directTermList,
      semanticTerms: semanticTermList,
      directCorpus: uniqueCompacts(directTermList),
      semanticCorpus: uniqueCompacts([...directTermList, ...semanticTermList]),
      intentIdSet: intentIds,
      intentLaneSet: intentLanes
    }
  })
}

export function extractStickerCommandQuery(text) {
  const match = String(text ?? '').match(STICKER_COMMAND_REGEX)
  return match ? String(match[1] ?? '').trim() : null
}

export function buildStickerCandidateContext({ inputValue = '', activeChat = null } = {}) {
  const commandQuery = extractStickerCommandQuery(inputValue)
  if (commandQuery !== null) {
    return buildCommandContext(commandQuery)
  }
  return buildNaturalContext(inputValue, activeChat)
}

function extractStickerNameFromMessage(message) {
  if (!message) return ''
  if (message.isSticker && message.stickerName) return normalizeText(message.stickerName)
  if (message.stickerName) return normalizeText(message.stickerName)
  const content = String((message.displayContent ?? message.content) ?? '').trim()
  if (!content) return ''
  let name = ''
  content.replace(STICKER_TOKEN_REGEX, (_, stickerName) => {
    name = normalizeText(stickerName)
    return _
  })
  return name
}

function extractSearchableMessageText(message) {
  if (!message) return ''
  if (message.isSticker || message.isImage || message.isMockImage || message.isImageRendering) return ''
  const content = String((message.displayContent ?? message.content) ?? '')
    .replace(SPECIAL_TOKEN_REGEX, ' ')
    .trim()
  return normalizeText(content)
}

export function buildStickerUsageStats(contacts = [], activeChatId = null, options = {}) {
  const byKey = new Map()
  const activeChat = Array.isArray(contacts)
    ? contacts.find(contact => contact?.id === activeChatId)
    : null
  const maxContacts = Number(options?.maxContacts || 0)
  const maxMessagesPerContact = Number(options?.maxMessagesPerContact || 0)

  const ensureStat = (key) => {
    if (!key) return null
    if (!byKey.has(key)) {
      byKey.set(key, {
        globalCount: 0,
        globalUserCount: 0,
        chatCount: 0,
        chatUserCount: 0,
        globalLastUsedAt: 0,
        chatLastUsedAt: 0
      })
    }
    return byKey.get(key)
  }

  let contactsToScan = Array.isArray(contacts) ? contacts : []
  if (maxContacts > 0 && contactsToScan.length > maxContacts) {
    const recent = contactsToScan.slice(-maxContacts)
    if (activeChat && !recent.includes(activeChat)) {
      recent[0] = activeChat
    }
    contactsToScan = recent
  }

  if (contactsToScan.length > 0) {
    contactsToScan.forEach((contact) => {
      const isActiveChat = !!activeChatId && contact?.id === activeChatId
      const messages = Array.isArray(contact?.msgs) ? contact.msgs : []
      const scopedMessages = (
        maxMessagesPerContact > 0 && messages.length > maxMessagesPerContact
      ) ? messages.slice(-maxMessagesPerContact) : messages

      scopedMessages.forEach((message) => {
        const key = compactText(extractStickerNameFromMessage(message))
        if (!key) return
        const stat = ensureStat(key)
        if (!stat) return
        stat.globalCount += 1
        if (message?.role === 'user') stat.globalUserCount += 1
        if (isActiveChat) {
          stat.chatCount += 1
          if (message?.role === 'user') stat.chatUserCount += 1
        }
        const time = Number(message?.time) || 0
        if (time > stat.globalLastUsedAt) stat.globalLastUsedAt = time
        if (isActiveChat && time > stat.chatLastUsedAt) stat.chatLastUsedAt = time
      })
    })
  }

  const recentUserStickerKeys = []
  if (activeChat && Array.isArray(activeChat.msgs)) {
    for (let i = activeChat.msgs.length - 1; i >= 0 && recentUserStickerKeys.length < 4; i -= 1) {
      const message = activeChat.msgs[i]
      if (message?.role !== 'user') continue
      const key = compactText(extractStickerNameFromMessage(message))
      if (key) recentUserStickerKeys.push(key)
    }
  }

  return {
    byKey,
    recentUserStickerKeys
  }
}

export function getStickerCandidates({
  stickerIndex = [],
  context = null,
  usageStats = null,
  limitCommand = 8,
  limitNatural = 6,
  now = Date.now()
} = {}) {
  if (!Array.isArray(stickerIndex) || stickerIndex.length === 0) return []
  if (!context?.shouldSuggest) return []

  if (context.mode === 'command') {
    const scored = sortScoredEntries(
      stickerIndex.map((entry) => {
        const base = context.query
          ? scoreCommandEntry(entry, context, usageStats, now)
          : fallbackCommandScore(entry, usageStats, now)
        return { ...base, entry, order: entry.order }
      })
    )

    let filtered = scored
    if (context.query && Array.isArray(context.strictTerms) && context.strictTerms.length >= 2) {
      const intersected = scored.filter(item => (item.strictMatchCount || 0) >= Math.min(2, context.strictTerms.length))
      if (intersected.length > 0) {
        filtered = intersected
      }
    }

    filtered = context.query
      ? relativeThreshold(filtered, 52, 0.32)
      : filtered

    return filtered
      .slice(0, limitCommand)
      .map(item => item.entry.sticker)
  }

  const scored = diversifyTopResult(sortScoredEntries(
    stickerIndex.map((entry) => {
      const base = scoreNaturalEntry(entry, context, usageStats, now)
      return { ...base, entry, order: entry.order }
    })
  ), context, usageStats).filter((item) => {
    const hasIntentOverlap = Array.isArray(context.intentIds) && context.intentIds.some(id => item.entry?.intentIdSet?.has(id))
    const conflictCount = countIntentConflicts(context.intentIds, item.entry?.intentIdSet)
    if (!hasIntentOverlap && conflictCount > 0) return false
    if ((item.querySupportScore || 0) > 0) return true
    if (!context.reactionLike) return false
    if ((item.recentMatchCount || 0) <= 0) return false
    return (item.recentContextScore || 0) >= 46
  })

  const baseResults = relativeThreshold(scored, 72, 0.42)
  if (isDirectKeywordContext(context)) {
    const literalPreferred = relativeThreshold(
      scored.filter(item => (item.literalHitCount || 0) > 0),
      48,
      0.2
    )
    const latestKey = usageStats?.recentUserStickerKeys?.[0]
    const topLiteralKey = literalPreferred[0]?.entry?.lookupKey
    const topBaseKey = baseResults[0]?.entry?.lookupKey
    const shouldPromoteLiteral = literalPreferred.length > 0 && !(latestKey && topLiteralKey === latestKey && topBaseKey && topBaseKey !== latestKey)

    if (shouldPromoteLiteral) {
      return mergeScoredEntries(literalPreferred, baseResults, limitNatural)
        .map(item => item.entry.sticker)
    }
  }

  return baseResults
    .slice(0, limitNatural)
    .map(item => item.entry.sticker)
}
