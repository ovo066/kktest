import { parseImageTokenPayload } from '../../../composables/api/imageTokens'
import {
  clampNumber,
  MAX_VIBE_REFERENCES,
  normalizeCharacterRefMode,
  normalizeStrengths
} from '../../../composables/imageGen/generationPrefs'

export function useChatImageTokens(options = {}) {
  const {
    store,
    charResStore,
    albumStore,
    generateImage,
    makeId,
    showToast,
    scrollToBottom
  } = options

  function getProvider() {
    return String(store?.vnImageGenConfig?.provider || '').trim().toLowerCase()
  }

  function extractImageTokenTags(text) {
    const content = String(text || '')
    const tokenRe = /(?:\(|（|\[|【)\s*(?:image|img|pic|photo|生图|画图|发图|配图|图片|图像)\s*[:：]\s*([^)）\]】]+?)\s*(?:\)|）|\]|】)/gi
    const tagsList = []
    let match
    while ((match = tokenRe.exec(content)) !== null) {
      const tags = String(match[1] || '').trim()
      if (tags) tagsList.push(tags)
    }
    return tagsList
  }

  function stripImageTokensFromText(text) {
    const content = String(text || '')
    const tokenRe = /(?:\(|（|\[|【)\s*(?:image|img|pic|photo|生图|画图|发图|配图|图片|图像)\s*[:：]\s*([^)）\]】]+?)\s*(?:\)|）|\]|】)/gi
    return content
      .replace(tokenRe, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n')
  }

  function splitDanbooruTags(text) {
    return String(text || '')
      .split(/[,，\n]/)
      .map(tag => tag.trim().toLowerCase().replace(/\s+/g, '_'))
      .filter(Boolean)
  }

  function uniqueTags(tags) {
    const result = []
    const seen = new Set()
    tags.forEach(tag => {
      if (seen.has(tag)) return
      seen.add(tag)
      result.push(tag)
    })
    return result
  }

  function base64ToBytes(base64) {
    const normalized = String(base64 || '').replace(/\s+/g, '')
    if (!normalized) return new Uint8Array(0)
    try {
      const binary = atob(normalized)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    } catch {
      return new Uint8Array(0)
    }
  }

  function bytesToBase64(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }

  function detectKnownImageMimeType(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return ''
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return 'image/webp'
    if (
      bytes.length >= 6 &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
      bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    ) return 'image/gif'
    return ''
  }

  async function blobToDataUrl(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function') return ''
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const mimeType = String(blob.type || '').trim() || detectKnownImageMimeType(bytes)
    if (!mimeType) return ''
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`
  }

  async function normalizeGeneratedImageUrl(rawValue) {
    if (typeof Blob !== 'undefined' && rawValue instanceof Blob) {
      const dataUrl = await blobToDataUrl(rawValue)
      if (!dataUrl) return ''
      rawValue = dataUrl
    }

    const text = String(rawValue || '').trim()
    if (!text) return ''
    if (/^data:image\//i.test(text) || /^(?:blob:|https?:\/\/)/i.test(text)) return text

    if (/^data:/i.test(text)) {
      const match = text.match(/^data:[^;,]*;base64,([\s\S]+)$/i)
      if (!match) return ''
      const bytes = base64ToBytes(match[1])
      const mimeType = detectKnownImageMimeType(bytes)
      if (!mimeType) return ''
      return `data:${mimeType};base64,${bytesToBase64(bytes)}`
    }

    if (/^[a-z0-9+/=\s]+$/i.test(text) && text.replace(/\s+/g, '').length >= 64) {
      const bytes = base64ToBytes(text)
      const mimeType = detectKnownImageMimeType(bytes)
      if (!mimeType) return ''
      return `data:${mimeType};base64,${bytesToBase64(bytes)}`
    }

    return ''
  }

  async function ensureImageUrlLoadable(imageUrl, timeoutMs = 15000) {
    if (!imageUrl || typeof Image === 'undefined') return imageUrl
    await new Promise((resolve, reject) => {
      let settled = false
      const img = new Image()
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('图片加载超时'))
      }, timeoutMs)

      img.onload = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      }
      img.onerror = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error('图片加载失败'))
      }
      img.src = imageUrl
    })
    return imageUrl
  }

  async function finalizeGeneratedImageUrl(rawValue) {
    const imageUrl = await normalizeGeneratedImageUrl(rawValue)
    if (!imageUrl) {
      throw new Error('图片结果无效：未返回可渲染的图片地址')
    }
    return await ensureImageUrlLoadable(imageUrl)
  }

  function clampUnitNumber(value, fallback = 1) {
    return clampNumber(value, 0, 1, fallback)
  }

  function normalizeReferenceImage(value) {
    const text = String(value || '').trim()
    if (!text) return ''
    const normalized = text.startsWith('data:') ? (text.split(',')[1] || '') : text
    return normalized.replace(/\s+/g, '')
  }

  function buildNovelAIReferenceOptionsForMessage(entry) {
    const prefs = entry?.generationPrefs && typeof entry.generationPrefs === 'object'
      ? entry.generationPrefs
      : null
    if (!prefs) return {}

    const vibeList = Array.isArray(prefs.vibeReferences)
      ? prefs.vibeReferences
          .slice(0, MAX_VIBE_REFERENCES)
          .map(item => {
            if (!item || typeof item !== 'object') return null
            const image = normalizeReferenceImage(item.image)
            if (!image) return null
            return {
              image,
              strength: clampUnitNumber(item.strength, 0.65),
              info: clampUnitNumber(item.informationExtracted, 1)
            }
          })
          .filter(Boolean)
      : []

    // Follow official behavior: when vibe exists, character reference is not mixed in the same request.
    if (vibeList.length > 0) {
      const strengths = normalizeStrengths(vibeList.map(v => v.strength), 1)
      return {
        reference_image_multiple: vibeList.map(v => v.image),
        reference_strength_multiple: strengths,
        reference_information_extracted_multiple: vibeList.map(v => v.info),
        normalize_reference_strength_multiple: true
      }
    }

    if (!prefs.characterRefEnabled) return {}
    const image = normalizeReferenceImage(prefs.characterRefImage)
    if (!image) return {}
    const mode = normalizeCharacterRefMode(
      prefs.characterRefMode !== undefined
        ? prefs.characterRefMode
        : (prefs.characterRefStyleAware === false ? 'character_only' : 'character_style')
    )
    const fidelity = clampUnitNumber(
      prefs.characterRefFidelity !== undefined ? prefs.characterRefFidelity : prefs.characterRefInfoExtracted,
      0.5
    )
    return {
      directorReferenceMode: mode,
      directorReferenceImages: [image],
      directorReferenceInformationExtracted: [1],
      directorReferenceStrengthValues: [clampUnitNumber(prefs.characterRefStrength, 0.65)],
      // API uses "secondary strength" where 0 = max fidelity, so invert UI "fidelity".
      directorReferenceSecondaryStrengthValues: [clampUnitNumber(1 - fidelity, 0.5)]
    }
  }

  function buildImagePromptForMessage(msg, sceneTags, imageType) {
    const provider = getProvider()
    const isCharacter = imageType === 'character'
    const contactId = msg?.senderId || store?.activeChat?.id || ''
    const entry = contactId ? charResStore?.getEntry(contactId) : null
    const keepArtistTagsOnNonCharacterImage = !!entry?.generationPrefs?.keepArtistTagsOnNonCharacterImage

    if (provider === 'nanobanana') {
      // NanoBanana: natural language prompt
      const sceneText = String(sceneTags || '').trim()
      if (!isCharacter) return sceneText || 'cinematic scene, atmospheric lighting, detailed composition'
      // Character image: prepend character description for context
      const charDesc = String(entry?.basePrompt || '').trim()
      if (charDesc && sceneText) return charDesc + ', ' + sceneText
      if (charDesc) return charDesc
      if (sceneText) return sceneText
      return 'anime character portrait, upper body, soft lighting'
    }

    // NAI / default: danbooru tag composition
    const actionTags = splitDanbooruTags(sceneTags || '')
    if (!isCharacter) {
      // Non-character: scene tags + quality. Character tags are always removed.
      // Artist tags are optional via per-character generation preference.
      const artistTags = keepArtistTagsOnNonCharacterImage
        ? splitDanbooruTags(entry?.artistTags || '')
        : []
      const qualityTags = ['masterpiece', 'best_quality', 'highres']
      return uniqueTags([...artistTags, ...actionTags, ...qualityTags]).join(', ')
    }
    const artistTags = splitDanbooruTags(entry?.artistTags || '')
    const roleTags = splitDanbooruTags(entry?.basePrompt || '')
    const qualityTags = ['masterpiece', 'best_quality', 'highres', 'anime_style']
    return uniqueTags([...artistTags, ...roleTags, ...actionTags, ...qualityTags]).join(', ')
  }

  function assignOptionIfSet(target, key, value) {
    if (value === undefined || value === null || value === '') return
    target[key] = value
  }

  function normalizeGenDimension(value, fallback = null) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return fallback
    return Math.max(64, Math.min(4096, Math.round(n)))
  }

  const CHAT_IMAGE_RENDER_TIMEOUT_MS = 90_000

  function getImageGenOptionsForMessage(msg, imageType) {
    const contactId = msg?.senderId || store?.activeChat?.id || ''
    const entry = contactId ? charResStore?.getEntry(contactId) : null
    const provider = getProvider()
    const isCharacter = imageType === 'character'
    const naiCfg = store?.vnImageGenConfig?.novelai || {}
    const cfgWidth = normalizeGenDimension(naiCfg.width)
    const cfgHeight = normalizeGenDimension(naiCfg.height)
    const entryWidth = normalizeGenDimension(entry?.baseImage?.params?.width)
    const entryHeight = normalizeGenDimension(entry?.baseImage?.params?.height)
    const hasCfgSize = !!cfgWidth && !!cfgHeight
    const hasEntrySize = !!entryWidth && !!entryHeight
    const isLikelyDefaultSquare = cfgWidth === 1024 && cfgHeight === 1024
    const useEntrySize = hasEntrySize && (!hasCfgSize || isLikelyDefaultSquare)
    const fallbackWidth = 832
    const fallbackHeight = 1216

    const width = useEntrySize
      ? entryWidth
      : (cfgWidth || entryWidth || fallbackWidth)
    const height = useEntrySize
      ? entryHeight
      : (cfgHeight || entryHeight || fallbackHeight)

    const options = { width, height }

    if (provider === 'novelai') {
      const passthroughKeys = [
        'model',
        'sampler',
        'steps',
        'scale',
        'qualityToggle',
        'sm',
        'sm_dyn',
        'ucPreset',
        'cfg_rescale',
        'uncond_scale',
        'strength',
        'noise',
        'noise_schedule',
        'params_version'
      ]
      passthroughKeys.forEach(key => assignOptionIfSet(options, key, naiCfg[key]))
      assignOptionIfSet(options, 'negative_prompt', naiCfg.negative_prompt)
      if (isCharacter) {
        Object.assign(options, buildNovelAIReferenceOptionsForMessage(entry))
      }
    } else if (provider === 'nanobanana' && isCharacter) {
      // Auto-attach base sprite as reference image for character consistency
      const baseUrl = entry?.baseImage?.url
      if (baseUrl) {
        const base64 = extractBase64FromDataUrl(baseUrl)
        if (base64) {
          options.baseImage = base64
          options.strength = 0.55
        }
      }
    }

    const roleNegativePrompt = String(entry?.negativePrompt || '').trim()
    if (roleNegativePrompt) {
      // Keep provider/default negative prompt and append role-specific constraints.
      options.negativePromptAppend = roleNegativePrompt
    }
    return options
  }

  function extractBase64FromDataUrl(url) {
    const text = String(url || '').trim()
    if (!text) return ''
    if (!text.startsWith('data:')) return ''
    const idx = text.indexOf(',')
    if (idx === -1) return ''
    return text.slice(idx + 1).replace(/\s+/g, '')
  }

  async function processAssistantImageTokens(contact, previousMsgIds) {
    if (!store?.allowAIImageGeneration) return
    if (!contact || !Array.isArray(contact.msgs) || contact.msgs.length === 0) return

    const newAssistantMessages = contact.msgs.filter(msg => {
      if (!msg || msg.role !== 'assistant') return false
      if (msg.isImage || msg.hidden || msg.hideInChat) return false
      if (previousMsgIds && previousMsgIds.has(msg.id)) return false
      return true
    })

    for (const msg of newAssistantMessages) {
      const sourceText = String(msg.content || msg.displayContent || '')
      if (!sourceText) continue

      const tagsList = extractImageTokenTags(sourceText)
      if (tagsList.length === 0) continue

      const cleanedText = stripImageTokensFromText(sourceText)
      if (cleanedText) {
        msg.content = cleanedText
        if (msg.displayContent != null) msg.displayContent = cleanedText
        msg.hideInChat = false
      } else {
        msg.hideInChat = true
      }

      let successCount = 0
      let failCount = 0
      let queuedCount = 0
      let firstError = null

      for (const rawTags of tagsList) {
        const { type: imageType, tags: sceneTags } = parseImageTokenPayload(rawTags)
        const prompt = buildImagePromptForMessage(msg, sceneTags, imageType)
        if (!prompt) {
          failCount += 1
          if (!firstError) firstError = new Error('图片提示词为空，已跳过本次生图')
          continue
        }

        const renderingMsg = {
          id: makeId('msg'),
          role: 'assistant',
          senderId: msg.senderId || null,
          senderName: msg.senderName || null,
          content: '正在渲染图片…',
          time: Date.now(),
          isImageRendering: true,
          skipForAIContext: true
        }
        contact.msgs.push(renderingMsg)
        queuedCount += 1
        // Use the reactive array item for subsequent updates; mutating the raw object
        // may skip Vue change notification in some cases.
        const renderingMsgRef = contact.msgs[contact.msgs.length - 1] || renderingMsg
        scrollToBottom?.()

        try {
          const imageUrl = await finalizeGeneratedImageUrl(await generateImage(prompt, {
            ...getImageGenOptionsForMessage(msg, imageType),
            timeoutMs: CHAT_IMAGE_RENDER_TIMEOUT_MS
          }))
          renderingMsgRef.isImageRendering = false
          renderingMsgRef.content = '[图片]'
          renderingMsgRef.isImage = true
          renderingMsgRef.imageUrl = imageUrl
          renderingMsgRef.generatedByAIImage = true
          renderingMsgRef.imageSource = 'ai-generated'
          albumStore?.addPhoto?.({ url: imageUrl, contactId: contact.id, contactName: contact.name, contactAvatar: contact.avatar || null, source: 'ai', prompt })
          successCount += 1
        } catch (e) {
          if (!firstError) firstError = e
          console.error('[chat-image] render failed', {
            contactId: contact?.id || null,
            prompt,
            error: e
          })
          renderingMsgRef.isImageRendering = false
          renderingMsgRef.content = `🖼️ 图片渲染失败：${String(e?.message || '未知错误')}`
          failCount += 1
        } finally {
          scrollToBottom?.()
        }
      }

      if (!cleanedText) {
        const idx = contact.msgs.findIndex(x => x?.id === msg.id)
        if (idx !== -1 && (successCount > 0 || failCount > 0 || queuedCount > 0)) {
          contact.msgs.splice(idx, 1)
        } else if (idx !== -1) {
          msg.hideInChat = false
        }
      }

      if (firstError) {
        showToast?.(firstError?.message ? ('图片渲染失败：' + firstError.message) : '图片渲染失败')
      }
    }
  }

  return { processAssistantImageTokens }
}
