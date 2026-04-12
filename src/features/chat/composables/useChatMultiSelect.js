import { ref } from 'vue'

export function useChatMultiSelect({
  store,
  getBlocks,
  parseMessageContent,
  rebuildMessageContent,
  onChatMutated,
  showConfirm,
  showToast,
  scheduleSave,
  onDeleteWholeMessages
}) {
  const multiSelectMode = ref(false)
  const selectedBlockKeys = ref(new Set())

  function enterMultiSelect(initialBlockKey) {
    multiSelectMode.value = true
    const key = String(initialBlockKey || '')
    selectedBlockKeys.value = key ? new Set([key]) : new Set()
  }

  function exitMultiSelect() {
    multiSelectMode.value = false
    selectedBlockKeys.value = new Set()
  }

  function toggleBlockSelection(blockKey) {
    const key = String(blockKey || '')
    const next = new Set(selectedBlockKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedBlockKeys.value = next
  }

  function getSelectedBlocks() {
    const blocks = (typeof getBlocks === 'function' ? getBlocks() : []) || []
    if (selectedBlockKeys.value.size === 0) return []
    return blocks.filter(block => selectedBlockKeys.value.has(block.key))
  }

  async function deleteSelectedBlocks() {
    if (selectedBlockKeys.value.size === 0) return

    const targetBlocks = getSelectedBlocks()
    if (targetBlocks.length === 0) {
      exitMultiSelect()
      return
    }

    const chat = store.activeChat
    if (!chat || !Array.isArray(chat.msgs)) {
      exitMultiSelect()
      return
    }

    const deletePlan = new Map()
    for (const block of targetBlocks) {
      if (!block.msgId) continue

      const existing = deletePlan.get(block.msgId) || { deleteWhole: false, partIndexes: new Set() }
      if (
        block.type === 'image' ||
        block.type === 'stickerMessage' ||
        (block.type === 'mockImage' && (block.partIndex === null || block.partIndex === undefined))
      ) {
        existing.deleteWhole = true
      } else if (block.partIndex !== null && block.partIndex !== undefined) {
        existing.partIndexes.add(block.partIndex)
      } else {
        existing.deleteWhole = true
      }
      deletePlan.set(block.msgId, existing)
    }

    if (deletePlan.size === 0) {
      exitMultiSelect()
      return
    }

    const affectedMsgIds = new Set(deletePlan.keys())
    const confirmed = await showConfirm({
      message: `确定删除 ${selectedBlockKeys.value.size} 条气泡（涉及 ${affectedMsgIds.size} 条消息）?`,
      destructive: true
    })
    if (!confirmed) return

    const updatedMsgs = []
    const removedWholeMessages = []
    for (const msg of chat.msgs) {
      const plan = deletePlan.get(msg.id)
      if (!plan) {
        updatedMsgs.push(msg)
        continue
      }

      if (plan.deleteWhole) {
        removedWholeMessages.push(msg)
        continue
      }

      const allowParts = {
        allowStickers: msg.role === 'user' || store.allowAIStickers,
        allowTransfer: msg.role === 'user' || store.allowAITransfer,
        allowGift: msg.role === 'user' || store.allowAIGift,
        allowVoice: msg.role === 'user' || store.allowAIVoice,
        allowCall: msg.role === 'user' || store.allowAICall,
        allowMockImage: msg.role === 'user' || store.allowAIMockImage
      }

      const baseContent = msg.displayContent != null ? msg.displayContent : msg.content
      const parts = parseMessageContent(String(baseContent ?? ''), allowParts)
      const remainingParts = parts.filter((_, idx) => !plan.partIndexes.has(idx))

      if (remainingParts.length === 0) {
        removedWholeMessages.push(msg)
        continue
      }

      const newContent = rebuildMessageContent(remainingParts)
      const updated = { ...msg, content: newContent }
      if (msg.displayContent != null) updated.displayContent = newContent
      updatedMsgs.push(updated)
    }

    chat.msgs = updatedMsgs
    if (typeof onDeleteWholeMessages === 'function' && removedWholeMessages.length > 0) {
      onDeleteWholeMessages(removedWholeMessages, chat)
    }
    if (typeof onChatMutated === 'function') {
      onChatMutated(chat)
    }
    scheduleSave()
    showToast(`已删除 ${selectedBlockKeys.value.size} 条气泡`)
    exitMultiSelect()
  }

  return {
    multiSelectMode,
    selectedBlockKeys,
    enterMultiSelect,
    exitMultiSelect,
    toggleBlockSelection,
    getSelectedBlocks,
    deleteSelectedBlocks
  }
}
