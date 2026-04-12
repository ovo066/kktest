import {
  NOVELAI_DEFAULTS,
  NOVELAI_DIRECTOR_REFERENCE_CANVAS_SIZES,
  base64ToUint8Array,
  clampInteger,
  clampNumber,
  detectImageMimeType,
  normalizeBase64Image,
  normalizeBase64ImageArray,
  pickDefined
} from './shared'

function pickNovelAIDirectorReferenceCanvasSize(width, height) {
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(1, Number(height) || 1)
  const aspect = safeWidth / safeHeight

  let best = NOVELAI_DIRECTOR_REFERENCE_CANVAS_SIZES[0]
  let bestDiff = Number.POSITIVE_INFINITY
  for (const size of NOVELAI_DIRECTOR_REFERENCE_CANVAS_SIZES) {
    const diff = Math.abs((size.width / size.height) - aspect)
    if (diff < bestDiff) {
      bestDiff = diff
      best = size
    }
  }
  return best
}

async function loadImageFromBase64(base64) {
  const bytes = base64ToUint8Array(base64)
  const mimeType = detectImageMimeType(bytes)
  const dataUrl = `data:${mimeType};base64,${base64}`
  return await new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API 不可用'))
      return
    }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('参考图解码失败'))
    img.src = dataUrl
  })
}

async function normalizeNovelAIDirectorReferenceImage(base64) {
  const normalized = normalizeBase64Image(base64)
  if (!normalized) return ''

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return normalized
  }

  try {
    const img = await loadImageFromBase64(normalized)
    const sourceWidth = Math.max(1, Number(img.naturalWidth || img.width || 1))
    const sourceHeight = Math.max(1, Number(img.naturalHeight || img.height || 1))
    const target = pickNovelAIDirectorReferenceCanvasSize(sourceWidth, sourceHeight)

    if (sourceWidth === target.width && sourceHeight === target.height) {
      return normalized
    }

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return normalized

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, target.width, target.height)

    const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight)
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale))
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale))
    const offsetX = Math.floor((target.width - drawWidth) / 2)
    const offsetY = Math.floor((target.height - drawHeight) / 2)
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

    return normalizeBase64Image(canvas.toDataURL('image/png'))
  } catch {
    return normalized
  }
}

export async function normalizeNovelAIDirectorReferenceImages(images) {
  if (!Array.isArray(images) || images.length === 0) return []
  const normalized = []
  for (const image of images) {
    const value = await normalizeNovelAIDirectorReferenceImage(image)
    if (value) normalized.push(value)
  }
  return normalized
}

function normalizeReferenceNumberArray(values, length, min, max, fallback) {
  const result = []
  const source = Array.isArray(values)
    ? values
    : (values !== undefined && values !== null ? [values] : [])

  for (let i = 0; i < length; i += 1) {
    const raw = source.length === 0
      ? fallback
      : source[Math.min(i, source.length - 1)]
    result.push(clampNumber(raw, min, max, fallback))
  }

  return result
}

function normalizeNovelAINoiseSchedule(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return NOVELAI_DEFAULTS.noise_schedule
  return text
}

function resolveNovelAINoiseScheduleForModel(model, value) {
  const normalized = normalizeNovelAINoiseSchedule(value)
  if (!isNovelAIV4FamilyModel(model)) return normalized
  if (!normalized || normalized === 'native') return 'karras'
  return normalized
}

function normalizeNovelAIUcPreset(value) {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return NOVELAI_DEFAULTS.ucPreset

  const rounded = Math.round(raw)
  if (rounded >= 4 && rounded <= 7) {
    return rounded - 4
  }

  return clampInteger(rounded, 0, 3, NOVELAI_DEFAULTS.ucPreset)
}

export function isNovelAIV4FamilyModel(model) {
  return /nai-diffusion-4/.test(String(model || '').toLowerCase())
}

function isNovelAIV45FamilyModel(model) {
  return /nai-diffusion-4-5/.test(String(model || '').toLowerCase())
}

function normalizeNovelAIDirectorReferenceMode(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return 'character_style'
  if (text === 'character') return 'character_only'
  if (text === 'character_only') return 'character_only'
  if (text === 'character_style') return 'character_style'
  if (text === 'character_and_style') return 'character_style'
  if (text === 'character&style') return 'character_style'
  return 'character_style'
}

function buildNovelAIDirectorReferenceDescription(mode = 'character_style') {
  const normalizedMode = normalizeNovelAIDirectorReferenceMode(mode)
  return {
    use_coords: false,
    use_order: false,
    legacy_uc: false,
    caption: {
      base_caption: normalizedMode === 'character_only' ? 'character' : 'character&style',
      char_captions: []
    }
  }
}

function normalizeNovelAIDirectorReferenceDescription(value, mode = 'character_style') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  const text = String(value || '').trim().toLowerCase()
  if (text === 'character' || text === 'character_only') {
    return buildNovelAIDirectorReferenceDescription('character_only')
  }
  if (
    text === 'character&style' ||
    text === 'character_style' ||
    text === 'character_and_style'
  ) {
    return buildNovelAIDirectorReferenceDescription('character_style')
  }
  return buildNovelAIDirectorReferenceDescription(mode)
}

function buildDefaultNovelAIV4Parameters(input, negativePrompt = '') {
  const baseCaption = typeof input === 'string'
    ? input.trim()
    : String(input?.caption || input?.base_caption || '').trim()

  return {
    v4_prompt: {
      caption: {
        base_caption: baseCaption,
        char_captions: []
      },
      use_coords: false,
      use_order: true
    },
    v4_negative_prompt: {
      caption: {
        base_caption: String(negativePrompt || ''),
        char_captions: []
      },
      legacy_uc: false
    },
    characterPrompts: [],
    legacy_uc: false
  }
}

export function buildNovelAIReferenceParams(resolved) {
  const hasDirectorReference = Array.isArray(resolved?.director_reference_images) && resolved.director_reference_images.length > 0
  const hasMultiReference = !hasDirectorReference &&
    Array.isArray(resolved?.reference_image_multiple) &&
    resolved.reference_image_multiple.length > 0
  const hasSingleReference = !hasDirectorReference &&
    !hasMultiReference &&
    !!String(resolved?.reference_image || '').trim()

  const referenceParams = hasDirectorReference
    ? {
        director_reference_images: resolved.director_reference_images,
        director_reference_descriptions: resolved.director_reference_descriptions,
        director_reference_information_extracted: resolved.director_reference_information_extracted,
        director_reference_strength_values: resolved.director_reference_strength_values,
        director_reference_secondary_strength_values: resolved.director_reference_secondary_strength_values
      }
    : hasMultiReference
      ? {
          reference_image_multiple: resolved.reference_image_multiple,
          reference_information_extracted_multiple: resolved.reference_information_extracted_multiple,
          reference_strength_multiple: resolved.reference_strength_multiple,
          normalize_reference_strength_multiple: resolved.normalize_reference_strength_multiple
        }
      : hasSingleReference
        ? {
            reference_image: resolved.reference_image,
            reference_information_extracted: resolved.reference_information_extracted,
            reference_strength: resolved.reference_strength
          }
        : {}

  return {
    hasDirectorReference,
    hasMultiReference,
    hasSingleReference,
    referenceParams
  }
}

export function buildNovelAIPrimaryParameters(resolved, { isImg2Img, baseImage, referenceParams, input }) {
  const isV4Family = isNovelAIV4FamilyModel(resolved.model)
  const params = {
    width: resolved.width,
    height: resolved.height,
    scale: resolved.scale,
    sampler: resolved.sampler,
    steps: resolved.steps,
    n_samples: resolved.n_samples,
    ucPreset: resolved.ucPreset,
    qualityToggle: resolved.qualityToggle,
    uncond_scale: resolved.uncond_scale,
    cfg_rescale: resolved.cfg_rescale,
    seed: resolved.seed,
    negative_prompt: resolved.negative_prompt,
    ...referenceParams
  }

  if (!isV4Family) {
    params.uc = resolved.negative_prompt
    params.sm = resolved.sm
    params.sm_dyn = resolved.sm_dyn
  }

  if (resolved.params_version !== null && resolved.params_version !== undefined) {
    params.params_version = resolved.params_version
  } else if (isV4Family) {
    params.params_version = 3
  }

  if (resolved.dynamic_thresholding) params.dynamic_thresholding = true

  if (isV4Family) {
    Object.assign(params, buildDefaultNovelAIV4Parameters(input, resolved.negative_prompt))
  }

  if (isImg2Img) {
    params.image = normalizeBase64Image(baseImage)
    params.strength = resolved.strength
    params.noise = resolved.noise
    if (resolved.add_original_image) {
      params.add_original_image = true
    }
  }

  return params
}

export function summarizeNovelAIResolvedParams(resolved) {
  const model = String(resolved?.model || '').trim() || 'unknown'
  const sampler = String(resolved?.sampler || '').trim() || 'unknown'
  const steps = Number.isFinite(Number(resolved?.steps)) ? Number(resolved.steps) : 'unknown'
  const scale = Number.isFinite(Number(resolved?.scale)) ? Number(resolved.scale) : 'unknown'
  const width = Number.isFinite(Number(resolved?.width)) ? Number(resolved.width) : 'unknown'
  const height = Number.isFinite(Number(resolved?.height)) ? Number(resolved.height) : 'unknown'
  const qualityToggle = resolved?.qualityToggle === true ? 'on' : 'off'
  const directorRefs = Array.isArray(resolved?.director_reference_images) ? resolved.director_reference_images.length : 0
  const directorMode = normalizeNovelAIDirectorReferenceMode(resolved?.director_reference_mode)
  const multiRefs = Array.isArray(resolved?.reference_image_multiple) ? resolved.reference_image_multiple.length : 0
  const hasSingleRef = !directorRefs && !multiRefs && !!String(resolved?.reference_image || '').trim()
  const refs = directorRefs > 0
    ? `director:${directorRefs}/${directorMode === 'character_only' ? 'char' : 'char+style'}`
    : (multiRefs > 0 ? `vibe:${multiRefs}` : (hasSingleRef ? 'ref:1' : 'none'))
  return `model=${model}, sampler=${sampler}, steps=${steps}, scale=${scale}, size=${width}x${height}, quality=${qualityToggle}, refs=${refs}`
}

export function resolveNovelAIParams(config, options) {
  const model = String(pickDefined(options.model, config.model, NOVELAI_DEFAULTS.model) || NOVELAI_DEFAULTS.model).trim()
  const paramsVersionRaw = pickDefined(options.paramsVersion, options.params_version, config.paramsVersion, config.params_version, NOVELAI_DEFAULTS.params_version)
  const hasParamsVersion = paramsVersionRaw !== undefined && paramsVersionRaw !== null && String(paramsVersionRaw).trim() !== ''
  const seedRaw = pickDefined(options.seed)
  const seed = seedRaw !== undefined
    ? clampInteger(seedRaw, 0, 4294967295, Math.floor(Math.random() * 4294967295))
    : Math.floor(Math.random() * 4294967295)
  const isV4Family = isNovelAIV4FamilyModel(model)

  const directorReferenceImages = normalizeBase64ImageArray(
    pickDefined(options.directorReferenceImages, options.director_reference_images, [])
  )
  const directorReferenceMode = normalizeNovelAIDirectorReferenceMode(
    pickDefined(
      options.directorReferenceMode,
      options.director_reference_mode,
      options.directorReferenceStyleAware === undefined
        ? undefined
        : (options.directorReferenceStyleAware ? 'character_style' : 'character_only'),
      options.director_reference_style_aware === undefined
        ? undefined
        : (options.director_reference_style_aware ? 'character_style' : 'character_only'),
      'character_style'
    )
  )
  const directorReferenceDescriptionsRaw = pickDefined(
    options.directorReferenceDescriptions,
    options.director_reference_descriptions,
    []
  )
  const directorReferenceDescriptions = []
  for (let i = 0; i < directorReferenceImages.length; i += 1) {
    const source = Array.isArray(directorReferenceDescriptionsRaw)
      ? directorReferenceDescriptionsRaw[Math.min(i, directorReferenceDescriptionsRaw.length - 1)]
      : directorReferenceDescriptionsRaw
    directorReferenceDescriptions.push(
      normalizeNovelAIDirectorReferenceDescription(source, directorReferenceMode)
    )
  }
  const directorReferenceStrengthValuesRaw = normalizeReferenceNumberArray(
    pickDefined(options.directorReferenceStrengthValues, options.director_reference_strength_values, []),
    directorReferenceImages.length,
    0, 1, NOVELAI_DEFAULTS.reference_strength
  )
  const directorReferenceSecondaryStrengthValuesRaw = normalizeReferenceNumberArray(
    pickDefined(options.directorReferenceSecondaryStrengthValues, options.director_reference_secondary_strength_values, []),
    directorReferenceImages.length,
    0, 1, 0.5
  )
  const directorReferenceInformationExtractedRaw = normalizeReferenceNumberArray(
    pickDefined(options.directorReferenceInformationExtracted, options.director_reference_information_extracted, []),
    directorReferenceImages.length,
    0, 1, 1
  )
  const hasDirectorReference = directorReferenceImages.length > 0
  const directorReferenceStrengthValues = normalizeReferenceNumberArray(
    directorReferenceStrengthValuesRaw,
    directorReferenceImages.length,
    0, 1, NOVELAI_DEFAULTS.reference_strength
  )
  const directorReferenceSecondaryStrengthValues = normalizeReferenceNumberArray(
    directorReferenceSecondaryStrengthValuesRaw,
    directorReferenceImages.length,
    0, 1, 0.5
  )
  const directorReferenceInformationExtracted = normalizeReferenceNumberArray(
    directorReferenceInformationExtractedRaw,
    directorReferenceImages.length,
    0, 1, 1
  )
  const directorReferenceEnabled = hasDirectorReference && isNovelAIV45FamilyModel(model)

  if (hasDirectorReference && !directorReferenceEnabled) {
    throw new Error(`NovelAI 角色参考仅支持 V4.5 模型，当前模型：${model}`)
  }

  const referenceImageMultiple = normalizeBase64ImageArray(
    pickDefined(options.referenceImageMultiple, options.reference_image_multiple, NOVELAI_DEFAULTS.reference_image_multiple)
  )
  const referenceInfoRaw = pickDefined(
    options.referenceInformationExtractedMultiple,
    options.reference_information_extracted_multiple,
    NOVELAI_DEFAULTS.reference_information_extracted_multiple
  )
  const referenceStrengthRaw = pickDefined(
    options.referenceStrengthMultiple,
    options.reference_strength_multiple,
    NOVELAI_DEFAULTS.reference_strength_multiple
  )

  const referenceInformationExtractedMultiple = normalizeReferenceNumberArray(
    referenceInfoRaw,
    referenceImageMultiple.length,
    0, 1, NOVELAI_DEFAULTS.reference_information_extracted
  )
  const referenceStrengthMultiple = normalizeReferenceNumberArray(
    referenceStrengthRaw,
    referenceImageMultiple.length,
    0, 1, NOVELAI_DEFAULTS.reference_strength
  )
  let referenceImageSingle = normalizeBase64Image(
    pickDefined(options.referenceImage, options.reference_image, '')
  )
  let referenceInformationExtractedSingle = clampNumber(
    pickDefined(
      options.referenceInformationExtracted,
      options.reference_information_extracted,
      NOVELAI_DEFAULTS.reference_information_extracted
    ),
    0, 1, NOVELAI_DEFAULTS.reference_information_extracted
  )
  let referenceStrengthSingle = clampNumber(
    pickDefined(
      options.referenceStrength,
      options.reference_strength,
      NOVELAI_DEFAULTS.reference_strength
    ),
    0, 1, NOVELAI_DEFAULTS.reference_strength
  )
  let normalizedReferenceImageMultiple = referenceImageMultiple
  let normalizedReferenceInformationExtractedMultiple = referenceInformationExtractedMultiple
  let normalizedReferenceStrengthMultiple = referenceStrengthMultiple

  if (isV4Family && !hasDirectorReference && referenceImageSingle && referenceImageMultiple.length === 0) {
    normalizedReferenceImageMultiple = [referenceImageSingle]
    normalizedReferenceInformationExtractedMultiple = [referenceInformationExtractedSingle]
    normalizedReferenceStrengthMultiple = [referenceStrengthSingle]
    referenceImageSingle = ''
  }

  if (!isV4Family && !hasDirectorReference && referenceImageMultiple.length === 1) {
    if (!referenceImageSingle) {
      referenceImageSingle = referenceImageMultiple[0]
    }
    if (!Number.isFinite(Number(referenceInformationExtractedSingle))) {
      referenceInformationExtractedSingle = referenceInformationExtractedMultiple[0] ?? NOVELAI_DEFAULTS.reference_information_extracted
    }
    if (!Number.isFinite(Number(referenceStrengthSingle))) {
      referenceStrengthSingle = referenceStrengthMultiple[0] ?? NOVELAI_DEFAULTS.reference_strength
    }
    normalizedReferenceImageMultiple = []
    normalizedReferenceInformationExtractedMultiple = []
    normalizedReferenceStrengthMultiple = []
  }

  if (directorReferenceEnabled) {
    referenceImageSingle = ''
    normalizedReferenceImageMultiple = []
    normalizedReferenceInformationExtractedMultiple = []
    normalizedReferenceStrengthMultiple = []
  }

  const normalizeReferenceStrengthMultiple = pickDefined(
    options.normalizeReferenceStrengthMultiple,
    options.normalize_reference_strength_multiple,
    (!directorReferenceEnabled && isV4Family && normalizedReferenceImageMultiple.length > 0)
  )
  const baseNegativePrompt = String(
    pickDefined(
      options.negativePrompt,
      options.negative_prompt,
      config.negativePrompt,
      config.negative_prompt,
      ''
    ) || ''
  ).trim()
  const appendNegativePrompt = String(
    pickDefined(options.negativePromptAppend, options.negative_prompt_append, '') || ''
  ).trim()
  const normalizedBaseNegativePrompt = baseNegativePrompt || NOVELAI_DEFAULTS.negative_prompt
  const finalNegativePrompt = appendNegativePrompt
    ? `${normalizedBaseNegativePrompt}, ${appendNegativePrompt}`
    : normalizedBaseNegativePrompt

  return {
    model,
    params_version: hasParamsVersion ? clampInteger(paramsVersionRaw, 1, 3, 3) : null,
    width: clampInteger(pickDefined(options.width, config.width, NOVELAI_DEFAULTS.width), 64, 4096, NOVELAI_DEFAULTS.width),
    height: clampInteger(pickDefined(options.height, config.height, NOVELAI_DEFAULTS.height), 64, 4096, NOVELAI_DEFAULTS.height),
    scale: clampNumber(pickDefined(options.scale, config.scale, NOVELAI_DEFAULTS.scale), 0, 50, NOVELAI_DEFAULTS.scale),
    sampler: String(pickDefined(options.sampler, config.sampler, NOVELAI_DEFAULTS.sampler) || NOVELAI_DEFAULTS.sampler),
    steps: clampInteger(pickDefined(options.steps, config.steps, NOVELAI_DEFAULTS.steps), 1, 60, NOVELAI_DEFAULTS.steps),
    n_samples: clampInteger(pickDefined(options.nSamples, options.n_samples, config.nSamples, config.n_samples, NOVELAI_DEFAULTS.n_samples), 1, 8, NOVELAI_DEFAULTS.n_samples),
    ucPreset: normalizeNovelAIUcPreset(pickDefined(options.ucPreset, config.ucPreset, NOVELAI_DEFAULTS.ucPreset)),
    qualityToggle: !!pickDefined(options.qualityToggle, config.qualityToggle, NOVELAI_DEFAULTS.qualityToggle),
    sm: !!pickDefined(options.sm, config.sm, NOVELAI_DEFAULTS.sm),
    sm_dyn: !!pickDefined(options.smDyn, options.sm_dyn, config.smDyn, config.sm_dyn, NOVELAI_DEFAULTS.sm_dyn),
    dynamic_thresholding: !!pickDefined(options.dynamicThresholding, options.dynamic_thresholding, config.dynamicThresholding, config.dynamic_thresholding, NOVELAI_DEFAULTS.dynamic_thresholding),
    controlnet_strength: clampNumber(pickDefined(options.controlnetStrength, options.controlnet_strength, config.controlnetStrength, config.controlnet_strength, NOVELAI_DEFAULTS.controlnet_strength), 0, 2, NOVELAI_DEFAULTS.controlnet_strength),
    legacy: !!pickDefined(options.legacy, config.legacy, NOVELAI_DEFAULTS.legacy),
    add_original_image: !!pickDefined(options.addOriginalImage, options.add_original_image, config.addOriginalImage, config.add_original_image, NOVELAI_DEFAULTS.add_original_image),
    uncond_scale: clampNumber(pickDefined(options.uncondScale, options.uncond_scale, config.uncondScale, config.uncond_scale, NOVELAI_DEFAULTS.uncond_scale), 0, 10, NOVELAI_DEFAULTS.uncond_scale),
    cfg_rescale: clampNumber(pickDefined(options.cfgRescale, options.cfg_rescale, config.cfgRescale, config.cfg_rescale, NOVELAI_DEFAULTS.cfg_rescale), 0, 1, NOVELAI_DEFAULTS.cfg_rescale),
    noise_schedule: resolveNovelAINoiseScheduleForModel(
      model,
      pickDefined(options.noiseSchedule, options.noise_schedule, config.noiseSchedule, config.noise_schedule, NOVELAI_DEFAULTS.noise_schedule)
    ),
    seed,
    negative_prompt: finalNegativePrompt,
    director_reference_mode: directorReferenceMode,
    director_reference_images: directorReferenceEnabled ? directorReferenceImages : [],
    director_reference_descriptions: directorReferenceEnabled ? directorReferenceDescriptions : [],
    director_reference_information_extracted: directorReferenceEnabled ? directorReferenceInformationExtracted : [],
    director_reference_strength_values: directorReferenceEnabled ? directorReferenceStrengthValues : [],
    director_reference_secondary_strength_values: directorReferenceEnabled ? directorReferenceSecondaryStrengthValues : [],
    reference_image: referenceImageSingle,
    reference_information_extracted: referenceInformationExtractedSingle,
    reference_strength: referenceStrengthSingle,
    reference_image_multiple: normalizedReferenceImageMultiple,
    reference_information_extracted_multiple: normalizedReferenceInformationExtractedMultiple,
    reference_strength_multiple: normalizedReferenceStrengthMultiple,
    normalize_reference_strength_multiple: normalizeReferenceStrengthMultiple,
    legacy_v3_extend: !!pickDefined(options.legacyV3Extend, options.legacy_v3_extend, config.legacyV3Extend, config.legacy_v3_extend, NOVELAI_DEFAULTS.legacy_v3_extend),
    deliberate_euler_ancestral_bug: !!pickDefined(options.deliberateEulerAncestralBug, options.deliberate_euler_ancestral_bug, config.deliberateEulerAncestralBug, config.deliberate_euler_ancestral_bug, NOVELAI_DEFAULTS.deliberate_euler_ancestral_bug),
    prefer_brownian: !!pickDefined(options.preferBrownian, options.prefer_brownian, config.preferBrownian, config.prefer_brownian, NOVELAI_DEFAULTS.prefer_brownian),
    strength: clampNumber(pickDefined(options.strength, config.strength, NOVELAI_DEFAULTS.strength), 0, 1, NOVELAI_DEFAULTS.strength),
    noise: clampNumber(pickDefined(options.noise, config.noise, NOVELAI_DEFAULTS.noise), 0, 1, NOVELAI_DEFAULTS.noise)
  }
}

export function buildNovelAIInput(prompt, options) {
  const caption = String(pickDefined(options.caption, prompt) || '').trim()
  if (!caption) throw new Error('NovelAI prompt 不能为空')

  const hasAdvancedPrompt = (
    options.useCoords !== undefined ||
    options.useOrder !== undefined ||
    options.legacyUc !== undefined ||
    options.characterPrompts !== undefined ||
    options.v4Prompt !== undefined ||
    options.v4NegativePrompt !== undefined
  )

  if (!hasAdvancedPrompt) return caption

  const result = {
    caption,
    use_coords: !!pickDefined(options.useCoords, false),
    use_order: !!pickDefined(options.useOrder, true),
    legacy_uc: !!pickDefined(options.legacyUc, false),
    char_captions: Array.isArray(options.characterPrompts) ? options.characterPrompts : []
  }

  if (options.v4Prompt && typeof options.v4Prompt === 'object') {
    result.v4_prompt = options.v4Prompt
  }
  if (options.v4NegativePrompt && typeof options.v4NegativePrompt === 'object') {
    result.v4_negative_prompt = options.v4NegativePrompt
  }

  return result
}