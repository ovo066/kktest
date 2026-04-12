import { describe, expect, it } from 'vitest'
import { parseNovelAIVibeTokenFromBytes } from './vibe'

describe('novelai vibe helpers', () => {
  it('extracts vibe tokens from json payloads', () => {
    const bytes = new TextEncoder().encode('{"data":{"vibe_token":"token-123"}}')

    expect(parseNovelAIVibeTokenFromBytes(bytes, 'application/json')).toBe('token-123')
  })

  it('falls back to base64 when the payload is binary', () => {
    const bytes = new Uint8Array([0, 255, 1, 2])

    expect(parseNovelAIVibeTokenFromBytes(bytes, 'application/octet-stream')).toBe('AP8BAg==')
  })
})