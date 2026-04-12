/**
 * STT 引擎调度器
 * 统一封装两种 STT 引擎，根据设置选择当前引擎
 * 引擎类型：'browser' | 'online'
 */
import { computed } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import { useCallSTT } from './useCallSTT'
import { useOnlineSTT } from './useOnlineSTT'

export function useSTTEngine() {
  const settings = useSettingsStore()

  const browserSTT = useCallSTT()
  const onlineSTT = useOnlineSTT()

  const currentEngineType = computed(() => {
    const type = String(settings.sttEngine || '').trim()
    if (type === 'online' || type === 'whisper-api') return 'online'
    return 'browser'
  })

  function getEngine() {
    const type = currentEngineType.value
    if (type === 'online') return onlineSTT
    return browserSTT
  }

  // 统一响应式状态 — 从当前引擎代理
  const isListening = computed(() => getEngine().isListening.value)
  const isSupported = computed(() => getEngine().isSupported.value)
  const transcript = computed(() => getEngine().transcript.value)
  const interimTranscript = computed(() => getEngine().interimTranscript.value)
  const lastError = computed(() => getEngine().lastError.value)

  function shouldFallbackToBrowser(type) {
    return type === 'online'
  }

  function start(options = {}) {
    const engine = getEngine()
    const requestedType = currentEngineType.value
    const result = engine.start(options)
    // 如果当前引擎启动失败且不是浏览器引擎，降级到浏览器
    if (result === false && shouldFallbackToBrowser(requestedType)) {
      console.warn(`STT engine "${requestedType}" failed, falling back to browser`)
      return browserSTT.start(options)
    }
    // 处理 Promise（在线 STT 引擎返回 async）
    if (result && typeof result.then === 'function') {
      return result.then(ok => {
        if (!ok && shouldFallbackToBrowser(requestedType)) {
          console.warn(`STT engine "${requestedType}" failed, falling back to browser`)
          return browserSTT.start(options)
        }
        return ok
      })
    }
    return result
  }

  function stop() { getEngine().stop() }
  function pause() { return getEngine().pause() }
  function resume() { return getEngine().resume() }
  function triggerRecognition() {
    const engine = getEngine()
    if (typeof engine.triggerRecognition === 'function') {
      return engine.triggerRecognition()
    }
    return false
  }

  async function requestMicrophonePermission() {
    return getEngine().requestMicrophonePermission()
  }

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    lastError,
    currentEngineType,
    start,
    stop,
    pause,
    resume,
    triggerRecognition,
    requestMicrophonePermission
  }
}
