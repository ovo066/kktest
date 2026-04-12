import { beforeEach, describe, expect, it, vi } from 'vitest'

const { parseMessageContentMock } = vi.hoisted(() => ({
  parseMessageContentMock: vi.fn((text) => [{ type: 'text', content: String(text || '') }])
}))

vi.mock('./messageParser/contentParts', () => ({
  parseMessageContent: parseMessageContentMock
}))

import { useChatSearch } from './useChatSearch'

function createSearchComposable(msgs) {
  return useChatSearch({
    store: {
      activeChat: {
        id: 'chat-1',
        msgs
      }
    },
    messageWindowLimit: { value: 100 },
    messageListRef: { value: null }
  })
}

describe('useChatSearch', () => {
  beforeEach(() => {
    parseMessageContentMock.mockClear()
  })

  it('returns all matching bubbles without the legacy result cap', () => {
    const msgs = Array.from({ length: 80 }, (_, index) => ({
      id: `m${index}`,
      role: index % 2 === 0 ? 'assistant' : 'user',
      content: `hello world ${index}`
    }))

    const { performSearch, searchResults } = createSearchComposable(msgs)
    performSearch('hello')

    expect(searchResults.value).toHaveLength(80)
    expect(searchResults.value[0].msgId).toBe('m79')
    expect(searchResults.value.at(-1)?.msgId).toBe('m0')
  })

  it('reuses cached parsed search documents across repeated queries', () => {
    const msgs = [
      { id: 'm1', role: 'assistant', content: 'alpha beta gamma' },
      { id: 'm2', role: 'user', content: 'alpha beta delta' }
    ]

    const { performSearch, searchResults } = createSearchComposable(msgs)

    performSearch('alpha')
    expect(searchResults.value).toHaveLength(2)
    expect(parseMessageContentMock).toHaveBeenCalledTimes(2)

    performSearch('alph')
    expect(searchResults.value).toHaveLength(2)
    expect(parseMessageContentMock).toHaveBeenCalledTimes(2)

    performSearch('delta')
    expect(searchResults.value).toHaveLength(1)
    expect(parseMessageContentMock).toHaveBeenCalledTimes(2)
  })

  it('narrows matches from the previous result set when query extends forward', () => {
    const msgs = [
      { id: 'm1', role: 'assistant', content: 'alpha beta gamma' },
      { id: 'm2', role: 'user', content: 'alpha delta' },
      { id: 'm3', role: 'assistant', content: 'beta only' }
    ]

    const { performSearch, searchResults } = createSearchComposable(msgs)

    performSearch('alpha')
    expect(searchResults.value).toHaveLength(2)
    expect(parseMessageContentMock).toHaveBeenCalledTimes(3)

    performSearch('alpha d')
    expect(searchResults.value).toHaveLength(1)
    expect(searchResults.value[0].msgId).toBe('m2')
    expect(parseMessageContentMock).toHaveBeenCalledTimes(3)
  })
})
