import { computed } from 'vue'
import { isMessagePartFavorited } from '../../../utils/messageFavorites'

export function useChatContextActions({
  store,
  multiSelectMode,
  showContextMenuBase,
  contextMenuBlockKey,
  contextMenuMsgId,
  contextMenuPartIndex,
  hideContextMenu,
  showCallHistoryModal,
  enterMultiSelect,
  toggleFavorite,
  favoriteSelectedBlocks,
  getSelectedBlocks,
  exitMultiSelect
}) {
  function showContextMenu(event, block) {
    if (multiSelectMode.value) return
    showContextMenuBase(event, block)
  }

  function openCallHistoryFromBubble() {
    if (multiSelectMode.value) return
    showCallHistoryModal.value = true
  }

  function handleEnterMultiSelect() {
    enterMultiSelect(contextMenuBlockKey.value)
    hideContextMenu()
  }

  const contextMenuFavorited = computed(() => {
    const msgId = contextMenuMsgId.value
    if (!msgId) return false
    const msgs = store.activeChat?.msgs
    if (!Array.isArray(msgs)) return false
    const msg = msgs.find(m => m.id === msgId)
    return isMessagePartFavorited(msg, contextMenuPartIndex.value)
  })

  function handleFavorite() {
    const msgId = contextMenuMsgId.value
    if (msgId) toggleFavorite(msgId, contextMenuPartIndex.value)
    hideContextMenu()
  }

  function handleFavoriteSelectedBlocks() {
    const targetBlocks = getSelectedBlocks()
    if (favoriteSelectedBlocks(targetBlocks)) {
      exitMultiSelect()
    }
  }

  return {
    showContextMenu,
    openCallHistoryFromBubble,
    handleEnterMultiSelect,
    contextMenuFavorited,
    handleFavorite,
    handleFavoriteSelectedBlocks
  }
}
