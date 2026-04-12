import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectRecentProactiveSummaries,
  countRecentGlobalProactiveMessages,
  countRecentProactiveMessages,
  hasRecentDuplicateAssistantMessage,
  isNearDuplicateText
} from './duplicateDetection'

describe('duplicateDetection', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('detects highly similar text even with spacing and punctuation differences', () => {
    expect(isNearDuplicateText('  早点睡呀!! ', '早点睡呀')).toBe(true)
    expect(isNearDuplicateText('今天吃饭了吗', '我们明天去散步吧')).toBe(false)
  })

  it('counts recent proactive messages for one contact and globally', () => {
    const now = Date.now()
    const contactA = {
      msgs: [
        { role: 'assistant', proactive: true, time: now - 60_000, content: '早呀' },
        { role: 'assistant', proactive: true, time: now - 120_000, content: '吃饭了吗' },
        { role: 'assistant', proactive: false, time: now - 180_000, content: '系统消息' }
      ]
    }
    const contactB = {
      msgs: [
        { role: 'assistant', proactive: true, time: now - 240_000, content: '晚上好' }
      ]
    }

    expect(countRecentProactiveMessages(contactA, { sinceMs: now - 10 * 60_000 })).toBe(2)
    expect(countRecentGlobalProactiveMessages([contactA, contactB], { sinceMs: now - 10 * 60_000 })).toBe(3)
  })

  it('collects recent summaries and skips near-duplicate assistant messages', () => {
    vi.useFakeTimers()
    const now = new Date('2026-03-10T12:00:00+08:00').getTime()
    vi.setSystemTime(now)

    const contact = {
      msgs: [
        { role: 'assistant', proactive: false, time: now - 180_000, content: '普通回复' },
        { role: 'assistant', proactive: true, time: now - 120_000, content: '突然想到你了' },
        { role: 'assistant', proactive: true, time: now - 60_000, content: '刚吃完饭，好撑' }
      ]
    }

    expect(collectRecentProactiveSummaries(contact, { sinceMs: now - 10 * 60_000, limit: 2 })).toEqual([
      '11:58 突然想到你了',
      '11:59 刚吃完饭，好撑'
    ])
    expect(hasRecentDuplicateAssistantMessage(contact, '刚吃完饭 好撑')).toBe(true)
    expect(hasRecentDuplicateAssistantMessage(contact, '要不要晚点出去走走')).toBe(false)
  })
})
