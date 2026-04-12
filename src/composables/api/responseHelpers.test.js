import { describe, expect, it } from 'vitest'
import {
  shouldAddReplyFormatPrompt,
  createStreamChunkBatcher,
  applyForumOnlyPlaceholder
} from './responseHelpers'

describe('responseHelpers', () => {
  it('detects quote format prompt coverage', () => {
    expect(shouldAddReplyFormatPrompt('plain output')).toBe(true)
    expect(shouldAddReplyFormatPrompt('[quote: xxx]')).toBe(false)
  })

  it('batches stream chunks and computes display content', () => {
    const msg = { content: '', displayContent: '' }
    const chunks = []
    const batcher = createStreamChunkBatcher(msg, (value) => chunks.push(value), (content) => `display:${content}`)

    batcher.push('a')
    batcher.push('b')
    batcher.flushNow()

    expect(msg.content).toBe('ab')
    expect(msg.displayContent).toBe('display:ab')
    expect(chunks[chunks.length - 1]).toBe('display:ab')
  })

  it('marks forum-only placeholder when content is empty after strip', () => {
    const msg = { content: '<post></post>', displayContent: '' }
    const parsed = { posts: 1 }

    const forumOnly = applyForumOnlyPlaceholder(msg, parsed, {
      stripForumBlocks: () => '',
      trimText: (value) => String(value || '').trim(),
      placeholder: 'placeholder'
    })

    expect(forumOnly).toBe(true)
    expect(msg.displayContent).toBe('placeholder')
    expect(msg.forumOnly).toBe(true)
  })
})
