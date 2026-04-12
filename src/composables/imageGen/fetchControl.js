const IMAGE_REQUEST_TIMEOUT_MS = 90_000

function normalizeTimeoutMs(value, fallback = IMAGE_REQUEST_TIMEOUT_MS) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.round(n)
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || /AbortError|aborted/i.test(String(error?.message || error || ''))
}

export function createFetchControl(parentSignal, timeoutMs) {
  const resolvedTimeout = normalizeTimeoutMs(timeoutMs)
  if (typeof AbortController === 'undefined') {
    return {
      signal: parentSignal,
      timeoutMs: resolvedTimeout,
      isTimedOut: () => false,
      cleanup: () => {}
    }
  }

  const controller = new AbortController()
  let timedOut = false
  let timeoutId = null
  let onParentAbort = null

  const abort = () => {
    if (!controller.signal.aborted) controller.abort()
  }

  const hasParentSignal = !!parentSignal && typeof parentSignal === 'object'
  if (hasParentSignal) {
    if (parentSignal.aborted) {
      abort()
    } else if (typeof parentSignal.addEventListener === 'function') {
      onParentAbort = () => abort()
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }
  }

  timeoutId = setTimeout(() => {
    timedOut = true
    abort()
  }, resolvedTimeout)

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (onParentAbort && hasParentSignal && typeof parentSignal.removeEventListener === 'function') {
      parentSignal.removeEventListener('abort', onParentAbort)
    }
  }

  return {
    signal: controller.signal,
    timeoutMs: resolvedTimeout,
    isTimedOut: () => timedOut,
    cleanup
  }
}

