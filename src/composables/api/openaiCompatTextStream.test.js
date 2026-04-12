import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeChatCompletionsStream: vi.fn(),
  fetchOpenAICompat: vi.fn(),
  readOpenAICompatError: vi.fn()
}))

vi.mock('./stream', () => ({
  consumeChatCompletionsStream: mocks.consumeChatCompletionsStream
}))

vi.mock('./openaiCompat', () => ({
  fetchOpenAICompat: mocks.fetchOpenAICompat,
  readOpenAICompatError: mocks.readOpenAICompatError
}))

import {
  createOpenAICompatTextAccumulator,
  runOpenAICompatTextStream
} from './openaiCompatTextStream'

describe('openaiCompatTextStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchOpenAICompat.mockResolvedValue({
      request: { targetUrl: 'https://api.test/chat/completions' },
      response: { ok: true }
    })
  })

  it('normalizes cumulative snapshots and repeated duplicate chunks', () => {
    const accumulator = createOpenAICompatTextAccumulator()

    expect(accumulator.push('Hel')).toEqual({
      text: 'Hel',
      changed: true,
      emittedDelta: 'Hel',
      piece: 'Hel'
    })
    expect(accumulator.push('Hello')).toEqual({
      text: 'Hello',
      changed: true,
      emittedDelta: 'lo',
      piece: 'Hello'
    })
    expect(accumulator.push('Hello')).toEqual({
      text: 'Hello',
      changed: false,
      emittedDelta: '',
      piece: 'Hello'
    })
    expect(accumulator.push(' world')).toEqual({
      text: 'Hello world',
      changed: true,
      emittedDelta: ' world',
      piece: ' world'
    })
    expect(accumulator.push(' world')).toEqual({
      text: 'Hello world',
      changed: false,
      emittedDelta: '',
      piece: ' world'
    })
  })

  it('streams normalized text while keeping append-only deltas for callers', async () => {
    mocks.consumeChatCompletionsStream.mockImplementation(async (_response, onDelta) => {
      onDelta('Hel')
      onDelta('Hello')
      onDelta('Hello world')
      onDelta('!')
      onDelta('!')
      return {
        finishReason: 'stop',
        usage: { total_tokens: 12 }
      }
    })

    const onDelta = vi.fn()
    const onText = vi.fn()

    const result = await runOpenAICompatTextStream({
      cfg: { url: 'https://example.com', key: 'sk-test' },
      body: { model: 'demo', stream: true },
      onDelta,
      onText
    })

    expect(mocks.fetchOpenAICompat).toHaveBeenCalledWith('https://example.com', {
      apiKey: 'sk-test',
      body: { model: 'demo', stream: true },
      signal: undefined,
      path: undefined,
      extraHeaders: undefined
    })
    expect(onDelta.mock.calls).toEqual([
      ['Hel', 'Hel', 'Hel'],
      ['lo', 'Hello', 'Hello'],
      [' world', 'Hello world', 'Hello world'],
      ['!', 'Hello world!', '!']
    ])
    expect(onText.mock.calls).toEqual([
      ['Hel', 'Hel', 'Hel'],
      ['Hello', 'lo', 'Hello'],
      ['Hello world', ' world', 'Hello world'],
      ['Hello world!', '!', '!']
    ])
    expect(result).toEqual({
      text: 'Hello world!',
      streamResult: {
        finishReason: 'stop',
        usage: { total_tokens: 12 }
      },
      url: 'https://api.test/chat/completions'
    })
  })

  it('attaches HTTP status metadata to failed requests', async () => {
    mocks.fetchOpenAICompat.mockResolvedValue({
      request: { targetUrl: 'https://api.test/chat/completions' },
      response: { ok: false, status: 429 }
    })
    mocks.readOpenAICompatError.mockResolvedValue('rate limit exceeded')

    await expect(runOpenAICompatTextStream({
      cfg: { url: 'https://example.com', key: 'sk-test' },
      body: { stream: true }
    })).rejects.toMatchObject({
      message: 'rate limit exceeded',
      status: 429,
      detail: 'rate limit exceeded',
      url: 'https://api.test/chat/completions'
    })
  })
})
