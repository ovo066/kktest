import crypto from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  CallToolRequest,
  CallToolResultSchema,
  ListToolsRequest,
  ListToolsResultSchema
} from '@modelcontextprotocol/sdk/types.js'

function trimString(value) {
  return String(value || '').trim()
}

function normalizeArgs(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => trimString(item)).filter(Boolean)
}

function normalizeEnv(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [trimString(key), trimString(item)])
      .filter(([key]) => !!key)
  )
}

function normalizeServerConfig(server) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    throw new Error('MCP server config must be an object')
  }

  const id = trimString(server.id) || crypto.randomUUID()
  const name = trimString(server.name) || id
  const transport = trimString(server.transport).toLowerCase() || (trimString(server.url) ? 'http' : 'stdio')
  const enabled = server.enabled !== false
  const command = trimString(server.command)
  const url = trimString(server.url)
  const args = normalizeArgs(server.args)
  const env = normalizeEnv(server.env)

  if (transport === 'http') {
    if (!url) throw new Error(`MCP server "${name}" is missing url`)
  } else if (!command) {
    throw new Error(`MCP server "${name}" is missing command`)
  }

  return {
    id,
    name,
    transport,
    enabled,
    command,
    args,
    env,
    url
  }
}

function buildConfigSignature(config) {
  return JSON.stringify({
    id: config.id,
    name: config.name,
    transport: config.transport,
    enabled: config.enabled,
    command: config.command,
    args: config.args,
    env: config.env,
    url: config.url
  })
}

function createState(config) {
  return {
    id: config.id,
    name: config.name,
    config,
    configSignature: buildConfigSignature(config),
    status: config.enabled ? 'disconnected' : 'disabled',
    lastError: '',
    tools: [],
    toolCount: 0,
    client: null,
    transport: null,
    updatedAt: Date.now()
  }
}

function serializeState(state) {
  return {
    id: state.id,
    name: state.name,
    status: state.status,
    enabled: state.config.enabled,
    transport: state.config.transport,
    command: state.config.command,
    args: state.config.args,
    env: state.config.env,
    url: state.config.url,
    toolCount: state.toolCount,
    lastError: state.lastError,
    updatedAt: state.updatedAt
  }
}

async function closeTransport(state) {
  if (state?.transport && typeof state.transport.close === 'function') {
    await state.transport.close()
  }
}

export class McpManager {
  constructor() {
    this.states = new Map()
  }

  async upsertServer(input) {
    const config = normalizeServerConfig(input)
    const existing = this.states.get(config.id)
    const signature = buildConfigSignature(config)

    if (existing && existing.configSignature === signature && existing.status === 'connected') {
      return serializeState(existing)
    }

    if (existing) {
      await this.removeServer(config.id)
    }

    const state = createState(config)
    this.states.set(state.id, state)

    if (!config.enabled) {
      state.status = 'disabled'
      state.updatedAt = Date.now()
      return serializeState(state)
    }

    await this.connectState(state)
    return serializeState(state)
  }

  async connectState(state) {
    state.status = 'connecting'
    state.lastError = ''
    state.updatedAt = Date.now()

    const client = new Client(
      { name: `aichat-bridge-${state.id}`, version: '1.0.0' },
      { capabilities: {} }
    )

    client.onerror = (error) => {
      state.lastError = error?.message || String(error || 'Unknown MCP client error')
      state.status = 'error'
      state.updatedAt = Date.now()
      console.error(`[bridge] MCP client error (${state.name}):`, error)
    }

    const transport = state.config.transport === 'http'
      ? new StreamableHTTPClientTransport(new URL(state.config.url))
      : new StdioClientTransport({
        command: state.config.command,
        args: state.config.args,
        env: Object.keys(state.config.env).length > 0 ? state.config.env : undefined
      })

    try {
      await client.connect(transport)
      state.client = client
      state.transport = transport
      state.status = 'connected'
      state.updatedAt = Date.now()
      await this.refreshTools(state.id)
    } catch (error) {
      state.lastError = error?.message || String(error || 'Failed to connect MCP server')
      state.status = 'error'
      state.updatedAt = Date.now()
      await closeTransport({ transport })
      throw error
    }
  }

  async refreshTools(serverId) {
    const state = this.requireConnectedState(serverId)
    const request = /** @type {import('@modelcontextprotocol/sdk/types.js').ListToolsRequest} */ ({
      method: 'tools/list',
      params: {}
    })
    const result = await state.client.request(request, ListToolsResultSchema)
    state.tools = Array.isArray(result.tools) ? result.tools : []
    state.toolCount = state.tools.length
    state.updatedAt = Date.now()
    return state.tools
  }

  async listTools() {
    const tools = []
    for (const state of this.states.values()) {
      if (state.status !== 'connected' || !state.client) continue
      try {
        await this.refreshTools(state.id)
      } catch (error) {
        state.lastError = error?.message || String(error || 'Failed to list tools')
        state.status = 'error'
        state.updatedAt = Date.now()
        continue
      }

      state.tools.forEach((tool) => {
        tools.push({
          serverId: state.id,
          serverName: state.name,
          transport: state.config.transport,
          name: tool.name,
          title: tool.title || '',
          description: tool.description || '',
          inputSchema: tool.inputSchema || { type: 'object', properties: {} }
        })
      })
    }
    return tools
  }

  async callTool(serverIdOrName, toolName, args = {}) {
    const state = this.requireConnectedState(serverIdOrName)
    const request = /** @type {import('@modelcontextprotocol/sdk/types.js').CallToolRequest} */ ({
      method: 'tools/call',
      params: {
        name: trimString(toolName),
        arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {}
      }
    })
    const result = await state.client.request(request, CallToolResultSchema)
    state.updatedAt = Date.now()
    return result
  }

  listServers() {
    return [...this.states.values()].map(serializeState)
  }

  async removeServer(serverIdOrName) {
    const state = this.findState(serverIdOrName)
    if (!state) return false
    try {
      await closeTransport(state)
    } finally {
      this.states.delete(state.id)
    }
    return true
  }

  async closeAll() {
    const states = [...this.states.values()]
    for (const state of states) {
      await this.removeServer(state.id)
    }
  }

  getStatus() {
    const states = this.listServers()
    return {
      ok: true,
      serverCount: states.length,
      connectedCount: states.filter((state) => state.status === 'connected').length,
      servers: states
    }
  }

  findState(serverIdOrName) {
    const normalized = trimString(serverIdOrName)
    if (!normalized) return null
    return this.states.get(normalized)
      || [...this.states.values()].find((state) => state.name === normalized)
      || null
  }

  requireConnectedState(serverIdOrName) {
    const state = this.findState(serverIdOrName)
    if (!state) {
      throw new Error(`Unknown MCP server: ${serverIdOrName}`)
    }
    if (state.status !== 'connected' || !state.client) {
      throw new Error(`MCP server "${state.name}" is not connected`)
    }
    return state
  }
}
