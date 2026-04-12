// @ts-check

import { escapeSvgText, hashString, lower, normalizeExpression, normalizeText, tokenizeText } from './utils'

const SAFEBORU_API =
  'https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=60&tags='

const DEFAULT_BACKGROUND_TIMEOUT_MS = 8_000
const SCENE_HINTS = [
  { re: /咖啡|cafe|coffee/i, tags: ['coffee_shop', 'cafe', 'indoors'] },
  { re: /公园|park|garden/i, tags: ['park', 'tree', 'outdoors'] },
  { re: /海|海边|beach|sea|ocean/i, tags: ['beach', 'ocean', 'sky'] },
  { re: /夜|night|evening/i, tags: ['night', 'night_sky'] },
  { re: /学校|school|classroom/i, tags: ['school', 'classroom', 'indoors'] },
  { re: /街|city|街道|urban/i, tags: ['cityscape', 'street', 'outdoors'] },
  { re: /家|房间|room|home|bedroom/i, tags: ['indoors', 'room'] },
  { re: /雨|rain/i, tags: ['rain', 'cloudy'] },
  { re: /雪|snow|winter/i, tags: ['snow', 'winter'] }
]

const IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|webp|bmp|svg)(?:\?|#|$)/i
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|weba|opus)(?:\?|#|$)/i
const DEFAULT_IMAGE_PROXY = 'https://wsrv.nl/?url='
const PROXY_HOST_RE = /(pximg\.net|pixiv\.net|weibo\.com|weibocdn\.com|postimg\.cc)/i

const BGM_HINTS = [
  { re: /romantic|love|date|暧昧|浪漫|温柔/i, tags: ['romantic', 'love', 'date', 'warm', 'soft'] },
  { re: /happy|cheerful|fun|开心|欢乐|轻快|明亮/i, tags: ['happy', 'cheerful', 'bright', 'upbeat', 'light'] },
  { re: /calm|ambient|peace|安静|平静|舒缓|放松/i, tags: ['calm', 'ambient', 'soft', 'peaceful'] },
  { re: /sad|melancholy|伤感|悲伤|低落/i, tags: ['sad', 'melancholy', 'piano', 'slow'] },
  { re: /tense|suspense|mystery|紧张|悬疑/i, tags: ['tense', 'suspense', 'mystery', 'dark'] },
  { re: /battle|action|fight|战斗|激烈/i, tags: ['battle', 'action', 'epic', 'intense'] },
  { re: /咖啡|cafe|coffee/i, tags: ['acoustic', 'jazz', 'chill', 'lounge'] },
  { re: /公园|park|garden/i, tags: ['calm', 'acoustic', 'nature', 'soft'] },
  { re: /海|海边|beach|sea|ocean/i, tags: ['ambient', 'chillout', 'summer', 'soft'] },
  { re: /城市|街|street|city|urban/i, tags: ['chill', 'groove', 'city', 'night'] },
  { re: /学校|school|classroom/i, tags: ['light', 'bright', 'acoustic', 'soft'] },
  { re: /家|房间|room|home|bedroom/i, tags: ['warm', 'soft', 'calm', 'ambient'] },
  { re: /night|夜|晚|moon/i, tags: ['night', 'calm', 'ambient'] },
  { re: /rain|雨/i, tags: ['rain', 'ambient', 'soft'] }
]

const SFX_HINTS = [
  { re: /door|open|close|门|开门|关门/i, tags: ['door', 'open', 'close'] },
  { re: /step|foot|walk|脚步|走路/i, tags: ['footstep', 'walk', 'step'] },
  { re: /rain|雨/i, tags: ['rain', 'water', 'ambient'] },
  { re: /wind|风/i, tags: ['wind', 'ambient'] },
  { re: /phone|ring|铃|来电/i, tags: ['phone', 'ring', 'notification'] },
  { re: /click|tap|按键|点击/i, tags: ['click', 'tap', 'ui'] },
  { re: /typing|keyboard|打字|键盘/i, tags: ['typing', 'keyboard'] },
  { re: /crowd|人群|嘈杂/i, tags: ['crowd', 'city', 'ambient'] },
  { re: /impact|hit|bang|撞击|砰/i, tags: ['impact', 'hit', 'bang'] }
]

function normalizeUrlSourceEntries(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item, idx) => {
      if (typeof item === 'string') {
        const raw = item.trim()
        if (!raw) return null
        if (raw.includes('|')) {
          const [name, url, tags = ''] = raw.split('|')
          return {
            id: `src_${idx}`,
            name: normalizeText(name),
            url: normalizeText(url),
            tags: normalizeText(tags),
            characterId: '',
            expression: '',
            aliases: '',
            api: '',
            method: 'GET',
            headers: '',
            body: '',
            responsePath: ''
          }
        }
        return {
          id: `src_${idx}`,
          name: '',
          url: raw,
          tags: '',
          characterId: '',
          expression: '',
          aliases: '',
          api: '',
          method: 'GET',
          headers: '',
          body: '',
          responsePath: ''
        }
      }
      if (!item || typeof item !== 'object') return null
      const url = normalizeText(item.url || item.link || item.src)
      const api = normalizeText(item.api || item.endpoint)
      if (!url && !api) return null
      return {
        id: String(item.id || `src_${idx}`),
        name: normalizeText(item.name || item.title),
        url,
        tags: normalizeText(item.tags || item.prompt || item.keyword),
        characterId: normalizeText(item.characterId || item.contactId),
        expression: normalizeExpression(item.expression || item.emotion || 'normal'),
        aliases: normalizeText(item.aliases || item.alias || ''),
        api,
        method: normalizeText(item.method || 'GET').toUpperCase(),
        headers: item.headers ?? '',
        body: item.body ?? '',
        responsePath: normalizeText(item.responsePath || item.path || '')
      }
    })
    .filter(Boolean)
}

function isLikelyMediaUrl(url, type = 'image') {
  const text = normalizeText(url)
  if (!text) return false
  if (text.startsWith('data:') || text.startsWith('blob:')) return true
  if (!/^https?:/i.test(text)) return false
  return type === 'audio' ? AUDIO_EXT_RE.test(text) : IMAGE_EXT_RE.test(text)
}

function getNestedValue(obj, path) {
  return String(path || '')
    .split(/[.\[\]]/)
    .filter(Boolean)
    .reduce((o, k) => o?.[k], obj)
}

function parseObjectLike(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  const text = String(value || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function applyTemplate(text, vars = {}) {
  return String(text || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const v = vars[key]
    if (v === undefined || v === null) return ''
    return String(v)
  })
}

function tryNormalizeGithubBlob(url) {
  const text = normalizeText(url)
  const m = text.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i)
  if (!m) return text
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`
}

function tryNormalizeImgurPage(url) {
  const text = normalizeText(url)
  const m = text.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)(?:\.[a-z0-9]+)?\/?$/i)
  if (!m) return text
  return `https://i.imgur.com/${m[1]}.jpg`
}

function applyImageProxy(url, proxyPrefix = '') {
  const source = normalizeText(url)
  if (!/^https?:/i.test(source)) return source
  const prefix = normalizeText(proxyPrefix || '')
  if (!prefix) return source
  if (prefix.includes('{url}')) {
    return prefix.replace(/\{url\}/g, encodeURIComponent(source))
  }
  return prefix + encodeURIComponent(source)
}

function normalizeExternalMediaUrl(url, type = 'image', options = {}) {
  let next = normalizeText(url)
  if (!next) return ''
  if (next.startsWith('//')) next = 'https:' + next
  next = tryNormalizeGithubBlob(next)
  next = tryNormalizeImgurPage(next)
  if (
    /^http:\/\//i.test(next) &&
    typeof window !== 'undefined' &&
    String(window.location?.protocol || '') === 'https:'
  ) {
    next = next.replace(/^http:\/\//i, 'https://')
  }

  if (type === 'image' && /^https?:/i.test(next)) {
    const explicitProxy = normalizeText(options.imageProxy || '')
    if (explicitProxy) {
      return applyImageProxy(next, explicitProxy)
    }
    if (PROXY_HOST_RE.test(next)) {
      return applyImageProxy(next, DEFAULT_IMAGE_PROXY)
    }
  }
  if (type === 'audio' && /^https?:/i.test(next)) {
    const explicitAudioProxy = normalizeText(options.audioProxy || '')
    if (explicitAudioProxy) {
      return applyImageProxy(next, explicitAudioProxy)
    }
  }
  return next
}

function ensureAbsoluteUrlMaybe(url, base) {
  const text = normalizeText(url)
  if (!text) return ''
  if (text.startsWith('//')) return 'https:' + text
  if (/^(https?:|data:|blob:)/i.test(text)) return text
  try {
    return new URL(text, base).toString()
  } catch {
    return text
  }
}

function extractFirstMediaUrl(value, type = 'image') {
  if (typeof value === 'string') {
    const text = normalizeText(value)
    if (!text) return ''
    if (text.startsWith('//') || /^(https?:|data:|blob:)/i.test(text)) return text
    return ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractFirstMediaUrl(item, type)
      if (result) return result
    }
    return ''
  }
  if (!value || typeof value !== 'object') return ''

  const preferKeys = type === 'audio'
    ? ['audio', 'audio_url', 'file', 'url', 'src', 'link']
    : ['image', 'image_url', 'file_url', 'url', 'src', 'link', 'sample_url', 'preview_url']

  for (const key of preferKeys) {
    const result = extractFirstMediaUrl(value[key], type)
    if (result) return result
  }
  for (const val of Object.values(value)) {
    const result = extractFirstMediaUrl(val, type)
    if (result) return result
  }
  return ''
}

function chooseBestByScore(entries, scorer) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  let best = null
  let bestScore = -Infinity
  for (const entry of entries) {
    const score = Number(scorer(entry))
    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }
  return best
}

function collectHintTags(text, hints) {
  const tags = []
  const source = normalizeText(text)
  if (!source) return tags
  for (const item of (hints || [])) {
    if (!item?.re || !Array.isArray(item.tags)) continue
    if (item.re.test(source)) {
      tags.push(...item.tags)
    }
  }
  return tags
}

function buildAudioHintTokens(name, context = {}, hints = []) {
  const text = [
    normalizeText(name),
    normalizeText(context.text),
    normalizeText(context.location),
    normalizeText(context.timeOfDay),
    normalizeText(context.scene)
  ].filter(Boolean).join(' ')
  const base = tokenizeText(text)
  const hint = collectHintTags(text, hints).map(lower)
  return Array.from(new Set([...base, ...hint]))
}

function toAbsoluteSafebooruUrl(url) {
  const raw = normalizeText(url)
  if (!raw) return ''
  if (raw.startsWith('//')) return 'https:' + raw
  if (raw.startsWith('/')) return 'https://safebooru.org' + raw
  if (/^https?:/i.test(raw)) return raw
  return `https://safebooru.org/${raw.replace(/^\/+/, '')}`
}

function buildFallbackBackgroundUrl(name, prompt) {
  const seed = hashString(`${name}|${prompt}`)
  const hueA = seed % 360
  const hueB = (hueA + 42) % 360
  const hueC = (hueA + 96) % 360
  const label = escapeSvgText(normalizeText(name) || 'Scene')
  const sub = escapeSvgText(normalizeText(prompt) || '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA}, 45%, 18%)"/>
      <stop offset="50%" stop-color="hsl(${hueB}, 42%, 14%)"/>
      <stop offset="100%" stop-color="hsl(${hueC}, 45%, 10%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="36%" r="62%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.24)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g1)"/>
  <circle cx="1160" cy="220" r="280" fill="url(#glow)"/>
  <circle cx="460" cy="760" r="360" fill="rgba(255,255,255,0.05)"/>
  <rect x="0" y="0" width="1600" height="900" fill="rgba(0,0,0,0.26)"/>
  <text x="72" y="794" fill="rgba(255,255,255,0.88)" font-size="52" font-family="sans-serif">${label}</text>
  <text x="74" y="846" fill="rgba(255,255,255,0.48)" font-size="28" font-family="sans-serif">${sub}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function extractSafebooruPosts(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.post)) return payload.post
  if (payload?.post && typeof payload.post === 'object') return [payload.post]
  return []
}

function scoreSafebooruPost(post) {
  const tagTokens = tokenizeText(post?.tags || '')
  const tagSet = new Set(tagTokens)
  let score = 0
  if (tagSet.has('no_humans')) score += 10
  if (tagSet.has('scenery')) score += 8
  if (tagSet.has('landscape')) score += 5
  if (tagSet.has('cityscape')) score += 5
  if (tagSet.has('1girl')) score -= 8
  if (tagSet.has('1boy')) score -= 8
  if (tagSet.has('multiple_girls')) score -= 10
  if (tagSet.has('multiple_boys')) score -= 10
  return score
}

function buildSafebooruTags(input) {
  const text = normalizeText(input)
  const tokenSet = new Set(['rating:safe', 'scenery', 'no_humans'])

  for (const hint of SCENE_HINTS) {
    if (hint.re.test(text)) {
      hint.tags.forEach(tag => tokenSet.add(tag))
    }
  }

  const extraTokens = tokenizeText(text)
    .map(t => t.replace(/-/g, '_'))
    .filter(t => /^[a-z0-9_]{2,24}$/.test(t))
    .slice(0, 6)

  extraTokens.forEach(t => tokenSet.add(t))

  if (tokenSet.size <= 3) tokenSet.add('outdoors')
  return Array.from(tokenSet).slice(0, 12).join(' ')
}

export {
  BGM_HINTS,
  DEFAULT_BACKGROUND_TIMEOUT_MS,
  SAFEBORU_API,
  SFX_HINTS,
  applyTemplate,
  buildAudioHintTokens,
  buildFallbackBackgroundUrl,
  buildSafebooruTags,
  chooseBestByScore,
  ensureAbsoluteUrlMaybe,
  extractFirstMediaUrl,
  extractSafebooruPosts,
  getNestedValue,
  isLikelyMediaUrl,
  normalizeExternalMediaUrl,
  normalizeUrlSourceEntries,
  parseObjectLike,
  scoreSafebooruPost,
  toAbsoluteSafebooruUrl
}
