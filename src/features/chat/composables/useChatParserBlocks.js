import { useMessageParser } from './useMessageParser'

export function useChatParserBlocks(options) {
  const {
    visibleMessages,
    store,
    isGroupChat,
    groupMembers,
    timestampGapMs
  } = options

  return useMessageParser({
    getMessages: () => visibleMessages.value,
    getStickerUrl: (name) => store.getStickerUrl ? store.getStickerUrl(name) : null,
    showTimestamps: () => store.showChatTimestamps,
    allowAIStickers: () => store.allowAIStickers,
    allowAITransfer: () => store.allowAITransfer,
    allowAIGift: () => store.allowAIGift,
    allowAIVoice: () => store.allowAIVoice,
    allowAICall: () => store.allowAICall,
    allowAIMockImage: () => store.allowAIMockImage,
    allowAIMusicRecommend: () => store.allowAIMusicRecommend,
    allowAIMeet: () => store.allowAIMeet,
    showToolLog: () => !!store.toolCallingConfig?.showToolLog,
    timestampGapMs,
    getAnimateMsgId: () => store.ui?.animateMsgId,
    isGroupChat: () => isGroupChat.value,
    getGroupMembers: () => groupMembers.value,
    showChatAvatars: () => store.showChatAvatars,
    showNarrations: () => store.showNarrations,
    getMockImagePlaceholder: () => store.theme.mockImagePlaceholder,
    getActiveContactId: () => String(store.activeChat?.id || '').trim(),
    getContactAvatar: () => store.activeChat
      ? { avatar: store.activeChat.avatar, avatarType: store.activeChat.avatarType }
      : null,
    getUserAvatar: () => {
      const personaId = store.activeChat?.personaId
      let persona = null
      if (personaId) {
        persona = store.personas.find(item => item.id === personaId)
      }
      if (!persona && store.defaultPersonaId) {
        persona = store.personas.find(item => item.id === store.defaultPersonaId)
      }
      if (persona) {
        return { avatar: persona.avatar, avatarType: persona.avatarType || 'emoji' }
      }
      return { avatar: '😊', avatarType: 'emoji' }
    }
  })
}
