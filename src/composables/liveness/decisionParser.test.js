import { describe, expect, it } from 'vitest'
import {
  parseDecision,
  parseChatReadOnlyDecision,
  normalizeReadOnlyReason
} from './decisionParser'

describe('decisionParser', () => {
  it('parses loose decision object payload', () => {
    const result = parseDecision("```json\n{action:'message', content:'你好', delay_seconds: 12, mood_delta: 0.1}\n```")

    expect(result.action).toBe('message')
    expect(result.content).toBe('你好')
    expect(result.delaySeconds).toBe(12)
    expect(result.moodDelta).toBe(0.1)
  })

  it('parses read-only decision from kv text', () => {
    const result = parseChatReadOnlyDecision('回复: 0\n原因: 正在忙')

    expect(result.shouldReply).toBe(false)
    expect(result.reason).toBe('正在忙')
  })

  it('normalizes read-only reason text', () => {
    expect(normalizeReadOnlyReason('原因: 已读不回，稍后再聊')).toBe('已读不回，稍后再聊')
    expect(normalizeReadOnlyReason('')).toBe('')
  })
})
