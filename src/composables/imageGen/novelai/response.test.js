import { encode } from '@msgpack/msgpack'
import { describe, expect, it } from 'vitest'
import {
  extractNovelAIStreamErrorMessage,
  parseNovelAIMsgpackEvents,
  parseNovelAIResponse,
  parseNovelAISSEEvents,
  parseNovelAIStreamResponse
} from './response'

const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+R6kAAAAASUVORK5CYII='

function decodeBase64(base64) {
  const binary = atob(base64)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function createResponse(body, contentType) {
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body || [])
  return {
    headers: {
      get(name) {
        if (String(name || '').toLowerCase() !== 'content-type') return null
        return contentType
      }
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }
  }
}

describe('novelai response helpers', () => {
  it('parses sse payloads and preserves the event name as event_type', () => {
    const payload = new TextEncoder().encode([
      'event: completed',
      'data: {"output":{"image":"YWJj"}}',
      ''
    ].join('\n'))

    expect(parseNovelAISSEEvents(payload)).toEqual([
      {
        event_type: 'completed',
        output: { image: 'YWJj' }
      }
    ])
  })

  it('parses concatenated msgpack events without a length prefix', () => {
    const first = encode({ event_type: 'progress', step: 1 })
    const second = encode({ event_type: 'final', output: { image: 'YWJj' } })
    const payload = new Uint8Array(first.length + second.length)
    payload.set(first, 0)
    payload.set(second, first.length)

    expect(parseNovelAIMsgpackEvents(payload)).toEqual([
      { event_type: 'progress', step: 1 },
      { event_type: 'final', output: { image: 'YWJj' } }
    ])
  })

  it('extracts nested stream error messages', () => {
    const message = extractNovelAIStreamErrorMessage([
      {
        event_type: 'error',
        payload: { detail: 'rate limited' }
      }
    ])

    expect(message).toBe('rate limited')
  })

  it('parses raw png responses even when content-type is octet-stream', async () => {
    const response = createResponse(decodeBase64(SAMPLE_PNG_BASE64), 'application/octet-stream')
    const imageUrl = await parseNovelAIResponse(response)
    expect(imageUrl).toBe(`data:image/png;base64,${SAMPLE_PNG_BASE64}`)
  })

  it('extracts image data from json wrapper responses', async () => {
    const response = createResponse(
      new TextEncoder().encode(JSON.stringify({ data: [{ b64_json: SAMPLE_PNG_BASE64 }] })),
      'application/json'
    )
    const imageUrl = await parseNovelAIResponse(response)
    expect(imageUrl).toBe(`data:image/png;base64,${SAMPLE_PNG_BASE64}`)
  })

  it('parses stream responses that return raw png bytes with generic mime type', async () => {
    const response = createResponse(decodeBase64(SAMPLE_PNG_BASE64), 'application/octet-stream')
    const imageUrl = await parseNovelAIStreamResponse(response)
    expect(imageUrl).toBe(`data:image/png;base64,${SAMPLE_PNG_BASE64}`)
  })
})
