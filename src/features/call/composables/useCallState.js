/**
 * 通话状态 — 单例 composable
 * 管理通话生命周期、计时器、资源库
 * 支持两种视频子模式：模拟视频 (video) / Galgame (galgame)
 */
import { ref, reactive } from 'vue'
import { useCharacterResourcesStore } from '../../../stores/characterResources'

// ===== 单例状态 =====
const callActive = ref(false)
const callPhase = ref('idle') // idle | ringing | connecting | connected | ended
const callMode = ref(null)    // 'video' | 'voice'
const videoSubMode = ref('video') // 'video' (模拟视频) | 'galgame' (立绘模式)
const callStartTime = ref(null)
const callDuration = ref(0)   // seconds
const callContactId = ref(null)

// AI 对话状态
const aiSpeaking = ref(false)
const aiText = ref('')
const aiEmotion = ref('normal')
const userSpeaking = ref(false)

// 通话内消息历史
const callMessages = ref([])

// 通话中使用的精灵图/背景/角色图
const currentSpriteUrl = ref('')
const currentBgUrl = ref('')
const currentCharacterImage = ref('') // 模拟视频模式下的角色全身图

// 角色资源库（按联系人存储）
// { [contactId]: { sprites: {}, backgrounds: [], avatar: '', characterImage: '' } }
const callResources = reactive({})

// 计时器
let durationTimer = null
let ringingTimer = null

function startDurationTimer() {
  callDuration.value = 0
  durationTimer = setInterval(() => {
    callDuration.value++
  }, 1000)
}

function stopDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function useCallState() {
  function normalizeEmotionKey(emotion) {
    const key = String(emotion || '').trim().toLowerCase()
    return key || 'normal'
  }

  function getCallSpriteUrl(contactId, emotion) {
    const res = callResources[contactId]
    if (!res?.sprites || typeof res.sprites !== 'object') return ''

    if (res.sprites[emotion]) {
      return res.sprites[emotion]
    }

    const matchedKey = Object.keys(res.sprites).find(
      (key) => String(key || '').trim().toLowerCase() === emotion
    )
    return matchedKey ? res.sprites[matchedKey] : ''
  }

  function getCharacterExpressionUrl(contactId, emotion) {
    try {
      const charResStore = useCharacterResourcesStore()
      const entry = charResStore.getEntry(contactId)
      if (!entry) return ''

      if (emotion === 'normal') {
        return entry.baseImage?.url || ''
      }

      if (entry.expressions?.[emotion]?.url) {
        return entry.expressions[emotion].url
      }

      const matchedKey = Object.keys(entry.expressions || {}).find(
        (key) => String(key || '').trim().toLowerCase() === emotion
      )
      return matchedKey ? (entry.expressions?.[matchedKey]?.url || '') : ''
    } catch {
      return ''
    }
  }

  function resolveSpriteUrl(contactId, emotion, options = {}) {
    if (!contactId) return ''
    const normalized = normalizeEmotionKey(emotion)
    const fallbackToNormal = options.fallbackToNormal === true

    const callSprite = getCallSpriteUrl(contactId, normalized)
    if (callSprite) return callSprite

    const characterSprite = getCharacterExpressionUrl(contactId, normalized)
    if (characterSprite) return characterSprite

    if (!fallbackToNormal || normalized === 'normal') {
      return ''
    }

    const callNormal = getCallSpriteUrl(contactId, 'normal')
    if (callNormal) return callNormal

    return getCharacterExpressionUrl(contactId, 'normal')
  }

  function startCall(contactId, mode) {
    callActive.value = true
    callPhase.value = 'ringing'
    callMode.value = mode
    callContactId.value = contactId
    callStartTime.value = null
    callDuration.value = 0
    callMessages.value = []
    aiText.value = ''
    aiEmotion.value = 'normal'
    aiSpeaking.value = false
    userSpeaking.value = false

    // 加载资源
    loadResources(contactId)

    // 模拟响铃 2.5 秒后自动接通
    ringingTimer = setTimeout(() => {
      ringingTimer = null
      if (callPhase.value === 'ringing') {
        connect()
      }
    }, 2500)
  }

  function receiveCall(contactId, mode, text) {
    callActive.value = true
    callPhase.value = 'incoming'
    callMode.value = mode
    callContactId.value = contactId
    callStartTime.value = null
    callDuration.value = 0
    callMessages.value = []
    aiText.value = text || '邀请你通话'
    aiEmotion.value = 'normal'

    loadResources(contactId)
  }

  function loadResources(contactId) {
    const res = callResources[contactId]

    // Try characterResources store as fallback for sprites
    let charResStore = null
    try { charResStore = useCharacterResourcesStore() } catch { /* not available during init */ }

    currentSpriteUrl.value = resolveSpriteUrl(contactId, 'normal')

    if (res?.backgrounds?.length > 0) {
      currentBgUrl.value = res.backgrounds[0]
    } else {
      currentBgUrl.value = ''
    }
    // 加载角色形象图
    currentCharacterImage.value = res?.characterImage || ''

    // 自动决定视频子模式：有角色图就用模拟视频，否则检查是否有立绘
    const hasCharRes = charResStore?.getEntry(contactId)
    if (res?.characterImage) {
      videoSubMode.value = 'video'
    } else if ((res?.sprites && Object.keys(res.sprites).length > 0) ||
               (hasCharRes?.baseImage?.url)) {
      videoSubMode.value = 'galgame'
    } else {
      videoSubMode.value = 'video'
    }
  }

  function connect() {
    callPhase.value = 'connecting'
    setTimeout(() => {
      if (callPhase.value === 'connecting') {
        callPhase.value = 'connected'
        callStartTime.value = Date.now()
        startDurationTimer()
      }
    }, 500)
  }

  function endCall() {
    callPhase.value = 'ended'
    stopDurationTimer()
    if (ringingTimer) {
      clearTimeout(ringingTimer)
      ringingTimer = null
    }

    setTimeout(() => {
      callActive.value = false
      callPhase.value = 'idle'
      callMode.value = null
      callContactId.value = null
      aiText.value = ''
      aiEmotion.value = 'normal'
      currentSpriteUrl.value = ''
      currentBgUrl.value = ''
      currentCharacterImage.value = ''
    }, 1200)
  }

  function toggleVideoSubMode() {
    videoSubMode.value = videoSubMode.value === 'video' ? 'galgame' : 'video'
  }

  function updateEmotion(emotion) {
    const normalizedEmotion = normalizeEmotionKey(emotion)
    aiEmotion.value = normalizedEmotion

    const contactId = callContactId.value
    if (!contactId) return

    // Do not force fallback to base sprite for missing expressions;
    // keep current sprite to avoid flicker back to base image.
    const nextSpriteUrl = resolveSpriteUrl(contactId, normalizedEmotion)
    if (nextSpriteUrl) {
      currentSpriteUrl.value = nextSpriteUrl
    } else if (normalizedEmotion === 'normal') {
      currentSpriteUrl.value = ''
    }
  }

  // 资源管理
  function getContactResources(contactId) {
    if (!callResources[contactId]) {
      callResources[contactId] = { sprites: {}, backgrounds: [], avatar: '', characterImage: '' }
    }
    return callResources[contactId]
  }

  function setSprite(contactId, expression, url) {
    const normalizedExpression = normalizeEmotionKey(expression)
    const res = getContactResources(contactId)
    res.sprites[normalizedExpression] = url

    if (callContactId.value === contactId && aiEmotion.value === normalizedExpression) {
      currentSpriteUrl.value = url
    }
  }

  function removeSprite(contactId, expression) {
    const normalizedExpression = normalizeEmotionKey(expression)
    const res = getContactResources(contactId)
    delete res.sprites[normalizedExpression]

    if (callContactId.value !== contactId || aiEmotion.value !== normalizedExpression) {
      return
    }

    const fallbackUrl = resolveSpriteUrl(contactId, normalizedExpression, { fallbackToNormal: true })
    if (fallbackUrl) {
      currentSpriteUrl.value = fallbackUrl
    } else if (normalizedExpression === 'normal') {
      currentSpriteUrl.value = ''
    }
  }

  function addBackground(contactId, url) {
    const res = getContactResources(contactId)
    if (!res.backgrounds.includes(url)) {
      res.backgrounds.push(url)
    }
  }

  function removeBackground(contactId, url) {
    const res = getContactResources(contactId)
    res.backgrounds = res.backgrounds.filter(u => u !== url)
  }

  function setContactAvatar(contactId, url) {
    const res = getContactResources(contactId)
    res.avatar = url
  }

  function setCharacterImage(contactId, url) {
    const res = getContactResources(contactId)
    res.characterImage = url
    if (callContactId.value === contactId) {
      currentCharacterImage.value = url
    }
  }

  function removeCharacterImage(contactId) {
    const res = getContactResources(contactId)
    res.characterImage = ''
    if (callContactId.value === contactId) {
      currentCharacterImage.value = ''
    }
  }

  // 序列化/反序列化
  function exportResources() {
    return JSON.parse(JSON.stringify(callResources))
  }

  function importResources(data) {
    if (!data || typeof data !== 'object') return
    Object.keys(data).forEach(contactId => {
      callResources[contactId] = data[contactId]
    })
  }

  return {
    // 状态
    callActive,
    callPhase,
    callMode,
    videoSubMode,
    callStartTime,
    callDuration,
    callContactId,
    aiSpeaking,
    aiText,
    aiEmotion,
    userSpeaking,
    callMessages,
    currentSpriteUrl,
    currentBgUrl,
    currentCharacterImage,
    callResources,

    // 方法
    startCall,
    receiveCall,
    connect,
    endCall,
    toggleVideoSubMode,
    updateEmotion,
    formatDuration,

    // 资源管理
    getContactResources,
    setSprite,
    removeSprite,
    addBackground,
    removeBackground,
    setContactAvatar,
    setCharacterImage,
    removeCharacterImage,
    exportResources,
    importResources
  }
}
