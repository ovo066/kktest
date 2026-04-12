import { describe, expect, it } from 'vitest'
import { buildContextMessages } from './contextWindow'

function createMessage(id, role, content, time, extra = {}) {
  return {
    id,
    role,
    content,
    time,
    ...extra
  }
}

describe('buildContextMessages', () => {
  it('converts early relationship-building rounds into a bootstrap block for long chats', () => {
    const base = Date.UTC(2026, 2, 10, 10, 0, 0)
    const allMsgs = [
      createMessage('m1', 'user', '第一次见面有点紧张', base),
      createMessage('m2', 'assistant', '别紧张，我会陪着你', base + 1000),
      createMessage('m3', 'user', '你以后可以叫我阿宁', base + 2000),
      createMessage('m4', 'assistant', '好，那我以后就这样叫你', base + 3000),
      createMessage('m5', 'user', '今天下班好累', base + 4000),
      createMessage('m6', 'assistant', '先喝点水，再慢慢和我说', base + 5000),
      createMessage('m7', 'user', '我现在有点想被安慰', base + 6000)
    ]

    const result = buildContextMessages(allMsgs, {
      headRounds: 1,
      tailRounds: 2
    })

    expect(result[0]).toEqual(expect.objectContaining({
      role: 'system'
    }))
    expect(result[0].content).toContain('<relationship_bootstrap>')
    expect(result[0].content).toContain('用户: 第一次见面有点紧张')
    expect(result[0].content).toContain('对方: 别紧张，我会陪着你')

    const currentDialogueIndex = result.findIndex(item => item.role === 'system' && item.content.includes('<current_dialogue>'))
    expect(currentDialogueIndex).toBeGreaterThan(0)

    const userContents = result.filter(item => item.role === 'user').map(item => item.content)
    expect(userContents).toEqual(['今天下班好累', '我现在有点想被安慰'])
  })

  it('keeps short chats as raw dialogue without bootstrap segmentation', () => {
    const base = Date.UTC(2026, 2, 10, 10, 0, 0)
    const allMsgs = [
      createMessage('m1', 'user', '你好', base),
      createMessage('m2', 'assistant', '你好呀', base + 1000),
      createMessage('m3', 'user', '今天过得怎么样', base + 2000)
    ]

    const result = buildContextMessages(allMsgs, {
      headRounds: 1,
      tailRounds: 2
    })

    expect(result.map(item => item.role)).toEqual(['user', 'assistant', 'user'])
    expect(result.some(item => String(item.content || '').includes('<relationship_bootstrap>'))).toBe(false)
    expect(result.some(item => String(item.content || '').includes('<current_dialogue>'))).toBe(false)
  })
})
