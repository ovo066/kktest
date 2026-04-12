import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runGroupSingleChatOrchestrator: vi.fn(),
  runGroupMultiChatOrchestrator: vi.fn()
}))

vi.mock('./groupSingleChatOrchestrator', () => ({
  runGroupSingleChatOrchestrator: mocks.runGroupSingleChatOrchestrator
}))

vi.mock('./groupMultiChatOrchestrator', () => ({
  runGroupMultiChatOrchestrator: mocks.runGroupMultiChatOrchestrator
}))

import { runGroupChatOrchestrator } from './groupChatOrchestrator'

describe('groupChatOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a shared failure when the active chat is not a group', async () => {
    const buildApiFailure = vi.fn((_code, _message, context) => ({
      success: false,
      code: 'GROUP_CHAT_REQUIRED',
      context
    }))

    const result = await runGroupChatOrchestrator({
      contactsStore: { activeChat: null },
      buildApiFailure
    })

    expect(buildApiFailure).toHaveBeenCalledWith('GROUP_CHAT_REQUIRED', '当前不是群聊', {
      feature: 'chat',
      action: 'callGroupAPI'
    })
    expect(result).toEqual({
      success: false,
      code: 'GROUP_CHAT_REQUIRED',
      context: {
        feature: 'chat',
        action: 'callGroupAPI'
      }
    })
  })

  it('dispatches single-api groups to the single orchestrator', async () => {
    mocks.runGroupSingleChatOrchestrator.mockResolvedValue({ success: true, mode: 'single' })

    const context = {
      contactsStore: {
        activeChat: { id: 'group_1', type: 'group', groupMode: 'single' }
      },
      buildApiFailure: vi.fn()
    }

    const result = await runGroupChatOrchestrator(context, vi.fn())

    expect(mocks.runGroupSingleChatOrchestrator).toHaveBeenCalledWith(context, expect.any(Function))
    expect(mocks.runGroupMultiChatOrchestrator).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, mode: 'single' })
  })

  it('requires a selected member before dispatching multi-api groups', async () => {
    const buildApiFailure = vi.fn((_code, _message, context) => ({
      success: false,
      code: 'MEMBER_NOT_SELECTED',
      context
    }))

    const result = await runGroupChatOrchestrator({
      contactsStore: {
        activeChat: { id: 'group_1', type: 'group', groupMode: 'multi' },
        selectedMemberId: ''
      },
      buildApiFailure
    })

    expect(buildApiFailure).toHaveBeenCalledWith('MEMBER_NOT_SELECTED', '请先选择发言成员', {
      feature: 'chat',
      action: 'callGroupAPI'
    })
    expect(result).toEqual({
      success: false,
      code: 'MEMBER_NOT_SELECTED',
      context: {
        feature: 'chat',
        action: 'callGroupAPI'
      }
    })
  })

  it('dispatches multi-api groups to the member orchestrator', async () => {
    mocks.runGroupMultiChatOrchestrator.mockResolvedValue({ success: true, mode: 'multi' })

    const context = {
      contactsStore: {
        activeChat: { id: 'group_1', type: 'group', groupMode: 'multi' },
        selectedMemberId: 'member_1'
      },
      buildApiFailure: vi.fn()
    }
    const onChunk = vi.fn()

    const result = await runGroupChatOrchestrator(context, onChunk)

    expect(mocks.runGroupMultiChatOrchestrator).toHaveBeenCalledWith(context, 'member_1', onChunk)
    expect(mocks.runGroupSingleChatOrchestrator).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, mode: 'multi' })
  })
})
