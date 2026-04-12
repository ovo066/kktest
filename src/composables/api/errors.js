export function trimText(value) {
  return String(value ?? '').trim()
}

export const API_ERROR_CODES = Object.freeze({
  API_ERROR: 'API_ERROR',
  CONFIG_MISSING: 'CONFIG_MISSING',
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  GROUP_CHAT_REQUIRED: 'GROUP_CHAT_REQUIRED',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  MEMBER_NOT_SELECTED: 'MEMBER_NOT_SELECTED',
  CONTACT_NOT_FOUND: 'CONTACT_NOT_FOUND',
  CALL_CONTACT_NOT_FOUND: 'CALL_CONTACT_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  EMPTY_REPLY: 'EMPTY_REPLY',
  CONTENT_FILTER: 'CONTENT_FILTER',
  ABORTED: 'ABORTED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  UNSUPPORTED_STREAM: 'UNSUPPORTED_STREAM'
})

const RETRYABLE_ERROR_CODES = new Set([
  API_ERROR_CODES.NETWORK_ERROR,
  API_ERROR_CODES.TIMEOUT,
  API_ERROR_CODES.RATE_LIMITED,
  API_ERROR_CODES.SERVER_ERROR
])

function readErrorMessage(error, fallback = '请求失败') {
  if (typeof error === 'string' && error) return error
  if (typeof error?.message === 'string' && error.message) return error.message
  if (error == null) return fallback
  return String(error)
}

function isNonEmptyObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0
}

function inferApiErrorCode(error, fallbackCode = API_ERROR_CODES.API_ERROR) {
  const explicitCode = trimText(error?.code)
  if (explicitCode) return explicitCode
  if (error?.name === 'AbortError') return API_ERROR_CODES.ABORTED
  const status = Number(error?.status)
  if (Number.isFinite(status)) {
    if (status === 401) return API_ERROR_CODES.AUTH_ERROR
    if (status === 403) return API_ERROR_CODES.PERMISSION_DENIED
    if (status === 404) return API_ERROR_CODES.NOT_FOUND
    if (status === 408) return API_ERROR_CODES.TIMEOUT
    if (status === 429) return API_ERROR_CODES.RATE_LIMITED
    if (status >= 500 && status <= 599) return API_ERROR_CODES.SERVER_ERROR
  }

  const raw = readErrorMessage(error, '')
  if (/HTTP 401/i.test(raw)) return API_ERROR_CODES.AUTH_ERROR
  if (/HTTP 403/i.test(raw)) return API_ERROR_CODES.PERMISSION_DENIED
  if (/HTTP 404/i.test(raw)) return API_ERROR_CODES.NOT_FOUND
  if (/HTTP 408/i.test(raw)) return API_ERROR_CODES.TIMEOUT
  if (/HTTP 429/i.test(raw)) return API_ERROR_CODES.RATE_LIMITED
  if (/HTTP 5\d\d/i.test(raw)) return API_ERROR_CODES.SERVER_ERROR
  if (/Failed to fetch|NetworkError|Load failed|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT/i.test(raw)) {
    return API_ERROR_CODES.NETWORK_ERROR
  }
  if (/当前环境不支持流式读取/.test(raw)) return API_ERROR_CODES.UNSUPPORTED_STREAM
  if (/content.?filter|content.?policy|safety|moderation|sensitive|违规|敏感/i.test(raw)) {
    return API_ERROR_CODES.CONTENT_FILTER
  }
  return fallbackCode
}

function inferRetryable(error, code) {
  if (typeof error?.retryable === 'boolean') return error.retryable
  return RETRYABLE_ERROR_CODES.has(code)
}

function pickFailureContext(error, explicitContext) {
  if (isNonEmptyObject(explicitContext)) return explicitContext
  if (isNonEmptyObject(error?.context)) return error.context
  if (isNonEmptyObject(error?.details)) return error.details
  return undefined
}

export function createApiError(code, message, details = {}, options = {}) {
  const err = new Error(message)
  err.code = code
  err.details = details
  if (isNonEmptyObject(options.context)) {
    err.context = options.context
  } else if (isNonEmptyObject(details)) {
    err.context = details
  }
  if (typeof options.retryable === 'boolean') {
    err.retryable = options.retryable
  }
  if (typeof options.traceId === 'string' && options.traceId) {
    err.traceId = options.traceId
  }
  return err
}

export function buildFriendlyErrorMessage(error, traceId) {
  const raw = trimText(readErrorMessage(error))
  const suffix = traceId ? `（诊断码: ${traceId}）` : ''
  const code = inferApiErrorCode(error)

  if (code === API_ERROR_CODES.CONFIG_MISSING) return `${raw || '请先完成 API 配置。'}${suffix}`
  if (code === API_ERROR_CODES.CHAT_NOT_FOUND) return `${raw || '没有活动的聊天'}${suffix}`
  if (code === API_ERROR_CODES.GROUP_CHAT_REQUIRED) return `${raw || '当前不是群聊'}${suffix}`
  if (code === API_ERROR_CODES.MEMBER_NOT_FOUND) return `${raw || '未找到指定成员'}${suffix}`
  if (code === API_ERROR_CODES.MEMBER_NOT_SELECTED) return `${raw || '请先选择发言成员'}${suffix}`
  if (code === API_ERROR_CODES.CONTACT_NOT_FOUND) return `${raw || '联系人不存在'}${suffix}`
  if (code === API_ERROR_CODES.CALL_CONTACT_NOT_FOUND) return `${raw || '找不到联系人'}${suffix}`
  if (code === API_ERROR_CODES.PROJECT_NOT_FOUND) return `${raw || '没有活动的 VN 项目'}${suffix}`
  if (code === API_ERROR_CODES.MEETING_NOT_FOUND) return `${raw || '没有活动的见面'}${suffix}`
  if (code === API_ERROR_CODES.EMPTY_REPLY) {
    return `本次没有收到可显示回复。请重试；若持续出现，请检查接口流式返回配置。${suffix}`
  }
  if (code === API_ERROR_CODES.CONTENT_FILTER) {
    return `回复被模型内容安全策略拦截（content_filter）。可尝试调整对话内容或更换模型。${suffix}`
  }
  if (code === API_ERROR_CODES.ABORTED) return `已取消${suffix}`
  if (code === API_ERROR_CODES.AUTH_ERROR) return `API Key 无效或已过期（401）。请检查设置。${suffix}`
  if (code === API_ERROR_CODES.PERMISSION_DENIED) return `当前 API Key 无权限访问该模型（403）。请检查模型权限。${suffix}`
  if (code === API_ERROR_CODES.NOT_FOUND) return `接口地址或模型不存在（404）。请检查 URL / 模型名。${suffix}`
  if (code === API_ERROR_CODES.TIMEOUT) return `请求超时（408）。请重试。${suffix}`
  if (code === API_ERROR_CODES.RATE_LIMITED) return `请求过于频繁（429）。请稍后再试。${suffix}`
  if (code === API_ERROR_CODES.SERVER_ERROR) return `服务端暂时不可用（${raw}）。请稍后重试。${suffix}`
  if (code === API_ERROR_CODES.NETWORK_ERROR) return `网络请求失败，请检查网络或代理设置。${suffix}`
  if (code === API_ERROR_CODES.UNSUPPORTED_STREAM) return `当前环境不支持流式返回。${suffix}`

  return `${raw}${suffix}`
}

export function createApiFailureResult(error, options = {}) {
  const traceId = trimText(options.traceId || error?.traceId)
  const code = inferApiErrorCode(error, options.defaultCode || API_ERROR_CODES.API_ERROR)
  const context = pickFailureContext(error, options.context)
  const retryable = typeof options.retryable === 'boolean'
    ? options.retryable
    : inferRetryable(error, code)
  const friendlyError = trimText(options.errorMessage) || buildFriendlyErrorMessage({
    code,
    message: readErrorMessage(error),
    retryable,
    context,
    details: error?.details,
    name: error?.name
  }, traceId)

  const result = {
    success: false,
    error: friendlyError,
    code,
    retryable
  }
  if (context) result.context = context
  if (traceId) result.traceId = traceId
  return result
}
