import { describe, expect, it, vi } from 'vitest'
import { createSTTErrorNotifier, formatSTTErrorMessage } from './callSpeechErrors'

describe('callSpeechErrors', () => {
  it('formats no-speech errors by trigger mode', () => {
    expect(formatSTTErrorMessage('no-speech', {
      isManualSTTTriggerMode: true,
      currentEngineType: 'online'
    })).toContain('先点开始识别')

    expect(formatSTTErrorMessage('no-speech', {
      isManualSTTTriggerMode: false,
      currentEngineType: 'browser'
    })).toContain('没有识别到清晰内容')
  })

  it('deduplicates repeated toasts during cooldown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'))

    const showToast = vi.fn()
    const notifySTTError = createSTTErrorNotifier({
      showToast,
      getCurrentEngineType: () => 'online',
      isManualSTTTriggerMode: () => false
    })

    notifySTTError('api-error')
    notifySTTError('api-error')
    expect(showToast).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-03-26T12:00:06Z'))
    notifySTTError('api-error')
    expect(showToast).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })
})
