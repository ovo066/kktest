import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { useChatImageTokens } from './useChatImageTokens'

const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+R6kAAAAASUVORK5CYII='
const SAMPLE_IMAGE_DATA_URL = `data:image/png;base64,${SAMPLE_PNG_BASE64}`

const OriginalImage = globalThis.Image

function base64ToBytes(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'))
}

beforeAll(() => {
  vi.stubGlobal('Image', class MockImage {
    set src(value) {
      queueMicrotask(() => {
        if (/^(?:data:image\/|blob:|https?:\/\/)/i.test(String(value || ''))) {
          this.onload?.()
        } else {
          this.onerror?.(new Event('error'))
        }
      })
    }
  })
})

afterAll(() => {
  if (OriginalImage) {
    vi.stubGlobal('Image', OriginalImage)
  } else {
    vi.unstubAllGlobals()
  }
})

function createHarness(options = {}) {
  const calls = []
  let idSeq = 0
  const provider = options.provider || 'novelai'
  const imageResult = options.imageResult || SAMPLE_IMAGE_DATA_URL

  const store = {
    allowAIImageGeneration: true,
    vnImageGenConfig: {
      provider,
      novelai: {
        width: 1024,
        height: 1024,
        model: 'nai-diffusion-4-5-full'
      },
      nanobanana: {
        model: 'gemini-2.5-flash-image-preview'
      }
    },
    activeChat: { id: 'c1' }
  }

  const entry = {
    artistTags: 'artist:test_artist',
    basePrompt: 'silver_hair, blue_eyes, school_uniform',
    negativePrompt: 'bad_hands, extra_fingers',
    baseImage: {
      url: 'data:image/png;base64,ZmFrZV9iYXNl',
      params: {
        width: 832,
        height: 1216
      }
    },
    generationPrefs: {
      keepArtistTagsOnNonCharacterImage: false,
      characterRefEnabled: true,
      characterRefImage: 'data:image/png;base64,ZmFrZV9yZWY=',
      characterRefStrength: 0.65,
      characterRefFidelity: 0.5,
      characterRefMode: 'character_style',
      vibeReferences: []
    }
  }
  const resolvedEntry = {
    ...entry,
    ...(options.entry || {})
  }

  const chatImageTokens = useChatImageTokens({
    store,
    charResStore: {
      getEntry(contactId) {
        return contactId === 'c1' ? resolvedEntry : null
      }
    },
    albumStore: {
      addPhoto() {}
    },
    generateImage: async (prompt, genOptions) => {
      calls.push({ prompt, options: genOptions })
      if (typeof options.generateImage === 'function') {
        return await options.generateImage(prompt, genOptions)
      }
      return imageResult
    },
    makeId(prefix) {
      idSeq += 1
      return `${prefix}_${idSeq}`
    },
    showToast() {},
    scrollToBottom() {}
  })

  return {
    calls,
    processAssistantImageTokens: chatImageTokens.processAssistantImageTokens,
    imageResult
  }
}

describe('useChatImageTokens', () => {
  it('keeps non-character images fully isolated from character prompt/options', async () => {
    const { calls, processAssistantImageTokens } = createHarness()
    const contact = {
      id: 'c1',
      name: 'Alice',
      msgs: [
        {
          id: 'msg_1',
          role: 'assistant',
          senderId: 'c1',
          senderName: 'Alice',
          content: '(image:type=scene, sunset, beach, no_people)'
        }
      ]
    }

    await processAssistantImageTokens(contact, new Set())

    expect(calls).toHaveLength(1)
    expect(calls[0].prompt).toBe('sunset, beach, no_people, masterpiece, best_quality, highres')
    expect(calls[0].prompt).not.toContain('silver_hair')
    expect(calls[0].prompt).not.toContain('artist:test_artist')
    expect(calls[0].options.width).toBe(832)
    expect(calls[0].options.height).toBe(1216)
    expect(calls[0].options.negativePromptAppend).toBe('bad_hands, extra_fingers')
    expect(calls[0].options.directorReferenceImages).toBeUndefined()
    expect(calls[0].options.baseImage).toBeUndefined()
  })

  it('still applies character prompt and references for default character images', async () => {
    const { calls, processAssistantImageTokens } = createHarness()
    const contact = {
      id: 'c1',
      name: 'Alice',
      msgs: [
        {
          id: 'msg_2',
          role: 'assistant',
          senderId: 'c1',
          senderName: 'Alice',
          content: '(image:smile, cafe)'
        }
      ]
    }

    await processAssistantImageTokens(contact, new Set())

    expect(calls).toHaveLength(1)
    expect(calls[0].prompt).toContain('artist:test_artist')
    expect(calls[0].prompt).toContain('silver_hair')
    expect(calls[0].options.width).toBe(832)
    expect(calls[0].options.height).toBe(1216)
    expect(calls[0].options.negativePromptAppend).toBe('bad_hands, extra_fingers')
    expect(calls[0].options.directorReferenceImages).toEqual(['ZmFrZV9yZWY='])
  })

  it('uses fallback prompt for nanobanana scene token without tags to avoid empty reply', async () => {
    const { calls, processAssistantImageTokens } = createHarness({
      provider: 'nanobanana',
      entry: {
        basePrompt: '',
        artistTags: '',
        negativePrompt: ''
      }
    })
    const contact = {
      id: 'c1',
      name: 'Alice',
      msgs: [
        {
          id: 'msg_3',
          role: 'assistant',
          senderId: 'c1',
          senderName: 'Alice',
          content: '(image:type=scene)'
        }
      ]
    }

    await processAssistantImageTokens(contact, new Set())

    expect(calls).toHaveLength(1)
    expect(calls[0].prompt).toBe('cinematic scene, atmospheric lighting, detailed composition')
    expect(contact.msgs.some(msg => msg.id === 'msg_3')).toBe(false)
    expect(contact.msgs.some(msg => msg.isImage && typeof msg.imageUrl === 'string')).toBe(true)
  })

  it('normalizes raw base64 image results before inserting image messages', async () => {
    const { processAssistantImageTokens } = createHarness({
      imageResult: SAMPLE_PNG_BASE64
    })
    const contact = {
      id: 'c1',
      name: 'Alice',
      msgs: [
        {
          id: 'msg_4',
          role: 'assistant',
          senderId: 'c1',
          senderName: 'Alice',
          content: '(image:smile)'
        }
      ]
    }

    await processAssistantImageTokens(contact, new Set())

    const imageMsg = contact.msgs.find(msg => msg.isImage)
    expect(imageMsg?.imageUrl).toBe(SAMPLE_IMAGE_DATA_URL)
  })

  it('normalizes Blob image results before inserting image messages', async () => {
    const { processAssistantImageTokens } = createHarness({
      imageResult: new Blob([base64ToBytes(SAMPLE_PNG_BASE64)], { type: 'image/png' })
    })
    const contact = {
      id: 'c1',
      name: 'Alice',
      msgs: [
        {
          id: 'msg_4_blob',
          role: 'assistant',
          senderId: 'c1',
          senderName: 'Alice',
          content: '(image:smile)'
        }
      ]
    }

    await processAssistantImageTokens(contact, new Set())

    const imageMsg = contact.msgs.find(msg => msg.isImage)
    expect(imageMsg?.imageUrl).toBe(SAMPLE_IMAGE_DATA_URL)
  })

  it('shows a failure bubble when generation returns a non-image payload', async () => {
    const { processAssistantImageTokens } = createHarness({
      imageResult: '{"ok":true}'
    })
    const contact = {
      id: 'c1',
      name: 'Alice',
      msgs: [
        {
          id: 'msg_5',
          role: 'assistant',
          senderId: 'c1',
          senderName: 'Alice',
          content: '(image:smile)'
        }
      ]
    }

    await processAssistantImageTokens(contact, new Set())

    expect(contact.msgs.some(msg => msg.isImage)).toBe(false)
    expect(contact.msgs.some(msg => String(msg.content || '').includes('图片渲染失败'))).toBe(true)
  })
})
