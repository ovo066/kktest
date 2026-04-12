// @ts-check

import { imageUrlToBase64 } from '../../../../utils/imageData'
import { clampNumber, normalizeText } from './utils'

const DEFAULT_GENERATION_QUEUE = Object.freeze({
  minDelayMs: 1400,
  maxDelayMs: 5200,
  jitterMs: 600,
  maxRetries: 3
})

const generationQueue = []
let generationQueueRunning = false
const generationLimiter = {
  nextAvailableAt: 0,
  delayMs: DEFAULT_GENERATION_QUEUE.minDelayMs
}

const pendingBackgroundJobs = new Map()
const pendingCgJobs = new Map()
const pendingSpriteJobs = new Map()

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function normalizeQueueConfig(rawConfig = {}) {
  const minDelayMs = clampNumber(
    rawConfig.minDelayMs,
    400,
    15000,
    DEFAULT_GENERATION_QUEUE.minDelayMs
  )
  const maxDelayMs = clampNumber(
    rawConfig.maxDelayMs,
    minDelayMs + 120,
    60000,
    Math.max(minDelayMs + 1800, DEFAULT_GENERATION_QUEUE.maxDelayMs)
  )
  const jitterMs = clampNumber(
    rawConfig.jitterMs,
    100,
    3000,
    DEFAULT_GENERATION_QUEUE.jitterMs
  )
  const maxRetries = clampNumber(
    rawConfig.maxRetries,
    0,
    6,
    DEFAULT_GENERATION_QUEUE.maxRetries
  )
  return {
    minDelayMs: Math.round(minDelayMs),
    maxDelayMs: Math.round(maxDelayMs),
    jitterMs: Math.round(jitterMs),
    maxRetries: Math.round(maxRetries)
  }
}

function isRateLimitError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')
}

function isRetryableGenerationError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return (
    isRateLimitError(error) ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  )
}

async function waitForLimiterWindow() {
  const waitMs = Math.max(0, generationLimiter.nextAvailableAt - Date.now())
  if (waitMs > 0) {
    await sleep(waitMs)
  }
}

function markGenerationRetry(config, attempt, rateLimited) {
  const baseMultiplier = rateLimited ? 1.95 : 1.45
  generationLimiter.delayMs = clampNumber(
    Math.round(generationLimiter.delayMs * baseMultiplier + (rateLimited ? 300 : 120) * attempt),
    config.minDelayMs,
    config.maxDelayMs,
    config.maxDelayMs
  )
  const jitter = Math.round(Math.random() * config.jitterMs)
  generationLimiter.nextAvailableAt = Date.now() + generationLimiter.delayMs + jitter
}

function markGenerationSuccess(config) {
  generationLimiter.delayMs = clampNumber(
    Math.round(generationLimiter.delayMs * 0.88),
    config.minDelayMs,
    config.maxDelayMs,
    config.minDelayMs
  )
  const jitter = Math.round(Math.random() * config.jitterMs)
  generationLimiter.nextAvailableAt = Date.now() + generationLimiter.delayMs + jitter
}

function markGenerationFailure(config, rateLimited) {
  if (rateLimited) {
    generationLimiter.delayMs = clampNumber(
      Math.round(generationLimiter.delayMs * 1.4 + 260),
      config.minDelayMs,
      config.maxDelayMs,
      config.maxDelayMs
    )
  }
  const jitter = Math.round(Math.random() * config.jitterMs)
  generationLimiter.nextAvailableAt = Date.now() + generationLimiter.delayMs + jitter
}

async function executeQueuedGeneration(task, rawConfig) {
  const config = normalizeQueueConfig(rawConfig)
  let attempt = 0

  while (true) {
    await waitForLimiterWindow()
    try {
      const result = await task()
      markGenerationSuccess(config)
      return result
    } catch (error) {
      attempt += 1
      const retryable = isRetryableGenerationError(error)
      const rateLimited = isRateLimitError(error)
      if (!retryable || attempt > config.maxRetries) {
        markGenerationFailure(config, rateLimited)
        throw error
      }
      markGenerationRetry(config, attempt, rateLimited)
    }
  }
}

function runGenerationQueue() {
  if (generationQueueRunning) return
  generationQueueRunning = true

  const loop = async () => {
    while (generationQueue.length > 0) {
      const item = generationQueue.shift()
      if (!item) continue
      try {
        const result = await executeQueuedGeneration(item.task, item.config)
        item.resolve(result)
      } catch (error) {
        item.reject(error)
      }
    }
  }

  loop().finally(() => {
    generationQueueRunning = false
    if (generationQueue.length > 0) runGenerationQueue()
  })
}

function enqueueGeneration(task, config) {
  return new Promise((resolve, reject) => {
    generationQueue.push({ task, config, resolve, reject })
    runGenerationQueue()
  })
}

function resolveProviderReady(vnStore) {
  const cfg = vnStore.imageGenConfig || {}
  const provider = String(cfg.provider || '').toLowerCase()
  if (provider === 'novelai') return !!cfg.novelai?.apiKey
  if (provider === 'nanobanana') {
    const nano = cfg.nanobanana || {}
    const keyMode = normalizeText(nano.apiKeyMode).toLowerCase()
    if (keyMode === 'none' || keyMode === 'noauth' || keyMode === 'no_auth') return true
    return !!normalizeText(nano.apiKey)
  }
  if (provider === 'custom') return !!cfg.custom?.endpoint
  return false
}

export {
  enqueueGeneration,
  normalizeQueueConfig,
  pendingBackgroundJobs,
  pendingCgJobs,
  pendingSpriteJobs,
  imageUrlToBase64,
  resolveProviderReady
}
