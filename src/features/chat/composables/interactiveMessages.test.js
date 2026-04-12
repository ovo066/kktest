import { describe, expect, it } from 'vitest'
import {
  applyAssistantInteractionDecisions,
  buildHiddenInteractionEvent,
  ensureInteractiveMessagePending,
  getInteractionState,
  normalizeInteractionStatus,
  setInteractionState
} from './interactiveMessages'

describe('interactiveMessages', () => {
  it('defaults each interactive part to pending when status is missing', () => {
    const message = {
      id: 'msg_mix_1',
      role: 'assistant',
      content: '(transfer:88:午饭钱)\n(meet:外滩:今晚八点)'
    }

    const changed = ensureInteractiveMessagePending(message)

    expect(changed).toBe(true)
    expect(getInteractionState(message, 0).status).toBe('pending')
    expect(getInteractionState(message, 1).status).toBe('pending')
  })

  it('stores interaction status per part index', () => {
    const message = {
      id: 'msg_mix_2',
      role: 'assistant',
      content: '(transfer:88)\n(meet:外滩)'
    }

    ensureInteractiveMessagePending(message)
    setInteractionState(message, 0, 'accepted', 100)

    expect(getInteractionState(message, 0)).toEqual({ status: 'accepted', respondedAt: 100 })
    expect(getInteractionState(message, 1)).toEqual({ status: 'pending', respondedAt: null })
  })

  it('normalizes known interaction statuses and falls back for invalid values', () => {
    expect(normalizeInteractionStatus('Accepted')).toBe('accepted')
    expect(normalizeInteractionStatus('unknown')).toBe('pending')
    expect(normalizeInteractionStatus('', '')).toBe('')
  })

  it('builds hidden user events for accepted assistant transfer cards', () => {
    const event = buildHiddenInteractionEvent({
      makeId: () => 'event_1',
      message: {
        id: 'msg_transfer_2',
        role: 'assistant',
        content: '(transfer:520:情人节红包)'
      },
      partIndex: 0,
      status: 'accepted',
      actorRole: 'user',
      now: 123
    })

    expect(event).toMatchObject({
      id: 'event_1',
      role: 'user',
      time: 123,
      hideInChat: true,
      interactionEvent: true,
      interactionSourceMsgId: 'msg_transfer_2',
      interactionSourcePartIndex: 0,
      interactionSourceType: 'transfer'
    })
    expect(event.content).toBe('[互动事件] 用户已接收你发起的转账：¥520，备注：情人节红包。')
  })

  it('applies assistant decision tokens to the latest pending user card', () => {
    const activeChat = {
      msgs: [
        {
          id: 'user_transfer_1',
          role: 'user',
          content: '(transfer:66:请你收下)'
        },
        {
          id: 'assistant_1',
          role: 'assistant',
          content: '谢谢你。\n(accept:transfer)'
        }
      ]
    }
    ensureInteractiveMessagePending(activeChat.msgs[0])

    const result = applyAssistantInteractionDecisions({
      activeChat,
      message: activeChat.msgs[1],
      makeId: () => 'event_accept_1'
    })

    expect(result.resolvedCount).toBe(1)
    expect(activeChat.msgs[1].content).toBe('谢谢你。')
    expect(getInteractionState(activeChat.msgs[0], 0).status).toBe('accepted')
    expect(activeChat.msgs.at(-1)?.content).toBe('[互动事件] 你已接收用户发起的转账：¥66，备注：请你收下。')
  })

  it('activates an offline meet scene when assistant accepts the latest pending meet invite', () => {
    const activeChat = {
      offlinePresetId: 'preset_cafe',
      offlineLayout: 'cinematic',
      offlineAvatarMode: 'full',
      offlineThemeConfig: { customCss: '.scene { color: pink; }' },
      offlineRegexRules: [{ id: 'rule_1', pattern: '.*' }],
      offlineMsgs: [{ id: 'old_scene_msg' }],
      msgs: [
        {
          id: 'user_meet_1',
          role: 'user',
          content: '(meet:外滩::一起喝杯咖啡)'
        },
        {
          id: 'assistant_meet_1',
          role: 'assistant',
          content: '好啊，我们见面吧。\n(accept:meet)'
        }
      ]
    }
    ensureInteractiveMessagePending(activeChat.msgs[0])

    const result = applyAssistantInteractionDecisions({
      activeChat,
      message: activeChat.msgs[1],
      makeId: () => 'event_meet_accept_1'
    })

    expect(result).toMatchObject({
      resolvedCount: 1,
      acceptedMeet: true,
      acceptedMeetCount: 1
    })
    expect(activeChat.meetSceneContext).toMatchObject({
      location: '外滩',
      time: '',
      note: '一起喝杯咖啡',
      offlineConfig: {
        presetId: 'preset_cafe',
        layout: 'cinematic',
        avatarMode: 'full',
        themeConfig: { customCss: '.scene { color: pink; }' },
        regexRules: [{ id: 'rule_1', pattern: '.*' }]
      }
    })
    expect(activeChat.offlineMsgs).toEqual([])
    expect(activeChat.offlineArchiveCursor).toBe(0)
  })
})
