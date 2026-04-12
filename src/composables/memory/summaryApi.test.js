import { afterEach, describe, expect, it, vi } from 'vitest'
import { callSummaryAPI } from './summaryApi'
import { generateShortSummary } from './summaryLifecycle'

const originalFetch = globalThis.fetch

function createJsonTextResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(payload))
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('summaryApi', () => {
  it('prioritizes config maxTokens over request max_tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonTextResponse({
      choices: [{ message: { content: 'summary ok' }, finish_reason: 'stop' }]
    }))
    globalThis.fetch = fetchMock

    const result = await callSummaryAPI(
      {
        getConfig: {
          key: 'test-key',
          url: 'https://example.com',
          model: 'summary-model',
          maxTokens: 2048
        }
      },
      'system prompt',
      'user content',
      {},
      { max_tokens: 128, temperature: 0.3 }
    )

    expect(result.success).toBe(true)
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody.max_tokens).toBe(2048)
  })

  it('falls back to request max_tokens when config maxTokens is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonTextResponse({
      choices: [{ message: { content: 'summary ok' }, finish_reason: 'stop' }]
    }))
    globalThis.fetch = fetchMock

    const result = await callSummaryAPI(
      {
        getConfig: {
          key: 'test-key',
          url: 'https://example.com',
          model: 'summary-model'
        }
      },
      'system prompt',
      'user content',
      {},
      { max_tokens: 256, temperature: 0.3 }
    )

    expect(result.success).toBe(true)
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody.max_tokens).toBe(256)
  })

  it('omits max_tokens when neither config nor request specifies it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonTextResponse({
      choices: [{ message: { content: 'summary ok' }, finish_reason: 'stop' }]
    }))
    globalThis.fetch = fetchMock

    const result = await callSummaryAPI(
      {
        getConfig: {
          key: 'test-key',
          url: 'https://example.com',
          model: 'summary-model'
        }
      },
      'system prompt',
      'user content',
      {},
      { temperature: 0.3 }
    )

    expect(result.success).toBe(true)
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Object.prototype.hasOwnProperty.call(requestBody, 'max_tokens')).toBe(false)
  })
})

describe('summaryLifecycle', () => {
  it('does not impose a default max_tokens limit for short summaries', async () => {
    const callSummaryAPIMock = vi.fn().mockResolvedValue({
      success: true,
      content: '简要总结',
      truncated: false
    })

    const contact = {
      name: '角色',
      memorySettings: {
        shortTermMergeThreshold: 99
      },
      msgs: [
        { id: 'm1', role: 'user', content: '第一句' },
        { id: 'm2', role: 'assistant', content: '第二句' },
        { id: 'm3', role: 'user', content: '第三句' }
      ]
    }

    const result = await generateShortSummary(contact, {
      force: true,
      minMessages: 1
    }, {
      callSummaryAPI: callSummaryAPIMock
    })

    expect(result.success).toBe(true)
    expect(callSummaryAPIMock).toHaveBeenCalledTimes(1)
    const requestOptions = callSummaryAPIMock.mock.calls[0][3]
    expect(requestOptions.max_tokens).toBeUndefined()
    expect(requestOptions.temperature).toBe(0.3)
  })

  it('keeps explicit range summaries visible without auto-merging to long term', async () => {
    const callSummaryAPIMock = vi.fn().mockResolvedValue({
      success: true,
      content: '范围总结',
      truncated: false
    })

    const contact = {
      name: '角色',
      memorySettings: {
        shortTermMergeThreshold: 2
      },
      memory: {
        core: [],
        longTerm: [],
        shortTerm: [
          {
            id: 'short_existing',
            content: '已有总结',
            time: Date.now() - 1000,
            status: 'ok',
            merged: false,
            msgRange: { start: 'm1', end: 'm2', count: 2 }
          }
        ]
      },
      msgs: [
        { id: 'm1', role: 'user', content: '第一句' },
        { id: 'm2', role: 'assistant', content: '第二句' },
        { id: 'm3', role: 'user', content: '第三句' },
        { id: 'm4', role: 'assistant', content: '第四句' }
      ]
    }

    const result = await generateShortSummary(contact, {
      startMsgId: 'm3',
      endMsgId: 'm4',
      force: true,
      minMessages: 1
    }, {
      callSummaryAPI: callSummaryAPIMock
    })

    expect(result.success).toBe(true)
    expect(contact.memory.longTerm).toHaveLength(0)
    expect(contact.memory.shortTerm).toHaveLength(2)
    expect(contact.memory.shortTerm.every(item => item.merged === false)).toBe(true)
    expect(result.summary?.content).toBe('范围总结')
  })
})
