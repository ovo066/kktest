import { describe, expect, it } from 'vitest'
import { parseMessageContent } from '../features/chat'
import {
  MESSAGE_CONTENT_PART_PARSE_OPTIONS,
  buildMessagePartDetailText,
  buildMessagePartSearchText,
  buildMessagePartSnippet
} from './messageContentParts'

describe('messageContentParts', () => {
  it('parses structured tokens with the shared parse options', () => {
    const parts = parseMessageContent('第一句\n(sticker:比心)\n(gift:咖啡:早安)', MESSAGE_CONTENT_PART_PARSE_OPTIONS)

    expect(parts.map(part => part.type)).toEqual(['normal', 'sticker', 'gift'])
    expect(parts[1]).toMatchObject({ name: '比心' })
    expect(parts[2]).toMatchObject({ item: '咖啡', message: '早安' })
  })

  it('builds normalized search text for structured parts', () => {
    expect(buildMessagePartSearchText({ type: 'sticker', name: ' 比心 ' })).toBe('表情包 比心')
    expect(buildMessagePartSearchText({ type: 'meet', location: '公园', time: '今晚8点', note: '别迟到' })).toBe('邀约 公园 今晚8点 别迟到')
  })

  it('builds favorite snippet and detail text for structured parts', () => {
    expect(buildMessagePartSnippet({ type: 'transfer', amount: '88.80', note: '晚饭' })).toBe('[转账]')
    expect(buildMessagePartDetailText({ type: 'transfer', amount: '88.80', note: '晚饭' })).toBe('转账：88.80 · 晚饭')
    expect(buildMessagePartDetailText({ type: 'text', content: '[quote:上一条]\n你好呀' })).toBe('你好呀')
  })
})