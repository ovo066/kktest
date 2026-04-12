import { describe, expect, it } from 'vitest'
import { adaptMcpToolResult, adaptMcpToolsToOpenAI } from './mcpToolAdapter'

describe('mcpToolAdapter', () => {
  it('converts MCP tool metadata into OpenAI function definitions with unique names', () => {
    const tools = adaptMcpToolsToOpenAI([
      {
        serverId: 'srv_1',
        serverName: 'Filesystem',
        name: 'read-file',
        description: 'Read a file from disk',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute path' }
          },
          required: ['path']
        }
      },
      {
        serverId: 'srv_2',
        serverName: 'Filesystem',
        name: 'read-file',
        description: 'Read a file from another server',
        inputSchema: { type: 'object', properties: {} }
      }
    ])

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toMatch(/^mcp_filesystem_read_file/)
    expect(tools[1].name).not.toBe(tools[0].name)
    expect(tools[0].parameters).toEqual({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path' }
      },
      required: ['path']
    })
  })

  it('converts MCP call results into executor-friendly payloads', () => {
    const success = adaptMcpToolResult({
      content: [{ type: 'text', text: 'created event' }],
      structuredContent: { eventId: 'evt_1' }
    })
    const failure = adaptMcpToolResult({
      isError: true,
      content: [{ type: 'text', text: 'permission denied' }]
    })

    expect(success).toEqual({
      success: true,
      result: {
        text: 'created event',
        structuredContent: { eventId: 'evt_1' }
      }
    })
    expect(failure).toEqual({
      success: false,
      error: 'permission denied',
      result: null
    })
  })
})
