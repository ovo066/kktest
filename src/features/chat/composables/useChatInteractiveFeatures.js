import { ref } from 'vue'
import { useSoundEffects } from '../../../composables/useSoundEffects'
import { createGiftSnapshot } from '../../../data/gifts'
import {
  formatGiftToken,
  formatMeetToken
} from './messageParser/contentParts'
import {
  activateAcceptedMeetScene,
  buildHiddenInteractionEvent,
  ensureInteractiveMessagePending,
  setInteractionState
} from './interactiveMessages'

export function useChatInteractiveFeatures({
  closePlusMenu,
  makeId,
  resolveMockImagePlaceholder,
  router,
  scheduleSave,
  store
}) {
  const showTransferModal = ref(false)
  const showGiftPanel = ref(false)
  const showVoiceModal = ref(false)
  const showMockImageModal = ref(false)
  const showMeetModal = ref(false)
  const showTransferDetail = ref(false)
  const transferDetailBlock = ref(null)
  const soundEffects = useSoundEffects()

  function openTransferModal() {
    closePlusMenu()
    showTransferModal.value = true
  }

  function openGiftPanel() {
    closePlusMenu()
    showGiftPanel.value = true
  }

  function openVoiceModal() {
    closePlusMenu()
    showVoiceModal.value = true
  }

  function openMeetModal() {
    closePlusMenu()
    showMeetModal.value = true
  }

  function openMockCameraModal() {
    closePlusMenu()
    showMockImageModal.value = true
  }

  // ─── Helpers ─────────────────────────────────────

  function findMsgById(msgId) {
    if (!store.activeChat) return null
    return store.activeChat.msgs.find(m => m.id === msgId) || null
  }

  function setInteractionStatus(msgId, partIndex, status) {
    const msg = findMsgById(msgId)
    if (!msg) return null
    const changed = setInteractionState(msg, partIndex, status, Date.now())
    if (!changed) return null
    return msg
  }

  function appendInteractionEvent(message, partIndex, status, actorRole) {
    if (!store.activeChat || !message || !actorRole) return
    const event = buildHiddenInteractionEvent({
      makeId,
      message,
      partIndex,
      status,
      actorRole
    })
    if (!event) return
    store.activeChat.msgs.push(event)
  }

  function resolveInteraction(msgId, partIndex, status, actorRole) {
    const msg = setInteractionStatus(msgId, partIndex, status)
    if (!msg) return null
    appendInteractionEvent(msg, partIndex, status, actorRole)
    scheduleSave()
    return msg
  }

  // ─── Transfer/Gift Detail Panel ────────────────────

  function openTransferDetail(block) {
    transferDetailBlock.value = block
    showTransferDetail.value = true
  }

  function closeTransferDetail() {
    showTransferDetail.value = false
    transferDetailBlock.value = null
  }

  // ─── Send handlers ───────────────────────────────

  function handleSendTransfer({ amount, note }) {
    showTransferModal.value = false
    if (!store.activeChat) return
    const token = note ? `(transfer:${amount}:${note})` : `(transfer:${amount})`
    const msg = {
      id: makeId('msg'),
      role: 'user',
      content: token,
      time: Date.now(),
      readStatus: 'unread'
    }
    ensureInteractiveMessagePending(msg)
    store.activeChat.msgs.push(msg)
    scheduleSave()
    soundEffects.playEvent('messageSend')
  }

  function handleSendGift({ item, message, giftSnapshot }) {
    showGiftPanel.value = false
    if (!store.activeChat) return
    const token = formatGiftToken(item, message)
    const msg = {
      id: makeId('msg'),
      role: 'user',
      content: token,
      time: Date.now(),
      readStatus: 'unread'
    }
    const snapshot = giftSnapshot && typeof giftSnapshot === 'object'
      ? { ...giftSnapshot }
      : createGiftSnapshot(item)
    if (snapshot) {
      msg.giftPartSnapshots = { 0: { ...snapshot } }
    }
    ensureInteractiveMessagePending(msg)
    store.activeChat.msgs.push(msg)
    scheduleSave()
    soundEffects.playEvent('messageSend')
  }

  function handleSendMeet({ location, time, note }) {
    showMeetModal.value = false
    if (!store.activeChat || !location) return
    const token = formatMeetToken(location, time, note)
    const msg = {
      id: makeId('msg'),
      role: 'user',
      content: token,
      time: Date.now(),
      readStatus: 'unread'
    }
    ensureInteractiveMessagePending(msg)
    store.activeChat.msgs.push(msg)
    scheduleSave()
    soundEffects.playEvent('messageSend')
  }

  function handleSendVoice({ text }) {
    showVoiceModal.value = false
    if (!store.activeChat) return
    store.activeChat.msgs.push({
      id: makeId('msg'),
      role: 'user',
      content: `(voice:${text})`,
      time: Date.now(),
      readStatus: 'unread'
    })
    scheduleSave()
    soundEffects.playEvent('messageSend')
  }

  function handleSendMockImage({ text }) {
    const content = String(text || '').trim()
    if (!store.activeChat || !content) return
    showMockImageModal.value = false

    const newMsg = {
      id: makeId('msg'),
      role: 'user',
      content,
      time: Date.now(),
      readStatus: 'unread',
      isMockImage: true,
      mockImageText: content,
      mockImagePlaceholder: resolveMockImagePlaceholder(store.theme.mockImagePlaceholder)
    }

    if (store.replyingToId) {
      newMsg.replyTo = store.replyingToId
      newMsg.replyToText = store.replyingToText
      store.replyingToId = null
      store.replyingToText = null
    }

    store.activeChat.msgs.push(newMsg)
    store.ui.animateMsgId = newMsg.id
    scheduleSave()
    soundEffects.playEvent('messageSend')
  }

  // ─── Accept / Reject handlers ────────────────────

  function handleAcceptTransfer(block) {
    resolveInteraction(block.msgId, block.partIndex, 'accepted', 'user')
  }

  function handleRejectTransfer(block) {
    resolveInteraction(block.msgId, block.partIndex, 'rejected', 'user')
  }

  function handleAcceptGift(block) {
    resolveInteraction(block.msgId, block.partIndex, 'accepted', 'user')
  }

  function handleRejectGift(block) {
    resolveInteraction(block.msgId, block.partIndex, 'rejected', 'user')
  }

  function handleAcceptMeet(block) {
    const message = resolveInteraction(block.msgId, block.partIndex, 'accepted', 'user')
    if (!message) return

    const contact = store.activeChat
    if (!contact) return
    activateAcceptedMeetScene(contact, message, block.partIndex)

    scheduleSave()

    // Navigate to offline mode
    if (router) {
      router.push('/offline/' + contact.id)
    }
  }

  function handleRejectMeet(block) {
    resolveInteraction(block.msgId, block.partIndex, 'rejected', 'user')
  }

  return {
    closeTransferDetail,
    handleAcceptGift,
    handleAcceptMeet,
    handleAcceptTransfer,
    handleRejectGift,
    handleRejectMeet,
    handleRejectTransfer,
    handleSendGift,
    handleSendMeet,
    handleSendMockImage,
    handleSendTransfer,
    handleSendVoice,
    openGiftPanel,
    openMeetModal,
    openMockCameraModal,
    openTransferDetail,
    openTransferModal,
    openVoiceModal,
    showGiftPanel,
    showMeetModal,
    showMockImageModal,
    showTransferDetail,
    showTransferModal,
    showVoiceModal,
    transferDetailBlock
  }
}
