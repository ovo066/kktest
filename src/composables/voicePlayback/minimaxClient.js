import { sanitizeMiniMaxGroupId } from '../../utils/minimaxConfig'

const MINIMAX_TUNE_VERSION = 'natural-v1'
const MINIMAX_TUNE_STRENGTH = 0.7
const MINIMAX_VOICE_LIMITS = Object.freeze({
  speed: { min: 0.85, max: 1.15 },
  pitch: { min: -1, max: 1 },
  vol: { min: 0.8, max: 1.2 }
})
const MINIMAX_API_PITCH_RANGE = Object.freeze({ min: -12, max: 12 })
const MINIMAX_EMOTION_ADJUSTMENTS = Object.freeze({
  normal: { speed: 0, pitch: 0, vol: 0 },
  neutral: { speed: 0, pitch: 0, vol: 0 },
  happy: { speed: 0.08, pitch: 0.3, vol: 0.1 },
  sad: { speed: -0.1, pitch: -0.4, vol: -0.1 },
  angry: { speed: 0.12, pitch: 0.2, vol: 0.15 },
  surprised: { speed: 0.05, pitch: 0.4, vol: 0.15 },
  fearful: { speed: 0.1, pitch: 0.5, vol: 0.05 },
  confused: { speed: -0.05, pitch: 0.2, vol: 0 },
  thinking: { speed: -0.05, pitch: -0.1, vol: -0.02 },
  laughing: { speed: 0.09, pitch: 0.3, vol: 0.1 },
  excited: { speed: 0.1, pitch: 0.35, vol: 0.12 },
  shy: { speed: -0.06, pitch: -0.2, vol: -0.06 },
  worried: { speed: 0.02, pitch: 0.15, vol: -0.02 },
  love: { speed: 0.03, pitch: 0.2, vol: 0.08 },
  sleepy: { speed: -0.12, pitch: -0.3, vol: -0.08 },
  proud: { speed: 0.04, pitch: 0.15, vol: 0.05 },
  nervous: { speed: 0.08, pitch: 0.2, vol: 0.04 }
})
const MINIMAX_API_EMOTION_MAP = Object.freeze({
  normal: 'calm',
  neutral: 'calm',
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  fearful: 'fearful',
  confused: 'calm',
  thinking: 'calm',
  laughing: 'happy',
  excited: 'fluent',
  shy: 'whisper',
  worried: 'calm',
  love: 'calm',
  sleepy: 'whisper',
  proud: 'fluent',
  nervous: 'calm'
})
const MINIMAX_KNOWN_MODELS = new Set([
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo'
])
const MINIMAX_MODEL_ALIASES = Object.freeze({
  'speech2.8-hd': 'speech-2.8-hd',
  'speech2.8-turbo': 'speech-2.8-turbo',
  'speech2.6-hd': 'speech-2.6-hd',
  'speech2.6-turbo': 'speech-2.6-turbo',
  'speech02-hd': 'speech-02-hd',
  'speech02-turbo': 'speech-02-turbo',
  'speech01-hd': 'speech-01-hd',
  'speech01-turbo': 'speech-01-turbo'
})
const MINIMAX_28_INTERJECTION_TAGS = new Set([
  'laughs', 'chuckle', 'coughs', 'clear-throat', 'groans',
  'breath', 'pant', 'inhale', 'exhale', 'gasps', 'sniffs',
  'sighs', 'snorts', 'burps', 'lip-smacking', 'humming',
  'hissing', 'emm', 'sneezes'
])
const MINIMAX_CACHE_HOST_ALIASES = Object.freeze({
  'api-uw.minimax.io': 'api.minimax.io',
  'api-bj.minimaxi.com': 'api.minimaxi.com'
})

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

function roundTo(value, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const scale = 10 ** digits
  return Math.round(n * scale) / scale
}

export function normalizeEmotionKey(value) {
  const key = String(value || '').trim().toLowerCase()
  if (!key) return 'normal'
  if (MINIMAX_EMOTION_ADJUSTMENTS[key]) return key
  return 'normal'
}

export function extractEmotionTag(text) {
  const match = String(text || '').match(/\[emotion:(\w+)\]/i)
  return match ? normalizeEmotionKey(match[1]) : 'normal'
}

function resolveMiniMaxApiEmotion(value) {
  const key = normalizeEmotionKey(value)
  return MINIMAX_API_EMOTION_MAP[key] || 'calm'
}

export function normalizeMiniMaxModelName(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'speech-02-turbo'

  if (MINIMAX_KNOWN_MODELS.has(raw)) return raw
  if (MINIMAX_MODEL_ALIASES[raw]) return MINIMAX_MODEL_ALIASES[raw]

  let next = raw.replace(/^speech(?=\d)/, 'speech-')
  next = next.replace(/^(speech-[0-9.]+)(hd|turbo)$/i, '$1-$2')
  if (MINIMAX_KNOWN_MODELS.has(next)) return next
  return raw
}

function normalizeMiniMaxText(rawText, modelName) {
  const raw = String(rawText || '').trim()
  if (!raw) return ''

  let text = raw.replace(/<#([^#>]*)#>/g, (full, value) => {
    const n = Number(String(value || '').trim())
    if (!Number.isFinite(n) || n < 0.01 || n > 99.99) return ' '
    const rounded = Math.round(n * 100) / 100
    return `<#${rounded}#>`
  })

  if (/^speech-2\.8-(?:hd|turbo)$/i.test(String(modelName || ''))) {
    text = text.replace(/\(([a-z-]{2,30})\)/gi, (full, tag) => {
      const key = String(tag || '').toLowerCase()
      return MINIMAX_28_INTERJECTION_TAGS.has(key) ? `(${key})` : key
    })
  }

  return text.trim()
}

export function resolveMiniMaxVoiceTuning(text, emotion) {
  const rawText = String(text || '')
  const emotionKey = normalizeEmotionKey(emotion)
  const adjustment = MINIMAX_EMOTION_ADJUSTMENTS[emotionKey] || MINIMAX_EMOTION_ADJUSTMENTS.normal
  const tune = {
    speed: 1 + adjustment.speed * MINIMAX_TUNE_STRENGTH,
    pitch: adjustment.pitch * MINIMAX_TUNE_STRENGTH,
    vol: 1 + adjustment.vol * MINIMAX_TUNE_STRENGTH
  }

  if (/[，,、；;]/.test(rawText)) tune.speed -= 0.01
  if (/[。！？!?…]/.test(rawText)) tune.speed -= 0.02
  if (/[？?]/.test(rawText)) tune.pitch += 0.08
  if (/[！!]/.test(rawText)) tune.vol += 0.05
  if (rawText.length >= 28) tune.speed -= 0.03
  if (rawText.length >= 46) tune.speed -= 0.02

  const speed = roundTo(clampNumber(tune.speed, MINIMAX_VOICE_LIMITS.speed.min, MINIMAX_VOICE_LIMITS.speed.max, 1), 2)
  const pitch = roundTo(clampNumber(tune.pitch, MINIMAX_VOICE_LIMITS.pitch.min, MINIMAX_VOICE_LIMITS.pitch.max, 0), 2)
  const vol = roundTo(clampNumber(tune.vol, MINIMAX_VOICE_LIMITS.vol.min, MINIMAX_VOICE_LIMITS.vol.max, 1), 2)
  const signature = `${MINIMAX_TUNE_VERSION}:${emotionKey}:${speed.toFixed(2)}:${pitch.toFixed(2)}:${vol.toFixed(2)}`

  return { speed, pitch, vol, emotion: emotionKey, signature }
}

export function trimText(text) {
  return String(text || '')
    .replace(/\[.*?\]/g, '')
    .replace(/[*_~`]/g, '')
    .trim()
}

function normalizeMiniMaxCacheText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function appendQuery(url, key, value) {
  try {
    const u = new URL(url)
    u.searchParams.set(key, value)
    return u.toString()
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    return url + sep + encodeURIComponent(key) + '=' + encodeURIComponent(value)
  }
}

function looksLikeBareHost(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(String(value || '').trim())
}

export function normalizeMiniMaxEndpoint(endpoint) {
  let raw = String(endpoint || '').trim()
  if (!raw) return ''
  if (!/^https?:\/\//i.test(raw) && looksLikeBareHost(raw)) {
    raw = 'https://' + raw
  }

  try {
    const u = new URL(raw)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    if (path === '/' || /^\/v1$/i.test(path)) {
      u.pathname = '/v1/t2a_v2'
    } else if (/^\/v1\/t2a_v2$/i.test(path)) {
      u.pathname = '/v1/t2a_v2'
    } else {
      u.pathname = path
    }
    u.hash = ''
    return u.toString()
  } catch {
    return raw
  }
}

export function buildMiniMaxEndpointCandidates(endpoint) {
  const primary = normalizeMiniMaxEndpoint(endpoint)
  if (!primary) return []

  const out = []
  const add = (url) => {
    const value = String(url || '').trim()
    if (!value || out.includes(value)) return
    out.push(value)
  }
  add(primary)

  try {
    const u = new URL(primary)
    const host = u.hostname.toLowerCase()
    const backupHost = ({
      'api.minimax.io': 'api-uw.minimax.io',
      'api-uw.minimax.io': 'api.minimax.io',
      'api.minimaxi.com': 'api-bj.minimaxi.com',
      'api-bj.minimaxi.com': 'api.minimaxi.com'
    })[host]

    if (backupHost) {
      const backup = new URL(u.toString())
      backup.hostname = backupHost
      add(backup.toString())
    }
  } catch {
    // Ignore candidate expansion when endpoint is not an absolute URL.
  }

  return out
}

function hexToU8(hex) {
  const source = String(hex || '').trim()
  if (!source || source.length % 2 !== 0) return null
  const out = new Uint8Array(source.length / 2)
  for (let i = 0; i < source.length; i += 2) {
    const byte = parseInt(source.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i / 2] = byte
  }
  return out
}

function base64ToU8(base64) {
  const source = String(base64 || '').trim()
  if (!source) return null
  const normalized = source
    .replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '')
    .replace(/\s+/g, '')
  try {
    const binary = atob(normalized)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i)
    }
    return out
  } catch {
    return null
  }
}

export async function fetchAudioAsBytes(url) {
  const targetUrl = String(url || '').trim()
  if (!targetUrl) return null
  const shouldUseProxy = (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  )

  const toBytes = async (res) => {
    if (!res || !res.ok) return null
    const blob = await res.blob().catch(() => null)
    if (!blob || !blob.size) return null
    const ab = await blob.arrayBuffer().catch(() => null)
    if (!ab || !ab.byteLength) return null
    return {
      bytes: new Uint8Array(ab),
      mimeType: String(blob.type || 'audio/mpeg')
    }
  }

  if (shouldUseProxy) {
    try {
      const proxied = await fetch('/api/proxy', {
        method: 'GET',
        headers: {
          'x-target-url': targetUrl
        }
      })
      const proxiedBytes = await toBytes(proxied)
      if (proxiedBytes?.bytes?.byteLength) return proxiedBytes
    } catch {
      // Ignore proxy fetch errors and fallback to direct fetch.
    }
  }

  try {
    const res = await fetch(targetUrl)
    return await toBytes(res)
  } catch {
    return null
  }
}

function extractMiniMaxAudio(data) {
  const candidates = [
    data?.data?.audio,
    data?.audio,
    data?.data?.audio_url,
    data?.audio_url
  ]
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim()
  }
  return null
}

function shouldRetryMiniMaxWithUrl(result) {
  if (!result || result.networkError) return false
  if (result.ok && result.audio) return false
  if (result.status === 400 || result.status === 404 || result.status === 415 || result.status === 422) return true
  if (result.statusCode === 2013) return true
  return !result.audio
}

function isMiniMaxInvalidParams(result) {
  if (!result || result.networkError) return false
  return result.statusCode === 2013 || result.status === 400 || result.status === 422
}

function isLikelyMiniMaxAuthOrRegionError(result) {
  if (!result) return false
  if (result.status === 401 || result.status === 403) return true
  if (result.statusCode === 1004 || result.statusCode === 2049) return true
  const msg = String(result.statusMsg || '').toLowerCase()
  return (
    msg.includes('token') ||
    msg.includes('api key') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('not match group')
  )
}

function formatMiniMaxFailure(failure, triedEndpoints) {
  const endpoint = failure?.endpoint || ''
  const result = failure?.result || null
  if (!result) return 'MiniMax request failed'

  const parts = []
  if (result.status) parts.push('HTTP ' + result.status)
  if (result.statusCode != null && result.statusCode !== 0) parts.push('code ' + result.statusCode)
  if (result.statusMsg) parts.push(result.statusMsg)
  if (result.traceId) parts.push('trace_id=' + result.traceId)

  let msg = parts.length
    ? 'MiniMax request failed (' + parts.join(', ') + ')'
    : 'MiniMax request failed'

  if (result.networkError) {
    msg += '. Browser request may be blocked by network policy or CORS; consider a backend proxy.'
  }

  if (isLikelyMiniMaxAuthOrRegionError(result)) {
    msg += ' Check API key and endpoint region: global https://api.minimax.io/v1/t2a_v2, China https://api.minimaxi.com/v1/t2a_v2.'
  }
  if (result.statusCode === 2013) {
    msg += ' Code 2013 means invalid params: verify model/voice_id and remove unsupported interjection tags like "(...)" in text.'
  }

  if (triedEndpoints.length > 1) {
    msg += ' Tried endpoints: ' + triedEndpoints.join(' -> ')
  } else if (endpoint) {
    msg += ' Endpoint: ' + endpoint
  }

  return msg
}

export async function synthesizeMiniMax({ endpoint, apiKey, groupId, model, text, voiceId, voiceTuning = null }) {
  const normalizedEndpoint = normalizeMiniMaxEndpoint(endpoint)
  if (!normalizedEndpoint) throw new Error('MiniMax endpoint is not configured')

  const key = String(apiKey || '').trim()
  if (!key) throw new Error('MiniMax API key is not configured')

  const gid = sanitizeMiniMaxGroupId(groupId, normalizedEndpoint)
  const normalizedModel = normalizeMiniMaxModelName(model)
  const rawText = String(text || '').trim()
  const normalizedText = normalizeMiniMaxText(rawText, normalizedModel) || rawText
  const normalizedVoiceId = String(voiceId || '').trim()
  if (!normalizedVoiceId) throw new Error('MiniMax voice ID is not configured')

  const endpointCandidates = buildMiniMaxEndpointCandidates(normalizedEndpoint)
  const rawPitch = clampNumber(voiceTuning?.pitch, MINIMAX_VOICE_LIMITS.pitch.min, MINIMAX_VOICE_LIMITS.pitch.max, 0)
  const apiPitch = clampNumber(Math.round(rawPitch * 12), MINIMAX_API_PITCH_RANGE.min, MINIMAX_API_PITCH_RANGE.max, 0)
  const tuning = {
    speed: roundTo(clampNumber(voiceTuning?.speed, MINIMAX_VOICE_LIMITS.speed.min, MINIMAX_VOICE_LIMITS.speed.max, 1), 2),
    vol: roundTo(clampNumber(voiceTuning?.vol, MINIMAX_VOICE_LIMITS.vol.min, MINIMAX_VOICE_LIMITS.vol.max, 1), 2),
    pitch: apiPitch === 0 ? 0 : apiPitch,
    emotion: resolveMiniMaxApiEmotion(voiceTuning?.emotion)
  }

  const buildBody = (outputFormat, options = {}) => {
    const requestText = String(options.text || normalizedText || rawText).trim()
    const minimalVoice = options.minimalVoice === true
    const disableEmotion = options.disableEmotion === true

    const voiceSetting = minimalVoice
      ? { voice_id: normalizedVoiceId }
      : {
          voice_id: normalizedVoiceId,
          speed: tuning.speed,
          vol: tuning.vol,
          pitch: tuning.pitch
        }
    if (!disableEmotion) voiceSetting.emotion = tuning.emotion

    return {
      model: normalizedModel,
      text: requestText,
      stream: false,
      output_format: outputFormat,
      voice_setting: voiceSetting,
      audio_setting: {
        format: 'mp3',
        sample_rate: 32000,
        bitrate: 128000,
        channel: 1
      }
    }
  }

  const requestMiniMax = async (requestUrl, outputFormat, requestOptions = null) => {
    const body = buildBody(outputFormat, requestOptions || {})
    const targetUrl = gid
      ? appendQuery(requestUrl, 'GroupId', gid)
      : requestUrl

    const useProxy = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    const fetchUrl = useProxy ? '/api/proxy' : targetUrl
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    }
    if (useProxy) headers['x-target-url'] = targetUrl

    try {
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => null)
      const parsedCode = Number(data?.base_resp?.status_code)
      const statusCode = Number.isFinite(parsedCode) ? parsedCode : null
      const statusMsg = String(data?.base_resp?.status_msg || '').trim()
      const traceId = String(data?.trace_id || res.headers.get('trace-id') || '').trim()
      const audio = extractMiniMaxAudio(data)
      const apiOk = statusCode == null || statusCode === 0

      return {
        ok: res.ok && apiOk,
        status: res.status,
        statusCode,
        statusMsg,
        traceId,
        networkError: false,
        data,
        audio
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        statusCode: null,
        statusMsg: error instanceof Error ? error.message : String(error || ''),
        traceId: '',
        networkError: true,
        data: null,
        audio: null
      }
    }
  }

  const failures = []
  const primaryRequestOptions = { text: rawText || normalizedText, minimalVoice: false, disableEmotion: false }
  const fallbackRequestOptions = { text: normalizedText || rawText, minimalVoice: true, disableEmotion: true }

  for (const requestUrl of endpointCandidates) {
    let result = await requestMiniMax(requestUrl, 'hex', primaryRequestOptions)
    if (shouldRetryMiniMaxWithUrl(result)) {
      const urlResult = await requestMiniMax(requestUrl, 'url', primaryRequestOptions)
      if ((urlResult.ok && urlResult.audio) || (!result.ok && !urlResult.networkError)) {
        result = urlResult
      }
    }

    if (!(result.ok && result.audio) && isMiniMaxInvalidParams(result)) {
      let fallbackResult = await requestMiniMax(requestUrl, 'hex', fallbackRequestOptions)
      if (shouldRetryMiniMaxWithUrl(fallbackResult)) {
        const fallbackUrlResult = await requestMiniMax(requestUrl, 'url', fallbackRequestOptions)
        if ((fallbackUrlResult.ok && fallbackUrlResult.audio) || (!fallbackResult.ok && !fallbackUrlResult.networkError)) {
          fallbackResult = fallbackUrlResult
        }
      }
      if ((fallbackResult.ok && fallbackResult.audio) || (!result.ok && !fallbackResult.networkError)) {
        result = fallbackResult
      }
    }

    if (result.ok && result.audio) {
      const audio = String(result.audio || '').trim()
      if (/^https?:\/\//i.test(audio)) {
        return { remoteUrl: audio, mimeType: 'audio/mpeg' }
      }

      const bytes = hexToU8(audio) || base64ToU8(audio)
      if (!bytes) throw new Error('MiniMax audio format is not supported')
      return { bytes, mimeType: 'audio/mpeg' }
    }

    failures.push({ endpoint: requestUrl, result })
  }

  const bestFailure = failures.find(item => !item.result?.networkError) || failures[0] || null
  const triedEndpoints = failures.map(item => item.endpoint)
  throw new Error(formatMiniMaxFailure(bestFailure, triedEndpoints))
}

function buildMiniMaxCacheEndpoint(endpoint) {
  const normalized = normalizeMiniMaxEndpoint(endpoint) || String(endpoint || '').trim()
  if (!normalized) return ''

  try {
    const u = new URL(normalized)
    const host = String(u.hostname || '').toLowerCase()
    const canonicalHost = MINIMAX_CACHE_HOST_ALIASES[host] || host
    u.hostname = canonicalHost
    u.hash = ''
    return u.toString()
  } catch {
    return normalized
  }
}

export function buildMiniMaxCacheKey(endpoint, model, voiceId, text, tuningSignature = 'default') {
  const ep = buildMiniMaxCacheEndpoint(endpoint)
  const normalizedModel = normalizeMiniMaxModelName(model)
  const normalizedVoiceId = String(voiceId || '').trim()
  const normalizedText = normalizeMiniMaxCacheText(text)
  const normalizedSignature = String(tuningSignature || 'default').trim() || 'default'
  return `minimax:${ep}:${normalizedModel}:${normalizedVoiceId}:${normalizedSignature}:${normalizedText}`
}
