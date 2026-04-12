import { useVNStore } from '../stores/vn'

export function useTTS() {
  const vnStore = useVNStore()

  const EDGE_VOICES = [
    // zh-CN (female)
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female', lang: 'zh', desc: '温柔甜美' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female', lang: 'zh', desc: '活泼可爱' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰', gender: 'female', lang: 'zh', desc: '知性温柔' },
    { id: 'zh-CN-XiaohanNeural', name: '晓涵', gender: 'female', lang: 'zh', desc: '温暖亲切' },
    { id: 'zh-CN-XiaomoNeural', name: '晓墨', gender: 'female', lang: 'zh', desc: '文静淡雅' },
    { id: 'zh-CN-XiaoruiNeural', name: '晓睿', gender: 'female', lang: 'zh', desc: '成熟稳重' },
    { id: 'zh-CN-XiaoshuangNeural', name: '晓双', gender: 'female', lang: 'zh', desc: '少女音' },
    { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', gender: 'female', lang: 'zh', desc: '元气少女' },
    { id: 'zh-CN-XiaoyanNeural', name: '晓颜', gender: 'female', lang: 'zh', desc: '沉稳大方' },
    // zh-CN (male)
    { id: 'zh-CN-YunxiNeural', name: '云希', gender: 'male', lang: 'zh', desc: '阳光青年' },
    { id: 'zh-CN-YunjianNeural', name: '云健', gender: 'male', lang: 'zh', desc: '成熟稳重' },
    { id: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male', lang: 'zh', desc: '专业播音' },
    { id: 'zh-CN-YunxiaNeural', name: '云夏', gender: 'male', lang: 'zh', desc: '少年音' },
    // ja-JP
    { id: 'ja-JP-NanamiNeural', name: 'Nanami', gender: 'female', lang: 'ja', desc: '日语女声' },
    { id: 'ja-JP-KeitaNeural', name: 'Keita', gender: 'male', lang: 'ja', desc: '日语男声' },
    // en-US
    { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'female', lang: 'en', desc: '英语女声' },
    { id: 'en-US-GuyNeural', name: 'Guy', gender: 'male', lang: 'en', desc: '英语男声' }
  ]

  async function synthesizeEdge(text, voiceId, options = {}) {
    const rate = options.rate || '+0%'
    const pitch = options.pitch || '+0Hz'

    try {
      return await edgeTTSViaAPI(text, voiceId, rate, pitch)
    } catch (e) {
      console.warn('Edge TTS API 失败, 使用浏览器 fallback:', e)
      await browserTTSFallback(text)
      return '__browser_tts__'
    }
  }

  async function edgeTTSViaAPI(text, voiceId, rate, pitch) {
    const ttsEndpoint = vnStore.ttsConfig.endpoint
    if (!ttsEndpoint) throw new Error('TTS endpoint 未设置')

    const params = new URLSearchParams({
      text,
      voice: voiceId,
      rate,
      pitch
    })

    const res = await fetch(`${ttsEndpoint}?${params}`)
    if (!res.ok) throw new Error('TTS API HTTP ' + res.status)

    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }

  function browserTTSFallback(text) {
    if (typeof window === 'undefined') return Promise.resolve()
    if (typeof speechSynthesis === 'undefined') return Promise.resolve()

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.rate = 1.0
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      speechSynthesis.speak(utterance)
    })
  }

  async function speak(text, characterIdOrOptions) {
    if (!vnStore.ttsConfig.enabled || vnStore.ttsConfig.provider === 'none') return null

    // 支持两种调用方式: speak(text, characterId) 或 speak(text, { isNarration, characterId })
    let characterId = null
    let isNarration = false

    if (typeof characterIdOrOptions === 'string') {
      characterId = characterIdOrOptions
    } else if (characterIdOrOptions && typeof characterIdOrOptions === 'object') {
      characterId = characterIdOrOptions.characterId || null
      isNarration = !!characterIdOrOptions.isNarration
    }

    // 旁白语音检查
    if (isNarration && !vnStore.ttsConfig.narratorEnabled) {
      return null
    }

    // 选择音色：旁白用专用音色，角色用角色音色
    let voiceId
    if (isNarration) {
      voiceId = vnStore.ttsConfig.narratorVoiceId || 'zh-CN-YunxiNeural'
    } else {
      const char = vnStore.currentProject?.characters?.find(c => c.contactId === characterId)
      voiceId = char?.voiceId || 'zh-CN-XiaoxiaoNeural'
    }

    const cleanText = String(text || '')
      .replace(/\[.*?\]/g, '')
      .replace(/[*_~`]/g, '')
      .trim()
    if (!cleanText) return null

    vnStore.player.isSpeaking = true

    const audioUrl = vnStore.ttsConfig.provider === 'edge'
      ? await synthesizeEdge(cleanText, voiceId)
      : '__browser_tts__'

    if (audioUrl === '__browser_tts__') {
      vnStore.player.isSpeaking = false
      return null
    }

    if (!audioUrl) {
      vnStore.player.isSpeaking = false
      return null
    }

    // stop previous
    if (vnStore.player.currentAudio) {
      vnStore.player.currentAudio.pause()
      vnStore.player.currentAudio = null
    }

    const audio = new Audio(audioUrl)
    audio.volume = vnStore.player.volume?.voice ?? 1.0
    vnStore.player.currentAudio = audio

    audio.onended = () => {
      vnStore.player.isSpeaking = false
      vnStore.player.currentAudio = null
      URL.revokeObjectURL(audioUrl)
    }
    audio.onerror = () => {
      vnStore.player.isSpeaking = false
      vnStore.player.currentAudio = null
      URL.revokeObjectURL(audioUrl)
    }

    audio.play().catch(() => {
      vnStore.player.isSpeaking = false
    })

    return audio
  }

  function stopSpeaking() {
    if (vnStore.player.currentAudio) {
      try { vnStore.player.currentAudio.pause() } catch {}
      vnStore.player.currentAudio = null
    }
    vnStore.player.isSpeaking = false
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.cancel() } catch {}
    }
  }

  return {
    EDGE_VOICES,
    speak,
    stopSpeaking
  }
}

