import { useContactsStore } from '../../../stores/contacts'
import { useChatStore } from '../../../stores/chat'
import { useSettingsStore } from '../../../stores/settings'
import { usePersonasStore } from '../../../stores/personas'
import { useStickersStore } from '../../../stores/stickers'
import { useVNStore } from '../../../stores/vn'
import { defineAliasedProxyMap, defineProxyMap } from '../../../utils/objectProxy'

export const CHAT_TIMESTAMP_GAP_MS = 30 * 60 * 1000

const SETTINGS_PROXY_FIELDS = [
  'showChatAvatars',
  'showChatTimestamps',
  'allowAIStickers',
  'showNarrations',
  'showTokenCapsule',
  'allowAIFavorite',
  'allowAITransfer',
  'allowAIGift',
  'allowAIVoice',
  'allowAICall',
  'allowAIMockImage',
  'allowAIMusicRecommend',
  'allowAIMeet',
  'allowAIImageGeneration',
  'allowPlannerAI',
  'allowAIPlannerCapture',
  'toolCallingConfig',
  'theme'
]

export function useChatViewStore() {
  const contactsStore = useContactsStore()
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()
  const personasStore = usePersonasStore()
  const stickersStore = useStickersStore()
  const vnStore = useVNStore()
  const store = {}

  defineProxyMap(store, contactsStore, ['contacts', 'activeChat', 'selectedMemberId'])
  defineProxyMap(store, chatStore, ['replyingToId', 'replyingToText', 'editingMsgId', 'pendingImages'])
  defineProxyMap(store, settingsStore, SETTINGS_PROXY_FIELDS)
  defineProxyMap(store, personasStore, ['personas', 'defaultPersonaId'])
  defineProxyMap(store, stickersStore, ['showStickerPanel', 'showStickerManager', 'stickers', 'stickerGroups'])
  defineAliasedProxyMap(store, vnStore, { vnImageGenConfig: 'imageGenConfig' })

  store.ui = chatStore.ui
  store.getStickerUrl = stickersStore.getStickerUrl

  return store
}
