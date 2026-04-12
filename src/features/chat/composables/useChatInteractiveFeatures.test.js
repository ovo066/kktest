import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatInteractiveFeatures } from './useChatInteractiveFeatures'

const { playEvent } = vi.hoisted(() => ({
  playEvent: vi.fn()
}))

vi.mock('../../../composables/useSoundEffects', () => ({
  useSoundEffects: () => ({
    playEvent
  })
}))

describe('useChatInteractiveFeatures', () => {
  beforeEach(() => {
    playEvent.mockReset()
  })

  function createHarness() {
    let idSeq = 0
    const requestAssistantReply = vi.fn()
    const scheduleSave = vi.fn()
    const store = {
      activeChat: {
        id: 'chat_1',
        msgs: []
      },
      replyingToId: null,
      replyingToText: null,
      ui: {},
      theme: {}
    }

    const api = useChatInteractiveFeatures({
      closePlusMenu: vi.fn(),
      makeId: (prefix) => `${prefix}_${++idSeq}`,
      requestAssistantReply,
      resolveMockImagePlaceholder: () => 'mock-placeholder.png',
      router: null,
      scheduleSave,
      store
    })

    return {
      api,
      requestAssistantReply,
      scheduleSave,
      store
    }
  }

  it('sends transfer card without auto triggering assistant reply', () => {
    const {
      api: { handleSendTransfer },
      requestAssistantReply,
      scheduleSave,
      store
    } = createHarness()

    handleSendTransfer({ amount: 66, note: '奶茶钱' })

    expect(store.activeChat.msgs).toHaveLength(1)
    expect(store.activeChat.msgs[0]).toMatchObject({
      role: 'user',
      content: '(transfer:66:奶茶钱)',
      readStatus: 'unread',
      interactionStatus: 'pending'
    })
    expect(scheduleSave).toHaveBeenCalledTimes(1)
    expect(requestAssistantReply).not.toHaveBeenCalled()
  })

  it('sends gift card without auto triggering assistant reply', () => {
    const {
      api: { handleSendGift },
      requestAssistantReply,
      scheduleSave,
      store
    } = createHarness()

    handleSendGift({ item: '玫瑰', message: '送你一朵' })

    expect(store.activeChat.msgs).toHaveLength(1)
    expect(store.activeChat.msgs[0]).toMatchObject({
      role: 'user',
      content: '(gift:玫瑰:送你一朵)',
      readStatus: 'unread',
      interactionStatus: 'pending'
    })
    expect(scheduleSave).toHaveBeenCalledTimes(1)
    expect(requestAssistantReply).not.toHaveBeenCalled()
  })

  it('sends voice message without auto triggering assistant reply', () => {
    const {
      api: { handleSendVoice },
      requestAssistantReply,
      scheduleSave,
      store
    } = createHarness()

    handleSendVoice({ text: '你好呀' })

    expect(store.activeChat.msgs).toHaveLength(1)
    expect(store.activeChat.msgs[0]).toMatchObject({
      role: 'user',
      content: '(voice:你好呀)',
      readStatus: 'unread'
    })
    expect(scheduleSave).toHaveBeenCalledTimes(1)
    expect(requestAssistantReply).not.toHaveBeenCalled()
  })

  it('sends mock image message without auto triggering assistant reply', () => {
    const {
      api: { handleSendMockImage },
      requestAssistantReply,
      scheduleSave,
      store
    } = createHarness()

    handleSendMockImage({ text: '  下雨天的街道  ' })

    expect(store.activeChat.msgs).toHaveLength(1)
    expect(store.activeChat.msgs[0]).toMatchObject({
      role: 'user',
      content: '下雨天的街道',
      readStatus: 'unread',
      isMockImage: true,
      mockImageText: '下雨天的街道',
      mockImagePlaceholder: 'mock-placeholder.png'
    })
    expect(scheduleSave).toHaveBeenCalledTimes(1)
    expect(requestAssistantReply).not.toHaveBeenCalled()
  })

  it('persists gift snapshots when sending picker-based gifts', () => {
    const {
      api: { handleSendGift },
      store
    } = createHarness()

    handleSendGift({
      item: '自定义票根',
      message: '留作纪念',
      giftSnapshot: {
        id: 'gift_custom_1',
        name: '自定义票根',
        description: '我们第一次约会的门票',
        price: 131.4,
        image: 'data:image/png;base64,abc'
      }
    })

    expect(store.activeChat.msgs[0]).toMatchObject({
      content: '(gift:自定义票根:留作纪念)',
      giftPartSnapshots: {
        0: {
          id: 'gift_custom_1',
          name: '自定义票根',
          description: '我们第一次约会的门票',
          price: 131.4,
          image: 'data:image/png;base64,abc'
        }
      }
    })
  })

  it('uses the note-only meet token shape when time is omitted', () => {
    const {
      api: { handleSendMeet },
      scheduleSave,
      store
    } = createHarness()

    handleSendMeet({ location: '咖啡厅', time: '', note: '3:30后见（别迟到）' })

    expect(store.activeChat.msgs).toHaveLength(1)
    expect(store.activeChat.msgs[0]).toMatchObject({
      role: 'user',
      content: '(meet:咖啡厅::3%3A30%E5%90%8E%E8%A7%81%EF%BC%88%E5%88%AB%E8%BF%9F%E5%88%B0%EF%BC%89)',
      readStatus: 'unread',
      interactionStatus: 'pending'
    })
    expect(scheduleSave).toHaveBeenCalledTimes(1)
  })
})
