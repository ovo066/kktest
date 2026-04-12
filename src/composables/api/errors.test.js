import { describe, expect, it } from 'vitest'
import {
  API_ERROR_CODES,
  buildFriendlyErrorMessage,
  createApiError,
  createApiFailureResult
} from './errors'

describe('api/errors', () => {
  it('preserves explicit business errors as shared failure results', () => {
    const result = createApiFailureResult(
      createApiError(API_ERROR_CODES.CONFIG_MISSING, '请先配置 API Key', {
        feature: 'vn',
        action: 'callVNApi'
      })
    )

    expect(result).toEqual({
      success: false,
      error: '请先配置 API Key',
      code: API_ERROR_CODES.CONFIG_MISSING,
      retryable: false,
      context: {
        feature: 'vn',
        action: 'callVNApi'
      }
    })
  })

  it('maps retryable HTTP errors into stable failure metadata', () => {
    const result = createApiFailureResult(
      new Error('HTTP 429: rate limit exceeded'),
      {
        traceId: 'trace_rate',
        context: {
          feature: 'chat',
          action: 'fetchModels'
        }
      }
    )

    expect(result).toEqual({
      success: false,
      error: '请求过于频繁（429）。请稍后再试。（诊断码: trace_rate）',
      code: API_ERROR_CODES.RATE_LIMITED,
      retryable: true,
      context: {
        feature: 'chat',
        action: 'fetchModels'
      },
      traceId: 'trace_rate'
    })
  })

  it('maps retryable HTTP errors from status metadata even when message is plain text', () => {
    const error = new Error('rate limit exceeded')
    error.status = 429

    const result = createApiFailureResult(error, {
      context: {
        feature: 'offline',
        action: 'sendMessage'
      }
    })

    expect(result).toEqual({
      success: false,
      error: '请求过于频繁（429）。请稍后再试。',
      code: API_ERROR_CODES.RATE_LIMITED,
      retryable: true,
      context: {
        feature: 'offline',
        action: 'sendMessage'
      }
    })
  })

  it('normalizes aborted requests to a shared canceled message', () => {
    const result = createApiFailureResult({
      name: 'AbortError',
      message: 'This operation was aborted'
    })

    expect(result).toEqual({
      success: false,
      error: '已取消',
      code: API_ERROR_CODES.ABORTED,
      retryable: false
    })
    expect(buildFriendlyErrorMessage({ name: 'AbortError', message: 'ignored' })).toBe('已取消')
  })
})
