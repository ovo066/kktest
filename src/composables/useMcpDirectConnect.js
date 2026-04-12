/**
 * MCP 直连模式 — 标准 MCP Streamable HTTP 传输
 *
 * 协议：JSON-RPC 2.0 over HTTP POST
 *   POST <url>  body: { jsonrpc: '2.0', id, method, params }
 *   Response:   { jsonrpc: '2.0', id, result } 或 { error }
 *
 * 在 HTTPS 页面（Vercel），请求自动通过 /api/mcp-proxy 代理以绕过 CORS。
 */

import { canProxyMcpBridgeTarget } from './useMcpBridge'
import { adaptMcpToolsToOpenAI, adaptMcpToolResult } from './api/tools/mcpToolAdapter'
import { normalizeMcpServerIds } from '../utils/mcpServers'

const DIRECT_CACHE_TTL_MS = 15000
const MAX_CACHED = 20

function trimString(value) {
  return String(value || '').trim()
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

function resolveAuthHeader(server) {
  const authHeader = trimString(server?.authHeader)
  if (authHeader) return authHeader

  const apiKey = trimString(server?.apiKey)
  return apiKey ? `Bearer ${apiKey}` : ''
}

/**
 * 判断是否需要走 /api/mcp-proxy
 * 规则：部署页上的跨域直连统一走代理，本地开发保持直连。
 */
function needsProxy(targetUrl) {
  return canProxyMcpBridgeTarget(targetUrl)
}

/**
 * 发送单条 JSON-RPC 请求到 MCP server
 */
async function rpcCall(url, method, params = {}, authHeader = '') {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: makeId(),
    method,
    params
  })

  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
  if (authHeader) headers['authorization'] = authHeader

  let fetchUrl = url
  let fetchHeaders = headers

  if (needsProxy(url)) {
    fetchUrl = '/api/mcp-proxy'
    fetchHeaders = {
      ...headers,
      'x-mcp-url': url
    }
    // Authorization 已在 headers 里，mcp-proxy 会直接转发
  }

  const res = await fetch(fetchUrl, { method: 'POST', headers: fetchHeaders, body })

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new Error(`MCP server returned non-JSON (status ${res.status})`)
  }

  if (!res.ok) {
    const msg = payload?.error?.message || payload?.message || `HTTP ${res.status}`
    throw new Error(`MCP request failed: ${msg}`)
  }

  if (payload?.error) {
    throw new Error(payload.error.message || 'MCP JSON-RPC error')
  }

  return payload?.result ?? payload
}

/**
 * 从单个直连 MCP server 获取工具列表
 * @returns {{ tools: OpenAI-format[], externalExecutors: Map }}
 */
async function discoverDirectServer(server) {
  const url = trimString(server.url)
  const authHeader = resolveAuthHeader(server)

  // MCP initialize handshake
  try {
    await rpcCall(url, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'aichat-vite', version: '1.0.0' }
    }, authHeader)
  } catch {
    // 部分 MCP server 不需要 initialize，继续
  }

  const result = await rpcCall(url, 'tools/list', {}, authHeader)
  const rawTools = Array.isArray(result?.tools) ? result.tools : []

  // 构造 mcpToolAdapter 期望的格式
  const serverName = trimString(server.name) || new URL(url).hostname
  const bridgeFormatTools = rawTools.map((tool) => ({
    serverId: server.id,
    serverName,
    name: tool.name,
    description: tool.description || '',
    title: tool.title || '',
    inputSchema: tool.inputSchema || { type: 'object', properties: {} }
  }))

  const adaptedTools = adaptMcpToolsToOpenAI(bridgeFormatTools)

  const executors = new Map()
  adaptedTools.forEach((tool) => {
    executors.set(tool.name, {
      execute: async (args = {}) => {
        const callResult = await rpcCall(url, 'tools/call', {
          name: tool.originalName,
          arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {}
        }, authHeader)
        return adaptMcpToolResult(callResult)
      },
      meta: {
        source: 'mcp',
        serverId: server.id,
        serverName,
        originalName: tool.originalName,
        displayName: tool.originalName
      }
    })
  })

  return {
    tools: adaptedTools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
    externalExecutors: executors
  }
}

/**
 * useMcpDirectConnect 组合式函数
 * 管理多个直连 MCP server 的工具发现和缓存
 */
export function useMcpDirectConnect({ settingsStore, showToast } = {}) {
  const cache = new Map() // key → { at, tools, externalExecutors }

  function getDirectServers(serverIds = null) {
    const servers = Array.isArray(settingsStore?.toolCallingConfig?.mcpDirectServers)
      ? settingsStore.toolCallingConfig.mcpDirectServers
      : []
    const enabled = servers.filter((s) => s && trimString(s.url) && s.enabled !== false)
    const selectedIds = normalizeMcpServerIds(serverIds)
    if (selectedIds.length === 0) return enabled
    const idSet = new Set(selectedIds)
    return enabled.filter((s) => idSet.has(trimString(s.id)))
  }

  function buildCacheKey(servers) {
    return JSON.stringify(servers.map((s) => ({ id: s.id, url: s.url, authHeader: resolveAuthHeader(s) })))
  }

  function pruneCache() {
    if (cache.size <= MAX_CACHED) return
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0]
    if (oldest) cache.delete(oldest)
  }

  async function discoverMcpDirectTools({ force = false, serverIds } = {}) {
    const servers = getDirectServers(serverIds)
    if (servers.length === 0) return { tools: [], externalExecutors: new Map() }

    const cacheKey = buildCacheKey(servers)
    const cached = cache.get(cacheKey)
    if (!force && cached && (Date.now() - cached.at) < DIRECT_CACHE_TTL_MS) {
      return { tools: [...cached.tools], externalExecutors: new Map(cached.externalExecutors) }
    }

    const allTools = []
    const allExecutors = new Map()
    const errors = []

    await Promise.all(
      servers.map(async (server) => {
        try {
          const { tools, externalExecutors } = await discoverDirectServer(server)
          tools.forEach((t) => allTools.push(t))
          externalExecutors.forEach((fn, name) => allExecutors.set(name, fn))
        } catch (err) {
          const msg = err?.message || String(err)
          errors.push(`${server.name || server.id}: ${msg}`)
          console.warn('[MCPDirect] discovery failed for', server.id, msg)
        }
      })
    )

    if (errors.length > 0 && typeof showToast === 'function') {
      showToast(`MCP 直连失败：${errors[0]}`, 3000)
    }

    const entry = { at: Date.now(), tools: allTools, externalExecutors: allExecutors }
    cache.set(cacheKey, entry)
    pruneCache()

    return { tools: [...allTools], externalExecutors: new Map(allExecutors) }
  }

  return {
    discoverDirectTools: discoverMcpDirectTools,
    getDirectServers,
    testDirectServer(serverId) {
      const server = getDirectServers().find((s) => trimString(s.id) === trimString(serverId))
      if (!server) return Promise.resolve({ ok: false, toolsCount: 0, toolNames: [], error: '未找到该服务器' })
      return discoverDirectServer(server)
        .then(({ tools }) => ({ ok: true, toolsCount: tools.length, toolNames: tools.map((t) => t.name) }))
        .catch((err) => ({ ok: false, toolsCount: 0, toolNames: [], error: err?.message || String(err) }))
    },
    refreshDirectTools(options = {}) {
      return discoverMcpDirectTools({ ...options, force: true })
    }
  }
}
