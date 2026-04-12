import { computed, ref } from 'vue'

export function useChatTimelineShell(options = {}) {
  const {
    router,
    store,
    isGroupChat,
    isLeavingToMessages,
    syncActiveChatSummary,
    showCallHistoryModal,
    initialMessageWindow = 100,
    messageWindowStep = 80
  } = options

  const messageWindowLimit = ref(initialMessageWindow)

  const visibleMessages = computed(() => {
    const messages = store.activeChat?.msgs || []
    if (messages.length <= messageWindowLimit.value) return messages
    return messages.slice(-messageWindowLimit.value)
  })

  const hasOlderMessages = computed(() => {
    const total = store.activeChat?.msgs?.length || 0
    return total > visibleMessages.value.length
  })

  const searchOverlayTop = computed(() => `calc(var(--app-pt) + ${isGroupChat.value ? 78 : 64}px)`)

  const callHistoryRecords = computed(() => {
    const list = store.activeChat?.callHistory
    return Array.isArray(list) ? list : []
  })

  function loadOlderMessages() {
    const total = store.activeChat?.msgs?.length || 0
    if (messageWindowLimit.value >= total) return
    messageWindowLimit.value = Math.min(total, messageWindowLimit.value + messageWindowStep)
  }

  function goBack() {
    if (isLeavingToMessages.value) return
    showCallHistoryModal.value = false
    syncActiveChatSummary()
    isLeavingToMessages.value = true
    requestAnimationFrame(() => {
      router.push('/messages')
    })
    setTimeout(() => {
      store.activeChat = null
    }, 400)
  }

  return {
    messageWindowLimit,
    visibleMessages,
    hasOlderMessages,
    searchOverlayTop,
    callHistoryRecords,
    loadOlderMessages,
    goBack
  }
}
