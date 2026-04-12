export function parseOptionalTemperature(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 2) return null
  return n
}

export function parseOptionalMaxTokens(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  const intVal = Math.floor(n)
  if (intVal > 65535) return 65535
  return intVal
}

export function resolveOptionalMaxTokens(...values) {
  for (const value of values) {
    const parsed = parseOptionalMaxTokens(value)
    if (parsed !== null) return parsed
  }
  return null
}

export function applyOptionalMaxTokens(payload, ...values) {
  const maxTokens = resolveOptionalMaxTokens(...values)
  if (maxTokens !== null) {
    payload.max_tokens = maxTokens
  } else if (Object.prototype.hasOwnProperty.call(payload, 'max_tokens')) {
    delete payload.max_tokens
  }
  return payload
}

export function buildChatCompletionPayload(cfg, messages, options = {}) {
  const payload = {
    model: cfg.model,
    messages,
    stream: true,
    stream_options: { include_usage: true }
  }
  applyOptionalMaxTokens(payload, cfg?.maxTokens, options.maxTokens, options.max_tokens)
  const temperature = parseOptionalTemperature(cfg?.temperature)
  if (temperature !== null) {
    payload.temperature = temperature
  }
  // Tool calling support
  if (Array.isArray(options.tools) && options.tools.length > 0) {
    payload.tools = options.tools
  }
  if (options.tool_choice) {
    payload.tool_choice = options.tool_choice
  }
  return payload
}
