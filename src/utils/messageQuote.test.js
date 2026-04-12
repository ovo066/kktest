import { describe, expect, it } from 'vitest'
import { extractQuoteFromText } from './messageQuote'

describe('extractQuoteFromText', () => {
  it('returns original text when no quote token exists', () => {
    expect(extractQuoteFromText('hello')).toEqual({ quote: null, cleanText: 'hello' })
  })

  it('extracts one quote token', () => {
    expect(extractQuoteFromText('[quote:上一条] 你好')).toEqual({
      quote: '上一条',
      cleanText: '你好'
    })
  })

  it('extracts multiple quote tokens', () => {
    expect(extractQuoteFromText('[引用:甲] [quote:乙] hi')).toEqual({
      quote: '甲；乙',
      cleanText: 'hi'
    })
  })

  it('preserves line breaks after removing quote tokens', () => {
    expect(extractQuoteFromText('[quote:上一条]\n第一句\n第二句')).toEqual({
      quote: '上一条',
      cleanText: '第一句\n第二句'
    })
  })
})
