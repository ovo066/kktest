import { computed, ref, watch } from 'vue'
import { useToast } from '../../../composables/useToast'
import { useSettingsStore } from '../../../stores/settings'
import {
  createSTTErrorNotifier,
  STT_BLOCKING_ERRORS
} from './callSpeechErrors'
import {
  mergeSpeechBuffer,
  normalizeSpeechText,
  STT_MIN_REPLY_CHARS,
  STT_RESUME_DELAY_MS,
  STT_SILENCE_REPLY_MS
} from './callSpeechSupport'
import { cleanCallText } from './useCallParser'
import { useSTTEngine } from './useSTTEngine'

export function useCallSpeechSession(options = {}) {
  const settingsStore = useSettingsStore()
  const { showToast } = useToast()
  const {
    currentEngineType,
    isListening: sttListening,
    isSupported: sttSupported,
    transcript: sttTranscript,
    interimTranscript: interimText,
    lastError: sttError,
    start: startSTT,
    stop: stopSTT,
    pause: pauseSTT,
    resume: resumeSTT,
    triggerRecognition: triggerSTTRecognition,
    requestMicrophonePermission
  } = useSTTEngine()

  const muted = ref(false)
  const showTextInput = ref(false)
  const manualRecognitionArmed = ref(false)
  const sttFinalBuffer = ref('')
  const sttInterimBuffer = ref('')

  const isLikelyEchoText = typeof options.isLikelyEchoText === 'function'
    ? options.isLikelyEchoText
    : () => false
  const resetEchoGuard = typeof options.resetEchoGuard === 'function'
    ? options.resetEchoGuard
    : () => {}

  let sttResumeTimer = null
  let sttSilenceReplyTimer = null
  let sttStartPromise = null

  const isManualSTTTriggerMode = computed(() => (
    String(settingsStore.sttEngine || '').trim() === 'online' &&
    String(settingsStore.sttTriggerMode || '').trim() === 'manual'
  ))
  const canTriggerManualRecognition = computed(() => (
    isManualSTTTriggerMode.value &&
    options.callActive?.value &&
    options.callPhase?.value === 'connected' &&
    !showTextInput.value &&
    !muted.value &&
    !options.isWaitingReply?.value &&
    !options.aiSpeaking?.value &&
    sttSupported.value &&
    sttListening.value
  ))
  const manualRecognitionButtonLabel = computed(() => (
    manualRecognitionArmed.value ? '发送识别' : '开始识别'
  ))

  const notifySTTError = createSTTErrorNotifier({
    showToast,
    getCurrentEngineType: () => currentEngineType.value,
    isManualSTTTriggerMode: () => isManualSTTTriggerMode.value
  })

  function clearSTTResumeTimer() {
    if (!sttResumeTimer) return
    clearTimeout(sttResumeTimer)
    sttResumeTimer = null
  }

  function clearSTTSilenceReplyTimer() {
    if (!sttSilenceReplyTimer) return
    clearTimeout(sttSilenceReplyTimer)
    sttSilenceReplyTimer = null
  }

  function resetSTTSpeechBuffers() {
    clearSTTSilenceReplyTimer()
    sttFinalBuffer.value = ''
    sttInterimBuffer.value = ''
  }

  async function dispatchRecognizedText(text) {
    const handler = typeof options.onRecognizedText === 'function'
      ? options.onRecognizedText
      : null
    if (!handler) return
    await Promise.resolve(handler(text))
  }

  function scheduleSTTSilenceAutoReply() {
    if (isManualSTTTriggerMode.value) return
    if (!sttSupported.value || showTextInput.value || muted.value) return

    clearSTTSilenceReplyTimer()
    sttSilenceReplyTimer = setTimeout(() => {
      sttSilenceReplyTimer = null
      if (options.isWaitingReply?.value || options.aiSpeaking?.value) return
      if (!options.callActive?.value || options.callPhase?.value !== 'connected') return

      const candidate = mergeSpeechBuffer(sttFinalBuffer.value, sttInterimBuffer.value)
      const normalized = normalizeSpeechText(candidate)
      if (!candidate || normalized.length < STT_MIN_REPLY_CHARS) return
      if (isLikelyEchoText(candidate)) {
        resetSTTSpeechBuffers()
        return
      }

      resetSTTSpeechBuffers()
      void dispatchRecognizedText(candidate)
    }, STT_SILENCE_REPLY_MS)
  }

  function resetSpeechTurnGuards() {
    clearSTTResumeTimer()
    resetSTTSpeechBuffers()
    resetEchoGuard()
    manualRecognitionArmed.value = false
  }

  function resumeSTTIfAllowed() {
    if (!sttSupported.value || showTextInput.value || muted.value) return
    if (!options.callActive?.value || options.callPhase?.value !== 'connected') return
    if (sttStartPromise) return

    Promise.resolve(resumeSTT())
      .then(async (ok) => {
        if (ok) return

        const currentError = String(sttError.value || '').trim()
        if (currentEngineType.value === 'browser' && (currentError === 'invalid-state' || currentError === 'unknown')) {
          await new Promise(resolve => setTimeout(resolve, 260))
          if (!options.callActive?.value || options.callPhase?.value !== 'connected' || showTextInput.value || muted.value) return
          const retried = await Promise.resolve(resumeSTT()).catch(() => false)
          if (retried) return
        }

        if (sttListening.value || sttStartPromise) return
        void startSTTListening()
      })
      .catch(() => {
        if (sttListening.value || sttStartPromise) return
        void startSTTListening()
      })
  }

  function scheduleResumeSpeechInput() {
    clearSTTResumeTimer()
    sttResumeTimer = setTimeout(() => {
      sttResumeTimer = null
      resumeSTTIfAllowed()
    }, STT_RESUME_DELAY_MS)
  }

  function resolveCallSTTLang() {
    if (typeof navigator === 'undefined') return 'zh-CN'
    const navLang = String(navigator.language || '').trim()
    if (!navLang) return 'zh-CN'
    const lower = navLang.toLowerCase()
    return lower.startsWith('zh') ? navLang : 'zh-CN'
  }

  watch(sttError, (error) => {
    const normalized = String(error || '').trim()
    if (!normalized) return
    if (normalized === 'no-speech' && !isManualSTTTriggerMode.value) return

    notifySTTError(normalized)
    if (STT_BLOCKING_ERRORS.has(normalized)) {
      manualRecognitionArmed.value = false
      clearSTTResumeTimer()
      resetSTTSpeechBuffers()
      showTextInput.value = true
    }
  })

  watch(isManualSTTTriggerMode, (enabled) => {
    if (enabled) return
    manualRecognitionArmed.value = false
  })

  async function prepareSTTForCurrentCall() {
    if (!sttSupported.value) {
      showTextInput.value = true
      notifySTTError('unsupported')
      return false
    }

    const { ok } = await requestMicrophonePermission()
    if (!ok) {
      showTextInput.value = true
      notifySTTError(sttError.value || 'unknown')
    }
    return ok
  }

  async function startSTTListening() {
    if (!sttSupported.value || showTextInput.value) return false
    if (sttListening.value) return true
    if (sttStartPromise) return sttStartPromise

    sttStartPromise = (async () => {
      const startOptions = {
        lang: resolveCallSTTLang(),
        triggerMode: isManualSTTTriggerMode.value ? 'manual' : 'auto',
        onResult: (text) => {
          const finalText = cleanCallText(text).trim()
          if (!finalText || options.isWaitingReply?.value || options.aiSpeaking?.value) return
          if (isLikelyEchoText(finalText)) return

          if (!isManualSTTTriggerMode.value && currentEngineType.value === 'online') {
            void dispatchRecognizedText(finalText)
            return
          }

          sttFinalBuffer.value = mergeSpeechBuffer(sttFinalBuffer.value, finalText)
          sttInterimBuffer.value = ''
          if (!isManualSTTTriggerMode.value) {
            scheduleSTTSilenceAutoReply()
          }
        },
        onInterim: (text) => {
          const nextInterimText = cleanCallText(text).trim()
          if (!nextInterimText || options.isWaitingReply?.value || options.aiSpeaking?.value) return
          if (isLikelyEchoText(nextInterimText)) return

          sttInterimBuffer.value = nextInterimText
          if (!isManualSTTTriggerMode.value) {
            scheduleSTTSilenceAutoReply()
          }
        }
      }

      const tryStart = async () => {
        try {
          return Boolean(await Promise.resolve(startSTT(startOptions)))
        } catch (err) {
          console.warn('Failed to start STT engine:', err)
          return false
        }
      }

      let started = await tryStart()
      const currentError = String(sttError.value || '').trim()
      if (!started && currentEngineType.value === 'browser' && (currentError === 'invalid-state' || currentError === 'unknown')) {
        await new Promise(resolve => setTimeout(resolve, 260))
        started = await tryStart()
      }

      if (!started) {
        resetSTTSpeechBuffers()
        showTextInput.value = true
        notifySTTError(sttError.value || 'unknown')
      }

      return Boolean(started)
    })()

    try {
      return await sttStartPromise
    } finally {
      sttStartPromise = null
    }
  }

  async function handleManualRecognition() {
    if (!canTriggerManualRecognition.value) return

    if (!manualRecognitionArmed.value) {
      resetSTTSpeechBuffers()
      manualRecognitionArmed.value = false
      await Promise.resolve(pauseSTT()).catch(() => false)
      const resumed = await Promise.resolve(resumeSTT()).catch(() => false)
      if (!resumed) {
        notifySTTError(sttError.value || 'unknown')
        return
      }
      manualRecognitionArmed.value = true
      showToast('已开始识别，请说话后再点一次“发送识别”', 2200)
      return
    }

    manualRecognitionArmed.value = false
    const ok = await Promise.resolve(triggerSTTRecognition()).catch(() => false)
    if (!ok) {
      notifySTTError(sttError.value || 'unknown')
      return
    }

    let candidate = mergeSpeechBuffer(sttFinalBuffer.value, sttInterimBuffer.value)
    if (!candidate) {
      const transcriptCandidate = cleanCallText(sttTranscript.value).trim()
      if (transcriptCandidate) {
        candidate = transcriptCandidate
      }
    }

    const normalized = normalizeSpeechText(candidate)
    if (!candidate || normalized.length < 1) {
      const currentError = String(sttError.value || '').trim()
      resetSTTSpeechBuffers()
      if (currentError) {
        notifySTTError(currentError)
        return
      }
      showToast('未识别到有效语音，请先点开始识别并完整说一句后再发送', 2400)
      return
    }
    if (isLikelyEchoText(candidate)) {
      resetSTTSpeechBuffers()
      return
    }

    resetSTTSpeechBuffers()
    await dispatchRecognizedText(candidate)
  }

  function pauseSpeechInput() {
    manualRecognitionArmed.value = false
    clearSTTResumeTimer()
    resetSTTSpeechBuffers()
    pauseSTT()
  }

  function stopSpeechRuntime() {
    resetSpeechTurnGuards()
    stopSTT()
  }

  function toggleMute() {
    muted.value = !muted.value
    if (!sttSupported.value || showTextInput.value) return
    if (muted.value) {
      pauseSpeechInput()
      return
    }
    if (!options.isWaitingReply?.value && !options.aiSpeaking?.value) {
      resumeSTTIfAllowed()
    }
  }

  function toggleTextInput() {
    showTextInput.value = !showTextInput.value
    if (!sttSupported.value) return
    if (showTextInput.value) {
      pauseSpeechInput()
      return
    }
    if (!muted.value && !options.isWaitingReply?.value && !options.aiSpeaking?.value) {
      resumeSTTIfAllowed()
    }
  }

  function resetSpeechSessionUi() {
    muted.value = false
    showTextInput.value = false
    manualRecognitionArmed.value = false
  }

  return {
    sttListening,
    interimText,
    muted,
    showTextInput,
    isManualSTTTriggerMode,
    canTriggerManualRecognition,
    manualRecognitionButtonLabel,
    toggleMute,
    toggleTextInput,
    handleManualRecognition,
    prepareSTTForCurrentCall,
    pauseSpeechInput,
    scheduleResumeSpeechInput,
    resetSpeechTurnGuards,
    resetSpeechSessionUi,
    stopSpeechRuntime
  }
}
