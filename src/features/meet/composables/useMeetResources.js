import { useContactsStore } from '../../../stores/contacts'
import { useCharacterResourcesStore } from '../../../stores/characterResources'
import { useMeetStore } from '../../../stores/meet'
import { useVNStore } from '../../../stores/vn'
import { useImageGen } from '../../../composables/useImageGen'
import { clampNumber, isDirectUrl, lower, normalizeExpression, normalizeText } from './meetResources/utils'
import {
  buildFallbackBackgroundUrl,
  normalizeExternalMediaUrl,
} from './meetResources/sourceHelpers'
import {
  enqueueGeneration,
  imageUrlToBase64,
  normalizeQueueConfig,
  pendingBackgroundJobs,
  pendingCgJobs,
  pendingSpriteJobs,
  resolveProviderReady
} from './meetResources/generationQueue'
import {
  buildBackgroundPrompt,
  buildCgPrompt,
  buildNanoBananaEditPrompt,
  buildSpritePrompt
} from './meetResources/resourcePrompts'
import { resolveCharacterMeta } from './meetResources/characterMeta'
import { createMeetResourceStore } from './meetResources/resourceStore'
import { createMeetSourceResolver } from './meetResources/sourceResolver'
import { processSpriteCutoutUrl } from './meetResources/spriteCutout'

export function useMeetResources() {
  const contactsStore = useContactsStore()
  const meetStore = useMeetStore()
  const vnStore = useVNStore()
  const characterResourcesStore = useCharacterResourcesStore()
  const { generateImage } = useImageGen()

  let activeImageJobs = 0

  function beginImageJob() {
    activeImageJobs += 1
    meetStore.player.isGeneratingImage = true
  }

  function endImageJob() {
    activeImageJobs = Math.max(0, activeImageJobs - 1)
    meetStore.player.isGeneratingImage = activeImageJobs > 0
  }

  function getQueueConfig() {
    const src = meetStore.assetSources || {}
    return normalizeQueueConfig({
      minDelayMs: src.generationMinDelayMs,
      maxDelayMs: src.generationMaxDelayMs,
      jitterMs: src.generationJitterMs,
      maxRetries: src.generationMaxRetries
    })
  }

  function getAssetFlags() {
    const src = meetStore.assetSources || {}
    return {
      enableSafebooru: src.enableSafebooru !== false,
      enableJamendoBgm: src.enableJamendoBgm !== false,
      enableRealtimeGeneration: src.enableRealtimeGeneration !== false,
      enableSpriteAutoCutout: src.enableSpriteAutoCutout !== false,
      jamendoClientId: normalizeText(src.jamendoClientId || ''),
      jamendoInstrumentalOnly: src.jamendoInstrumentalOnly !== false,
      jamendoSearchLimit: clampNumber(src.jamendoSearchLimit, 4, 20, 10),
      spriteCutoutThreshold: clampNumber(src.spriteCutoutThreshold, 220, 252, 240),
      spriteCutoutSoftness: clampNumber(src.spriteCutoutSoftness, 8, 64, 18),
      spriteCutoutEdgeThreshold: clampNumber(src.spriteCutoutEdgeThreshold, 210, 255, 234),
      spriteCutoutEdgeTolerance: clampNumber(src.spriteCutoutEdgeTolerance, 12, 80, 34),
      safebooruProxy: normalizeText(src.safebooruProxy || '').replace(/\/+$/, ''),
      imageProxy: normalizeText(src.imageProxy || ''),
      audioProxy: normalizeText(src.audioProxy || '')
    }
  }

  async function finalizeSpriteUrl(characterId, expression, url, flags, extra = {}) {
    const normalized = normalizeMediaUrlForUse(url, 'image')
    if (!normalized) return null
    if (!flags.enableSpriteAutoCutout || extra.skipCutout) return normalized

    const cutout = await processSpriteCutoutUrl(normalized, {
      threshold: flags.spriteCutoutThreshold,
      softness: flags.spriteCutoutSoftness,
      edgeThreshold: flags.spriteCutoutEdgeThreshold,
      edgeTolerance: flags.spriteCutoutEdgeTolerance
    })
    const finalUrl = normalizeMediaUrlForUse(cutout || normalized, 'image')

    if (
      finalUrl &&
      finalUrl !== normalized &&
      extra.persist !== false &&
      normalizeText(characterId)
    ) {
      persistSprite(characterId, expression, finalUrl, {
        source: extra.source || 'auto_cutout',
        prompt: normalizeText(extra.prompt || '')
      })
    }

    return finalUrl || normalized
  }

  function normalizeMediaUrlForUse(url, type = 'image') {
    return normalizeExternalMediaUrl(url, type, {
      imageProxy: getAssetFlags().imageProxy,
      audioProxy: getAssetFlags().audioProxy
    })
  }

  const resourceStore = createMeetResourceStore({
    characterResourcesStore,
    contactsStore,
    meetStore,
    normalizeMediaUrlForUse
  })
  const {
    getMeetingBackgroundByName,
    getMeetingBgmByName,
    getMeetingCgByName,
    getMeetingSfxByName,
    persistBackground,
    persistCg,
    persistSprite,
    resolveExactSpriteResource,
    resolveSpriteResource
  } = resourceStore
  const {
    fetchSafebooruBackground,
    getBackgroundFromAssetSources,
    getSpriteFromAssetSources,
    pickAutoBGM,
    resolveBGM,
    resolveBGMAsync,
    resolveSFX,
    resolveSFXAsync,
    resolveSpriteFromAssetSources
  } = createMeetSourceResolver({
    getAssetFlags,
    getMeetingBgmByName,
    getMeetingSfxByName,
    meetStore,
    normalizeMediaUrlForUse
  })

  async function resolveBackground(name, prompt, options = {}) {
    const sceneName = normalizeText(name || prompt || 'scene')
    const scenePrompt = normalizeText(prompt || name || sceneName)
    const meetingId = normalizeText(meetStore.currentMeeting?.id || 'global')
    const key = `${meetingId}::${lower(sceneName)}`

    const direct = isDirectUrl(sceneName) ? sceneName : ''
    if (direct) return direct

    const existing = getMeetingBackgroundByName(sceneName)
    if (existing?.url) return normalizeMediaUrlForUse(existing.url, 'image')

    const fromSource = await getBackgroundFromAssetSources(sceneName, scenePrompt)
    if (fromSource) {
      persistBackground(sceneName, fromSource, { source: 'asset_sources', prompt: scenePrompt })
      return normalizeMediaUrlForUse(fromSource, 'image')
    }

    if (pendingBackgroundJobs.has(key)) {
      return await pendingBackgroundJobs.get(key)
    }

    const job = (async () => {
      beginImageJob()
      try {
        const flags = getAssetFlags()
        if (flags.enableSafebooru && options.allowSafebooru !== false) {
          const safebooruUrl = await fetchSafebooruBackground(scenePrompt)
          if (safebooruUrl) {
            const normalizedSafebooruUrl = normalizeMediaUrlForUse(safebooruUrl, 'image')
            persistBackground(sceneName, normalizedSafebooruUrl, {
              source: 'safebooru',
              prompt: scenePrompt
            })
            return normalizedSafebooruUrl
          }
        }

        if (
          flags.enableRealtimeGeneration &&
          options.allowGenerate !== false &&
          resolveProviderReady(vnStore)
        ) {
          try {
            const generated = await enqueueGeneration(async () => {
              const promptText = buildBackgroundPrompt(sceneName, scenePrompt)
              return await generateImage(promptText, {
                width: 1344,
                height: 768
              })
            }, getQueueConfig())
            if (generated) {
              const normalizedGenerated = normalizeMediaUrlForUse(generated, 'image')
              persistBackground(sceneName, normalizedGenerated, {
                source: 'ai',
                prompt: scenePrompt
              })
              return normalizedGenerated
            }
          } catch (error) {
            if (import.meta.env?.DEV) {
              console.warn('[MeetResources] Background generation failed:', error)
            }
          }
        }

        const fallback = buildFallbackBackgroundUrl(sceneName, scenePrompt)
        persistBackground(sceneName, fallback, {
          source: 'fallback',
          prompt: scenePrompt
        })
        return normalizeMediaUrlForUse(fallback, 'image')
      } finally {
        endImageJob()
      }
    })()
      .finally(() => {
        pendingBackgroundJobs.delete(key)
      })

    pendingBackgroundJobs.set(key, job)
    return await job
  }

  async function resolveCG(name, prompt, options = {}) {
    const cgName = normalizeText(name || prompt || 'cg_scene')
    const cgPrompt = normalizeText(prompt || name || cgName)
    if (!cgName) return null

    if (isDirectUrl(cgName)) return normalizeMediaUrlForUse(cgName, 'image')

    const existing = getMeetingCgByName(cgName)
    if (existing?.url && !options.force) {
      return normalizeMediaUrlForUse(existing.url, 'image')
    }

    const fromSource = await getBackgroundFromAssetSources(cgName, cgPrompt)
    if (fromSource) {
      persistCg(cgName, fromSource, { source: 'asset_sources', prompt: cgPrompt })
      return normalizeMediaUrlForUse(fromSource, 'image')
    }

    const reuseBackground = getMeetingBackgroundByName(cgName)
    if (reuseBackground?.url) {
      const reused = normalizeMediaUrlForUse(reuseBackground.url, 'image')
      persistCg(cgName, reused, { source: 'background_reuse', prompt: cgPrompt })
      return reused
    }

    const meetingId = normalizeText(meetStore.currentMeeting?.id || 'global')
    const key = `${meetingId}::cg::${lower(cgName)}`
    if (pendingCgJobs.has(key)) {
      return await pendingCgJobs.get(key)
    }

    const job = (async () => {
      beginImageJob()
      try {
        const flags = getAssetFlags()
        if (
          !flags.enableRealtimeGeneration ||
          options.allowGenerate === false ||
          !resolveProviderReady(vnStore)
        ) {
          return null
        }

        try {
          const generated = await enqueueGeneration(async () => {
            return await generateImage(buildCgPrompt(cgName, cgPrompt), {
              width: 1216,
              height: 832
            })
          }, getQueueConfig())
          if (generated) {
            const normalizedGenerated = normalizeMediaUrlForUse(generated, 'image')
            persistCg(cgName, normalizedGenerated, {
              source: 'ai',
              prompt: cgPrompt,
              isNew: !!options.isNew
            })
            return normalizedGenerated
          }
        } catch (error) {
          if (import.meta.env?.DEV) {
            console.warn('[MeetResources] CG generation failed:', error)
          }
        }
        return null
      } finally {
        endImageJob()
      }
    })()
      .finally(() => {
        pendingCgJobs.delete(key)
      })

    pendingCgJobs.set(key, job)
    return await job
  }

  function getSpriteUrl(characterId, expression = 'normal', vnName = '') {
    if (!characterId) return null
    const fromResource = resolveSpriteResource(characterId, expression)
    if (fromResource) return normalizeMediaUrlForUse(fromResource, 'image')
    const fromSource = getSpriteFromAssetSources(characterId, expression, vnName)
    return fromSource ? normalizeMediaUrlForUse(fromSource, 'image') : null
  }

  async function generateSprite(characterId, expression, payload, flags) {
    const meta = resolveCharacterMeta({
      characterResourcesStore,
      contactsStore,
      meetStore
    }, characterId, payload.vnName)
    let prompt = buildSpritePrompt(payload, meta)
    const provider = lower(vnStore.imageGenConfig?.provider)

    const generateOptions = {
      width: 832,
      height: 1216
    }

    const negativePrompt = normalizeText(meta.charRes?.negativePrompt)
    if (negativePrompt) {
      generateOptions.negativePrompt = negativePrompt
    }

    if (expression !== 'normal') {
      const normalSprite = resolveSpriteResource(characterId, 'normal')
      if (normalSprite) {
        try {
          const base64 = await imageUrlToBase64(normalizeMediaUrlForUse(normalSprite, 'image'))
          if (base64) {
            generateOptions.baseImage = base64
            generateOptions.strength = provider === 'nanobanana' ? 0.35 : 0.45
            if (!normalizeText(payload.prompt) && provider === 'nanobanana') {
              prompt = buildNanoBananaEditPrompt(meta.displayName, expression)
            }
          }
        } catch {
          // Ignore base-image conversion errors and fallback to text2img.
        }
      }
    }

    let generated = await generateImage(prompt, generateOptions)
    if (generated && flags.enableSpriteAutoCutout) {
      generated = await processSpriteCutoutUrl(generated, {
        threshold: flags.spriteCutoutThreshold,
        softness: flags.spriteCutoutSoftness,
        edgeThreshold: flags.spriteCutoutEdgeThreshold,
        edgeTolerance: flags.spriteCutoutEdgeTolerance
      })
    }
    return generated
  }

  async function ensureSprite(payload = {}, options = {}) {
    const characterId = normalizeText(payload.characterId)
    if (!characterId) return null
    const expression = normalizeExpression(payload.expression || 'normal')
    const spritePrompt = normalizeText(payload.prompt || '')
    const flags = getAssetFlags()
    const exactResource = resolveExactSpriteResource(characterId, expression)
    const allowExistingFallback = options.allowGenerate === false

    const existing = getSpriteUrl(characterId, expression, payload.vnName)
    if (existing && !options.force && (expression === 'normal' || !!exactResource || allowExistingFallback)) {
      if (!exactResource && expression === 'normal') {
        persistSprite(characterId, expression, existing, {
          source: 'asset_sources',
          prompt: spritePrompt
        })
      }
      return await finalizeSpriteUrl(characterId, expression, existing, flags, {
        source: 'asset_sources',
        prompt: spritePrompt,
        persist: expression === 'normal' || !!exactResource
      })
    }

    const meetingId = normalizeText(meetStore.currentMeeting?.id || 'global')
    const key = `${meetingId}::${characterId}::${expression}`
    if (pendingSpriteJobs.has(key)) {
      return await pendingSpriteJobs.get(key)
    }

    const job = (async () => {
      beginImageJob()
      try {
        if (
          expression !== 'normal' &&
          flags.enableRealtimeGeneration &&
          resolveProviderReady(vnStore) &&
          !options.skipPrimeNormal
        ) {
          const normal = resolveSpriteResource(characterId, 'normal')
          if (!normal) {
            await ensureSprite(
              { ...payload, expression: 'normal', isNew: true },
              { ...options, skipPrimeNormal: true }
            )
          }
        }

        const exactAfterPrime = resolveExactSpriteResource(characterId, expression)
        if (exactAfterPrime && !options.force) {
          return await finalizeSpriteUrl(characterId, expression, exactAfterPrime, flags, {
            source: 'resource',
            prompt: spritePrompt
          })
        }

        let fallbackSourceUrl = null
        const fromSource = await resolveSpriteFromAssetSources(
          characterId,
          expression,
          payload.vnName,
          payload.prompt
        )
        if (fromSource?.url) {
          const sourceUrl = fromSource.url
          const sourceExpr = normalizeExpression(fromSource.expression || 'normal')
          const sourceIsExact = expression === 'normal' || (
            fromSource.isExplicitExpression && sourceExpr === expression
          )

          if (sourceIsExact) {
            persistSprite(characterId, expression, sourceUrl, {
              source: 'asset_sources',
              prompt: spritePrompt
            })
          }

          const finalizedSourceUrl = await finalizeSpriteUrl(characterId, expression, sourceUrl, flags, {
            source: 'asset_sources',
            prompt: spritePrompt,
            persist: sourceIsExact
          })
          if (sourceIsExact) {
            return finalizedSourceUrl
          }
          fallbackSourceUrl = finalizedSourceUrl
        }

        if (
          !flags.enableRealtimeGeneration ||
          options.allowGenerate === false ||
          !resolveProviderReady(vnStore)
        ) {
          return fallbackSourceUrl
        }

        try {
          const generated = await enqueueGeneration(async () => {
            return await generateSprite(characterId, expression, payload, flags)
          }, getQueueConfig())

          if (generated) {
            const normalizedGenerated = normalizeMediaUrlForUse(generated, 'image')
            persistSprite(characterId, expression, normalizedGenerated, {
              source: 'ai',
              prompt: spritePrompt,
              isNew: !!payload.isNew
            })
            return await finalizeSpriteUrl(characterId, expression, normalizedGenerated, flags, {
              source: 'ai',
              prompt: spritePrompt,
              persist: false
            })
          }
        } catch (error) {
          if (import.meta.env?.DEV) {
            console.warn('[MeetResources] Sprite generation failed:', error)
          }
        }
        return fallbackSourceUrl
      } finally {
        endImageJob()
      }
    })()
      .finally(() => {
        pendingSpriteJobs.delete(key)
      })

    pendingSpriteJobs.set(key, job)
    return await job
  }

  return {
    resolveBackground,
    resolveCG,
    resolveBGM,
    resolveBGMAsync,
    pickAutoBGM,
    resolveSFX,
    resolveSFXAsync,
    getSpriteUrl,
    ensureSprite
  }
}
