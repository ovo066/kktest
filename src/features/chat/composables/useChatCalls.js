import { ref } from 'vue'
import { appendInviteLifecycleEvent } from '../../../composables/call/callHistory'

export function useChatCalls({ store, scheduleSave, parseMessageContent, makeId }) {
  const showCallModeSheet = ref(false)
  const showCallHistoryModal = ref(false)
  const callOverlayRef = ref(null)
  const processedCallInviteIds = ref(new Set())

  const incomingCallVisible = ref(false)
  const incomingCallInfo = ref(null)

  function openCallModeSheet() {
    showCallModeSheet.value = true
  }

  function closeCallModeSheet() {
    showCallModeSheet.value = false
  }

  function closeCallHistoryModal() {
    showCallHistoryModal.value = false
  }

  function startCallWithMode(mode) {
    if (!store.activeChat) return
    closeCallModeSheet()
    callOverlayRef.value?.startCall(store.activeChat.id, mode)
  }

  function handleStartCall(mode) {
    if (!store.activeChat) return
    if (mode) {
      startCallWithMode(mode)
    } else {
      openCallModeSheet()
    }
  }

  async function checkAssistantCallInvite(contact) {
    if (!contact?.msgs) return
    if (!store.allowAICall) return

    // 从倒序查找本次新增且未处理过的 assistant 消息
    const lastMsgs = [...contact.msgs].reverse().slice(0, 5) // 只看最近几条
    for (const msg of lastMsgs) {
      if (msg.role !== 'assistant') continue
      if (processedCallInviteIds.value.has(msg.id)) continue

      const parts = parseMessageContent(msg.content, { allowCall: store.allowAICall })
      const callPart = parts.find(p => p.type === 'call' && p.isCallInvite)

      if (callPart) {
        processedCallInviteIds.value.add(msg.id)
        const callText = callPart.callText || '邀请你通话'

        incomingCallInfo.value = {
          contactId: contact.id,
          name: contact.name,
          avatar: contact.avatar,
          avatarType: contact.avatarType || 'image',
          mode: callPart.callMode, // 'voice' or 'video'
          text: callText
        }
        incomingCallVisible.value = true

        break // 一次只处理一个来电邀请
      }
    }
  }

  function appendIncomingInviteEvent(contactId, mode, eventType) {
    const contact = store.contacts.find(c => c.id === contactId)
    if (!contact || !Array.isArray(contact.msgs)) return false

    return appendInviteLifecycleEvent(contact, {
      mode,
      eventType
    }, {
      makeMessageId: () => makeId('msg')
    })
  }

  function handleAcceptCall() {
    if (incomingCallInfo.value) {
      const { contactId, mode, text } = incomingCallInfo.value
      appendIncomingInviteEvent(contactId, mode, 'accept')
      callOverlayRef.value?.receiveCall(contactId, mode, text)
    }
    incomingCallVisible.value = false
    incomingCallInfo.value = null
    scheduleSave()
  }

  function handleDeclineCall() {
    if (incomingCallInfo.value) {
      const { contactId, mode } = incomingCallInfo.value
      appendIncomingInviteEvent(contactId, mode, 'decline')
    }
    incomingCallVisible.value = false
    incomingCallInfo.value = null
    scheduleSave()
  }

  return {
    showCallModeSheet,
    showCallHistoryModal,
    callOverlayRef,
    incomingCallVisible,
    incomingCallInfo,
    openCallModeSheet,
    closeCallModeSheet,
    closeCallHistoryModal,
    startCallWithMode,
    handleStartCall,
    checkAssistantCallInvite,
    handleAcceptCall,
    handleDeclineCall
  }
}
