import { useContactsStore } from '../../stores/contacts'
import { useLorebookStore } from '../../stores/lorebook'
import { usePersonasStore } from '../../stores/personas'
import { useSettingsStore } from '../../stores/settings'
import { useStickersStore } from '../../stores/stickers'
import { useVNStore } from '../../stores/vn'

export function createPromptContext({
  contactsStore,
  lorebookStore,
  personasStore,
  settingsStore,
  stickersStore,
  vnStore
}) {
  return {
    get activeChat() {
      return contactsStore.activeChat
    },
    get contacts() {
      return contactsStore.contacts
    },
    get lorebook() {
      return lorebookStore.lorebook
    },
    get stickers() {
      return stickersStore.stickers
    },
    get stickerGroups() {
      return stickersStore.stickerGroups
    },
    get allowAIStickers() {
      return settingsStore.allowAIStickers
    },
    get allowAIImageGeneration() {
      return settingsStore.allowAIImageGeneration
    },
    get allowAIMockImage() {
      return settingsStore.allowAIMockImage
    },
    get allowAICall() {
      return settingsStore.allowAICall
    },
    get allowAITransfer() {
      return settingsStore.allowAITransfer
    },
    get allowAIFavorite() {
      return settingsStore.allowAIFavorite
    },
    get allowAIGift() {
      return settingsStore.allowAIGift
    },
    get allowAIMeet() {
      return settingsStore.allowAIMeet
    },
    get allowAIVoice() {
      return settingsStore.allowAIVoice
    },
    get allowAIEmotionTag() {
      return settingsStore.allowAIEmotionTag
    },
    get allowAIMusicRecommend() {
      return settingsStore.allowAIMusicRecommend
    },
    get globalPresetLorebookEnabled() {
      return settingsStore.globalPresetLorebookEnabled
    },
    get vnImageGenConfig() {
      return vnStore.imageGenConfig
    },
    getPersonaForContact(contactId) {
      return personasStore.getPersonaForContact(contactId)
    }
  }
}

export function usePromptContext() {
  return createPromptContext({
    contactsStore: useContactsStore(),
    lorebookStore: useLorebookStore(),
    personasStore: usePersonasStore(),
    settingsStore: useSettingsStore(),
    stickersStore: useStickersStore(),
    vnStore: useVNStore()
  })
}
