import { reactive, ref } from 'vue'
import { resolveBaseSeed, resolveExpressionSeed } from '../utils/generationPrefs'

export function useVNStudioGeneration({
  contactId,
  entry,
  vnStore,
  charResStore,
  generateImage,
  scheduleSave,
  spriteSize,
  fullBasePrompt,
  generationPrefs,
  refImage,
  readFileAsDataUrl,
  ensureBase64,
  buildNovelAIReferenceOptions
}) {
  const baseStatus = ref('pending')
  const basePreview = ref(null)
  const baseSeed = ref(null)
  const baseError = ref('')
  const exprStates = reactive({})
  const batchRunning = ref(false)

  function restoreGeneratedAssets(existing) {
    baseStatus.value = 'pending'
    basePreview.value = null
    baseSeed.value = null
    baseError.value = ''
    Object.keys(exprStates).forEach((key) => delete exprStates[key])

    if (!existing || typeof existing !== 'object') return

    if (existing.baseImage?.url) {
      basePreview.value = existing.baseImage.url
      baseSeed.value = existing.baseImage.seed || null
      baseStatus.value = 'done'
    }

    if (existing.expressions && typeof existing.expressions === 'object') {
      for (const [name, data] of Object.entries(existing.expressions)) {
        exprStates[name] = {
          status: data?.url ? 'done' : 'pending',
          url: data?.url || null,
          error: '',
          seed: data?.seed || null
        }
      }
    }
  }

  async function handleBaseUpload(event) {
    const file = event?.target?.files?.[0]
    if (!file) return
    const url = await readFileAsDataUrl(file)
    basePreview.value = url
    baseSeed.value = null
    baseStatus.value = 'done'
    baseError.value = ''
    if (event?.target) event.target.value = ''
  }

  async function handleExprUpload(event, exprName) {
    const file = event?.target?.files?.[0]
    if (!file) return
    const url = await readFileAsDataUrl(file)
    if (!exprStates[exprName]) {
      exprStates[exprName] = { status: 'done', url: null, error: '', seed: null }
    }
    exprStates[exprName].url = url
    exprStates[exprName].status = 'done'
    charResStore.setExpression(contactId.value, exprName, {
      url,
      seed: null,
      params: { expression: exprName },
      method: 'upload'
    })
    scheduleSave()
    if (event?.target) event.target.value = ''
  }

  async function generateBase() {
    if (baseStatus.value === 'generating') return
    baseStatus.value = 'generating'
    baseError.value = ''

    try {
      const seed = resolveBaseSeed(generationPrefs)
      const { width, height } = spriteSize.value
      const referenceOptions = await buildNovelAIReferenceOptions()
      const options = {
        width,
        height,
        seed,
        negativePrompt: entry.negativePrompt || undefined,
        ...referenceOptions
      }
      if (refImage.value) {
        options.baseImage = await ensureBase64(refImage.value)
      }
      const url = await generateImage(fullBasePrompt.value, options)
      basePreview.value = url
      baseSeed.value = seed
      baseStatus.value = 'done'
    } catch (error) {
      baseError.value = error?.message || '生成失败'
      baseStatus.value = 'error'
    }
  }

  function confirmBase() {
    if (!basePreview.value) return false
    const { width, height } = spriteSize.value
    charResStore.setBaseImage(contactId.value, {
      url: basePreview.value,
      seed: baseSeed.value,
      params: { width, height, prompt: fullBasePrompt.value }
    })
    scheduleSave()
    return true
  }

  async function generateOneExpression(exprName) {
    if (!exprStates[exprName]) {
      exprStates[exprName] = { status: 'pending', url: null, error: '', seed: null }
    }
    const state = exprStates[exprName]
    state.status = 'generating'
    state.error = ''

    try {
      const provider = vnStore.imageGenConfig.provider
      const strategy = vnStore.imageGenConfig.spriteStrategy
      const seed = resolveExpressionSeed(generationPrefs, baseSeed.value)
      const { width, height } = spriteSize.value
      const referenceOptions = await buildNovelAIReferenceOptions()
      let url

      const useImg2Img = (strategy === 'img2img' || provider === 'nanobanana') && basePreview.value

      if (useImg2Img) {
        const base64 = await ensureBase64(basePreview.value)
        const editPrompt = provider === 'nanobanana'
          ? `Edit this anime character illustration: change the facial expression to "${exprName}". Keep the exact same character design, pose, clothing, hairstyle, and art style. Only modify the facial expression.`
          : `${fullBasePrompt.value}, ${exprName} expression`

        url = await generateImage(editPrompt, {
          width,
          height,
          baseImage: base64,
          seed,
          strength: provider === 'nanobanana' ? 0.45 : undefined,
          negativePrompt: entry.negativePrompt || undefined,
          ...referenceOptions
        })
      } else {
        url = await generateImage(`${fullBasePrompt.value}, ${exprName} expression`, {
          width,
          height,
          seed,
          negativePrompt: entry.negativePrompt || undefined,
          ...referenceOptions
        })
      }

      state.url = url
      state.seed = seed
      state.status = 'done'
      charResStore.setExpression(contactId.value, exprName, {
        url,
        seed,
        params: { width, height, expression: exprName },
        method: strategy
      })
      scheduleSave()
    } catch (error) {
      state.error = error?.message || '生成失败'
      state.status = 'error'
    }
  }

  async function batchGenerateAll(expressions) {
    if (batchRunning.value) return
    batchRunning.value = true
    try {
      const pending = expressions.filter((name) => {
        if (name === 'normal') return false
        const state = exprStates[name]
        return !state || state.status === 'pending' || state.status === 'error'
      })
      for (const name of pending) {
        await generateOneExpression(name)
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    } finally {
      batchRunning.value = false
    }
  }

  return {
    baseStatus,
    basePreview,
    baseSeed,
    baseError,
    exprStates,
    batchRunning,
    restoreGeneratedAssets,
    handleBaseUpload,
    handleExprUpload,
    generateBase,
    confirmBase,
    generateOneExpression,
    batchGenerateAll
  }
}
