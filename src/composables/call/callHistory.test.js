import { describe, expect, it, vi } from 'vitest'
import {
  appendInviteLifecycleEvent,
  buildCallEventText,
  buildInviteLifecycleEventText,
  getEndReason,
  saveCallRecord
} from './callHistory'

describe('callHistory', () => {
  it('builds lifecycle text with normalized end reasons', () => {
    expect(getEndReason('', 'incoming', 'user')).toBe('user_decline')
    expect(getEndReason('', 'ringing', 'ai')).toBe('ai_cancel')
    expect(getEndReason('', 'connected', 'ai')).toBe('ai_hangup')

    const text = buildCallEventText({
      phase: 'connected',
      mode: 'video',
      durationSeconds: 83,
      endedBy: 'ai',
      endReason: 'ai_hangup',
      aiNote: '先去开会'
    }, (seconds) => `${seconds}s`)

    expect(text).toContain('视频通话已结束')
    expect(text).toContain('AI 挂断')
    expect(text).toContain('83s')
    expect(text).toContain('先去开会')
  })

  it('builds and appends invite lifecycle events', () => {
    expect(buildInviteLifecycleEventText('video', 'accept')).toContain('接听了 AI 发起的视频通话邀请')
    expect(buildInviteLifecycleEventText('voice', 'decline')).toContain('拒接了 AI 发起的语音通话邀请')

    const contact = { msgs: [] }
    const appended = appendInviteLifecycleEvent(contact, {
      mode: 'voice',
      eventType: 'accept'
    }, {
      makeMessageId: () => 'msg-1'
    })

    expect(appended).toBe(true)
    expect(contact.msgs).toHaveLength(1)
    expect(contact.msgs[0]).toMatchObject({
      id: 'msg-1',
      role: 'user',
      hideInChat: true,
      callLifecycleEvent: true
    })
    expect(contact.msgs[0].content).toContain('接听了 AI 发起的语音通话邀请')
  })

  it('persists call history items and visible transcript records', () => {
    const contact = { msgs: [], callHistory: [] }
    const scheduleSave = vi.fn()
    const makeMessageId = vi.fn((prefix) => `${prefix}-id`)

    saveCallRecord({
      contact,
      callMode: 'voice',
      callDuration: 42,
      callMessages: [
        { role: 'system', content: 'ignore', time: 1 },
        { role: 'user', content: '你好', time: 2 },
        { role: 'assistant', content: '[emotion:happy] 在呢', time: 3 }
      ],
      formatDuration: (seconds) => `0:${String(seconds).padStart(2, '0')}`,
      makeMessageId,
      scheduleSave,
      endedBy: 'user',
      endReason: 'user_hangup',
      aiNote: ''
    })

    expect(scheduleSave).toHaveBeenCalledTimes(1)
    expect(contact.callHistory).toHaveLength(1)
    expect(contact.callHistory[0].status).toBe('completed')
    expect(contact.callHistory[0].transcript).toEqual([
      { role: 'user', text: '你好', time: 2 },
      { role: 'assistant', text: '在呢', time: 3 }
    ])
    expect(contact.msgs).toHaveLength(1)
    expect(contact.msgs[0].isCallRecord).toBe(true)
    expect(contact.msgs[0].content).toContain('语音通话')
  })
})
