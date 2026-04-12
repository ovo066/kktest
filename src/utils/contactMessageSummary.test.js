import { describe, expect, it } from 'vitest'
import {
  applyContactMessageSummary,
  buildContactMessageSummary,
  buildMessagePreview,
  getLastVisibleMessage
} from './contactMessageSummary'

describe('contactMessageSummary', () => {
  it('builds lightweight previews without full parser', () => {
    expect(buildMessagePreview({ content: '[quote:上一条]\n[emotion:happy](voice:你好呀)' })).toBe('[语音]')
    expect(buildMessagePreview({ content: '(image:sunset)' })).toBe('[图片]')
    expect(buildMessagePreview({ isSticker: true, stickerName: '挥手' })).toBe('[表情包: 挥手]')
    expect(buildMessagePreview({ content: '*看着你笑了笑*' })).toBe('看着你笑了笑')
  })

  it('uses only the last visible content part for previews', () => {
    expect(buildMessagePreview({ content: '第一句\n第二句' })).toBe('第二句')
    expect(buildMessagePreview({ content: '*看了你一眼*\n那我先走啦' })).toBe('那我先走啦')
    expect(buildMessagePreview({ content: '好的\n(sticker:挥手)' })).toBe('[表情包: 挥手]')
  })

  it('skips hidden messages when summarizing contacts', () => {
    const contact = {
      msgs: [
        { id: '1', content: '第一条', time: 1 },
        { id: '2', content: '隐藏', time: 2, hidden: true },
        { id: '3', content: '(voice:你好)', time: 3, senderName: '小张' }
      ]
    }

    expect(getLastVisibleMessage(contact)?.id).toBe('3')
    expect(buildContactMessageSummary(contact)).toMatchObject({
      lastMsgId: '3',
      lastMsgPreview: '[语音]',
      lastMsgSenderName: '小张',
      lastMsgTime: 3,
      msgCount: 3
    })
  })

  it('falls back to cached metadata when messages are partitioned out', () => {
    const contact = {
      id: 'c1',
      msgCount: 12,
      lastMsgId: 'm9',
      lastMsgPreview: '最近一条',
      lastMsgSenderName: '小李',
      lastMsgTime: 123
    }

    expect(buildContactMessageSummary(contact)).toMatchObject({
      lastMsgId: 'm9',
      lastMsgPreview: '最近一条',
      lastMsgSenderName: '小李',
      lastMsgTime: 123,
      msgCount: 12
    })
  })

  it('writes summary fields back to contact objects', () => {
    const contact = {
      msgs: [{ id: 'm1', content: '你好', time: 99 }]
    }

    applyContactMessageSummary(contact)

    expect(contact).toMatchObject({
      lastMsgId: 'm1',
      lastMsgPreview: '你好',
      lastMsgTime: 99,
      msgCount: 1
    })
  })
})

