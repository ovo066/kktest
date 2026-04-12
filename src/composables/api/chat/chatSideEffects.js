import { markPendingUserMessagesAsRead } from '../chatMessages'

export async function applyReadOnlySuppression(options = {}) {
  const {
    activeChat,
    chatStore,
    settingsStore,
    showToast,
    reason,
    delayMs = 450 + Math.random() * 500
  } = options

  chatStore.ui.isTyping = true
  await new Promise(resolve => setTimeout(resolve, Math.max(0, delayMs)))
  chatStore.ui.isTyping = false

  markPendingUserMessagesAsRead(activeChat, 'read_only')

  if (settingsStore?.livenessConfig?.showReadOnlyReasonToast) {
    const shortReason = String(reason || '').trim()
    showToast(shortReason ? `对方已读不回：${shortReason}` : '对方已读不回')
  }

  return { success: true, suppressed: true }
}

export function finalizeAssistantTurn(activeChat, soundEffects, options = {}) {
  const { playSound = true } = options
  markPendingUserMessagesAsRead(activeChat, 'assistant_reply')
  if (playSound) {
    soundEffects.playEvent('messageReceive')
  }
}
