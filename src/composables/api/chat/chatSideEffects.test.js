import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  markPendingUserMessagesAsRead: vi.fn()
}))

vi.mock('../chatMessages', () => ({
  markPendingUserMessagesAsRead: mocks.markPendingUserMessagesAsRead
}))

import { applyReadOnlySuppression, finalizeAssistantTurn } from './chatSideEffects'

describe('chatSideEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies read-only suppression side effects through the shared helper', async () => {
    const chatStore = { ui: { isTyping: false } }
    const showToast = vi.fn()
    const activeChat = { id: 'chat_1' }

    const result = await applyReadOnlySuppression({
      activeChat,
      chatStore,
      settingsStore: {
        livenessConfig: { showReadOnlyReasonToast: true }
      },
      showToast,
      reason: '忙线中',
      delayMs: 0
    })

    expect(chatStore.ui.isTyping).toBe(false)
    expect(mocks.markPendingUserMessagesAsRead).toHaveBeenCalledWith(activeChat, 'read_only')
    expect(showToast).toHaveBeenCalledWith('对方已读不回：忙线中')
    expect(result).toEqual({ success: true, suppressed: true })
  })

  it('marks assistant replies as read and optionally plays the receive sound', () => {
    const soundEffects = { playEvent: vi.fn() }
    const activeChat = { id: 'chat_1' }

    finalizeAssistantTurn(activeChat, soundEffects, { playSound: true })
    finalizeAssistantTurn(activeChat, soundEffects, { playSound: false })

    expect(mocks.markPendingUserMessagesAsRead).toHaveBeenNthCalledWith(1, activeChat, 'assistant_reply')
    expect(mocks.markPendingUserMessagesAsRead).toHaveBeenNthCalledWith(2, activeChat, 'assistant_reply')
    expect(soundEffects.playEvent).toHaveBeenCalledTimes(1)
    expect(soundEffects.playEvent).toHaveBeenCalledWith('messageReceive')
  })
})
