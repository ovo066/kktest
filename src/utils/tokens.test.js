import { describe, expect, it } from 'vitest'
import { estimateTokens, trimToMaxTokens } from './tokens'

describe('tokens', () => {
  it('estimates ASCII roughly as 4 chars/token', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('estimates non-ASCII roughly as 1 char/token', () => {
    expect(estimateTokens('你')).toBe(1)
    expect(estimateTokens('你好')).toBe(2)
  })

  it('trims to budget with suffix', () => {
    const text = 'abcd'.repeat(200)
    const trimmed = trimToMaxTokens(text, 10)
    expect(trimmed.length).toBeLessThan(text.length)
    expect(trimmed.endsWith('\n...')).toBe(true)
  })

  it('returns original when under budget', () => {
    const text = 'hello world'
    expect(trimToMaxTokens(text, 1000)).toBe(text)
  })
})

