import { reactive, ref } from 'vue'
import {
  MAX_REFERENCE_LONG_SIDE,
  MAX_VIBE_REFERENCES,
  clampNumber,
  newVibeId,
  normalizeCharacterRefMode,
  normalizeGenerationPrefs,
  normalizeStrengths,
  snapshotGenerationPrefs as snapshotVnGenerationPrefs
} from '../utils/generationPrefs'

export function useVNStudioReferences({ provider }) {
  const generationPrefs = reactive(normalizeGenerationPrefs())
  const refImage = ref(null)
  const referenceBase64Cache = new Map()

  function restoreGenerationPrefs(raw) {
    Object.assign(generationPrefs, normalizeGenerationPrefs(raw))
  }

  function snapshotGenerationPrefs() {
    return snapshotVnGenerationPrefs(generationPrefs)
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (event) => resolve(String(event?.target?.result || ''))
      reader.readAsDataURL(file)
    })
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('图片读取失败'))
      reader.readAsDataURL(blob)
    })
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('图片解码失败'))
      image.src = dataUrl
    })
  }

  async function toOptimizedPngDataUrl(input, maxSide = MAX_REFERENCE_LONG_SIDE) {
    const source = String(input || '').trim()
    if (!source.startsWith('data:') || typeof document === 'undefined') return source

    const image = await loadImageFromDataUrl(source)
    const rawWidth = Number(image.naturalWidth || image.width || 0)
    const rawHeight = Number(image.naturalHeight || image.height || 0)
    const width = rawWidth > 0 ? rawWidth : 1
    const height = rawHeight > 0 ? rawHeight : 1
    const longestSide = Math.max(width, height)
    const scale = longestSide > maxSide ? (maxSide / longestSide) : 1
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('图片处理失败')
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/png')
  }

  async function fileToOptimizedPngDataUrl(file, maxSide = MAX_REFERENCE_LONG_SIDE) {
    const dataUrl = await readFileAsDataUrl(file)
    return await toOptimizedPngDataUrl(dataUrl, maxSide)
  }

  async function ensureBase64(value) {
    const text = String(value || '').trim()
    if (!text) return ''

    if (referenceBase64Cache.has(text)) {
      return await referenceBase64Cache.get(text)
    }

    const task = (async () => {
      if (text.startsWith('data:')) {
        const optimizedDataUrl = await toOptimizedPngDataUrl(text, MAX_REFERENCE_LONG_SIDE)
        return (optimizedDataUrl.split(',')[1] || '').replace(/\s+/g, '')
      }
      if (/^https?:\/\//i.test(text)) {
        const response = await fetch(text)
        if (!response.ok) throw new Error(`参考图下载失败: HTTP ${response.status}`)
        const blob = await response.blob()
        const dataUrl = await blobToDataUrl(blob)
        const optimizedDataUrl = await toOptimizedPngDataUrl(dataUrl, MAX_REFERENCE_LONG_SIDE)
        return (optimizedDataUrl.split(',')[1] || '').replace(/\s+/g, '')
      }
      return text.replace(/\s+/g, '')
    })()

    referenceBase64Cache.set(text, task)
    try {
      const result = await task
      referenceBase64Cache.set(text, Promise.resolve(result))
      return result
    } catch (error) {
      referenceBase64Cache.delete(text)
      throw error
    }
  }

  async function handleRefUpload(event) {
    const file = event?.target?.files?.[0]
    if (file) refImage.value = await fileToOptimizedPngDataUrl(file, 1536)
    if (event?.target) event.target.value = ''
  }

  async function handleCharacterRefUpload(event) {
    const file = event?.target?.files?.[0]
    if (!file) return
    generationPrefs.characterRefImage = await fileToOptimizedPngDataUrl(file, MAX_REFERENCE_LONG_SIDE)
    generationPrefs.characterRefImageRef = ''
    generationPrefs.characterRefEnabled = true
    if (event?.target) event.target.value = ''
  }

  function clearCharacterRef() {
    generationPrefs.characterRefImage = ''
    generationPrefs.characterRefImageRef = ''
  }

  async function handleVibeUpload(event) {
    const files = Array.from(event?.target?.files || [])
    if (files.length === 0) return

    const remainSlots = Math.max(0, MAX_VIBE_REFERENCES - generationPrefs.vibeReferences.length)
    if (remainSlots <= 0) {
      if (event?.target) event.target.value = ''
      return
    }

    const acceptedFiles = files.slice(0, remainSlots)
    for (const file of acceptedFiles) {
      const image = await fileToOptimizedPngDataUrl(file, MAX_REFERENCE_LONG_SIDE)
      generationPrefs.vibeReferences.push({
        id: newVibeId(),
        image,
        imageRef: '',
        strength: 0.65,
        informationExtracted: 1
      })
    }

    if (event?.target) event.target.value = ''
  }

  function removeVibe(vibeId) {
    generationPrefs.vibeReferences = generationPrefs.vibeReferences.filter((item) => item.id !== vibeId)
  }

  function clearVibes() {
    generationPrefs.vibeReferences = []
  }

  async function buildNovelAIReferenceOptions() {
    if (provider.value !== 'novelai') return {}

    const vibeRefs = []
    for (const vibe of generationPrefs.vibeReferences.slice(0, MAX_VIBE_REFERENCES)) {
      const image = await ensureBase64(vibe.image)
      if (!image) continue
      vibeRefs.push({
        image,
        strength: clampNumber(vibe.strength, 0, 1, 0.65),
        info: clampNumber(vibe.informationExtracted, 0, 1, 1)
      })
    }

    if (vibeRefs.length > 0) {
      const normalizedStrengths = normalizeStrengths(vibeRefs.map((item) => item.strength), 1)
      return {
        referenceImageMultiple: vibeRefs.map((item) => item.image),
        referenceStrengthMultiple: normalizedStrengths,
        referenceInformationExtractedMultiple: vibeRefs.map((item) => item.info),
        normalizeReferenceStrengthMultiple: true
      }
    }

    if (generationPrefs.characterRefEnabled) {
      const image = await ensureBase64(generationPrefs.characterRefImage)
      if (!image) return {}
      return {
        directorReferenceImages: [image],
        directorReferenceMode: normalizeCharacterRefMode(generationPrefs.characterRefMode),
        directorReferenceInformationExtracted: [1],
        directorReferenceStrengthValues: [clampNumber(generationPrefs.characterRefStrength, 0, 1, 0.65)],
        directorReferenceSecondaryStrengthValues: [clampNumber(1 - Number(generationPrefs.characterRefFidelity || 0), 0, 1, 0.5)]
      }
    }

    return {}
  }

  return {
    generationPrefs,
    refImage,
    restoreGenerationPrefs,
    snapshotGenerationPrefs,
    readFileAsDataUrl,
    ensureBase64,
    buildNovelAIReferenceOptions,
    handleRefUpload,
    handleCharacterRefUpload,
    clearCharacterRef,
    handleVibeUpload,
    removeVibe,
    clearVibes
  }
}
