import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  executeStreamedAssistantRequest: vi.fn(),
  handleAssistantRequestFailure: vi.fn()
}))

vi.mock('../streamingRequest', () => ({
  executeStreamedAssistantRequest: mocks.executeStreamedAssistantRequest
}))

vi.mock('../assistantMessageLifecycle', () => ({
  handleAssistantRequestFailure: mocks.handleAssistantRequestFailure
}))

import { executeChatStreamOrchestrator } from './sharedChatExecutor'

describe('sharedChatExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes the shared stream flow and forwards the stream result to the completion handler', async () => {
    mocks.executeStreamedAssistantRequest.mockImplementation(async (options) => {
      options.setTyping(false)
      options.setThinking(true)
      options.setThinking(false)
      return {
        createdMsgId: 'msg_1',
        streamInfo: { finishReason: 'stop' },
        streamMsg: { id: 'msg_1', content: 'hello' },
        url: 'https://api.test/chat'
      }
    })

    const onStreamComplete = vi.fn().mockResolvedValue({ success: true })
    const chatStore = { ui: { isTyping: false, isThinking: false } }

    const result = await executeChatStreamOrchestrator({
      chatStore,
      activeChat: { id: 'chat_1', msgs: [] },
      cfg: { url: 'https://example.com', key: 'sk-test' },
      messages: [{ role: 'user', content: 'hi' }],
      makeMsgId: () => 'msg_local',
      traceId: 'trace_1',
      onChunk: vi.fn(),
      createStreamChunkBatcher: vi.fn(),
      onStreamComplete
    })

    expect(mocks.executeStreamedAssistantRequest).toHaveBeenCalledTimes(1)
    expect(onStreamComplete).toHaveBeenCalledWith({
      createdMsgId: 'msg_1',
      streamInfo: { finishReason: 'stop' },
      streamMsg: { id: 'msg_1', content: 'hello' },
      url: 'https://api.test/chat'
    })
    expect(chatStore.ui.isTyping).toBe(false)
    expect(chatStore.ui.isThinking).toBe(false)
    expect(result).toEqual({ success: true })
  })

  it('normalizes stream failures through the shared assistant failure path', async () => {
    const error = new Error('bad request')
    mocks.executeStreamedAssistantRequest.mockRejectedValue(error)
    mocks.handleAssistantRequestFailure.mockReturnValue({ success: false, error: 'bad request' })

    const chatStore = { ui: { isTyping: false, isThinking: false } }
    const activeChat = { id: 'chat_1', msgs: [] }

    const result = await executeChatStreamOrchestrator({
      chatStore,
      activeChat,
      cfg: { url: 'https://example.com', key: 'sk-test' },
      messages: [],
      makeMsgId: () => 'msg_local',
      traceId: 'trace_1',
      createStreamChunkBatcher: vi.fn(),
      onStreamComplete: vi.fn()
    })

    expect(chatStore.ui.isTyping).toBe(false)
    expect(chatStore.ui.isThinking).toBe(false)
    expect(mocks.handleAssistantRequestFailure).toHaveBeenCalledWith(expect.objectContaining({
      activeChat,
      createdMsgId: null,
      traceId: 'trace_1',
      error
    }))
    expect(result).toEqual({ success: false, error: 'bad request' })
  })
})
