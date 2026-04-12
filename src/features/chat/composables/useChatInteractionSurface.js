import { unref } from 'vue'
import { useContextMenu } from './useContextMenu'
import { useChatContextActions } from './useChatContextActions'
import { useChatMultiSelect } from './useChatMultiSelect'
import { useChatNarrationMenu } from './useChatNarrationMenu'

export function useChatInteractionSurface(options = {}) {
  const {
    store,
    blocks,
    parseMessageContent,
    rebuildMessageContent,
    onChatMutated,
    showConfirm,
    showToast,
    scheduleSave,
    onDeleteWholeMessages,
    toggleFavorite,
    favoriteSelectedBlocks,
    showCallHistoryModal
  } = options

  const {
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuMaxHeight,
    contextMenuAnchor,
    contextMenuBlockKey,
    contextMenuMsgId,
    contextMenuPartIndex,
    contextMenuIsUser,
    contextMenuContent,
    focusedBubble,
    showContextMenu: showContextMenuBase,
    hideContextMenu
  } = useContextMenu()

  const {
    multiSelectMode,
    selectedBlockKeys,
    enterMultiSelect,
    exitMultiSelect,
    toggleBlockSelection,
    getSelectedBlocks,
    deleteSelectedBlocks
  } = useChatMultiSelect({
    store,
    getBlocks: () => unref(blocks),
    parseMessageContent,
    rebuildMessageContent,
    onChatMutated,
    showConfirm,
    showToast,
    scheduleSave,
    onDeleteWholeMessages
  })

  const {
    handleAvatarToggleNarrations,
    handleCopyNarration,
    handleNarrationEnterMultiSelect,
    handleToggleNarrations,
    hideNarrationMenu,
    narrationMenuVisible,
    narrationMenuX,
    narrationMenuY,
    showNarrationMenu
  } = useChatNarrationMenu({
    enterMultiSelect,
    scheduleSave,
    showToast,
    store
  })

  const {
    showContextMenu,
    openCallHistoryFromBubble,
    handleEnterMultiSelect,
    contextMenuFavorited,
    handleFavorite,
    handleFavoriteSelectedBlocks
  } = useChatContextActions({
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
  })

  return {
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuMaxHeight,
    contextMenuAnchor,
    contextMenuBlockKey,
    contextMenuMsgId,
    contextMenuPartIndex,
    contextMenuIsUser,
    contextMenuContent,
    focusedBubble,
    hideContextMenu,
    multiSelectMode,
    selectedBlockKeys,
    exitMultiSelect,
    toggleBlockSelection,
    deleteSelectedBlocks,
    handleAvatarToggleNarrations,
    handleCopyNarration,
    handleNarrationEnterMultiSelect,
    handleToggleNarrations,
    hideNarrationMenu,
    narrationMenuVisible,
    narrationMenuX,
    narrationMenuY,
    showNarrationMenu,
    showContextMenu,
    openCallHistoryFromBubble,
    handleEnterMultiSelect,
    contextMenuFavorited,
    handleFavorite,
    handleFavoriteSelectedBlocks
  }
}
