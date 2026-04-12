import { computed, ref } from 'vue'
import { useSoundEffects } from '../../../composables/useSoundEffects'

export function useChatMessageActions({
  albumStore,
  callAPI,
  callGroupAPI,
  checkAssistantCallInvite,
  cleanupOfflineLinksForRemovedMessages,
  closePlusMenu,
  contextMenuContent,
  contextMenuMsgId,
  contextMenuPartIndex,
  hideContextMenu,
  invalidateRoundVectors,
  isGroupChat,
  makeId,
  onAcceptedMeet,
  onAssistantReplied,
  onMessageSent,
  parseMessageContent,
  processAssistantFavoriteTokens,
  processAssistantPlannerActions,
  processAssistantImageTokens,
  rebuildMessageContent,
  scheduleSave,
  scrollToBottom,
  showConfirm,
  showToast,
  store
}) {
  const inputText = ref('')
  const editingPartIndex = ref(null)
  const soundEffects = useSoundEffects()

  const editPreview = computed(() => {
    if (!store.editingMsgId || !store.activeChat) return ''
    // 如果有 partIndex，显示当前气泡的内容而不是整条消息
    if (editingPartIndex.value !== null) {
      return inputText.value || ''
    }
    const msg = store.activeChat.msgs.find(m => m.id === store.editingMsgId)
    return msg?.content || ''
  })

  function cancelReply() {
    store.replyingToId = null
    store.replyingToText = null
  }

  function cancelEdit() {
    store.editingMsgId = null
    editingPartIndex.value = null
    inputText.value = ''
  }

  async function requestAssistantReply() {
    if (!store.activeChat) return
    const contact = store.activeChat
    const previousMsgIds = new Set((contact.msgs || []).map(msg => msg?.id))
    let result = null
    if (isGroupChat.value) {
      if (store.activeChat.groupMode === 'multi' && !store.selectedMemberId) {
        showToast('请先选择发言成员')
        return
      }
      result = await callGroupAPI(() => scrollToBottom())
    } else {
      result = await callAPI(() => scrollToBottom())
    }

    if (result && result.success === false && result.error) {
      showToast(result.error)
    }

    if (!result || result.success !== false) {
      await processAssistantFavoriteTokens?.(contact, result?.message)
      await processAssistantPlannerActions?.(contact, previousMsgIds)
      await processAssistantImageTokens(contact, previousMsgIds)
    }

    // 统一检测来电邀请（从消息队列中检测，不依赖 result.message）
    await checkAssistantCallInvite(contact)

    scheduleSave()
    if (result?.acceptedMeet && typeof onAcceptedMeet === 'function') {
      onAcceptedMeet(contact)
    }

    // AI 自主触发记忆/自动总结（后台执行，不阻塞 UI）
    void onAssistantReplied(contact, scheduleSave).then((res) => {
      const added = res?.autoMemories?.added?.length || 0
      const notify = contact?.memorySettings?.aiAutoMemoryNotify !== false
      if (!notify) return

      if (added === 1) {
        const mem = res.autoMemories.added[0]
        if (mem?.content) {
          const preview = mem.content.slice(0, 20) + (mem.content.length > 20 ? '...' : '')
          showToast('AI 建议记忆: ' + preview)
        }
        return
      }
      if (added > 1) {
        showToast(`AI 建议了 ${added} 条待整理记忆`)
        return
      }
    }).catch(() => {
      // silent
    })
  }

  function scheduleSaveForInputFlow() {
    const keyboardOpen = typeof document !== 'undefined' &&
      document.documentElement.classList.contains('keyboard-open')
    if (keyboardOpen) {
      window.setTimeout(() => {
        scheduleSave()
      }, 220)
      return
    }
    scheduleSave()
  }

  async function sendMessage() {
    const txt = inputText.value.trim()
    closePlusMenu()
    if (!store.activeChat) return

    if (store.editingMsgId) {
      if (!txt) return
      const msg = store.activeChat.msgs.find(m => m.id === store.editingMsgId)
      if (msg) {
        if (editingPartIndex.value !== null && editingPartIndex.value !== undefined) {
          const baseContent = msg.displayContent != null ? msg.displayContent : msg.content
          const parts = parseMessageContent(String(baseContent ?? ''), true)
          if (editingPartIndex.value < parts.length) {
            const part = parts[editingPartIndex.value]
            if (part.type === 'narration') {
              part.content = txt
            } else if (part.type === 'sticker') {
              const stickerMatch = txt.match(/^(?:\(|（|\[|【)\s*(?:stickers?|sticker|表情包|贴纸)\s*[:：]\s*([^\)\]）】]+?)\s*(?:\)|）|\]|】)$/i)
              if (stickerMatch) {
                part.name = stickerMatch[1].trim()
              } else {
                part.type = 'normal'
                part.content = txt
                delete part.name
              }
            } else if (part.type === 'mockImage') {
              const mockMatch = txt.match(/^(?:\(|（|\[|【)\s*(?:camera|相机|mockimage|mock|模拟图片)\s*[:：]\s*([^\)\]）】]+?)\s*(?:\)|）|\]|】)$/i)
              if (mockMatch) {
                part.text = mockMatch[1].trim()
              } else {
                part.text = txt
              }
            } else {
              part.content = txt
            }
            const newContent = rebuildMessageContent(parts)
            msg.content = newContent
            if (msg.displayContent != null) {
              msg.displayContent = newContent
            }
            delete msg.giftPartSnapshots
          } else {
            msg.content = txt
            if (msg.displayContent != null) {
              msg.displayContent = txt
            }
            delete msg.giftPartSnapshots
          }
        } else {
          msg.content = txt
          if (msg.isMockImage) {
            msg.mockImageText = txt
          }
          if (msg.displayContent != null) {
            msg.displayContent = txt
          }
          delete msg.giftPartSnapshots
        }
      }
      inputText.value = ''
      cancelEdit()
      invalidateRoundVectors?.(store.activeChat)
      scheduleSave()
      return
    }

    const hasImages = store.pendingImages.length > 0

    if (txt || hasImages) {
      inputText.value = ''

      if (hasImages) {
        const imgTime = Date.now()
        store.pendingImages.forEach((img) => {
          store.activeChat.msgs.push({
            id: makeId('msg'),
            role: 'user',
            content: '[图片]',
            time: imgTime,
            readStatus: 'unread',
            isImage: true,
            imageUrl: img
          })
          albumStore.addPhoto({
            url: img,
            contactId: store.activeChat.id,
            contactName: store.activeChat.name,
            contactAvatar: store.activeChat.avatar || null,
            source: 'chat'
          })
        })
        store.pendingImages = []
      }

      if (txt) {
        const newMsg = { id: makeId('msg'), role: 'user', content: txt, time: Date.now(), readStatus: 'unread' }
        if (store.replyingToId) {
          newMsg.replyTo = store.replyingToId
          newMsg.replyToText = store.replyingToText
          cancelReply()
        }
        store.activeChat.msgs.push(newMsg)
        store.ui.animateMsgId = newMsg.id

        // 记忆触发放到后台，避免与键盘动画抢主线程。
        void onMessageSent(store.activeChat, txt, scheduleSave).then((memResult) => {
          if (memResult?.type === 'keyword' && memResult.memory?.content) {
            const content = memResult.memory.content
            showToast('已记住: ' + content.slice(0, 20) + (content.length > 20 ? '...' : ''))
          }
        }).catch(() => {})
      }

      scheduleSaveForInputFlow()
      soundEffects.playEvent('messageSend')
    } else {
      // 空发送直接触发AI回复
      await requestAssistantReply()
    }
  }

  function handleReply() {
    store.replyingToId = contextMenuMsgId.value
    store.replyingToText = contextMenuContent.value
    hideContextMenu()
  }

  function handleCopy() {
    if (contextMenuContent.value) {
      navigator.clipboard.writeText(contextMenuContent.value).then(() => showToast('已复制'))
    }
    hideContextMenu()
  }

  function handleEdit() {
    store.editingMsgId = contextMenuMsgId.value
    editingPartIndex.value = contextMenuPartIndex.value
    inputText.value = contextMenuContent.value || ''
    hideContextMenu()
  }

  async function handleRegen() {
    const idx = store.activeChat.msgs.findIndex(m => m.id === contextMenuMsgId.value)
    if (idx !== -1) {
      store.activeChat.msgs = store.activeChat.msgs.slice(0, idx)
      invalidateRoundVectors?.(store.activeChat)
      scheduleSave()
      await requestAssistantReply()
    }
    hideContextMenu()
  }

  async function handleDelete() {
    const confirmed = await showConfirm({ message: '确定删除?', destructive: true })
    if (!confirmed) {
      hideContextMenu()
      return
    }
    const removed = store.activeChat.msgs.find(m => m.id === contextMenuMsgId.value)
    store.activeChat.msgs = store.activeChat.msgs.filter(m => m.id !== contextMenuMsgId.value)
    if (removed) cleanupOfflineLinksForRemovedMessages([removed])
    invalidateRoundVectors?.(store.activeChat)
    scheduleSave()
    hideContextMenu()
    showToast('已删除')
  }

  async function handleDeleteOfflineCard(block) {
    const msgId = String(block?.msgId || '').trim()
    if (!msgId || !store.activeChat?.msgs) return
    const confirmed = await showConfirm({
      message: '删除线下卡片，并取消对应注入总结？',
      destructive: true
    })
    if (!confirmed) return

    const removed = store.activeChat.msgs.find(m => m.id === msgId)
    if (!removed) return
    store.activeChat.msgs = store.activeChat.msgs.filter(m => m.id !== msgId)
    cleanupOfflineLinksForRemovedMessages([removed])
    invalidateRoundVectors?.(store.activeChat)
    scheduleSave()
    showToast('线下卡片已删除')
  }

  return {
    cancelEdit,
    cancelReply,
    editPreview,
    editingPartIndex,
    handleCopy,
    handleDelete,
    handleDeleteOfflineCard,
    handleEdit,
    handleRegen,
    handleReply,
    inputText,
    requestAssistantReply,
    sendMessage
  }
}
