import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeChatCompletionsStream: vi.fn(),
  buildChatCompletionPayload: vi.fn(),
  fetchOpenAICompat: vi.fn(),
  readOpenAICompatError: vi.fn(),
  estimateUsageFromMessages: vi.fn(),
  recordUsage: vi.fn()
}))

vi.mock('./stream', () => ({
  consumeChatCompletionsStream: mocks.consumeChatCompletionsStream
}))

vi.mock('./chatCompletions', () => ({
  buildChatCompletionPayload: mocks.buildChatCompletionPayload
}))

vi.mock('./openaiCompat', () => ({
  fetchOpenAICompat: mocks.fetchOpenAICompat,
  readOpenAICompatError: mocks.readOpenAICompatError,
}))

vi.mock('./usage', () => ({
  estimateUsageFromMessages: mocks.estimateUsageFromMessages,
  recordUsage: mocks.recordUsage
}))

import { appendInstructionMessage, executeStreamedAssistantRequest } from './streamingRequest'

describe('streamingRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildChatCompletionPayload.mockReturnValue({
      payload: true,
      stream: true,
      stream_options: { include_usage: true }
    })
    mocks.fetchOpenAICompat.mockResolvedValue({
      request: { targetUrl: 'https://api.test/chat' },
      response: { ok: true }
    })
    mocks.estimateUsageFromMessages.mockReturnValue({ totalTokens: 3 })
  })

  it('appends instruction blocks only when parts exist', () => {
    const messages = [{ role: 'system', content: 'base' }]
    appendInstructionMessage(messages, ['first', 'second'])
    appendInstructionMessage(messages, [])

    expect(messages).toEqual([
      { role: 'system', content: 'base' },
      { role: 'system', content: '<instructions>\nfirst\n\nsecond\n</instructions>' }
    ])
  })

  it('executes a streamed request and records usage', async () => {
    mocks.consumeChatCompletionsStream.mockImplementation(async (_res, onDelta) => {
      onDelta('hello')
      return { finishReason: 'stop' }
    })

    const activeChat = { msgs: [] }
    const setTyping = vi.fn()
    const onChunk = vi.fn()

    const result = await executeStreamedAssistantRequest({
      cfg: { key: 'test-key', model: 'gpt-test', url: 'https://example.com' },
      messages: [{ role: 'user', content: 'Hi' }],
      activeChat,
      makeMsgId: () => 'msg_1',
      traceId: 'trace_1',
      onChunk,
      createStreamChunkBatcher(message, handleChunk) {
        return {
          push(delta) {
            message.content += delta
            handleChunk?.(delta)
          },
          flushNow() {}
        }
      },
      assistantMessage: { senderName: 'Alice' },
      setTyping
    })

    expect(mocks.fetchOpenAICompat).toHaveBeenCalledWith('https://example.com', {
      apiKey: 'test-key',
      body: {
        payload: true,
        stream: true,
        stream_options: { include_usage: true }
      }
    })
    expect(setTyping).toHaveBeenCalledWith(false)
    expect(onChunk).toHaveBeenCalledWith('hello')
    expect(activeChat.msgs[0]).toMatchObject({
      id: 'msg_1',
      senderName: 'Alice',
      content: 'hello',
      traceId: 'trace_1'
    })
    expect(mocks.recordUsage).toHaveBeenCalledWith(activeChat, { finishReason: 'stop' }, { totalTokens: 3 }, 'gpt-test')
    expect(result).toMatchObject({
      url: 'https://api.test/chat',
      createdMsgId: 'msg_1',
      streamInfo: { finishReason: 'stop' },
      streamMsg: activeChat.msgs[0]
    })
  })

  it('throws API errors before creating placeholder messages', async () => {
    mocks.fetchOpenAICompat.mockResolvedValue({
      request: { targetUrl: 'https://api.test/chat' },
      response: { ok: false }
    })
    mocks.readOpenAICompatError.mockResolvedValue('bad request')

    const activeChat = { msgs: [] }
    const setTyping = vi.fn()

    await expect(executeStreamedAssistantRequest({
      cfg: { key: 'test-key', model: 'gpt-test', url: 'https://example.com' },
      messages: [],
      activeChat,
      makeMsgId: () => 'msg_1',
      traceId: 'trace_1',
      createStreamChunkBatcher() {
        return { push() {}, flushNow() {} }
      },
      setTyping
    })).rejects.toThrow('bad request')

    expect(setTyping).toHaveBeenCalledWith(false)
    expect(activeChat.msgs).toEqual([])
  })

  it('falls back to non-stream mode when streaming yields no visible text', async () => {
    mocks.fetchOpenAICompat
      .mockResolvedValueOnce({
        request: { targetUrl: 'https://api.test/chat' },
        response: { ok: true }
      })
      .mockResolvedValueOnce({
        request: { targetUrl: 'https://api.test/chat' },
        response: {
          ok: true,
          json: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'fallback hello' }, finish_reason: 'stop' }],
            usage: { total_tokens: 9 }
          })
        }
      })
    mocks.consumeChatCompletionsStream.mockResolvedValue({
      finishReason: null,
      emittedChars: 0,
      emittedEvents: 0,
      usedFallback: false,
      usage: null
    })

    const activeChat = { msgs: [] }
    const onChunk = vi.fn()

    const result = await executeStreamedAssistantRequest({
      cfg: { key: 'test-key', model: 'gpt-test', url: 'https://example.com' },
      messages: [{ role: 'user', content: 'Hi' }],
      activeChat,
      makeMsgId: () => 'msg_1',
      traceId: 'trace_1',
      onChunk,
      createStreamChunkBatcher(message, handleChunk) {
        return {
          push(delta) {
            message.content += delta
            handleChunk?.(delta)
          },
          flushNow() {}
        }
      }
    })

    expect(mocks.fetchOpenAICompat).toHaveBeenNthCalledWith(2, 'https://example.com', {
      apiKey: 'test-key',
      body: {
        payload: true,
        stream: false
      }
    })
    expect(activeChat.msgs[0]?.content).toBe('fallback hello')
    expect(onChunk).toHaveBeenCalledWith('fallback hello')
    expect(result.streamInfo).toMatchObject({
      finishReason: 'stop',
      usedNonStreamFallback: true,
      usage: { total_tokens: 9 }
    })
  })
})
