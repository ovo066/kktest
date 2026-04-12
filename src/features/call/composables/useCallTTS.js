/**
 * 通话 TTS 桥接
 * 复用 useVoicePlayback 的 TTS 基础设施，添加句子级别播放和队列管理
 */
import { ref } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import { useVoicePlayback } from '../../../composables/useVoicePlayback'
import { useCallState } from './useCallState'
import { splitForVoiceMode } from '../../../utils/ttsSegmentation'

// 单例状态
const isSpeaking = ref(false)
const speakQueue = ref([])
let isProcessing = false

export function useCallTTS() {
  const settingsStore = useSettingsStore()
  const { play, stop: stopPlayback } = useVoicePlayback()
  const { aiSpeaking, callActive } = useCallState()

  /**
   * 朗读一个句子（排队等待）
   * @param {string} text - 要朗读的文本
   * @param {Object} options - { msgId, isUser, emotion, onStarted, onEnded }
   */
  async function speakSentence(text, options = {}) {
    if (!callActive.value) return
    if (!text || !text.trim()) return

    const parts = splitForVoiceMode(text, settingsStore.voiceTtsMode)
    if (parts.length === 0) return

    const shared = { ...options }
    delete shared.onStarted
    delete shared.onEnded

    for (let i = 0; i < parts.length; i++) {
      speakQueue.value.push({
        ...shared,
        text: parts[i],
        onStarted: i === 0 ? options.onStarted : null,
        onEnded: i === parts.length - 1 ? options.onEnded : null
      })
    }
    processQueue()
  }

  async function processQueue() {
    if (isProcessing) return
    if (speakQueue.value.length === 0) {
      isSpeaking.value = false
      aiSpeaking.value = false
      return
    }

    isProcessing = true
    isSpeaking.value = true
    aiSpeaking.value = true

    const item = speakQueue.value.shift()

    try {
      if (item.onStarted) item.onStarted()

      await new Promise((resolve) => {
        play({
          msgId: item.msgId || null,
          text: item.text,
          isUser: item.isUser || false,
          emotion: item.emotion || 'normal',
          // 通话场景优先保持音色稳定，避免情绪标签导致句间音色突变。
          stableTimbre: true,
          durationSec: Math.max(1, item.text.length / 4),
          onEnded: resolve
        }).catch(() => resolve())
      })
    } catch {
      // 忽略 TTS 错误，继续处理队列
    }

    if (item.onEnded) {
      try { item.onEnded() } catch {}
    }

    isProcessing = false

    if (!callActive.value) {
      clearQueue()
      return
    }

    // 继续处理下一个
    processQueue()
  }

  function clearQueue() {
    speakQueue.value = []
    isProcessing = false
    isSpeaking.value = false
    aiSpeaking.value = false
  }

  function stopSpeaking() {
    stopPlayback()
    clearQueue()
  }

  return {
    isSpeaking,
    speakSentence,
    stopSpeaking,
    clearQueue
  }
}

