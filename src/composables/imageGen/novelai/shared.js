const NOVELAI_ENDPOINT = 'https://image.novelai.net/ai/generate-image'
const NOVELAI_STREAM_ENDPOINT = 'https://image.novelai.net/ai/generate-image-stream'
const NOVELAI_ENCODE_VIBE_ENDPOINT = 'https://image.novelai.net/ai/encode-vibe'
const NOVELAI_DIRECTOR_REFERENCE_CANVAS_SIZES = Object.freeze([
  Object.freeze({ width: 1024, height: 1536 }),
  Object.freeze({ width: 1472, height: 1472 }),
  Object.freeze({ width: 1536, height: 1024 })
])

const NOVELAI_DEFAULTS = Object.freeze({
  model: 'nai-diffusion-4-5-full',
  params_version: null,
  width: 1024,
  height: 1024,
  scale: 5,
  sampler: 'k_euler',
  steps: 28,
  n_samples: 1,
  ucPreset: 0,
  qualityToggle: true,
  sm: false,
  sm_dyn: false,
  dynamic_thresholding: false,
  controlnet_strength: 1,
  legacy: false,
  add_original_image: false,
  uncond_scale: 1,
  cfg_rescale: 0,
  noise_schedule: 'native',
  negative_prompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, noise, grainy, underexposed, low contrast, dull colors',
  reference_information_extracted: 1,
  reference_strength: 0.6,
  reference_image_multiple: [],
  reference_information_extracted_multiple: [],
  reference_strength_multiple: [],
  legacy_v3_extend: false,
  deliberate_euler_ancestral_bug: false,
  prefer_brownian: true,
  strength: 0.6,
  noise: 0.2
})

export {
  NOVELAI_DEFAULTS,
  NOVELAI_DIRECTOR_REFERENCE_CANVAS_SIZES,
  NOVELAI_ENCODE_VIBE_ENDPOINT,
  NOVELAI_ENDPOINT,
  NOVELAI_STREAM_ENDPOINT
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

export function clampInteger(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback))
}

export function pickDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

export function normalizeBase64Image(input) {
  const text = String(input || '').trim()
  if (!text) return ''
  const normalized = text.startsWith('data:') ? (text.split(',')[1] || '') : text
  return normalized.replace(/\s+/g, '')
}

export function normalizeBase64ImageArray(values) {
  if (!Array.isArray(values)) return []
  return values
    .map(v => normalizeBase64Image(v))
    .filter(Boolean)
}

export async function readResponseTextSafe(res) {
  return await res.text().catch(() => '')
}

export function formatNovelAIError(status, rawText, requestSummary = '') {
  const text = String(rawText || '').trim()
  let detail = text

  if (text) {
    try {
      const parsed = JSON.parse(text)
      detail = String(
        parsed?.message ||
        parsed?.error ||
        parsed?.reason ||
        parsed?.detail ||
        text
      )
    } catch {
      detail = text
    }
  }

  const summarySuffix = requestSummary ? `（${requestSummary}）` : ''
  if (!detail) return `NovelAI 生成失败: HTTP ${status}${summarySuffix}`
  return `NovelAI 生成失败: HTTP ${status} ${detail}${summarySuffix}`
}

export function generateXCorrelationId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 6; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateXInitiatedAt() {
  const now = new Date()
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0')
  return now.toISOString().replace(/\.\d{3}Z$/, `.${ms}Z`)
}

export function buildNovelAIRequestHeaders(apiKey, accept = '*/*') {
  return {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    'Accept': accept,
    'x-correlation-id': generateXCorrelationId(),
    'x-initiated-at': generateXInitiatedAt()
  }
}

export function base64ToUint8Array(base64) {
  const text = String(base64 || '').trim()
  if (!text) return new Uint8Array(0)
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function uint8ArrayToBase64(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export function detectImageMimeType(bytes) {
  if (!bytes || bytes.length < 2) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return 'image/png'
}

export async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片解码失败'))
    reader.readAsDataURL(blob)
  })
}