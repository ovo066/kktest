import { describe, expect, it, vi } from 'vitest'
import {
  appendAssistantErrorMessage,
  applyContentFilterNotice,
  applyReplyMetadata,
  assertVisibleAssistantReply,
  createAssistantMessage,
  finalizeStreamingAssistantReply,
  handleAssistantRequestFailure
} from './assistantMessageLifecycle'
import { API_ERROR_CODES } from './errors'

describe('assistantMessageLifecycle', () => {
  it('creates assistant messages with shared defaults', () => {
    const msg = createAssistantMessage(() => 'msg_1', 'trace_1', {
      senderName: 'Alice',
      content: '(transfer:66)'
    })
    expect(msg).toMatchObject({
      id: 'msg_1',
      role: 'assistant',
      content: '(transfer:66)',
      traceId: 'trace_1',
      senderName: 'Alice',
      interactionStatus: 'pending'
    })
  })

  it('applies quoted reply metadata and strips sender prefix', () => {
    const history = [{ id: 'old_1', content: 'hello world' }]
    const msg = {
      id: 'new_1',
      content: '[Alice]： [quote:hello world] hi there'
    }

    applyReplyMetadata(msg, history, {
      prefixRegex: /^\[Alice\][:：]\s*/i,
      buildDisplayContent(text) {
        return text
      }
    })

    expect(msg.content).toBe('hi there')
    expect(msg.displayContent).toBe('hi there')
    expect(msg.replyToText).toBe('hello world')
    expect(msg.replyTo).toBe('old_1')
  })

  it('preserves image token in raw content when extracting quoted reply', () => {
    const history = [{ id: 'old_1', content: 'hello world' }]
    const msg = {
      id: 'new_img_1',
      content: '[quote:hello world] 好的 (image:sunset, beach)'
    }

    applyReplyMetadata(msg, history, {
      buildDisplayContent(text) {
        return String(text || '')
          .replace(/\(image:[^)]+\)/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
      }
    })

    expect(msg.replyToText).toBe('hello world')
    expect(msg.replyTo).toBe('old_1')
    expect(msg.content).toContain('(image:sunset, beach)')
    expect(msg.displayContent).toBe('好的')
  })

  it('keeps multi-line reply content when extracting quote metadata', () => {
    const history = [{ id: 'old_1', content: 'hello world' }]
    const msg = {
      id: 'new_multiline_1',
      content: '[quote:hello world]\n第一句\n第二句'
    }

    applyReplyMetadata(msg, history, {
      buildDisplayContent(text) {
        return text
      }
    })

    expect(msg.replyToText).toBe('hello world')
    expect(msg.replyTo).toBe('old_1')
    expect(msg.content).toBe('第一句\n第二句')
    expect(msg.displayContent).toBe('第一句\n第二句')
  })

  it('marks replies truncated by content filters', () => {
    const msg = { content: 'hello' }
    const marked = applyContentFilterNotice(msg, { finishReason: 'content_filter' })

    expect(marked).toBe(true)
    expect(msg.contentFiltered).toBe(true)
    expect(msg.content).toContain('⚠️ 回复被内容安全策略截断。')
  })

  it('finalizes streamed replies with shared post-processing', () => {
    const pushMomentsIslandNotifications = vi.fn()
    const applyForumOnlyPlaceholder = vi.fn(() => true)
    const parseMomentContent = vi.fn(() => ({ moments: 1, latestMomentContent: 'new post' }))
    const activeChat = {
      msgs: [
        { id: 'old_1', content: 'hello world' },
        { id: 'new_1', content: '[Alice]： [quote:hello world] hi there\n(transfer:88:奶茶钱)' }
      ]
    }
    const msg = activeChat.msgs[1]

    const result = finalizeStreamingAssistantReply({
      message: msg,
      activeChat,
      streamInfo: { finishReason: 'content_filter' },
      prefixRegex: /^\[Alice\][:：]\s*/i,
      buildDisplayContent(text) {
        return text
      },
      makeMsgId: () => 'event_msg_1',
      syncForumToAI: true,
      parseMomentContent,
      actor: { id: 'alice', name: 'Alice' },
      applyForumOnlyPlaceholder,
      pushMomentsIslandNotifications,
      visibility: {
        mode: 'single',
        traceId: 'trace_stream',
        model: 'gpt-test',
        url: 'https://example.com',
        allowAIImageGeneration: true
      }
    })

    expect(msg.contentFiltered).toBe(true)
    expect(msg.replyToText).toBe('hello world')
    expect(msg.replyTo).toBe('old_1')
    expect(msg.interactionStatus).toBe('pending')
    expect(parseMomentContent).toHaveBeenCalled()
    expect(applyForumOnlyPlaceholder).toHaveBeenCalledWith(msg, { moments: 1, latestMomentContent: 'new post' })
    expect(pushMomentsIslandNotifications).toHaveBeenCalledWith({ moments: 1, latestMomentContent: 'new post' }, { id: 'alice', name: 'Alice' })
    expect(result).toEqual({
      forumOnly: true,
      parsedMomentsResult: { moments: 1, latestMomentContent: 'new post' },
      acceptedMeet: false
    })
  })

  it('marks accepted meet replies so chat view can enter offline mode', () => {
    const activeChat = {
      offlinePresetId: 'preset_walk',
      offlineLayout: 'story',
      offlineAvatarMode: 'side',
      offlineRegexRules: [],
      offlineMsgs: [{ id: 'offline_old_1' }],
      msgs: [
        { id: 'meet_user_1', role: 'user', content: '(meet:公园::一起散步)' },
        { id: 'meet_assistant_1', role: 'assistant', content: '(accept:meet)' }
      ]
    }
    const msg = activeChat.msgs[1]

    const result = finalizeStreamingAssistantReply({
      message: msg,
      activeChat,
      streamInfo: { finishReason: 'stop' },
      buildDisplayContent(text) {
        return text
      },
      makeMsgId: () => 'event_meet_accept_2',
      visibility: {
        mode: 'single',
        traceId: 'trace_meet_accept',
        model: 'gpt-test',
        url: 'https://example.com',
        allowAIImageGeneration: true
      }
    })

    expect(result).toEqual({
      forumOnly: false,
      parsedMomentsResult: null,
      interactionOnly: true,
      acceptedMeet: true
    })
    expect(msg.hideInChat).toBe(true)
    expect(activeChat.meetSceneContext).toMatchObject({
      location: '公园',
      time: '',
      note: '一起散步'
    })
    expect(activeChat.offlineMsgs).toEqual([])
  })

  it('throws EMPTY_REPLY when reply has no visible text', () => {
    expect(() => {
      assertVisibleAssistantReply({
        message: { content: '   ', displayContent: '   ' },
        mode: 'single',
        traceId: 'trace_empty',
        model: 'gpt-test',
        url: 'https://example.com',
        streamInfo: { finishReason: 'stop' },
        allowAIImageGeneration: true
      })
    }).toThrow(/empty reply/)
  })

  it('appends assistant error message to active chat', () => {
    const activeChat = { msgs: [] }
    appendAssistantErrorMessage({
      activeChat,
      makeMsgId: () => 'err_1',
      friendlyError: 'request failed',
      traceId: 'trace_err',
      extra: { senderName: 'System' }
    })

    expect(activeChat.msgs).toHaveLength(1)
    expect(activeChat.msgs[0]).toMatchObject({
      id: 'err_1',
      content: '⚠️ request failed',
      traceId: 'trace_err',
      senderName: 'System',
      errorCode: 'API_ERROR'
    })
  })

  it('builds a shared assistant failure result', () => {
    const activeChat = { msgs: [] }
    const removeMessageIfVisiblyEmpty = vi.fn()
    const result = handleAssistantRequestFailure({
      activeChat,
      removeMessageIfVisiblyEmpty,
      createdMsgId: 'temp_1',
      buildFriendlyErrorMessage: () => 'friendly failure',
      makeMsgId: () => 'err_2',
      traceId: 'trace_fail',
      error: { code: API_ERROR_CODES.NETWORK_ERROR },
      extra: { senderName: 'Alice' }
    })

    expect(removeMessageIfVisiblyEmpty).toHaveBeenCalledWith(activeChat, 'temp_1')
    expect(activeChat.msgs[0]).toMatchObject({
      id: 'err_2',
      content: '⚠️ friendly failure',
      senderName: 'Alice',
      errorCode: API_ERROR_CODES.NETWORK_ERROR
    })
    expect(result).toEqual({
      success: false,
      error: 'friendly failure',
      code: API_ERROR_CODES.NETWORK_ERROR,
      retryable: true,
      traceId: 'trace_fail'
    })
  })
})
