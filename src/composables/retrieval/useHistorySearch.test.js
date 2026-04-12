import { describe, expect, it } from 'vitest'
import { buildHistorySearchQueries, formatRetrievedContext, searchMessages } from './useHistorySearch'

function createMessage(id, role, content, time, extra = {}) {
  return {
    id,
    role,
    content,
    time,
    ...extra
  }
}

describe('useHistorySearch', () => {
  it('builds expanded search queries for underspecified latest user turns', () => {
    const base = Date.UTC(2026, 2, 14, 10, 0, 0)
    const msgs = [
      createMessage('m1', 'user', '我喜欢下雨天听白噪音睡觉', base),
      createMessage('m2', 'assistant', '记住了，以后我会这样陪你', base + 1000),
      createMessage('m3', 'user', '那个你还记得吗', base + 2000)
    ]

    const queries = buildHistorySearchQueries(msgs)

    expect(queries[0].text).toBe('那个你还记得吗')
    expect(queries.some(item => item.text.includes('我喜欢下雨天听白噪音睡觉'))).toBe(true)
    expect(queries.some(item => item.label === 'recent_user_window')).toBe(true)
  })

  it('retrieves the full most-recent relevant round instead of isolated single messages', () => {
    const base = Date.UTC(2026, 2, 14, 10, 0, 0)
    const msgs = [
      createMessage('m1', 'user', '我喜欢下雨天听白噪音睡觉', base),
      createMessage('m2', 'assistant', '好，我记住了。下次你睡不着我就陪你聊聊', base + 1000),
      createMessage('m3', 'user', '我最近又有点失眠', base + 2000),
      createMessage('m4', 'assistant', '你之前说过下雨天听白噪音会舒服一点，我还记得', base + 3000),
      createMessage('m5', 'user', '那个你还记得吗', base + 4000)
    ]

    const queryVariants = buildHistorySearchQueries(msgs)
    const results = searchMessages(msgs, queryVariants[0].text, {
      queryVariants,
      maxResults: 2,
      excludeRecent: 1,
      maxTokens: 200
    })

    expect(results[0]).toEqual(expect.objectContaining({
      startIndex: 2,
      endIndex: 3
    }))
    expect(results[0].snippet).toContain('用户: 我最近又有点失眠')
    expect(results[0].snippet).toContain('AI: 你之前说过下雨天听白噪音会舒服一点，我还记得')
  })

  it('can still hit older original fact rounds when the query is explicit', () => {
    const base = Date.UTC(2026, 2, 14, 10, 0, 0)
    const msgs = [
      createMessage('m1', 'user', '我喜欢下雨天听白噪音睡觉', base),
      createMessage('m2', 'assistant', '好，我记住了。下次你睡不着我就陪你聊聊', base + 1000),
      createMessage('m3', 'user', '我最近又有点失眠', base + 2000),
      createMessage('m4', 'assistant', '你之前说过下雨天听白噪音会舒服一点，我还记得', base + 3000),
      createMessage('m5', 'user', '今天工作有点累', base + 4000)
    ]

    const results = searchMessages(msgs, '白噪音 睡觉', {
      maxResults: 1,
      excludeRecent: 1,
      maxTokens: 120
    })

    expect(results[0]).toEqual(expect.objectContaining({
      startIndex: 0,
      endIndex: 1
    }))
  })

  it('formats retrieved context with the full matched round', () => {
    const base = Date.UTC(2026, 2, 14, 10, 0, 0)
    const msgs = [
      createMessage('m1', 'user', '我喜欢下雨天听白噪音睡觉', base),
      createMessage('m2', 'assistant', '好，我记住了。下次你睡不着我就陪你聊聊', base + 1000),
      createMessage('m3', 'user', '今天午饭吃什么', base + 2000)
    ]

    const rendered = formatRetrievedContext([{
      msgIndex: 0,
      startIndex: 0,
      endIndex: 1,
      score: 1.2,
      snippet: '用户: 我喜欢下雨天听白噪音睡觉'
    }], msgs, { maxTokens: 120 })

    expect(rendered).toContain('[过去对话回忆')
    expect(rendered).toContain('用户: 我喜欢下雨天听白噪音睡觉')
    expect(rendered).toContain('AI: 好，我记住了。下次你睡不着我就陪你聊聊')
    expect(rendered).not.toContain('今天午饭吃什么')
  })
})
