import { describe, expect, it, vi } from 'vitest'
import {
  createCallSpeechEchoGuard,
  mergeSpeechBuffer,
  normalizeSpeechText
} from './callSpeechSupport'

describe('callSpeechSupport', () => {
  it('normalizes speech text and merges overlapping buffers', () => {
    expect(normalizeSpeechText(' 你好，World！ ')).toBe('你好world')
    expect(mergeSpeechBuffer('你好 世界', '世界')).toBe('你好 世界')
    expect(mergeSpeechBuffer('你好', '你好 世界')).toBe('你好 世界')
    expect(mergeSpeechBuffer('你好', '世界')).toBe('你好 世界')
  })

  it('tracks recent ai speech and suppresses likely echo text', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'))

    const echoGuard = createCallSpeechEchoGuard()
    echoGuard.rememberAISentence('今天天气不错')
    echoGuard.markAISpeechEnded()

    expect(echoGuard.isLikelyEchoText('今天天气不错')).toBe(true)
    expect(echoGuard.isLikelyEchoText('天气不错')).toBe(true)

    vi.setSystemTime(new Date('2026-03-26T12:00:04Z'))
    expect(echoGuard.isLikelyEchoText('今天天气不错')).toBe(false)

    echoGuard.resetEchoGuard()
    expect(echoGuard.isLikelyEchoText('今天天气不错')).toBe(false)

    vi.useRealTimers()
  })
})
