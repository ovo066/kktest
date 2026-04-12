import { describe, expect, it } from 'vitest'
import {
  buildMiniMaxCacheKey,
  buildMiniMaxEndpointCandidates,
  normalizeMiniMaxEndpoint,
  normalizeMiniMaxModelName,
  resolveMiniMaxVoiceTuning,
  synthesizeMiniMax,
  trimText
} from './minimaxClient'

describe('minimax client helpers', () => {
  it('normalizes common model aliases', () => {
    expect(normalizeMiniMaxModelName('speech2.8-turbo')).toBe('speech-2.8-turbo')
    expect(normalizeMiniMaxModelName('speech-02-hd')).toBe('speech-02-hd')
  })

  it('normalizes endpoint and expands backup hosts', () => {
    expect(normalizeMiniMaxEndpoint('api.minimax.io')).toBe('https://api.minimax.io/v1/t2a_v2')
    expect(buildMiniMaxEndpointCandidates('https://api.minimax.io/v1')).toEqual([
      'https://api.minimax.io/v1/t2a_v2',
      'https://api-uw.minimax.io/v1/t2a_v2'
    ])
  })

  it('builds stable cache keys across host aliases and whitespace noise', () => {
    const left = buildMiniMaxCacheKey('https://api-uw.minimax.io/v1/t2a_v2', 'speech2.8-turbo', 'voiceA', 'hello\n\nworld', 'sig')
    const right = buildMiniMaxCacheKey('https://api.minimax.io/v1/t2a_v2', 'speech-2.8-turbo', 'voiceA', 'hello\n\nworld', 'sig')

    expect(left).toBe(right)
  })

  it('keeps trimText and tuning signatures deterministic', () => {
    expect(trimText(' [emotion:happy]*你好* ')).toBe('你好')

    expect(resolveMiniMaxVoiceTuning('你好！', 'happy')).toEqual({
      speed: 1.04,
      pitch: 0.21,
      vol: 1.12,
      emotion: 'happy',
      signature: 'natural-v1:happy:1.04:0.21:1.12'
    })
  })

  it('fails fast when mandatory minimax config is missing', async () => {
    await expect(synthesizeMiniMax({
      endpoint: '',
      apiKey: '',
      groupId: '',
      model: '',
      text: 'hello',
      voiceId: '',
      voiceTuning: null
    })).rejects.toThrow('MiniMax endpoint is not configured')
  })
})
