import { createFetchControl, isAbortError } from './fetchControl'

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const DEFAULT_NANOBANANA_MODEL = 'gemini-2.5-flash-image-preview'

const MODE_GEMINI = 'gemini'
const MODE_OPENAI_CHAT = 'openai_chat'
const MODE_OPENAI_IMAGES = 'openai_images'

const GEMINI_BASE_ASPECT_RATIOS = Object.freeze([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
])

const GEMINI3_EXTRA_ASPECT_RATIOS = Object.freeze([
  '1:4', '4:1', '1:8', '8:1'
])

const GEMINI_IMAGE_SIZES = Object.freeze(['512px', '1K', '2K', '4K'])

export async function generateNanoBanana(prompt, config = {}, options = {}) {
  const mode = normalizeNanoBananaMode(config?.apiMode || config?.mode || config?.transport)
  const keyMode = normalizeApiKeyMode(config?.apiKeyMode, mode)
  const apiKey = normalizeText(config?.apiKey)
  if (keyMode !== 'none' && !apiKey) {
    throw new Error('NanoBanana API Key 未设置')
  }
  const modelId = resolveNanoBananaModel(config?.model)

  const fetchControl = createFetchControl(options.signal, options.timeoutMs)
  try {
    if (mode === MODE_OPENAI_IMAGES) {
      return await requestOpenAIImages(prompt, modelId, config, options, apiKey, fetchControl.signal)
    }
    if (mode === MODE_OPENAI_CHAT) {
      return await requestOpenAIChat(prompt, modelId, config, options, apiKey, fetchControl.signal)
    }
    return await requestGeminiNative(prompt, modelId, config, options, apiKey, fetchControl.signal)
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (fetchControl.isTimedOut()) {
      throw new Error(`NanoBanana 请求超时（${fetchControl.timeoutMs}ms）`)
    }
    if (isAbortError(e)) {
      throw new Error('NanoBanana 请求已取消')
    }
    throw new Error('NanoBanana 请求失败: ' + msg)
  } finally {
    fetchControl.cleanup()
  }
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNanoBananaMode(value) {
  const text = normalizeText(value).toLowerCase()
  if (!text || text === MODE_GEMINI) return MODE_GEMINI
  if (text === MODE_OPENAI_CHAT || text === 'openai-chat' || text === 'openai_chat_completions' || text === 'chat') {
    return MODE_OPENAI_CHAT
  }
  if (text === MODE_OPENAI_IMAGES || text === 'openai-images' || text === 'images' || text === 'image') {
    return MODE_OPENAI_IMAGES
  }
  if (text === 'openai') return MODE_OPENAI_CHAT
  return MODE_GEMINI
}

function resolveNanoBananaModel(value) {
  const raw = normalizeText(value)
  if (!raw) return DEFAULT_NANOBANANA_MODEL

  const key = raw.toLowerCase().replace(/[\s_]+/g, '-')
  if (key === 'nanobanana' || key === 'nano-banana') return DEFAULT_NANOBANANA_MODEL
  if (key === 'nanobanana-2' || key === 'nano-banana-2' || key === 'nanobanana2' || key === 'nb-2') {
    return 'gemini-2.5-flash-image-preview'
  }
  if (key === 'nanobanana-pro' || key === 'nano-banana-pro' || key === 'nb-pro') {
    return 'gemini-3-pro-image-preview'
  }
  if (key === 'nanobanana-flash' || key === 'nanobanana-3.1' || key === 'nano-banana-3.1') {
    return 'gemini-3.1-flash-image-preview'
  }
  return raw
}

function normalizeApiKeyMode(value, mode) {
  const text = normalizeText(value).toLowerCase()
  if (text === 'none' || text === 'noauth' || text === 'no_auth') return 'none'
  if (text === 'query' || text === 'url') return 'query'
  if (text === 'x-goog-api-key' || text === 'x_goog_api_key') return 'x-goog-api-key'
  if (text === 'x-api-key' || text === 'x_api_key') return 'x-api-key'
  if (text === 'bearer' || text === 'authorization' || text === 'auth') return 'bearer'
  return mode === MODE_GEMINI ? 'query' : 'bearer'
}

function sanitizeBase64(value) {
  return String(value || '').replace(/\s+/g, '')
}

function toDataUrl(base64, mimeType = 'image/png') {
  const clean = sanitizeBase64(base64)
  return clean ? `data:${mimeType};base64,${clean}` : ''
}

function isGemini3FamilyModel(model) {
  return /gemini-3/i.test(String(model || ''))
}

function supportsGeminiImageSize(model) {
  return isGemini3FamilyModel(model)
}

function getSupportedAspectRatios(model) {
  return isGemini3FamilyModel(model)
    ? [...GEMINI_BASE_ASPECT_RATIOS, ...GEMINI3_EXTRA_ASPECT_RATIOS]
    : [...GEMINI_BASE_ASPECT_RATIOS]
}

function normalizeAspectRatioValue(value, model) {
  const text = normalizeText(value)
  if (!text) return ''
  const m = text.match(/^(\d+)\s*[:/x]\s*(\d+)$/i)
  if (!m) return ''
  const normalized = `${Number(m[1])}:${Number(m[2])}`
  return getSupportedAspectRatios(model).includes(normalized) ? normalized : ''
}

function resolveAspectRatio(config, options, model) {
  const explicit = normalizeAspectRatioValue(
    options?.aspectRatio ?? options?.aspect_ratio ?? config?.aspectRatio ?? config?.aspect_ratio,
    model
  )
  if (explicit) return explicit

  const width = Number(options?.width)
  const height = Number(options?.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }

  const ratio = width / height
  const candidates = getSupportedAspectRatios(model)
  let best = ''
  let bestDiff = Number.POSITIVE_INFINITY
  candidates.forEach((candidate) => {
    const [w, h] = candidate.split(':').map(Number)
    if (!w || !h) return
    const diff = Math.abs((w / h) - ratio)
    if (diff < bestDiff) {
      best = candidate
      bestDiff = diff
    }
  })
  return best
}

function normalizeImageSizeValue(value) {
  const text = normalizeText(value).toUpperCase()
  if (!text) return ''
  if (text === '512PX' || text === '512') return '512px'
  if (text === '1K' || text === '1024' || text === '1024PX') return '1K'
  if (text === '2K' || text === '2048' || text === '2048PX') return '2K'
  if (text === '4K' || text === '4096' || text === '4096PX') return '4K'
  return GEMINI_IMAGE_SIZES.includes(value) ? value : ''
}

function resolveImageSize(config, options, model) {
  if (!supportsGeminiImageSize(model)) return ''

  const explicit = normalizeImageSizeValue(
    options?.imageSize ?? options?.image_size ?? config?.imageSize ?? config?.image_size
  )
  if (explicit) return explicit

  const width = Number(options?.width)
  const height = Number(options?.height)
  const maxSide = Math.max(width, height)
  if (!Number.isFinite(maxSide) || maxSide <= 0) return ''
  if (maxSide <= 700) return '512px'
  if (maxSide <= 1700) return '1K'
  if (maxSide <= 3200) return '2K'
  return '4K'
}

function normalizeResponseModalities(value) {
  const rawList = Array.isArray(value)
    ? value
    : (value ? String(value).split(/[,\s|]+/) : [])
  const normalized = rawList
    .map(item => String(item || '').trim().toUpperCase())
    .filter(item => item === 'IMAGE' || item === 'TEXT')
  if (normalized.length === 0) return ['IMAGE', 'TEXT']
  const uniq = Array.from(new Set(normalized))
  if (!uniq.includes('IMAGE')) uniq.unshift('IMAGE')
  return uniq
}

function buildPromptText(prompt, options = {}) {
  const base = normalizeText(prompt)
  const negatives = normalizeText(options.negativePromptAppend || options.negativePrompt || options.negative_prompt)
  if (!negatives) return base
  return `${base}\n\nNegative prompt: ${negatives}`
}

function normalizeNumericTemperature(value, fallback = 1.0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(2, n))
}

function normalizeBaseImageMimeType(value) {
  const text = normalizeText(value).toLowerCase()
  if (text === 'image/jpeg' || text === 'image/jpg') return 'image/jpeg'
  if (text === 'image/webp') return 'image/webp'
  if (text === 'image/gif') return 'image/gif'
  return 'image/png'
}

function normalizeBaseImageValue(value) {
  const text = normalizeText(value)
  if (!text) return ''
  if (!text.startsWith('data:')) return sanitizeBase64(text)
  const idx = text.indexOf(',')
  if (idx === -1) return ''
  return sanitizeBase64(text.slice(idx + 1))
}

function resolveGeminiRequestUrl(modelId, config = {}) {
  const endpoint = normalizeText(config.endpoint || config.baseUrl || config.url)
  if (!endpoint) {
    return `${DEFAULT_GEMINI_BASE_URL}/models/${encodeURIComponent(modelId)}:generateContent`
  }
  const trimmed = endpoint.replace(/\/+$/, '')
  if (/\/models\/[^/]+:generatecontent(?:\?|$)/i.test(trimmed)) return trimmed
  if (/\/models\/[^/]+$/i.test(trimmed)) return `${trimmed}:generateContent`
  return `${trimmed}/models/${encodeURIComponent(modelId)}:generateContent`
}

function resolveOpenAIRequestUrl(config = {}, path) {
  const endpoint = normalizeText(config.endpoint || config.baseUrl || config.url)
  const fallback = `${DEFAULT_OPENAI_COMPAT_BASE_URL}/${path}`
  if (!endpoint) return fallback

  const trimmed = endpoint.replace(/\/+$/, '')
  if (/\/chat\/completions(?:\?|$)/i.test(trimmed)) {
    return path === 'chat/completions'
      ? trimmed
      : trimmed.replace(/\/chat\/completions(?:\?.*)?$/i, '/' + path)
  }
  if (/\/images\/(?:generations|edits)(?:\?|$)/i.test(trimmed)) {
    return trimmed.replace(/\/images\/(?:generations|edits)(?:\?.*)?$/i, '/' + path)
  }
  return `${trimmed}/${path}`
}

function buildRequestHeaders(config, mode, apiKey, includeContentType = true) {
  const headers = includeContentType ? { 'Content-Type': 'application/json' } : {}
  const keyMode = normalizeApiKeyMode(config?.apiKeyMode, mode)
  if (keyMode === 'none') return { headers, keyMode }
  if (keyMode === 'x-goog-api-key') headers['x-goog-api-key'] = apiKey
  else if (keyMode === 'x-api-key') headers['x-api-key'] = apiKey
  else if (keyMode === 'bearer') headers.Authorization = 'Bearer ' + apiKey
  return { headers, keyMode }
}

function appendApiKeyToUrl(url, apiKey, keyMode) {
  if (keyMode !== 'query') return url
  try {
    const resolved = new URL(url, 'https://dummy.local')
    if (!resolved.searchParams.has('key')) resolved.searchParams.set('key', apiKey)
    if (resolved.origin === 'https://dummy.local') {
      return resolved.pathname + resolved.search + resolved.hash
    }
    return resolved.toString()
  } catch {
    const hasQuery = url.includes('?')
    const hasKey = /(?:^|[?&])key=/.test(url)
    if (hasKey) return url
    return url + (hasQuery ? '&' : '?') + 'key=' + encodeURIComponent(apiKey)
  }
}

function parseJsonObject(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  const text = normalizeText(value)
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    return null
  }
  return null
}

function buildGeminiImageConfig(config, options, modelId) {
  const aspectRatio = resolveAspectRatio(config, options, modelId)
  const imageSize = resolveImageSize(config, options, modelId)
  const imageConfig = {}
  if (aspectRatio) imageConfig.aspectRatio = aspectRatio
  if (imageSize) imageConfig.imageSize = imageSize
  return Object.keys(imageConfig).length > 0 ? imageConfig : null
}

function extractDataUrlFromText(text) {
  const source = String(text || '')
  const dataUrlMatch = source.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=\s]+/i)
  if (dataUrlMatch?.[0]) {
    const hit = dataUrlMatch[0]
    const commaIdx = hit.indexOf(',')
    if (commaIdx > 0) {
      const prefix = hit.slice(0, commaIdx + 1)
      const base64 = sanitizeBase64(hit.slice(commaIdx + 1))
      return prefix + base64
    }
    return hit
  }

  const markdownMatch = source.match(/!\[[^\]]*]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/i)
  if (markdownMatch?.[1]) return markdownMatch[1]

  const plainUrlMatch = source.match(/https?:\/\/[^\s)]+/i)
  if (plainUrlMatch?.[0]) return plainUrlMatch[0]

  const trimmed = source.trim()
  if (/^[a-zA-Z0-9+/=\r\n\s]+$/.test(trimmed) && trimmed.length > 128) {
    return toDataUrl(trimmed, 'image/png')
  }
  return ''
}

function extractImageUrlFromUnknown(value) {
  if (typeof value === 'string') {
    return extractDataUrlFromText(value)
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = extractImageUrlFromUnknown(item)
      if (hit) return hit
    }
    return ''
  }
  if (!value || typeof value !== 'object') return ''

  const directKeys = [
    'b64_json',
    'base64',
    'image_base64',
    'imageBase64',
    'url',
    'image_url',
    'imageUrl',
    'image',
    'data'
  ]

  for (const key of directKeys) {
    if (!(key in value)) continue
    const raw = value[key]
    if ((key === 'b64_json' || key === 'base64' || key === 'image_base64' || key === 'imageBase64') && typeof raw === 'string') {
      return toDataUrl(raw, 'image/png')
    }
    const hit = extractImageUrlFromUnknown(raw)
    if (hit) return hit
  }

  if (value.inlineData || value.inline_data) {
    const inline = value.inlineData || value.inline_data
    const data = sanitizeBase64(inline?.data || inline?.bytes)
    if (data) {
      const mimeType = normalizeText(inline?.mimeType || inline?.mime_type) || 'image/png'
      return toDataUrl(data, mimeType)
    }
  }

  if (typeof value.text === 'string') {
    const hit = extractDataUrlFromText(value.text)
    if (hit) return hit
  }

  for (const nested of Object.values(value)) {
    const hit = extractImageUrlFromUnknown(nested)
    if (hit) return hit
  }

  return ''
}

async function readErrorText(res) {
  const text = await res.text().catch(() => '')
  if (!text) return ''
  try {
    const parsed = JSON.parse(text)
    return String(
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.detail ||
      parsed?.error ||
      text
    )
  } catch {
    return text
  }
}

async function parseImageResponseOrThrow(res, label = 'NanoBanana') {
  if (!res.ok) {
    const detail = await readErrorText(res)
    throw new Error(`${label} 生成失败: HTTP ${res.status}${detail ? ' ' + detail : ''}`)
  }

  const data = await res.json()
  const image = extractImageUrlFromUnknown(data)
  if (!image) {
    throw new Error(`${label} 未返回图片`)
  }
  return image
}

async function requestGeminiNative(prompt, modelId, config, options, apiKey, signal) {
  const promptText = buildPromptText(prompt, options)
  const baseImage = normalizeBaseImageValue(options.baseImage)
  const baseImageMimeType = normalizeBaseImageMimeType(options.baseImageMimeType || options.baseImageMime)

  const parts = baseImage
    ? [
        {
          inline_data: {
            mime_type: baseImageMimeType,
            data: baseImage
          }
        },
        { text: promptText }
      ]
    : [{ text: promptText }]

  const generationConfig = {
    responseModalities: normalizeResponseModalities(config?.responseModalities),
    temperature: normalizeNumericTemperature(options?.temperature ?? config?.temperature, 1.0)
  }
  const imageConfig = buildGeminiImageConfig(config, options, modelId)
  if (imageConfig) generationConfig.imageConfig = imageConfig

  const { headers, keyMode } = buildRequestHeaders(config, MODE_GEMINI, apiKey, true)
  const rawUrl = resolveGeminiRequestUrl(modelId, config)
  const url = appendApiKeyToUrl(rawUrl, apiKey, keyMode)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig
    }),
    signal
  })

  return await parseImageResponseOrThrow(res, 'NanoBanana (Gemini)')
}

function buildOpenAICommonPayload(prompt, modelId, config, options) {
  const body = {
    model: modelId,
    prompt: buildPromptText(prompt, options),
    n: 1,
    response_format: 'b64_json'
  }

  const explicitSize = normalizeText(options.openaiSize || config?.openaiSize || config?.size)
  if (explicitSize) body.size = explicitSize

  const temperature = Number(options?.temperature ?? config?.temperature)
  if (Number.isFinite(temperature)) {
    body.temperature = Math.max(0, Math.min(2, temperature))
  }

  return body
}

function base64ToBlob(base64, mimeType = 'image/png') {
  const text = sanitizeBase64(base64)
  if (!text) throw new Error('img2img 输入图片为空')
  if (typeof atob !== 'function') {
    throw new Error('当前环境不支持 atob，无法发送 img2img 请求')
  }

  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: normalizeBaseImageMimeType(mimeType) })
}

async function requestOpenAIImages(prompt, modelId, config, options, apiKey, signal) {
  const { headers, keyMode } = buildRequestHeaders(config, MODE_OPENAI_IMAGES, apiKey, true)
  const generationUrl = appendApiKeyToUrl(resolveOpenAIRequestUrl(config, 'images/generations'), apiKey, keyMode)

  const payload = buildOpenAICommonPayload(prompt, modelId, config, options)
  const baseImage = normalizeBaseImageValue(options.baseImage)

  if (baseImage) {
    const editUrl = appendApiKeyToUrl(resolveOpenAIRequestUrl(config, 'images/edits'), apiKey, keyMode)
    const editHeaders = { ...headers }
    delete editHeaders['Content-Type']
    const formData = new FormData()
    formData.append('model', modelId)
    formData.append('prompt', payload.prompt)
    formData.append('response_format', payload.response_format)
    formData.append('n', String(payload.n))
    if (payload.size) formData.append('size', String(payload.size))
    formData.append(
      'image',
      base64ToBlob(baseImage, options.baseImageMimeType || options.baseImageMime),
      'input.png'
    )

    const editRes = await fetch(editUrl, {
      method: 'POST',
      headers: editHeaders,
      body: formData,
      signal
    })

    if (editRes.ok) {
      return await parseImageResponseOrThrow(editRes, 'NanoBanana (OpenAI Images)')
    }

    const detail = await readErrorText(editRes)
    const retryable = [400, 404, 405, 415, 422, 501].includes(editRes.status)
    if (!retryable) {
      throw new Error(`NanoBanana (OpenAI Images) 编辑失败: HTTP ${editRes.status}${detail ? ' ' + detail : ''}`)
    }
  }

  const generationRes = await fetch(generationUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  })

  return await parseImageResponseOrThrow(generationRes, 'NanoBanana (OpenAI Images)')
}

function buildOpenAIChatMessage(prompt, options) {
  const promptText = buildPromptText(prompt, options)
  const baseImage = normalizeBaseImageValue(options.baseImage)
  if (!baseImage) return promptText

  const mimeType = normalizeBaseImageMimeType(options.baseImageMimeType || options.baseImageMime)
  return [
    { type: 'text', text: promptText },
    { type: 'image_url', image_url: { url: toDataUrl(baseImage, mimeType) } }
  ]
}

function mergeOpenAIExtraBody(config = {}, options = {}, modelId = '') {
  const extraBody = parseJsonObject(config?.extraBody || config?.extra_body) || {}
  const google = (extraBody.google && typeof extraBody.google === 'object')
    ? { ...extraBody.google }
    : {}

  google.response_modalities = ['IMAGE']

  const aspectRatio = resolveAspectRatio(config, options, modelId)
  const imageSize = resolveImageSize(config, options, modelId)
  if (aspectRatio || imageSize) {
    const imageConfig = (google.image_config && typeof google.image_config === 'object')
      ? { ...google.image_config }
      : {}
    if (aspectRatio) imageConfig.aspect_ratio = aspectRatio
    if (imageSize) imageConfig.image_size = imageSize
    google.image_config = imageConfig
  }

  return {
    ...extraBody,
    google
  }
}

async function requestOpenAIChat(prompt, modelId, config, options, apiKey, signal) {
  const { headers, keyMode } = buildRequestHeaders(config, MODE_OPENAI_CHAT, apiKey, true)
  const url = appendApiKeyToUrl(resolveOpenAIRequestUrl(config, 'chat/completions'), apiKey, keyMode)

  const body = {
    model: modelId,
    messages: [
      {
        role: 'user',
        content: buildOpenAIChatMessage(prompt, options)
      }
    ],
    extra_body: mergeOpenAIExtraBody(config, options, modelId)
  }

  const maxTokens = Number(config?.maxTokens ?? config?.max_tokens)
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    body.max_tokens = Math.round(maxTokens)
  }
  const temperature = Number(options?.temperature ?? config?.temperature)
  if (Number.isFinite(temperature)) {
    body.temperature = Math.max(0, Math.min(2, temperature))
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })

  return await parseImageResponseOrThrow(res, 'NanoBanana (OpenAI Chat)')
}
