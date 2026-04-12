import { describe, expect, it } from 'vitest'
import {
  buildAutoReplyVibeHint,
  cleanGeneratedComment,
  getRecentRepliesText,
  normalizeReplyForCompare,
  stripOuterCodeFence
} from './aiGeneration'

describe('moments aiGeneration utils', () => {
  it('strips a fenced code block wrapper', () => {
    expect(stripOuterCodeFence('```text\nhello world\n```')).toBe('hello world')
    expect(stripOuterCodeFence('plain text')).toBe('plain text')
  })

  it('cleans generated comments', () => {
    expect(cleanGeneratedComment('[角色]: 回复 小明： 你好呀')).toBe('你好呀')
  })

  it('normalizes replies for duplicate checks', () => {
    expect(normalizeReplyForCompare('你好， 世界！')).toBe('你好世界')
  })

  it('formats recent replies for prompts', () => {
    const text = getRecentRepliesText({
      replies: [
        { authorName: 'A', replyToAuthorName: null, content: '第一条' },
        { authorName: 'B', replyToAuthorName: 'A', content: '第二条' }
      ]
    })
    expect(text).toBe('A: 第一条\nB -> @A: 第二条')
  })

  it('builds vibe hints', () => {
    expect(buildAutoReplyVibeHint('drama')).toContain('修罗场')
    expect(buildAutoReplyVibeHint('friendly')).toContain('其乐融融')
    expect(buildAutoReplyVibeHint('neutral')).toContain('中立自然')
  })
})
