import { describe, expect, it } from 'vitest'
import { createPromptContext } from './promptContext'

describe('createPromptContext', () => {
  it('maps prompt-related stores into a narrow context object', () => {
    const contactsStore = {
      activeChat: { id: 'c1', name: '?????' },
      contacts: [{ id: 'c1', name: '?????' }]
    }
    const lorebookStore = {
      lorebook: { books: [{ id: 'book1', name: '???' }] }
    }
    const personasStore = {
      getPersonaForContact(contactId) {
        return contactId === 'c1' ? { id: 'p1', name: '??' } : null
      }
    }
    const settingsStore = {
      allowAIStickers: true,
      allowAIImageGeneration: true,
      allowAIMockImage: false,
      allowAICall: true,
      allowAITransfer: false,
      allowAIGift: true,
      allowAIVoice: true,
      allowAIEmotionTag: true,
      allowAIMusicRecommend: false,
      globalPresetLorebookEnabled: true
    }
    const stickersStore = {
      stickers: [{ id: 's1', name: 'smile' }],
      stickerGroups: [{ id: 'g1', name: '??' }]
    }
    const vnStore = {
      imageGenConfig: { provider: 'nanobanana' }
    }

    const context = createPromptContext({
      contactsStore,
      lorebookStore,
      personasStore,
      settingsStore,
      stickersStore,
      vnStore
    })

    expect(context.activeChat).toBe(contactsStore.activeChat)
    expect(context.contacts).toBe(contactsStore.contacts)
    expect(context.lorebook).toBe(lorebookStore.lorebook)
    expect(context.stickers).toBe(stickersStore.stickers)
    expect(context.stickerGroups).toBe(stickersStore.stickerGroups)
    expect(context.allowAIStickers).toBe(true)
    expect(context.allowAIImageGeneration).toBe(true)
    expect(context.globalPresetLorebookEnabled).toBe(true)
    expect(context.vnImageGenConfig).toBe(vnStore.imageGenConfig)
    expect(context.getPersonaForContact('c1')).toEqual({ id: 'p1', name: '??' })
  })
})
