import express from 'express'
import cors from 'cors'
import { McpManager } from './mcpManager.js'

const PORT = Number(process.env.MCP_BRIDGE_PORT || 3099)
const HOST = process.env.MCP_BRIDGE_HOST || '127.0.0.1'

const app = express()
const manager = new McpManager()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/status', (_req, res) => {
  res.json({
    ...manager.getStatus(),
    name: 'aichat-mcp-bridge'
  })
})

app.get('/tools', async (_req, res) => {
  try {
    const tools = await manager.listTools()
    res.json({ ok: true, tools })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to list MCP tools'
    })
  }
})

app.post('/call', async (req, res) => {
  try {
    const serverId = req.body?.server
    const toolName = req.body?.tool
    const args = req.body?.arguments
    if (!serverId || !toolName) {
      return res.status(400).json({
        ok: false,
        error: 'server and tool are required'
      })
    }

    const result = await manager.callTool(serverId, toolName, args)
    return res.json({ ok: true, result })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to call MCP tool'
    })
  }
})

app.get('/servers', (_req, res) => {
  res.json({
    ok: true,
    servers: manager.listServers()
  })
})

app.post('/servers/add', async (req, res) => {
  try {
    const server = await manager.upsertServer(req.body)
    res.json({ ok: true, server })
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error?.message || 'Failed to add MCP server'
    })
  }
})

app.post('/servers/remove', async (req, res) => {
  try {
    const id = req.body?.id || req.body?.server || req.body?.name
    if (!id) {
      return res.status(400).json({
        ok: false,
        error: 'id is required'
      })
    }

    const removed = await manager.removeServer(id)
    return res.json({ ok: true, removed })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to remove MCP server'
    })
  }
})

const server = app.listen(PORT, HOST, () => {
  console.log(`[bridge] MCP bridge listening on http://${HOST}:${PORT}`)
})

async function shutdown(signal) {
  console.log(`[bridge] received ${signal}, shutting down...`)
  server.close(async () => {
    try {
      await manager.closeAll()
    } finally {
      process.exit(0)
    }
  })
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
