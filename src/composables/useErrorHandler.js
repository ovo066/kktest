import { useToast } from './useToast'

function getErrorMessage(error, fallbackMessage) {
  if (typeof error === 'string' && error) {
    return error
  }

  if (error?.message) {
    return error.message
  }

  if (error == null) {
    return fallbackMessage
  }

  return String(error)
}

/**
 * 统一错误处理。
 * - 'toast':  显示 toast 通知
 * - 'warn':   console.warn + 返回错误
 * - 'silent': 仅返回错误，不做任何输出
 */
export function useErrorHandler() {
  const { showToast } = useToast()

  function handleError(error, {
    mode = 'toast',
    context = '',
    fallbackMessage = '操作失败',
    toastMessage = '',
    toastDuration = 2500
  } = {}) {
    const message = getErrorMessage(error, fallbackMessage)
    const label = context ? `[${context}] ${message}` : message

    if (mode === 'toast') {
      showToast(toastMessage || label, toastDuration)
    }

    if (mode === 'warn' || mode === 'toast') {
      console.warn(label, error)
    }

    return { error: message }
  }

  function withErrorHandling(fn, options = {}) {
    return async function withHandledError(...args) {
      try {
        return await fn(...args)
      } catch (error) {
        return handleError(error, options)
      }
    }
  }

  return {
    handleError,
    withErrorHandling
  }
}
