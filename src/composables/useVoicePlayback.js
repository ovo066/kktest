import { useContactsStore } from '../stores/contacts'
import { useSettingsStore } from '../stores/settings'
import {
  buildMiniMaxCacheKey,
  extractEmotionTag,
  fetchAudioAsBytes,
  normalizeEmotionKey,
  resolveMiniMaxVoiceTuning,
  synthesizeMiniMax,
  trimText
} from './voicePlayback/minimaxClient'
import {
  createObjectUrlFromBytes,
  readMiniMaxCachedAudio,
  toUint8Array,
  withMiniMaxInflight,
  writeMiniMaxCacheEntry
} from './voicePlayback/minimaxCache'

const CACHE_LIMIT = 64
const cache = new Map()

let currentAudio = null
let currentTimer = null
let currentOnEnded = null

function stopSpeech() {
  if (typeof window === 'undefined') return
  if (!window.speechSynthesis) return
  try { window.speechSynthesis.cancel() } catch {}
}

function stopAudio() {
  if (!currentAudio) return
  try { currentAudio.pause() } catch {}
  currentAudio = null
}

function stopTimer() {
  if (!currentTimer) return
  try { clearTimeout(currentTimer) } catch {}
  currentTimer = null
}

function stopAndNotifyEnded() {
  stopTimer()
  stopAudio()
  stopSpeech()
  const cb = currentOnEnded
  currentOnEnded = null
  if (typeof cb === 'function') {
    try { cb() } catch {}
  }
}

function cacheGet(key) {
  const item = cache.get(key)
  return item && item.url ? item.url : null
}

function revokeObjectUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('blob:')) return
  if (currentAudio?.src === url) return
  try { URL.revokeObjectURL(url) } catch {}
}

function cacheSet(key, url, options = {}) {
  if (!key || !url) return
  const isObjectUrl = options.isObjectUrl !== false && String(url).startsWith('blob:')
  const old = cache.get(key)
  if (old?.isObjectUrl && old.url && old.url !== url) {
    revokeObjectUrl(old.url)
  }
  cache.delete(key)
  cache.set(key, { url, ts: Date.now(), isObjectUrl })
  while (cache.size > CACHE_LIMIT) {
    const firstKey = cache.keys().next().value
    const first = cache.get(firstKey)
    cache.delete(firstKey)
    if (first?.isObjectUrl) {
      revokeObjectUrl(first.url)
    }
  }
}

async function synthesizeEdge({ endpoint, text, voiceId }) {
  const ep = String(endpoint || '').trim()
  if (!ep) throw new Error('未配置 Edge 接口')

  const params = new URLSearchParams({
    text,
    voice: voiceId,
    rate: '+0%',
    pitch: '+0Hz'
  })
  const url = ep + (ep.includes('?') ? '&' : '?') + params.toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error('Edge TTS HTTP ' + res.status)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

async function loadMiniMaxUrlFromPersistentCache(cacheKey) {
  const persisted = await readMiniMaxCachedAudio(cacheKey)
  if (!persisted) return null

  if (persisted.bytes?.byteLength) {
    const objectUrl = createObjectUrlFromBytes(persisted.bytes, persisted.mimeType)
    if (objectUrl) {
      cacheSet(cacheKey, objectUrl)
      return objectUrl
    }
  }

  const remoteUrl = String(persisted.remoteUrl || '').trim()
  if (!remoteUrl) return null
  cacheSet(cacheKey, remoteUrl, { isObjectUrl: false })
  return remoteUrl
}

async function synthesizeAndCacheMiniMaxAudio({ cacheKey, cfg, text, voiceId, voiceTuning }) {
  const response = await synthesizeMiniMax({
    endpoint: cfg.minimaxEndpoint,
    apiKey: cfg.minimaxApiKey,
    groupId: cfg.minimaxGroupId,
    model: cfg.minimaxModel,
    text,
    voiceId,
    voiceTuning
  })

  let bytes = toUint8Array(response?.bytes)
  let mimeType = String(response?.mimeType || 'audio/mpeg')
  const remoteUrl = String(response?.remoteUrl || '').trim()

  if ((!bytes || !bytes.byteLength) && remoteUrl) {
    const fetched = await fetchAudioAsBytes(remoteUrl)
    if (fetched?.bytes?.byteLength) {
      bytes = fetched.bytes
      mimeType = String(fetched.mimeType || mimeType || 'audio/mpeg')
    }
  }

  if (bytes && bytes.byteLength) {
    const objectUrl = createObjectUrlFromBytes(bytes, mimeType)
    if (!objectUrl) throw new Error('MiniMax audio format is not supported')
    cacheSet(cacheKey, objectUrl)
    await writeMiniMaxCacheEntry(cacheKey, { bytes, mimeType })
    return { url: objectUrl, isObjectUrl: true }
  }

  if (remoteUrl) {
    cacheSet(cacheKey, remoteUrl, { isObjectUrl: false })
    await writeMiniMaxCacheEntry(cacheKey, { remoteUrl, mimeType })
    return { url: remoteUrl, isObjectUrl: false }
  }

  throw new Error('MiniMax audio format is not supported')
}

function resolveVoiceId({ contactsStore, settingsStore }, options, mode) {
  const {
    msgId = null,
    isUser = false,
    contactId = ''
  } = options || {}
  const cfg = settingsStore.voiceTtsConfig || {}
  const directContact = String(contactId || '').trim()
    ? contactsStore.contacts?.find(c => c && c.id === String(contactId || '').trim()) || null
    : null
  const activeChatId = String(contactsStore.activeChat?.id || '').trim()
  const activeChat = activeChatId
    ? contactsStore.contacts?.find(c => c && c.id === activeChatId) || contactsStore.activeChat
    : contactsStore.activeChat
  if (directContact) {
    return mode === 'minimax'
      ? String(directContact.minimaxVoiceId || cfg.minimaxVoiceId || '').trim()
      : String(directContact.edgeVoiceId || cfg.edgeVoiceId || '').trim()
  }

  if (!activeChat) {
    return mode === 'minimax'
      ? (cfg.minimaxVoiceId || '')
      : (cfg.edgeVoiceId || '')
  }

  if (isUser) {
    return mode === 'minimax'
      ? (cfg.minimaxVoiceId || '')
      : (cfg.edgeVoiceId || '')
  }

  let contact = activeChat

  try {
    const msg = activeChat?.msgs?.find(m => m && m.id === msgId) || null
    if (activeChat?.type === 'group' && msg) {
      const members = Array.isArray(activeChat.members) ? activeChat.members : []
      const member = (msg.senderId && members.find(m => m.id === msg.senderId)) || null
      const contactId = member?.contactId || null
      const found = contactId ? contactsStore.contacts?.find(c => c && c.id === contactId) : null
      if (found) contact = found
    }
  } catch {
    // ignore, fallback to activeChat
  }

  if (mode === 'minimax') {
    return String(contact?.minimaxVoiceId || cfg.minimaxVoiceId || '').trim()
  }
  return String(contact?.edgeVoiceId || cfg.edgeVoiceId || '').trim()
}

export function useVoicePlayback() {
  const contactsStore = useContactsStore()
  const settingsStore = useSettingsStore()

  function stop() {
    stopAndNotifyEnded()
  }

  async function play(options = {}) {
    const {
      msgId = null,
      isUser = false,
      contactId = '',
      text = '',
      emotion = '',
      stableTimbre = false,
      durationSec = 1,
      volume = 1,
      onEnded = null
    } = options

    const mode = String(settingsStore.voiceTtsMode || 'simulated')
    const cleanText = trimText(text)
    const audioVolume = Math.max(0, Math.min(1, Number(volume ?? 1) || 1))
    if (!cleanText) throw new Error('语音内容为空')

    stopAndNotifyEnded()
    currentOnEnded = onEnded

    if (mode === 'simulated') {
      const ms = Math.max(500, Number(durationSec || 1) * 1000)
      currentTimer = setTimeout(() => {
        currentTimer = null
        stopAndNotifyEnded()
      }, ms)
      return
    }

    if (mode === 'browser') {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        throw new Error('当前环境不支持浏览器TTS')
      }
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'zh-CN'
      utterance.volume = audioVolume
      utterance.onend = () => stopAndNotifyEnded()
      utterance.onerror = () => stopAndNotifyEnded()
      window.speechSynthesis.speak(utterance)
      return
    }

    if (mode === 'edge') {
      const cfg = settingsStore.voiceTtsConfig || {}
      const voiceId = resolveVoiceId({ contactsStore, settingsStore }, {
        msgId,
        isUser,
        contactId
      }, 'edge') || 'zh-CN-XiaoxiaoNeural'
      const cacheKey = `edge:${voiceId}:${cleanText}`
      let url = cacheGet(cacheKey)
      if (!url) {
        url = await synthesizeEdge({
          endpoint: cfg.edgeEndpoint,
          text: cleanText,
          voiceId
        })
        cacheSet(cacheKey, url)
      }
      const audio = new Audio(url)
      audio.volume = audioVolume
      currentAudio = audio
      audio.onended = () => stopAndNotifyEnded()
      audio.onerror = () => stopAndNotifyEnded()
      await audio.play()
      return
    }

    if (mode === 'minimax') {
      const cfg = settingsStore.voiceTtsConfig || {}
      const voiceId = resolveVoiceId({ contactsStore, settingsStore }, {
        msgId,
        isUser,
        contactId
      }, 'minimax') || String(cfg.minimaxVoiceId || '').trim()
      if (!voiceId) throw new Error('MiniMax voice ID is not configured')
      const hasExplicitEmotion = String(emotion || '').trim().length > 0
      const emotionKey = hasExplicitEmotion
        ? normalizeEmotionKey(emotion)
        : extractEmotionTag(text)
      const effectiveEmotionKey = stableTimbre ? 'normal' : emotionKey
      const voiceTuning = resolveMiniMaxVoiceTuning(cleanText, effectiveEmotionKey)

      const cacheKey = buildMiniMaxCacheKey(cfg.minimaxEndpoint, cfg.minimaxModel, voiceId, cleanText, voiceTuning.signature)
      let url = cacheGet(cacheKey)
      if (!url) {
        url = await loadMiniMaxUrlFromPersistentCache(cacheKey)
      }
      if (!url) {
        const result = await withMiniMaxInflight(cacheKey, async () => {
          const inMemory = cacheGet(cacheKey)
          if (inMemory) return { url: inMemory, isObjectUrl: inMemory.startsWith('blob:') }

          const persisted = await loadMiniMaxUrlFromPersistentCache(cacheKey)
          if (persisted) return { url: persisted, isObjectUrl: persisted.startsWith('blob:') }

          return await synthesizeAndCacheMiniMaxAudio({
            cacheKey,
            cfg,
            text: cleanText,
            voiceId,
            voiceTuning
          })
        })
        url = result.url
      }

      const audio = new Audio(url)
      audio.volume = audioVolume
      currentAudio = audio
      audio.onended = () => stopAndNotifyEnded()
      audio.onerror = () => stopAndNotifyEnded()
      await audio.play()
      return
    }

    throw new Error('未知语音模式: ' + mode)
  }

  return {
    play,
    stop
  }
}
