import { describe, expect, it } from 'vitest'
import { cleanCallText, extractCompleteSentences, parseCallContent } from './useCallParser'

describe('useCallParser emotion tag handling', () => {
  it('strips emotion tags with non-word labels and full-width colon', () => {
    expect(cleanCallText('[emotion:开心] 你好')).toBe('你好')
    expect(cleanCallText('[ emotion ： happy ] 今天天气不错')).toBe('今天天气不错')
    expect(cleanCallText('[Emotion:excited]太棒了')).toBe('太棒了')
  })

  it('parses emotion tags with flexible spacing', () => {
    const parsed = parseCallContent('[ emotion : happy ] 你好呀')
    expect(parsed.lastEmotion).toBe('happy')
    expect(parsed.segments).toEqual([{ emotion: 'happy', text: '你好呀' }])
  })

  it('keeps sentence extraction text clean from tags', () => {
    const result = extractCompleteSentences('[emotion:开心] 好呀。下一句')
    expect(result.sentences).toEqual(['好呀。'])
    expect(result.remainder).toBe('下一句')
  })

  it('does not truncate long spoken text when removing emotion tags', () => {
    const raw = '[emotion:happy]今天白天一直在开会，所以现在才有空认真跟你说这件事，不过我想表达的重点其实一直都没有变。'
    expect(cleanCallText(raw)).toBe('今天白天一直在开会，所以现在才有空认真跟你说这件事，不过我想表达的重点其实一直都没有变。')
  })

  it('keeps full streaming remainder while stripping call control tags', () => {
    const raw = '[emotion:thinking]我刚刚信号不太好，所以前面那句可能没说清楚，其实我是想说我们可以晚一点再继续聊[call:end:稍后再聊]'
    const result = extractCompleteSentences(raw)

    expect(result.sentences).toEqual([])
    expect(result.remainder).toBe('我刚刚信号不太好，所以前面那句可能没说清楚，其实我是想说我们可以晚一点再继续聊')
    expect(result.callAction).toEqual({ action: 'end', reason: '稍后再聊' })
  })
})
