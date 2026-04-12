import { describe, expect, it, vi } from 'vitest'
import { useChatPlannerActions } from './useChatPlannerActions'

describe('useChatPlannerActions', () => {
  it('still strips hidden planner tags when auto capture is disabled', async () => {
    const showToast = vi.fn()
    const { processAssistantPlannerActions } = useChatPlannerActions({
      store: { allowAIPlannerCapture: false },
      plannerStore: {
        events: [],
        addEvent: vi.fn()
      },
      showToast
    })

    const contact = {
      id: 'chat_1',
      msgs: [{
        id: 'msg_1',
        role: 'assistant',
        content: '好的。\n<planner_add>\ntitle: 记得报名\n</planner_add>'
      }]
    }

    const result = await processAssistantPlannerActions(contact, new Set())

    expect(result.addedEvents).toEqual([])
    expect(contact.msgs[0].content).toBe('好的。')
    expect(showToast).not.toHaveBeenCalled()
  })

  it('persists planner events and shows toast when auto capture is enabled', async () => {
    const added = []
    const showToast = vi.fn()
    const plannerStore = {
      events: [],
      addEvent(data) {
        const event = { id: `evt_${this.events.length + 1}`, ...data }
        this.events.push(event)
        added.push(event)
        return event
      }
    }
    const { processAssistantPlannerActions } = useChatPlannerActions({
      store: { allowAIPlannerCapture: true },
      plannerStore,
      showToast
    })

    const contact = {
      id: 'chat_2',
      msgs: [{
        id: 'msg_2',
        role: 'assistant',
        content: '收到。\n<planner_add>\ntitle: 复查\ndate: 2026-03-20\ntime: 09:00\n</planner_add>'
      }]
    }

    const result = await processAssistantPlannerActions(contact, new Set())

    expect(result.addedEvents).toHaveLength(1)
    expect(added[0]).toMatchObject({
      title: '复查',
      source: 'assistant'
    })
    expect(showToast).toHaveBeenCalledWith('已记入日程：复查，可在任务/日历查看', 4200)
    expect(contact.msgs[0].content).toBe('收到。')
  })

  it('shows a failure toast when planner block cannot be converted into an event', async () => {
    const showToast = vi.fn()
    const { processAssistantPlannerActions } = useChatPlannerActions({
      store: { allowAIPlannerCapture: true },
      plannerStore: {
        events: [],
        addEvent: vi.fn()
      },
      showToast
    })

    const contact = {
      id: 'chat_3',
      msgs: [{
        id: 'msg_3',
        role: 'assistant',
        content: '好的。\n<planner_add>\n备注: 只是备注，没有标题\n</planner_add>'
      }]
    }

    const result = await processAssistantPlannerActions(contact, new Set())

    expect(result.addedEvents).toEqual([])
    expect(result.invalidCount).toBe(1)
    expect(showToast).toHaveBeenCalledWith('识别到日程指令，但未成功写入', 3600)
  })
})
