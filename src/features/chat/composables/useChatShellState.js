import { computed, ref, watch } from 'vue'
import { refreshContactMessageSummary } from '../../../utils/contactMessageSummary'

export function useChatShellState({
  route,
  store,
  persistScheduleSave
}) {
  const isGroupChat = computed(() => store.activeChat?.type === 'group')
  const groupMembers = computed(() => store.activeChat?.members || [])

  const showWatermark = computed(() => store.theme.showWatermark !== false)
  const watermarkText = computed(() => {
    const style = store.theme.layoutStyle || 'imessage'
    if (style === 'qq') return 'QQ'
    if (style === 'line') return 'LINE'
    return 'iMessage'
  })

  const chatBackgroundStyle = computed(() => {
    if (store.activeChat?.chatBackground) {
      return { backgroundImage: `url(${store.activeChat.chatBackground})` }
    }
    return {}
  })

  const isLeavingToMessages = ref(false)

  function syncActiveChatSummary(options = {}) {
    if (!store.activeChat) return null
    return refreshContactMessageSummary(store.activeChat, options)
  }

  function scheduleSave(options = {}) {
    syncActiveChatSummary()
    persistScheduleSave(options)
  }

  function syncActiveChatFromRoute() {
    const rawContactId = route.params.contactId
    const contactId = rawContactId == null ? '' : String(rawContactId).trim()
    if (!contactId) return

    const contact = store.contacts.find(c => String(c.id) === contactId)
    if (!contact) return

    if (store.activeChat?.id !== contact.id) {
      store.activeChat = contact
    }
    contact.unreadCount = 0
  }

  function hideTokenCapsule() {
    store.showTokenCapsule = false
    scheduleSave()
  }

  watch(() => route.params.contactId, () => {
    isLeavingToMessages.value = false
    syncActiveChatFromRoute()
  }, { immediate: true })

  return {
    chatBackgroundStyle,
    groupMembers,
    hideTokenCapsule,
    isGroupChat,
    isLeavingToMessages,
    scheduleSave,
    showWatermark,
    syncActiveChatSummary,
    syncActiveChatFromRoute,
    watermarkText
  }
}
