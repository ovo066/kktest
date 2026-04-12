import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/mcp-proxy'

const originalFetch = globalThis.fetch

function createMockRes() {
  return {
    headers: {},
    statusCode: 200,
    jsonBody: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.jsonBody = payload
      return this
    },
    end() {
      return this
    },
    send(payload) {
      this.sentBody = payload
      return this
    },
    write() {},
    flush() {},
    flushHeaders() {}
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('api/mcp-proxy', () => {
  it('rejects cross-origin requests so the endpoint is not a public HTTPS proxy', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const req = {
      method: 'POST',
      headers: {
        host: 'aichat.vercel.app',
        'x-forwarded-proto': 'https',
        origin: 'https://evil.example',
        'x-mcp-url': 'https://mcp.example.com'
      },
      body: { jsonrpc: '2.0', id: '1', method: 'tools/list', params: {} }
    }
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.jsonBody).toEqual({ error: 'Origin not allowed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
