import { describe, expect, it } from 'vitest'
import { parseGroupReplyMessages } from './groupReplyParser'

describe('parseGroupReplyMessages', () => {
  const members = [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' }
  ]

  it('parses multiple tagged group replies', () => {
    const result = parseGroupReplyMessages('[Alice]： hello [Bob]: [quote:hello] got it', members)
    expect(result).toEqual([
      { senderId: 'm1', senderName: 'Alice', content: 'hello', replyToText: null },
      { senderId: 'm2', senderName: 'Bob', content: 'got it', replyToText: 'hello' }
    ])
  })

  it('falls back to the first member when no prefix exists', () => {
    const result = parseGroupReplyMessages('[quote:context] summary', members)
    expect(result).toEqual([
      { senderId: 'm1', senderName: 'Alice', content: 'summary', replyToText: 'context' }
    ])
  })
})
