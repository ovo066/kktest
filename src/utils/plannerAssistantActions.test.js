import { describe, expect, it } from 'vitest'
import {
  applyAssistantPlannerActions,
  extractPlannerActionBlocks,
  stripPlannerActionBlocksForDisplay
} from './plannerAssistantActions'

describe('plannerAssistantActions', () => {
  it('extracts hidden planner blocks', () => {
    const blocks = extractPlannerActionBlocks(`好的。
<planner_add>
title: 复查
date: 2026-03-20
time: 09:00
</planner_add>`)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].fields).toMatchObject({
      title: '复查',
      date: '2026-03-20',
      time: '09:00'
    })
  })

  it('creates planner events from assistant hidden blocks and strips the block from chat', () => {
    const plannerStore = {
      events: [],
      addEvent(data) {
        const event = { id: `evt_${this.events.length + 1}`, ...data }
        this.events.push(event)
        return event
      }
    }
    const message = {
      id: 'msg_1',
      role: 'assistant',
      content: `好的，我先帮你记着。
<planner_add>
title: 复查
date: 明天下午三点
all_day: false
type: todo
note: 空腹
</planner_add>`
    }

    const result = applyAssistantPlannerActions({
      plannerStore,
      activeChat: { id: 'chat_1' },
      message,
      now: new Date('2026-03-13T10:00:00+08:00')
    })

    expect(result.addedEvents).toHaveLength(1)
    expect(result.addedEvents[0]).toMatchObject({
      title: '复查',
      startDate: '2026-03-14',
      startTime: '15:00',
      description: '空腹',
      source: 'assistant'
    })
    expect(message.content).toBe('好的，我先帮你记着。')
    expect(message.hideInChat).toBe(false)
  })

  it('allows long term plans without an exact date and skips duplicates', () => {
    const plannerStore = {
      events: [
        { id: 'evt_existing', title: '准备考研', startDate: '', startTime: '', kind: 'todo' }
      ],
      addEvent(data) {
        const event = { id: `evt_${this.events.length + 1}`, ...data }
        this.events.push(event)
        return event
      }
    }
    const message = {
      id: 'msg_2',
      role: 'assistant',
      content: `<planner_add>
title: 准备考研
type: todo
note: 长期计划
</planner_add>`
    }

    const result = applyAssistantPlannerActions({
      plannerStore,
      activeChat: { id: 'chat_2' },
      message
    })

    expect(result.addedEvents).toHaveLength(0)
    expect(result.duplicateCount).toBe(1)
    expect(message.hideInChat).toBe(true)
  })

  it('strips planner blocks from chat even when auto persistence is disabled', () => {
    const plannerStore = {
      events: [],
      addEvent() {
        throw new Error('should not persist when disabled')
      }
    }
    const message = {
      id: 'msg_3',
      role: 'assistant',
      content: '好的。\n<planner_add>\ntitle: 记得体检\n</planner_add>'
    }

    const result = applyAssistantPlannerActions({
      plannerStore,
      activeChat: { id: 'chat_3' },
      message,
      enabled: false
    })

    expect(result.addedEvents).toHaveLength(0)
    expect(message.content).toBe('好的。')
    expect(message.hideInChat).toBe(false)
  })

  it('hides an unfinished planner block during streaming display', () => {
    expect(stripPlannerActionBlocksForDisplay('先聊这个\n<planner_add>\ntitle: 周末看牙')).toBe('先聊这个')
  })

  it('parses Chinese keys and natural language title lines', () => {
    const plannerStore = {
      events: [],
      addEvent(data) {
        const event = { id: `evt_${this.events.length + 1}`, ...data }
        this.events.push(event)
        return event
      }
    }
    const message = {
      id: 'msg_4',
      role: 'assistant',
      content: `<planner_add>
标题：下周三下午三点复查
备注：空腹
类型：待办
</planner_add>`
    }

    const result = applyAssistantPlannerActions({
      plannerStore,
      activeChat: { id: 'chat_4' },
      message,
      now: new Date('2026-03-13T10:00:00+08:00')
    })

    expect(result.addedEvents).toHaveLength(1)
    expect(result.addedEvents[0]).toMatchObject({
      title: '复查',
      startDate: '2026-03-18',
      startTime: '15:00',
      description: '空腹'
    })
  })

  it('builds a task when only when-field is provided', () => {
    const plannerStore = {
      events: [],
      addEvent(data) {
        const event = { id: `evt_${this.events.length + 1}`, ...data }
        this.events.push(event)
        return event
      }
    }
    const message = {
      id: 'msg_5',
      role: 'assistant',
      content: `<planner_add>
when: 明天下午三点复查
</planner_add>`
    }

    const result = applyAssistantPlannerActions({
      plannerStore,
      activeChat: { id: 'chat_5' },
      message,
      now: new Date('2026-03-13T10:00:00+08:00')
    })

    expect(result.addedEvents).toHaveLength(1)
    expect(result.addedEvents[0]).toMatchObject({
      title: '复查',
      startDate: '2026-03-14',
      startTime: '15:00'
    })
  })
})
