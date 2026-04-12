import { afterEach, describe, expect, it, vi } from 'vitest'
import { useErrorHandler } from './useErrorHandler'
import { useToast } from './useToast'

function resetToastState() {
  const { toastMessage, toastVisible } = useToast()
  toastMessage.value = ''
  toastVisible.value = false
}

describe('useErrorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    resetToastState()
  })

  it('shows a custom toast message and logs the original error', () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { handleError } = useErrorHandler()
    const { toastMessage, toastVisible } = useToast()

    const result = handleError(new Error('disk full'), {
      mode: 'toast',
      context: 'Storage:Save',
      toastMessage: '数据保存失败，请尽快导出备份',
      toastDuration: 4000
    })

    expect(result).toEqual({ error: 'disk full' })
    expect(toastMessage.value).toBe('数据保存失败，请尽快导出备份')
    expect(toastVisible.value).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith('[Storage:Save] disk full', expect.any(Error))

    vi.advanceTimersByTime(4000)

    expect(toastVisible.value).toBe(false)
  })

  it('returns the fallback message without side effects in silent mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { handleError } = useErrorHandler()
    const { toastMessage, toastVisible } = useToast()

    const result = handleError(null, {
      mode: 'silent',
      fallbackMessage: '操作失败'
    })

    expect(result).toEqual({ error: '操作失败' })
    expect(toastMessage.value).toBe('')
    expect(toastVisible.value).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
