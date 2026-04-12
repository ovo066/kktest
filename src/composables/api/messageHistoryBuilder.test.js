import { describe, expect, it } from 'vitest'
import {
  buildDirectChatApiMessages,
  buildGroupMultiApiMessages,
  buildGroupSingleApiMessages,
  resolveContextMessageImageUrls
} from './messageHistoryBuilder'

describe('messageHistoryBuilder', () => {
  it('builds direct chat messages with quote metadata', () => {
    const contextMsgs = [
      { role: 'system', content: 'sys' },
      { id: 'u1', role: 'user', content: 'hello' },
      { id: 'a1', role: 'assistant', content: 'reply', replyTo: 'u1' },
      { role: 'user', content: '[\u56FE\u7247]', isImage: true, imageUrl: 'https://img.test/a.png' }
    ]

    expect(buildDirectChatApiMessages(contextMsgs, contextMsgs)).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: '[quote:hello]\nreply' },
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'https://img.test/a.png' } }]
      }
    ])
  })

  it('builds group single history with user prefixes', () => {
    const contextMsgs = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: '[Alice]: hi' },
      { role: 'user', content: '[\u56FE\u7247]', isImage: true, imageUrl: 'https://img.test/u.png' }
    ]

    expect(buildGroupSingleApiMessages(contextMsgs)).toEqual([
      { role: 'user', content: '[\u7528\u6237]: hello' },
      { role: 'assistant', content: '[Alice]: hi' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '[\u7528\u6237]: [\u56FE\u7247]' },
          { type: 'image_url', image_url: { url: 'https://img.test/u.png' } }
        ]
      }
    ])
  })

  it('builds group multi history with role remapping and sender prefixes', () => {
    const contextMsgs = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', senderId: 'm1', senderName: 'Alice', content: 'hi' },
      { role: 'assistant', senderId: 'm2', senderName: 'Bob', content: '[\u56FE\u7247]', isImage: true, imageUrl: 'https://img.test/b.png' }
    ]

    expect(buildGroupMultiApiMessages(contextMsgs, 'm1')).toEqual([
      { role: 'user', content: '[\u7528\u6237]: hello' },
      { role: 'assistant', content: '[Alice]: hi' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '[Bob]: [\u56FE\u7247]' },
          { type: 'image_url', image_url: { url: 'https://img.test/b.png' } }
        ]
      }
    ])
  })

  it('does not inline interaction status notes into api message content', () => {
    const contextMsgs = [
      {
        id: 'u_transfer_1',
        role: 'user',
        content: '(transfer:88:午饭钱)',
        interactionStates: {
          '0': { status: 'pending' }
        }
      }
    ]

    expect(buildDirectChatApiMessages(contextMsgs, contextMsgs)).toEqual([
      { role: 'user', content: '(transfer:88:午饭钱)' }
    ])
  })

  it('resolves runtime blob image urls before building api messages', async () => {
    const contextMsgs = [
      { role: 'user', content: '[图片]', isImage: true, imageUrl: 'blob:msg-1' },
      { role: 'assistant', content: 'ok' }
    ]

    const resolved = await resolveContextMessageImageUrls(contextMsgs, async (_message, imageUrl) => {
      if (imageUrl === 'blob:msg-1') return 'data:image/png;base64,abc'
      return imageUrl
    })

    expect(resolved).toEqual([
      { role: 'user', content: '[图片]', isImage: true, imageUrl: 'data:image/png;base64,abc' },
      { role: 'assistant', content: 'ok' }
    ])
    expect(contextMsgs[0].imageUrl).toBe('blob:msg-1')
  })
})
