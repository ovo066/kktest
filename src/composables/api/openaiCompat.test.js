import { describe, expect, it } from 'vitest'
import {
  buildOpenAICompatHeaders,
  fetchOpenAICompat,
  readOpenAICompatError,
  resolveOpenAICompatRequest,
  resolveOpenAICompatUrl
} from './openaiCompat'

describe('resolveOpenAICompatUrl', () => {
  it('appends chat completion suffix once', () => {
    expect(resolveOpenAICompatUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions')
    expect(resolveOpenAICompatUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions')
    expect(resolveOpenAICompatUrl('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('supports custom suffixes', () => {
    expect(resolveOpenAICompatUrl('https://api.openai.com/v1', '/models')).toBe('https://api.openai.com/v1/models')
  })
})

describe('buildOpenAICompatHeaders', () => {
  it('builds auth and json headers', () => {
    expect(buildOpenAICompatHeaders('sk-test')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-test'
    })
  })

  it('supports auth only mode', () => {
    expect(buildOpenAICompatHeaders('sk-test', { contentType: false })).toEqual({
      Authorization: 'Bearer sk-test'
    })
  })
})

describe('resolveOpenAICompatRequest', () => {
  it('uses same-origin proxy for the mortis endpoint on deployed cross-origin requests', () => {
    const request = resolveOpenAICompatRequest('https://api.mortis.edu.kg/v1', {
      apiKey: 'sk-test',
      locationLike: {
        origin: 'https://aichat.vercel.app',
        hostname: 'aichat.vercel.app'
      }
    })

    expect(request).toEqual({
      url: '/api/proxy',
      targetUrl: 'https://api.mortis.edu.kg/v1/chat/completions',
      proxied: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test',
        'x-target-url': 'https://api.mortis.edu.kg/v1/chat/completions'
      }
    })
  })

  it('keeps other deployed cross-origin endpoints direct', () => {
    const request = resolveOpenAICompatRequest('https://api.openai.com/v1', {
      apiKey: 'sk-test',
      locationLike: {
        origin: 'https://aichat.vercel.app',
        hostname: 'aichat.vercel.app'
      }
    })

    expect(request).toEqual({
      url: 'https://api.openai.com/v1/chat/completions',
      targetUrl: 'https://api.openai.com/v1/chat/completions',
      proxied: false,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test'
      }
    })
  })

  it('keeps localhost requests direct during development', () => {
    const request = resolveOpenAICompatRequest('https://api.mortis.edu.kg/v1', {
      apiKey: 'sk-test',
      locationLike: {
        origin: 'http://localhost:5173',
        hostname: 'localhost'
      }
    })

    expect(request.url).toBe('https://api.mortis.edu.kg/v1/chat/completions')
    expect(request.proxied).toBe(false)
    expect(request.headers['x-target-url']).toBeUndefined()
  })
})

describe('fetchOpenAICompat', () => {
  it('forwards proxied requests with target header', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (...args) => ({ args })

    try {
      const { request } = await fetchOpenAICompat('https://api.mortis.edu.kg/v1', {
        apiKey: 'sk-test',
        body: { hello: 'world' },
        locationLike: {
          origin: 'https://aichat.vercel.app',
          hostname: 'aichat.vercel.app'
        }
      })

      expect(request.url).toBe('/api/proxy')
      expect(globalThis.fetch).toBeTypeOf('function')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('readOpenAICompatError', () => {
  it('prefers structured error message', async () => {
    const response = new Response(JSON.stringify({ error: { message: 'bad request' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
    await expect(readOpenAICompatError(response)).resolves.toBe('bad request')
  })

  it('falls back to raw text when needed', async () => {
    const response = new Response('plain error', { status: 500 })
    await expect(readOpenAICompatError(response)).resolves.toBe('plain error')
  })
})
