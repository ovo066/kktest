import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMcpDirectConnect } from './useMcpDirectConnect'

const originalFetch = globalThis.fetch
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

function setWindowLocation(location) {
  Object.defineProperty(globalThis, 'window', {
    value: { location },
    configurable: true,
    writable: true
  })
}

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    return
  }
  Reflect.deleteProperty(globalThis, 'window')
}

function createJsonRpcResponse(result, status = 200) {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 'test',
    result
  }), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  restoreWindow()
})

describe('useMcpDirectConnect', () => {
  it('uses apiKey as a bearer Authorization header when discovering tools', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonRpcResponse({}))
      .mockResolvedValueOnce(createJsonRpcResponse({
        tools: [
          {
            name: 'search',
            description: 'Search docs',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      }))
    globalThis.fetch = fetchMock

    const settingsStore = {
      toolCallingConfig: {
        mcpDirectServers: [
          { id: 'direct_docs', name: 'Docs', url: 'https://mcp.example.com/docs', apiKey: 'secret', enabled: true }
        ]
      }
    }

    const { discoverDirectTools } = useMcpDirectConnect({ settingsStore })
    const result = await discoverDirectTools({ force: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://mcp.example.com/docs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer secret'
        })
      })
    )
    expect(result.tools).toHaveLength(1)
  })

  it('routes deployed cross-origin HTTPS direct servers through /api/mcp-proxy', async () => {
    setWindowLocation({
      origin: 'https://aichat.vercel.app',
      hostname: 'aichat.vercel.app',
      protocol: 'https:'
    })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonRpcResponse({}))
      .mockResolvedValueOnce(createJsonRpcResponse({ tools: [] }))
    globalThis.fetch = fetchMock

    const settingsStore = {
      toolCallingConfig: {
        mcpDirectServers: [
          { id: 'direct_docs', name: 'Docs', url: 'https://mcp.example.com/docs', apiKey: 'secret', enabled: true }
        ]
      }
    }

    const { discoverDirectTools } = useMcpDirectConnect({ settingsStore })
    await discoverDirectTools({ force: true })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/mcp-proxy',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-mcp-url': 'https://mcp.example.com/docs',
          authorization: 'Bearer secret'
        })
      })
    )
  })

  it('skips direct discovery when selected server ids do not match', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const settingsStore = {
      toolCallingConfig: {
        mcpDirectServers: [
          { id: 'direct_docs', name: 'Docs', url: 'https://mcp.example.com/docs', apiKey: 'secret', enabled: true }
        ]
      }
    }

    const { discoverDirectTools } = useMcpDirectConnect({ settingsStore })
    const result = await discoverDirectTools({ force: true, serverIds: ['bridge_only'] })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.tools).toEqual([])
    expect(result.externalExecutors).toEqual(new Map())
  })
})
