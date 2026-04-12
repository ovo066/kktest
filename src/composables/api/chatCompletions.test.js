import { describe, expect, it } from 'vitest'
import { buildChatCompletionPayload } from './chatCompletions'

describe('chatCompletions', () => {
  it('uses config maxTokens when present', () => {
    const payload = buildChatCompletionPayload({
      model: 'gpt-test',
      maxTokens: 2048
    }, [{ role: 'user', content: 'hi' }])

    expect(payload.max_tokens).toBe(2048)
  })

  it('falls back to request max_tokens when config maxTokens is absent', () => {
    const payload = buildChatCompletionPayload({
      model: 'gpt-test',
      maxTokens: null
    }, [{ role: 'user', content: 'hi' }], {
      max_tokens: 256
    })

    expect(payload.max_tokens).toBe(256)
  })

  it('omits max_tokens when neither config nor request provides it', () => {
    const payload = buildChatCompletionPayload({
      model: 'gpt-test',
      maxTokens: null
    }, [{ role: 'user', content: 'hi' }])

    expect(Object.prototype.hasOwnProperty.call(payload, 'max_tokens')).toBe(false)
  })
})
