import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildStickerCandidateContext,
  buildStickerSuggestionIndex,
  buildStickerUsageStats,
  extractStickerCommandQuery,
  getStickerCandidates,
  preloadStickerSearch
} from './stickerSearch'

function makeContext(overrides = {}) {
  return {
    inputValue: '',
    activeChat: {
      id: 'chat-1',
      msgs: []
    },
    ...overrides
  }
}

describe('stickerSearch', () => {
  beforeAll(async () => {
    await preloadStickerSearch({ force: true })
  })

  it('extracts explicit sticker command query', () => {
    expect(extractStickerCommandQuery('(sticker: 猫猫哭哭')).toBe('猫猫哭哭')
    expect(extractStickerCommandQuery('普通文本')).toBeNull()
  })

  it('matches aliases and keywords in command mode', () => {
    const stickerIndex = buildStickerSuggestionIndex([
      { id: 's1', name: '摸鱼小猫', aliases: ['上班', '打工人'] },
      { id: 's2', name: '晚安小狗', keywords: ['睡觉', '困困'] }
    ])

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '(sticker: 打工'
    }))

    const results = getStickerCandidates({
      stickerIndex,
      context,
      usageStats: buildStickerUsageStats([], null)
    })

    expect(results[0]?.name).toBe('摸鱼小猫')
  })

  it('keeps emoticon signals in explicit command mode', () => {
    const stickerIndex = buildStickerSuggestionIndex([
      { id: 's1', name: '委屈猫猫' },
      { id: 's2', name: '开心小狗' }
    ])

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '(sticker: T_T'
    }))

    const results = getStickerCandidates({
      stickerIndex,
      context,
      usageStats: buildStickerUsageStats([], null)
    })

    expect(results[0]?.name).toBe('委屈猫猫')
  })

  it('maps emoji mood signals to sticker intent', () => {
    const stickerIndex = buildStickerSuggestionIndex([
      { id: 's1', name: '流泪猫猫头' },
      { id: 's2', name: '哈哈小狗' }
    ])

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '😭😭'
    }))

    const results = getStickerCandidates({
      stickerIndex,
      context,
      usageStats: buildStickerUsageStats([], null)
    })

    expect(results[0]?.name).toBe('流泪猫猫头')
  })

  it('avoids opposite-intent stickers for emotional queries', () => {
    const stickers = [
      { id: 's1', name: '开心小狗' },
      { id: 's2', name: '流泪猫猫头' }
    ]
    const activeChat = {
      id: 'chat-1',
      msgs: [
        { id: 'm1', role: 'assistant', content: '刚刚大家都在哈哈哈', time: 10 },
        { id: 'm2', role: 'user', content: '我现在好难过', time: 20 }
      ]
    }

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '难过死了',
      activeChat
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats([{ id: 'chat-1', msgs: activeChat.msgs }], 'chat-1')
    })

    expect(results[0]?.name).toBe('流泪猫猫头')
    expect(results.some(item => item.name === '开心小狗')).toBe(false)
  })

  it('uses recent conversation context to surface relevant stickers', () => {
    const stickers = [
      { id: 's1', name: '流泪猫猫头' },
      { id: 's2', name: '哈哈小狗' },
      { id: 's3', name: '摸鱼水獭' }
    ]

    const activeChat = {
      id: 'chat-1',
      msgs: [
        { id: 'm1', role: 'assistant', content: '今天开会又被老板点名了，真的有点委屈', time: 10 },
        { id: 'm2', role: 'user', content: '我现在只想发个表情', time: 20 }
      ]
    }

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '啊啊啊',
      activeChat
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats([{ id: 'chat-1', msgs: activeChat.msgs }], 'chat-1')
    })

    expect(results[0]?.name).toBe('流泪猫猫头')
  })

  it('does not surface unrelated stickers for generic filler text', () => {
    const stickers = [
      { id: 's1', name: '打工小狗' },
      { id: 's2', name: '流泪猫猫头' }
    ]
    const activeChat = {
      id: 'chat-1',
      msgs: [
        { id: 'm1', role: 'assistant', content: '今天上班又开会了', time: 10 },
        { id: 'm2', role: 'user', content: '我看看', time: 20 }
      ]
    }

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '今天',
      activeChat
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats([{ id: 'chat-1', msgs: activeChat.msgs }], 'chat-1')
    })

    expect(results).toEqual([])
  })

  it('does not backfill unrelated scenario stickers for a response-like query', () => {
    const stickers = [
      { id: 's1', name: '打工小狗' },
      { id: 's2', name: '摸鱼水獭' }
    ]
    const activeChat = {
      id: 'chat-1',
      msgs: [
        { id: 'm1', role: 'assistant', content: '今天上班好累', time: 10 },
        { id: 'm2', role: 'user', content: '我知道了', time: 20 }
      ]
    }

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '好的',
      activeChat
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats([{ id: 'chat-1', msgs: activeChat.msgs }], 'chat-1')
    })

    expect(results).toEqual([])
  })

  it('extracts important single-character keywords from longer sentences', () => {
    const stickerIndex = buildStickerSuggestionIndex([
      { id: 's1', name: '累瘫小狗' },
      { id: 's2', name: '开心猫猫' }
    ])

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '今天真的累死了'
    }))

    const results = getStickerCandidates({
      stickerIndex,
      context,
      usageStats: buildStickerUsageStats([], null)
    })

    expect(results[0]?.name).toBe('累瘫小狗')
  })

  it('keeps literal keyword hits ahead of context-heavy semantic matches', () => {
    const stickers = [
      { id: 's1', name: '前途一片早八啊' },
      { id: 's2', name: '打工小狗' },
      { id: 's3', name: '周一上班' },
      { id: 's4', name: '困困猫猫' }
    ]
    const contacts = [
      {
        id: 'chat-1',
        msgs: [
          { id: 'm1', role: 'assistant', content: '今天上班加班真的好累', time: 10 },
          { id: 'm2', role: 'user', isSticker: true, stickerName: '打工小狗', time: 20 },
          { id: 'm3', role: 'user', isSticker: true, stickerName: '打工小狗', time: 30 },
          { id: 'm4', role: 'user', isSticker: true, stickerName: '打工小狗', time: 40 }
        ]
      }
    ]

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '早八',
      activeChat: contacts[0]
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats(contacts, 'chat-1')
    })

    expect(results[0]?.name).toBe('前途一片早八啊')
  })

  it('keeps reaction-like fallback aligned with emotional context instead of unrelated scenarios', () => {
    const stickers = [
      { id: 's1', name: '流泪猫猫头' },
      { id: 's2', name: '打工小狗' }
    ]
    const contacts = [
      {
        id: 'chat-1',
        msgs: [
          { id: 'm1', role: 'assistant', content: '今天被老板说了一顿，真的好委屈', time: 10 },
          { id: 'm2', role: 'user', content: '我现在也不想上班', time: 20 }
        ]
      }
    ]

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '啊啊啊',
      activeChat: contacts[0]
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats(contacts, 'chat-1')
    })

    expect(results[0]?.name).toBe('流泪猫猫头')
    expect(results.some(item => item.name === '打工小狗')).toBe(false)
  })

  it('boosts frequently used stickers in blank command mode', () => {
    const contacts = [
      {
        id: 'chat-1',
        msgs: [
          { id: 'm1', role: 'user', isSticker: true, stickerName: '哈哈小狗', time: 100 },
          { id: 'm2', role: 'user', isSticker: true, stickerName: '哈哈小狗', time: 200 },
          { id: 'm3', role: 'user', isSticker: true, stickerName: '流泪猫猫头', time: 300 }
        ]
      }
    ]

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '(sticker:',
      activeChat: contacts[0]
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex([
        { id: 's1', name: '哈哈小狗' },
        { id: 's2', name: '流泪猫猫头' },
        { id: 's3', name: '摸鱼水獭' }
      ]),
      context,
      usageStats: buildStickerUsageStats(contacts, 'chat-1')
    })

    expect(results[0]?.name).toBe('哈哈小狗')
  })

  it('prefers candidates covering multiple explicit query terms', () => {
    const stickerIndex = buildStickerSuggestionIndex([
      { id: 's1', name: '点头猫猫' },
      { id: 's2', name: '哭哭小狗' },
      { id: 's3', name: '哭哭猫猫' }
    ])

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '(sticker: 猫 哭'
    }))

    const results = getStickerCandidates({
      stickerIndex,
      context,
      usageStats: buildStickerUsageStats([], null)
    })

    expect(results.map(item => item.name)).toEqual(['哭哭猫猫'])
  })

  it('avoids repeating the just-used sticker when intent matches several options', () => {
    const stickers = [
      { id: 's1', name: '哈哈小狗' },
      { id: 's2', name: '开心猫猫' }
    ]
    const contacts = [
      {
        id: 'chat-1',
        msgs: [
          { id: 'm1', role: 'user', isSticker: true, stickerName: '哈哈小狗', time: 100 }
        ]
      }
    ]

    const context = buildStickerCandidateContext(makeContext({
      inputValue: '哈哈哈哈',
      activeChat: contacts[0]
    }))

    const results = getStickerCandidates({
      stickerIndex: buildStickerSuggestionIndex(stickers),
      context,
      usageStats: buildStickerUsageStats(contacts, 'chat-1')
    })

    expect(results[0]?.name).toBe('开心猫猫')
  })
})
