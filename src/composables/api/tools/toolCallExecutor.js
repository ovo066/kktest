/**
 * Executes an array of completed tool calls and returns OpenAI-format tool result messages.
 */
import { getToolDefinition, getToolExecutor } from './toolRegistry'

const TOOL_LOG_PREVIEW_MAX_CHARS = 320
const TOOL_LOG_PREVIEW_MAX_LINES = 8

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function truncatePreview(value, maxChars = TOOL_LOG_PREVIEW_MAX_CHARS, maxLines = TOOL_LOG_PREVIEW_MAX_LINES) {
  const text = String(value || '').trim()
  if (!text) return ''

  const lines = text.split(/\r?\n/)
  let next = lines.slice(0, maxLines).join('\n')
  if (next.length > maxChars) {
    next = `${next.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
  } else if (lines.length > maxLines) {
    next = `${next}\n…`
  }
  return next
}

function humanizeToolName(name) {
  return String(name || '')
    .trim()
    .replace(/^mcp_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'tool'
}

function normalizeExternalExecutor(entry) {
  if (!entry) return { execute: null, meta: null }
  if (typeof entry === 'function') {
    return { execute: entry, meta: null }
  }
  if (typeof entry?.execute === 'function') {
    return {
      execute: entry.execute,
      meta: entry?.meta && typeof entry.meta === 'object' ? entry.meta : null
    }
  }
  return { execute: null, meta: null }
}

function buildArgsPreview(parsedArgs, rawArguments = '') {
  if (parsedArgs && typeof parsedArgs === 'object') {
    if (!Array.isArray(parsedArgs) && Object.keys(parsedArgs).length === 0) return ''
    return truncatePreview(safeJsonStringify(parsedArgs))
  }
  return truncatePreview(rawArguments)
}

function buildResultPreview(payload) {
  if (!payload?.success) return ''

  const result = payload?.result
  const structured = result?.structuredContent
  if (structured && typeof structured === 'object') {
    return truncatePreview(safeJsonStringify(structured))
  }

  const text = typeof result?.text === 'string' ? result.text.trim() : ''
  if (text) return truncatePreview(text)

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const previewResult = { ...result }
    if (previewResult.imageToken) previewResult.imageToken = '[image token]'
    if (previewResult.stickerToken) previewResult.stickerToken = '[sticker token]'
    if (Object.keys(previewResult).length > 0) {
      return truncatePreview(safeJsonStringify(previewResult))
    }
  }

  return ''
}

function buildSuccessSummary(payload) {
  const result = payload?.result
  const text = typeof result?.text === 'string' ? result.text.trim() : ''
  if (text) return truncatePreview(text, 120, 2)
  if (result?.imageToken) return '已返回图片结果'
  if (result?.stickerToken) return '已返回贴纸结果'

  const structured = result?.structuredContent
  if (structured && typeof structured === 'object') {
    const count = Object.keys(structured).length
    return count > 0 ? `已返回 ${count} 个结构化字段` : '已返回结构化结果'
  }

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const keys = Object.keys(result)
      .filter((key) => key !== 'text' && key !== 'structuredContent' && key !== 'imageToken' && key !== 'stickerToken')
    if (keys.length === 1) return `已返回 ${keys[0]}`
    if (keys.length > 1) return `已返回 ${keys.length} 个结果字段`
  }

  return '调用已完成'
}

function buildToolLogEntry({
  toolName,
  rawArguments = '',
  parsedArgs = null,
  payload,
  meta = null,
  durationMs = 0
}) {
  const isMcp = meta?.source === 'mcp' || /^mcp_/i.test(toolName)
  const displayName = String(
    meta?.displayName
    || meta?.originalName
    || meta?.description
    || humanizeToolName(toolName)
  ).trim()

  const subtitleParts = isMcp
    ? [meta?.serverName || meta?.serverId || '', meta?.originalName || toolName]
    : [toolName]

  return {
    source: isMcp ? 'mcp' : 'internal',
    sourceLabel: isMcp ? 'MCP' : '内置工具',
    success: !!payload?.success,
    toolName,
    displayName,
    subtitle: subtitleParts.filter(Boolean).join(' · '),
    argsPreview: buildArgsPreview(parsedArgs, rawArguments),
    resultPreview: buildResultPreview(payload),
    summary: payload?.success
      ? buildSuccessSummary(payload)
      : String(payload?.error || 'Tool execution failed'),
    errorText: payload?.success ? '' : String(payload?.error || 'Tool execution failed'),
    durationMs: Math.max(0, Number(durationMs || 0) || 0),
    durationLabel: durationMs > 0 ? `${Math.max(1, Math.round(durationMs))} ms` : '',
    serverName: String(meta?.serverName || '').trim(),
    serverId: String(meta?.serverId || '').trim(),
    originalName: String(meta?.originalName || '').trim()
  }
}

/**
 * Execute tool calls and produce tool result messages.
 *
 * @param {Array<{id:string, function:{name:string, arguments:string}}>} toolCalls
 * @param {object} context - execution context with stores and active chat
 * @param {object} [externalExecutors] - Map<name, fn|{execute:Function,meta?:object}> for MCP/external tool executors
 * @returns {Promise<{messages:Array<{role:'tool', tool_call_id:string, content:string}>, logs:Array<object>}>}
 */
export async function executeToolCalls(toolCalls, context, externalExecutors = null) {
  const messages = []
  const logs = []

  for (const call of toolCalls) {
    const { id, function: fn } = call
    const toolName = String(fn?.name || '').trim()
    const rawArguments = typeof fn?.arguments === 'string' ? fn.arguments : ''
    let parsedArgs
    try {
      parsedArgs = rawArguments ? JSON.parse(rawArguments) : {}
    } catch {
      const payload = { success: false, error: 'Invalid JSON arguments' }
      messages.push({
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(payload)
      })
      logs.push(buildToolLogEntry({
        toolName,
        rawArguments,
        payload
      }))
      continue
    }

    // Look up internal executor first, then external (MCP)
    const internalDefinition = getToolDefinition(toolName)
    let executor = getToolExecutor(toolName)
    let executorMeta = internalDefinition
      ? {
          source: 'internal',
          displayName: internalDefinition.description || humanizeToolName(toolName)
        }
      : null

    if (!executor && externalExecutors) {
      const externalEntry = typeof externalExecutors.get === 'function'
        ? externalExecutors.get(toolName)
        : externalExecutors[toolName]
      const normalizedExternal = normalizeExternalExecutor(externalEntry)
      executor = normalizedExternal.execute
      executorMeta = normalizedExternal.meta || executorMeta
    }

    if (!executor) {
      const payload = { success: false, error: `Unknown tool: ${toolName}` }
      messages.push({
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(payload)
      })
      logs.push(buildToolLogEntry({
        toolName,
        rawArguments,
        parsedArgs,
        payload,
        meta: executorMeta
      }))
      continue
    }

    const startedAt = Date.now()
    try {
      const result = await executor(parsedArgs, context)
      messages.push({
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(result)
      })
      logs.push(buildToolLogEntry({
        toolName,
        rawArguments,
        parsedArgs,
        payload: result,
        meta: executorMeta,
        durationMs: Date.now() - startedAt
      }))
    } catch (err) {
      const payload = { success: false, error: err?.message || 'Tool execution failed' }
      messages.push({
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(payload)
      })
      logs.push(buildToolLogEntry({
        toolName,
        rawArguments,
        parsedArgs,
        payload,
        meta: executorMeta,
        durationMs: Date.now() - startedAt
      }))
    }
  }

  return { messages, logs }
}
