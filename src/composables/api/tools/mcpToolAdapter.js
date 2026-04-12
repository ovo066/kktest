function trimString(value) {
  return String(value || '').trim()
}

function sanitizeNamePart(value, fallback) {
  const normalized = trimString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

function shortHash(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'object', properties: {} }
  }

  const next = {}

  if (typeof schema.type === 'string') next.type = schema.type
  if (typeof schema.description === 'string') next.description = schema.description
  if (Array.isArray(schema.required)) {
    next.required = schema.required.map((item) => trimString(item)).filter(Boolean)
  }
  if (Array.isArray(schema.enum)) next.enum = schema.enum
  if (schema.default !== undefined) next.default = schema.default
  if (typeof schema.minimum === 'number') next.minimum = schema.minimum
  if (typeof schema.maximum === 'number') next.maximum = schema.maximum
  if (typeof schema.minLength === 'number') next.minLength = schema.minLength
  if (typeof schema.maxLength === 'number') next.maxLength = schema.maxLength
  if (typeof schema.pattern === 'string') next.pattern = schema.pattern
  if (typeof schema.format === 'string') next.format = schema.format
  if (typeof schema.additionalProperties === 'boolean') {
    next.additionalProperties = schema.additionalProperties
  } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && !Array.isArray(schema.additionalProperties)) {
    next.additionalProperties = sanitizeSchema(schema.additionalProperties)
  }
  if (schema.items) {
    next.items = Array.isArray(schema.items)
      ? schema.items.map((item) => sanitizeSchema(item))
      : sanitizeSchema(schema.items)
  }
  if (schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
    next.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, sanitizeSchema(value)])
    )
  }
  if (Array.isArray(schema.anyOf)) next.anyOf = schema.anyOf.map((item) => sanitizeSchema(item))
  if (Array.isArray(schema.oneOf)) next.oneOf = schema.oneOf.map((item) => sanitizeSchema(item))
  if (Array.isArray(schema.allOf)) next.allOf = schema.allOf.map((item) => sanitizeSchema(item))

  if (!next.type && next.properties) {
    next.type = 'object'
  }

  if (!next.type && !next.oneOf && !next.anyOf && !next.allOf) {
    next.type = 'object'
    next.properties = next.properties || {}
  }

  return next
}

function buildFunctionName(serverName, toolName, usedNames = new Set()) {
  const serverPart = sanitizeNamePart(serverName, 'server').slice(0, 20)
  const toolPart = sanitizeNamePart(toolName, 'tool').slice(0, 28)
  let name = `mcp_${serverPart}_${toolPart}`.slice(0, 64)

  if (!usedNames.has(name)) {
    usedNames.add(name)
    return name
  }

  const suffix = shortHash(`${serverName}:${toolName}`).slice(0, 6)
  name = `${name.slice(0, Math.max(1, 64 - suffix.length - 1))}_${suffix}`
  usedNames.add(name)
  return name
}

function extractContentText(content) {
  if (!Array.isArray(content)) return ''

  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      if (block.type === 'text') return trimString(block.text)
      if (block.type === 'image') return '[image]'
      if (block.type === 'resource') {
        return trimString(block.resource?.uri || block.uri || '[resource]')
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export function adaptMcpToolsToOpenAI(rawTools = []) {
  const usedNames = new Set()

  return rawTools
    .filter((tool) => tool && typeof tool === 'object')
    .map((tool) => {
      const serverId = trimString(tool.serverId)
      const serverName = trimString(tool.serverName) || serverId || 'server'
      const originalName = trimString(tool.name)
      const description = trimString(tool.description || tool.title || `MCP tool from ${serverName}`)

      return {
        serverId,
        serverName,
        originalName,
        name: buildFunctionName(serverName, originalName, usedNames),
        description,
        parameters: sanitizeSchema(tool.inputSchema)
      }
    })
    .filter((tool) => tool.serverId && tool.originalName)
}

export function adaptMcpToolResult(result) {
  const text = extractContentText(result?.content)
  const structuredContent = result?.structuredContent && typeof result.structuredContent === 'object'
    ? result.structuredContent
    : null

  if (result?.isError) {
    return {
      success: false,
      error: text || 'MCP tool call failed',
      result: structuredContent ? { structuredContent } : null
    }
  }

  return {
    success: true,
    result: {
      text,
      structuredContent
    }
  }
}
