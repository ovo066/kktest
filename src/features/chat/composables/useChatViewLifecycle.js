import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { favoritePartIndexToKey } from '../../../utils/messageFavorites'

export function useChatViewLifecycle(options) {
  const {
    route,
    store,
    messageListRef,
    messageWindowLimit,
    initialMessageWindow,
    jumpToMessage,
    contextMenuVisible,
    hideContextMenu,
    narrationMenuVisible,
    hideNarrationMenu
  } = options

  let scrollScheduled = false
  let scrollRafId = 0
  const handledRouteJumpKey = ref('')

  function syncActiveChatFromRoute() {
    const contactId = String(route.params.contactId ?? '').trim()
    if (!contactId) return null

    const contact = store.contacts.find(item => String(item?.id ?? '') === contactId) || null
    if (contact && store.activeChat?.id !== contact.id) {
      store.activeChat = contact
    }
    return contact
  }

  function scrollToBottom() {
    if (scrollScheduled) return
    scrollScheduled = true
    nextTick(() => {
      scrollScheduled = false
      if (scrollRafId) cancelAnimationFrame(scrollRafId)
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = 0
        messageListRef.value?.scrollToBottom?.()
      })
    })
  }

  function handleDocumentClick() {
    if (contextMenuVisible.value) {
      hideContextMenu()
    }
    if (narrationMenuVisible.value) {
      hideNarrationMenu()
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
  })

  watch(() => route.params.contactId, () => {
    syncActiveChatFromRoute()
  }, { immediate: true })

  watch(() => store.activeChat?.id, () => {
    messageWindowLimit.value = initialMessageWindow
  }, { immediate: true })

  watch(() => [store.activeChat?.id, store.activeChat?.msgs?.length || 0], () => {
    scrollToBottom()
  }, { immediate: true, flush: 'post' })

  watch(
    () => [route.params.contactId, route.query.jumpToMsg, route.query.jumpToPart, store.activeChat?.msgs?.length || 0],
    async ([routeContactId, jumpTarget, jumpPart]) => {
      const contact = syncActiveChatFromRoute()
      const contactId = String(routeContactId ?? '').trim()
      const msgId = String(jumpTarget ?? '').trim()
      const partKey = favoritePartIndexToKey(jumpPart)

      if (!contact || !contactId || !msgId) return
      if (String(contact.id) !== contactId) return

      const msgs = contact.msgs
      if (!Array.isArray(msgs) || !msgs.some(item => String(item?.id ?? '') === msgId)) return

      const jumpKey = `${contactId}:${msgId}:${partKey}`
      if (handledRouteJumpKey.value === jumpKey) return

      handledRouteJumpKey.value = jumpKey
      await jumpToMessage(msgId, partKey)
    },
    { immediate: true, flush: 'post' }
  )

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
    if (scrollRafId) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = 0
    }
  })

  return {
    scrollToBottom
  }
}
