import { createFetchControl, isAbortError } from '../fetchControl'
import {
  NOVELAI_ENCODE_VIBE_ENDPOINT,
  base64ToUint8Array,
  buildNovelAIRequestHeaders,
  clampNumber,
  formatNovelAIError,
  normalizeBase64Image,
  readResponseTextSafe,
  uint8ArrayToBase64
} from './shared'
import { isNovelAIV4FamilyModel } from './params'

const NOVELAI_VIBE_TOKEN_CACHE = new Map()

async function sha256HexFromBase64(base64) {
  const text = String(base64 || '').trim()
  if (!text) return ''

  try {
    if (globalThis.crypto?.subtle?.digest) {
      const bytes = base64ToUint8Array(text)
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes)
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    // fall through
  }

  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function extractNovelAIVibeTokenFromValue(value) {
  if (typeof value === 'string') {
    const text = value.trim()
    return text || ''
  }
  if (!value || typeof value !== 'object') return ''

  const directKeys = [
    'token',
    'vibe',
    'vibe_token',
    'reference_image',
    'encoded_image',
    'data'
  ]
  for (const key of directKeys) {
    const text = extractNovelAIVibeTokenFromValue(value[key])
    if (text) return text
  }

  if (Array.isArray(value.reference_image_multiple) && value.reference_image_multiple.length > 0) {
    const text = extractNovelAIVibeTokenFromValue(value.reference_image_multiple[0])
    if (text) return text
  }

  return ''
}

export function parseNovelAIVibeTokenFromBytes(bytes, contentType = '') {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''

  const decodedText = new TextDecoder().decode(bytes).trim()
  if (decodedText) {
    if (decodedText.startsWith('{') || decodedText.startsWith('[') || contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(decodedText)
        const fromJson = extractNovelAIVibeTokenFromValue(parsed)
        if (fromJson) return fromJson
      } catch {
        // Ignore JSON parse failure and continue.
      }
    }

    const hasReplacementChar = decodedText.includes('\uFFFD')
    const isMostlyPrintable = /^[\x20-\x7E]+$/.test(decodedText)
    if (!hasReplacementChar && isMostlyPrintable) {
      return decodedText
    }
  }

  return uint8ArrayToBase64(bytes)
}

async function fetchNovelAIVibeToken({ apiKey, image, informationExtracted, model, signal, timeoutMs }) {
  const fetchControl = createFetchControl(signal, timeoutMs)
  let res
  try {
    res = await fetch(NOVELAI_ENCODE_VIBE_ENDPOINT, {
      method: 'POST',
      headers: buildNovelAIRequestHeaders(apiKey),
      body: JSON.stringify({
        image,
        informationExtracted,
        information_extracted: informationExtracted,
        model
      }),
      signal: fetchControl.signal
    })
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (fetchControl.isTimedOut()) {
      throw new Error(`NovelAI encode-vibe 请求超时（${fetchControl.timeoutMs}ms）`)
    }
    if (isAbortError(e)) {
      throw new Error('NovelAI encode-vibe 请求已取消')
    }
    throw new Error('NovelAI encode-vibe 请求失败：' + msg)
  } finally {
    fetchControl.cleanup()
  }

  if (!res.ok) {
    const status = res.status
    const errorText = await readResponseTextSafe(res)
    throw new Error(formatNovelAIError(status, errorText, `encode-vibe model=${model}`))
  }

  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const token = parseNovelAIVibeTokenFromBytes(bytes, contentType)
  if (!token) {
    throw new Error(`NovelAI encode-vibe 返回为空（content-type=${contentType || 'unknown'}）`)
  }
  return token
}

export async function encodeNovelAIVibeTokensInParameters(parameters, { apiKey, model, signal, timeoutMs }) {
  if (!isNovelAIV4FamilyModel(model)) return
  if (!parameters || typeof parameters !== 'object') return

  const images = parameters.reference_image_multiple
  if (!Array.isArray(images) || images.length === 0) return

  const infoList = Array.isArray(parameters.reference_information_extracted_multiple)
    ? parameters.reference_information_extracted_multiple
    : []

  const tokens = []
  for (let i = 0; i < images.length; i += 1) {
    const image = normalizeBase64Image(images[i])
    if (!image) {
      throw new Error('Vibe 参考图为空，无法编码')
    }
    const info = clampNumber(infoList[i] ?? 1, 0, 1, 1)
    const imageHash = await sha256HexFromBase64(image)
    const cacheKey = `${imageHash}:${info}:${model}`

    let token = NOVELAI_VIBE_TOKEN_CACHE.get(cacheKey)
    if (!token) {
      token = await fetchNovelAIVibeToken({
        apiKey,
        image,
        informationExtracted: info,
        model,
        signal,
        timeoutMs
      })
      NOVELAI_VIBE_TOKEN_CACHE.set(cacheKey, token)
    }
    tokens.push(token)
  }

  parameters.reference_image_multiple = tokens
  delete parameters.reference_information_extracted_multiple
}