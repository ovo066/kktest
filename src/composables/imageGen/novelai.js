import { createFetchControl, isAbortError } from './fetchControl'
import {
  NOVELAI_ENDPOINT,
  NOVELAI_STREAM_ENDPOINT,
  buildNovelAIRequestHeaders,
  formatNovelAIError,
  readResponseTextSafe
} from './novelai/shared'
import {
  buildNovelAIInput,
  buildNovelAIPrimaryParameters,
  buildNovelAIReferenceParams,
  isNovelAIV4FamilyModel,
  normalizeNovelAIDirectorReferenceImages,
  resolveNovelAIParams,
  summarizeNovelAIResolvedParams
} from './novelai/params'
import {
  parseNovelAIResponse,
  parseNovelAIStreamResponse
} from './novelai/response'
import { encodeNovelAIVibeTokensInParameters } from './novelai/vibe'

export async function generateNovelAI(prompt, config = {}, options = {}) {
  const { apiKey } = config || {}
  if (!apiKey) throw new Error('NovelAI API Key 未设置')

  const input = buildNovelAIInput(prompt, options)
  const resolved = resolveNovelAIParams(config || {}, options)
  if (Array.isArray(resolved.director_reference_images) && resolved.director_reference_images.length > 0) {
    resolved.director_reference_images = await normalizeNovelAIDirectorReferenceImages(
      resolved.director_reference_images
    )
  }

  const isImg2Img = !!options.baseImage
  const isV4Family = isNovelAIV4FamilyModel(resolved.model)
  const { hasDirectorReference, referenceParams } = buildNovelAIReferenceParams(resolved)
  const action = isImg2Img ? 'img2img' : 'generate'
  const parameters = buildNovelAIPrimaryParameters(resolved, {
    input,
    isImg2Img,
    baseImage: options.baseImage,
    referenceParams
  })
  const requestSummary = summarizeNovelAIResolvedParams(resolved)

  if (isV4Family && !hasDirectorReference) {
    await encodeNovelAIVibeTokensInParameters(parameters, {
      apiKey,
      model: resolved.model,
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
  }

  const payload = { input, model: resolved.model, action, parameters }
  if (import.meta.env?.DEV) {
    const promptPreview = typeof input === 'string'
      ? input.slice(0, 220)
      : String(input?.caption || '').slice(0, 220)
    console.info('[NovelAI] generation request', {
      requestSummary,
      promptPreview
    })
  }

  const fetchControl = createFetchControl(options.signal, options.timeoutMs)
  let res
  try {
    const endpoint = isV4Family ? NOVELAI_STREAM_ENDPOINT : NOVELAI_ENDPOINT
    const accept = isV4Family ? '*/*' : 'application/zip,image/*,*/*'
    res = await fetch(endpoint, {
      method: 'POST',
      headers: buildNovelAIRequestHeaders(apiKey, accept),
      body: JSON.stringify(payload),
      signal: fetchControl.signal
    })
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (fetchControl.isTimedOut()) {
      throw new Error(`NovelAI 请求超时（${fetchControl.timeoutMs}ms）（${requestSummary}）`)
    }
    if (isAbortError(e)) {
      throw new Error(`NovelAI 请求已取消（${requestSummary}）`)
    }
    if (import.meta.env?.DEV) {
      console.error('[NovelAI] request failed', {
        error: msg,
        requestSummary
      })
    }
    throw new Error(`NovelAI 请求失败：${msg}（${requestSummary}）`)
  } finally {
    fetchControl.cleanup()
  }

  if (res.ok) {
    return isV4Family
      ? await parseNovelAIStreamResponse(res)
      : await parseNovelAIResponse(res)
  }

  const status = res.status
  const errorText = await readResponseTextSafe(res)
  if (import.meta.env?.DEV) {
    console.error('[NovelAI] generation failed', {
      status,
      detail: String(errorText || '').slice(0, 600),
      requestSummary
    })
  }
  throw new Error(formatNovelAIError(status, errorText, requestSummary))
}