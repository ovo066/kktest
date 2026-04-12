import { describe, expect, it } from 'vitest'
import { useMessageParser } from './useMessageParser'

function createParser(messages, options = {}) {
  return useMessageParser({
    getMessages: () => messages,
    getStickerUrl: () => '',
    showTimestamps: () => false,
    allowAIStickers: () => true,
    allowAITransfer: () => true,
    allowAIGift: () => true,
    allowAIVoice: () => true,
    allowAICall: () => true,
    allowAIMockImage: () => true,
    allowAIMusicRecommend: () => true,
    allowAIMeet: () => true,
    showToolLog: () => !!options.showToolLog,
    timestampGapMs: 0,
    getAnimateMsgId: () => null,
    isGroupChat: () => false,
    getGroupMembers: () => [],
    showChatAvatars: () => false,
    getContactAvatar: () => null,
    getUserAvatar: () => null,
    showNarrations: () => true,
    getMockImagePlaceholder: () => '',
    getActiveContactId: () => options.activeContactId || ''
  })
}

describe('useMessageParser', () => {
  it('binds direct assistant voice blocks to the active chat contact', () => {
    const { blocks } = createParser([
      {
        id: 'msg-1',
        role: 'assistant',
        content: '(voice:当前聊天角色语音)'
      }
    ], {
      activeContactId: 'contact-direct-1'
    })

    expect(blocks.value).toMatchObject([
      {
        type: 'voice',
        msgId: 'msg-1',
        contactId: 'contact-direct-1',
        text: '当前聊天角色语音'
      }
    ])
  })

  it('preserves contactId on parsed voice blocks', () => {
    const { blocks } = createParser([
      {
        id: 'msg-1',
        role: 'assistant',
        contactId: 'contact-1',
        content: '(voice:收藏里的语音)'
      }
    ])

    expect(blocks.value).toMatchObject([
      {
        type: 'voice',
        msgId: 'msg-1',
        contactId: 'contact-1',
        text: '收藏里的语音'
      }
    ])
  })

  it('prefers sourceMsgId for block msgId when rendering preview messages', () => {
    const { blocks } = createParser([
      {
        id: 'preview-msg-1',
        sourceMsgId: 'source-msg-1',
        role: 'assistant',
        content: '预览气泡'
      }
    ])

    expect(blocks.value).toMatchObject([
      {
        type: 'bubble',
        msgId: 'source-msg-1',
        text: '预览气泡'
      }
    ])
  })

  it('prefers sourceMsgId when preview messages use synthetic ids', () => {
    const { blocks } = createParser([
      {
        id: 'preview-msg-1',
        sourceMsgId: 'msg-1',
        role: 'assistant',
        content: '预览消息'
      }
    ])

    expect(blocks.value).toMatchObject([
      {
        type: 'bubble',
        msgId: 'msg-1',
        text: '预览消息'
      }
    ])
  })

  it('normalizes and truncates long reply preview text', () => {
    const longReply = `第一行\n第二行 ${'很长的引用'.repeat(40)}`
    const { blocks } = createParser([
      {
        id: 'msg-1',
        role: 'assistant',
        content: '收到',
        replyToText: longReply
      }
    ])

    expect(blocks.value).toHaveLength(1)
    expect(blocks.value[0].replyText).toContain('第一行 第二行')
    expect(blocks.value[0].replyText).not.toContain('\n')
    expect(blocks.value[0].replyText.endsWith('…')).toBe(true)
    expect(blocks.value[0].replyText.length).toBeLessThanOrEqual(141)
  })

  it('does not render empty assistant placeholders as chat bubbles', () => {
    const { blocks } = createParser([
      {
        id: 'msg-1',
        role: 'assistant',
        content: ''
      }
    ])

    expect(blocks.value).toEqual([])
  })

  it('renders tool log cards before the assistant bubble when enabled', () => {
    const { blocks } = createParser([
      {
        id: 'msg-1',
        role: 'assistant',
        content: '已经帮你处理好了',
        toolLogs: [
          {
            source: 'mcp',
            sourceLabel: 'MCP',
            success: true,
            displayName: 'create_page',
            subtitle: 'Notion · create_page',
            summary: '已返回 pageId',
            argsPreview: '{\n  "title": "周计划"\n}',
            resultPreview: '{\n  "pageId": "page_1"\n}',
            durationLabel: '32 ms',
            round: 1
          }
        ]
      }
    ], {
      showToolLog: true
    })

    expect(blocks.value).toHaveLength(2)
    expect(blocks.value[0]).toMatchObject({
      type: 'toolLog',
      msgId: 'msg-1',
      title: 'create_page',
      summary: '已返回 pageId',
      durationLabel: '32 ms'
    })
    expect(blocks.value[1]).toMatchObject({
      type: 'bubble',
      msgId: 'msg-1',
      text: '已经帮你处理好了'
    })
  })

  it('hides tool log cards when the setting is disabled', () => {
    const { blocks } = createParser([
      {
        id: 'msg-1',
        role: 'assistant',
        content: '只显示正文',
        toolLogs: [
          {
            source: 'internal',
            sourceLabel: '内置工具',
            success: true,
            displayName: '创建日程事件',
            summary: '已返回 eventId',
            round: 1
          }
        ]
      }
    ])

    expect(blocks.value).toHaveLength(1)
    expect(blocks.value[0]).toMatchObject({
      type: 'bubble',
      text: '只显示正文'
    })
  })

  it('prefers persisted gift snapshots over live catalog lookup when rendering gift cards', () => {
    const { blocks } = createParser([
      {
        id: 'msg-gift-1',
        role: 'user',
        content: '(gift:玫瑰:送给你)',
        giftPartSnapshots: {
          0: {
            id: 'gift_custom_1',
            name: '演唱会门票',
            description: '去年一起看的那场',
            price: 520,
            image: 'data:image/png;base64,abc'
          }
        }
      }
    ])

    expect(blocks.value).toHaveLength(1)
    expect(blocks.value[0]).toMatchObject({
      type: 'gift',
      item: '演唱会门票',
      description: '去年一起看的那场',
      price: 520,
      imageUrl: 'data:image/png;base64,abc',
      message: '送给你'
    })
  })
})
