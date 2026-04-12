import { parseMessageContent } from './contentParts'

const PARSE_CACHE_KEY_ORDER = []
const PARSE_CACHE = new WeakMap()
const PARSE_CACHE_LIMIT = 5000
let parseCacheSize = 0

function getContentFingerprint(content) {
  const text = String(content ?? '')
  if (!text) return '0:'
  const head = text.slice(0, 28)
  const tail = text.slice(-28)
  return `${text.length}:${head}:${tail}`
}

function makeParseOptionsSignature(options) {
  return [
    options.allowStickers !== false ? '1' : '0',
    options.allowTransfer !== false ? '1' : '0',
    options.allowGift !== false ? '1' : '0',
    options.allowVoice !== false ? '1' : '0',
    options.allowCall !== false ? '1' : '0',
    options.allowMockImage !== false ? '1' : '0',
    options.allowMusic !== false ? '1' : '0',
    options.allowMeet !== false ? '1' : '0',
    options.allowNarration !== false ? '1' : '0'
  ].join('')
}

function trimParseCache() {
  while (parseCacheSize > PARSE_CACHE_LIMIT && PARSE_CACHE_KEY_ORDER.length > 0) {
    const [msg, signature] = PARSE_CACHE_KEY_ORDER.shift()
    const bucket = PARSE_CACHE.get(msg)
    if (!bucket || !bucket.has(signature)) continue
    bucket.delete(signature)
    parseCacheSize -= 1
  }
}

export function getCachedParsedParts(message, content, options) {
  if (!message || typeof message !== 'object') {
    return parseMessageContent(String(content ?? ''), options)
  }

  const signature = makeParseOptionsSignature(options)
  const fingerprint = getContentFingerprint(content)
  let bucket = PARSE_CACHE.get(message)
  if (!bucket) {
    bucket = new Map()
    PARSE_CACHE.set(message, bucket)
  }

  const cached = bucket.get(signature)
  if (cached && cached.fingerprint === fingerprint) {
    return cached.parts
  }

  const parts = parseMessageContent(String(content ?? ''), options)
  if (!cached) {
    parseCacheSize += 1
    PARSE_CACHE_KEY_ORDER.push([message, signature])
    trimParseCache()
  }
  bucket.set(signature, { fingerprint, parts })
  return parts
}

const CALL_ENDING_CACHE = new WeakMap()

export function isMessageEndingWithCallPart(message, allowCall) {
  if (!message) return false
  if (message.isCallRecord) return true
  if (!allowCall) return false

  const displayContent = message.displayContent != null ? message.displayContent : message.content
  const fingerprint = getContentFingerprint(displayContent)
  const cached = CALL_ENDING_CACHE.get(message)
  if (cached && cached.allowCall === !!allowCall && cached.fingerprint === fingerprint) {
    return cached.value
  }

  const parts = getCachedParsedParts(message, displayContent, {
    allowStickers: false,
    allowTransfer: false,
    allowGift: false,
    allowVoice: false,
    allowCall: true
  })

  let endingWithCall = false
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
    if (part.type === 'narration') continue
    endingWithCall = part.type === 'call'
    break
  }

  CALL_ENDING_CACHE.set(message, {
    allowCall: !!allowCall,
    fingerprint,
    value: endingWithCall
  })

  return endingWithCall
}
