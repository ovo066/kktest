/**
 * 通话 STT（语音转文字）
 * 封装 Web Speech API SpeechRecognition
 */
import { ref } from 'vue'

const isListening = ref(false)
const isSupported = ref(false)
const transcript = ref('')
const interimTranscript = ref('')
const lastError = ref('')

let recognition = null
let shouldAutoRestart = false
let isPaused = false
let restartTimer = null

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// 检测支持
if (typeof window !== 'undefined') {
  const SpeechRecognition = getSpeechRecognitionCtor()
  isSupported.value = typeof SpeechRecognition === 'function'
}

function isSecureSpeechContext() {
  if (typeof window === 'undefined') return false
  if (window.isSecureContext) return true
  const host = window.location?.hostname || ''
  return host === 'localhost' || host === '127.0.0.1'
}

function normalizeMediaError(error) {
  const name = error?.name || ''
  const message = String(error?.message || '').toLowerCase()
  if (name === 'InvalidStateError') return 'invalid-state'
  if (name === 'NotSupportedError') return 'unsupported'
  if (name === 'AbortError') return 'aborted'
  if (name === 'NetworkError') return 'network'
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'not-allowed'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'audio-capture'
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'audio-capture'
  if (name === 'SecurityError') return 'insecure-context'
  if (/not a constructor|is not a function/.test(message)) return 'unsupported'
  if (/already started|already active|start\(\) called/.test(message)) return 'invalid-state'
  if (/network/.test(message)) return 'network'
  return 'unknown'
}

function normalizeSpeechError(errorType) {
  const raw = String(errorType || '').trim().toLowerCase()
  if (!raw) return 'unknown'
  if (raw === 'permission-denied') return 'not-allowed'
  if (raw === 'device-not-found') return 'audio-capture'
  return raw
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
}

function safeStop(rec) {
  if (!rec) return
  try { rec.stop() } catch {}
}

export function useCallSTT() {
  function start(options = {}) {
    const { lang = 'zh-CN', onResult, onInterim } = options

    if (!isSupported.value) {
      lastError.value = 'unsupported'
      return false
    }
    if (!isSecureSpeechContext()) {
      lastError.value = 'insecure-context'
      return false
    }

    const SpeechRecognition = getSpeechRecognitionCtor()
    if (typeof SpeechRecognition !== 'function') {
      lastError.value = 'unsupported'
      return false
    }

    stop()
    clearRestartTimer()
    shouldAutoRestart = true
    isPaused = false
    transcript.value = ''
    interimTranscript.value = ''
    lastError.value = ''

    let current = null
    try {
      current = new SpeechRecognition()
    } catch (error) {
      shouldAutoRestart = false
      isPaused = false
      isListening.value = false
      lastError.value = normalizeMediaError(error)
      recognition = null
      return false
    }

    recognition = current
    current.continuous = true
    current.interimResults = true
    current.lang = lang
    current.maxAlternatives = 1

    current.onresult = (event) => {
      if (recognition !== current) return
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalText) {
        transcript.value = finalText
        interimTranscript.value = ''
        if (onResult) onResult(finalText)
      } else if (interimText) {
        interimTranscript.value = interimText
        if (onInterim) onInterim(interimText)
      }
    }

    current.onerror = (event) => {
      if (recognition !== current) return
      const errorType = normalizeSpeechError(event?.error)

      if (errorType !== 'aborted') {
        lastError.value = errorType
      }
      if (
        errorType === 'not-allowed' ||
        errorType === 'service-not-allowed' ||
        errorType === 'audio-capture' ||
        errorType === 'language-not-supported' ||
        errorType === 'bad-grammar' ||
        errorType === 'network'
      ) {
        shouldAutoRestart = false
        isPaused = false
        isListening.value = false
      }

      // 'no-speech' 和 'aborted' 不是严重错误
      if (errorType !== 'no-speech' && errorType !== 'aborted') {
        console.warn('STT error:', errorType)
      }
    }

    current.onend = () => {
      if (recognition !== current) return
      isListening.value = false

      // 如果还在监听模式，自动重启
      if (shouldAutoRestart && !isPaused) {
        clearRestartTimer()
        restartTimer = setTimeout(() => {
          if (recognition !== current || !shouldAutoRestart || isPaused) return
          restartTimer = null
          try {
            current.start()
            isListening.value = true
          } catch (error) {
            shouldAutoRestart = false
            isListening.value = false
            lastError.value = normalizeMediaError(error)
          }
        }, 180)
      }
    }

    try {
      current.start()
      isListening.value = true
      return true
    } catch (error) {
      const normalized = normalizeMediaError(error)

      // 部分安卓浏览器会在刚创建后抛 InvalidStateError，允许一次立即重试。
      if (normalized === 'invalid-state') {
        try {
          safeStop(current)
          current.start()
          isListening.value = true
          return true
        } catch (retryError) {
          lastError.value = normalizeMediaError(retryError)
        }
      }

      shouldAutoRestart = false
      isPaused = false
      isListening.value = false
      if (!lastError.value) {
        lastError.value = normalized
      }
      if (recognition === current) {
        recognition = null
      }
      return false
    }
  }

  async function requestMicrophonePermission() {
    if (!isSupported.value) {
      lastError.value = 'unsupported'
      return { ok: false, error: 'unsupported' }
    }
    if (!isSecureSpeechContext()) {
      lastError.value = 'insecure-context'
      return { ok: false, error: 'insecure-context' }
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      lastError.value = 'unsupported'
      return { ok: false, error: 'unsupported' }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      lastError.value = ''
      return { ok: true, error: '' }
    } catch (error) {
      const normalized = normalizeMediaError(error)
      lastError.value = normalized
      return { ok: false, error: normalized }
    }
  }

  function stop() {
    shouldAutoRestart = false
    isPaused = false
    isListening.value = false
    interimTranscript.value = ''
    clearRestartTimer()
    if (recognition) {
      const current = recognition
      recognition = null
      current.onresult = null
      current.onerror = null
      current.onend = null
      safeStop(current)
    }
  }

  function pause() {
    if (!recognition || !isListening.value) return false
    isPaused = true
    shouldAutoRestart = false
    isListening.value = false
    interimTranscript.value = ''
    clearRestartTimer()
    safeStop(recognition)
    return true
  }

  function resume() {
    if (!recognition || isListening.value) return false
    isPaused = false
    shouldAutoRestart = true
    lastError.value = ''
    try {
      recognition.start()
      isListening.value = true
      return true
    } catch (error) {
      shouldAutoRestart = false
      isListening.value = false
      lastError.value = normalizeMediaError(error)
      return false
    }
  }

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    lastError,
    start,
    stop,
    pause,
    resume,
    requestMicrophonePermission
  }
}
