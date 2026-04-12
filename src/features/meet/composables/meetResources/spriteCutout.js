// @ts-check

import { clampNumber, hashString, normalizeText } from './utils'

const pendingSpriteCutoutJobs = new Map()
const spriteCutoutCache = new Map()
const SPRITE_CUTOUT_CACHE_LIMIT = 180

async function loadImage(url) {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })
}

async function removeWhiteBackground(url, options = {}) {
  if (!url || typeof document === 'undefined' || typeof Image === 'undefined') return url

  const threshold = clampNumber(options.threshold, 220, 252, 240)
  const softness = clampNumber(options.softness, 8, 64, 18)
  const edgeThreshold = clampNumber(
    options.edgeThreshold,
    210,
    255,
    Math.max(224, threshold - 6)
  )
  const edgeTolerance = clampNumber(options.edgeTolerance, 12, 80, 34)

  try {
    const img = await loadImage(url)
    const width = Math.max(1, Number(img.naturalWidth || img.width || 1))
    const height = Math.max(1, Number(img.naturalHeight || img.height || 1))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return url
    ctx.drawImage(img, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const pixelCount = width * height
    const removedMask = new Uint8Array(pixelCount)
    const queue = new Int32Array(pixelCount)
    let head = 0
    let tail = 0
    let changed = 0

    const canTreatAsBackground = (idx, relaxed = false) => {
      const offset = idx * 4
      const a = data[offset + 3]
      if (a === 0) return true
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const spread = max - min
      const luma = (r + g + b) / 3
      const localThreshold = relaxed ? edgeThreshold - 8 : edgeThreshold
      const localSpread = relaxed ? edgeTolerance + 8 : edgeTolerance
      return luma >= localThreshold && spread <= localSpread
    }

    const enqueueBg = (idx, relaxed = false) => {
      if (idx < 0 || idx >= pixelCount) return
      if (removedMask[idx]) return
      if (!canTreatAsBackground(idx, relaxed)) return
      removedMask[idx] = 1
      queue[tail++] = idx
    }

    for (let x = 0; x < width; x += 1) {
      enqueueBg(x, false)
      enqueueBg((height - 1) * width + x, false)
    }
    for (let y = 0; y < height; y += 1) {
      enqueueBg(y * width, false)
      enqueueBg(y * width + (width - 1), false)
    }

    while (head < tail) {
      const idx = queue[head++]
      const offset = idx * 4
      if (data[offset + 3] !== 0) {
        data[offset + 3] = 0
        changed += 1
      }

      const x = idx % width
      const y = (idx / width) | 0
      if (x > 0) enqueueBg(idx - 1, true)
      if (x < width - 1) enqueueBg(idx + 1, true)
      if (y > 0) enqueueBg(idx - width, true)
      if (y < height - 1) enqueueBg(idx + width, true)
    }

    const shouldFeather = (idx, x, y) => {
      if (x > 0 && removedMask[idx - 1]) return true
      if (x < width - 1 && removedMask[idx + 1]) return true
      if (y > 0 && removedMask[idx - width]) return true
      if (y < height - 1 && removedMask[idx + width]) return true
      if (x > 0 && y > 0 && removedMask[idx - width - 1]) return true
      if (x < width - 1 && y > 0 && removedMask[idx - width + 1]) return true
      if (x > 0 && y < height - 1 && removedMask[idx + width - 1]) return true
      if (x < width - 1 && y < height - 1 && removedMask[idx + width + 1]) return true
      return false
    }

    const featherStart = threshold - softness
    const featherSpan = Math.max(6, softness + 8)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x
        if (removedMask[idx]) continue
        if (!shouldFeather(idx, x, y)) continue
        const offset = idx * 4
        const a = data[offset + 3]
        if (a === 0) continue

        const r = data[offset]
        const g = data[offset + 1]
        const b = data[offset + 2]
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const spread = max - min
        const luma = (r + g + b) / 3

        if (spread > edgeTolerance + 10) continue
        if (luma < featherStart) continue

        const strength = Math.max(0, Math.min(1, (luma - featherStart) / featherSpan))
        const keep = 1 - (0.9 * strength)
        const nextAlpha = Math.round(a * keep)
        if (nextAlpha !== a) {
          data[offset + 3] = nextAlpha
          changed += 1
        }
      }
    }

    if (changed === 0) return url

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return url
  }
}

function buildSpriteCutoutKey(url, options = {}) {
  const threshold = clampNumber(options.threshold, 220, 252, 240)
  const softness = clampNumber(options.softness, 8, 64, 18)
  const edgeThreshold = clampNumber(options.edgeThreshold, 210, 255, Math.max(224, threshold - 6))
  const edgeTolerance = clampNumber(options.edgeTolerance, 12, 80, 34)
  const base = normalizeText(url)
  return [
    `sprite_cutout`,
    String(threshold),
    String(softness),
    String(edgeThreshold),
    String(edgeTolerance),
    String(base.length),
    String(hashString(base))
  ].join(':')
}

export async function processSpriteCutoutUrl(url, options = {}) {
  const source = normalizeText(url)
  if (!source) return source
  if (!/^(https?:|data:|blob:)/i.test(source)) return source

  const key = buildSpriteCutoutKey(source, options)
  if (spriteCutoutCache.has(key)) {
    return spriteCutoutCache.get(key) || source
  }
  if (pendingSpriteCutoutJobs.has(key)) {
    return await pendingSpriteCutoutJobs.get(key)
  }

  const job = (async () => {
    const processed = await removeWhiteBackground(source, options)
    const finalUrl = normalizeText(processed || source) || source
    spriteCutoutCache.set(key, finalUrl)
    while (spriteCutoutCache.size > SPRITE_CUTOUT_CACHE_LIMIT) {
      const oldKey = spriteCutoutCache.keys().next().value
      if (!oldKey) break
      spriteCutoutCache.delete(oldKey)
    }
    return finalUrl
  })()
    .finally(() => {
      pendingSpriteCutoutJobs.delete(key)
    })

  pendingSpriteCutoutJobs.set(key, job)
  return await job
}

