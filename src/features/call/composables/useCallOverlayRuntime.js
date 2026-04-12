import { computed, onBeforeUnmount, ref, unref, watch } from 'vue'
import { useStorage } from '../../../composables/useStorage'
import {
  appendHiddenCallEvent,
  getEndReason,
  modeLabel,
  normalizeCallMode,
  pushCallSystemEvent,
  saveCallRecord
} from '../../../composables/call/callHistory'
import { useContactsStore } from '../../../stores/contacts'
import { usePersonasStore } from '../../../stores/personas'
import { makeId } from '../../../utils/id'
import { useCallApi } from './useCallApi'
import { parseCallContent, extractCompleteSentences, cleanCallText } from './useCallParser'
import { useCallState } from './useCallState'
import { useCallOverlaySpeechRuntime } from './useCallOverlaySpeechRuntime'
import { useCallTTS } from './useCallTTS'

export function useCallOverlayRuntime(options = {}) {
  const contactsStore = useContactsStore()
  const personasStore = usePersonasStore()
  const { scheduleSave } = useStorage()

  const {
    callActive,
    callPhase,
    callMode,
    videoSubMode,
    callDuration,
    callContactId,
    aiSpeaking,
    aiText,
    aiEmotion,
    callMessages,
    currentSpriteUrl,
    currentBgUrl,
    currentCharacterImage,
    startCall: startCallState,
    receiveCall: receiveCallState,
    connect,
    endCall,
    toggleVideoSubMode,
    updateEmotion,
    formatDuration
  } = useCallState()

  const { sendCallMessage } = useCallApi()
  const { speakSentence, stopSpeaking } = useCallTTS()

  const contact = computed(() => unref(options.contact) || null)

  const showResourcePanel = ref(false)
  const isWaitingReply = ref(false)
  const subtitleText = ref('')
  const streamBuffer = ref('')

  let endingInProgress = false
  let endingReleaseTimer = null

  const durationText = computed(() => formatDuration(callDuration.value))
  const transcriptTopSafeArea = computed(() => (
    callMode.value === 'video'
      ? 'calc(var(--app-pt, 44px) + 152px)'
      : 'calc(var(--app-pt, 44px) + 60px)'
  ))

  const userPersona = computed(() => {
    const currentContact = contact.value
    if (!currentContact) return null
    return personasStore.getPersonaForContact(currentContact.id)
  })
  const userPersonaAvatar = computed(() => userPersona.value?.avatar || '')
  const userPersonaAvatarType = computed(() => userPersona.value?.avatarType || '')
  const userPersonaEmoji = computed(() => {
    const persona = userPersona.value
    if (persona && persona.avatarType !== 'image' && persona.avatar) return persona.avatar
    return '👤'
  })

  function makeCallMessageId(prefix = 'msg') {
    return makeId(prefix)
  }

  const {
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
    stopSpeechRuntime,
    rememberAISentence,
    markAISpeechEnded
  } = useCallOverlaySpeechRuntime({
    callActive,
    callPhase,
    aiSpeaking,
    isWaitingReply,
    onRecognizedText: (text) => handleUserInput(text)
  })

  watch(callPhase, async (phase) => {
    if (phase === 'connected') {
      pushCallSystemEvent(callMessages.value, `[通话事件] 已接通${modeLabel(callMode.value)}。`, () => makeCallMessageId('cmsg'))
      await requestAIResponse(null, true)
    }
  })

  async function handleAcceptCall() {
    showTextInput.value = false
    await prepareSTTForCurrentCall()
    connect()
  }

  function resetOverlaySession() {
    resetSpeechSessionUi()
    isWaitingReply.value = false
    subtitleText.value = ''
    streamBuffer.value = ''
    resetSpeechTurnGuards()
  }

  function startCall(contactId, mode) {
    resetOverlaySession()
    startCallState(contactId, mode)
    void prepareSTTForCurrentCall()
  }

  function receiveCall(contactId, mode, text) {
    resetOverlaySession()
    receiveCallState(contactId, mode, text)
  }

  async function handleUserInput(text) {
    if (!text?.trim() || isWaitingReply.value) return
    pauseSpeechInput()
    await requestAIResponse(text.trim(), false)
  }

  async function requestAIResponse(userInput, isGreeting) {
    isWaitingReply.value = true
    streamBuffer.value = ''
    subtitleText.value = ''
    pauseSpeechInput()

    let lastEmotionApplied = null
    let pendingCallAction = null
    const spokenSentences = new Set()
    let pendingSpeechCount = 0
    let streamFinished = false

    const executePendingCallAction = () => {
      if (!pendingCallAction) return false
      if (!callActive.value || callPhase.value !== 'connected') return false

      const action = pendingCallAction
      pendingCallAction = null

      if (action.action === 'reject') {
        handleEndCall({
          endedBy: 'ai',
          endReason: 'ai_reject',
          aiNote: action.reason || ''
        })
        return true
      }

      if (action.action === 'end') {
        handleEndCall({
          endedBy: 'ai',
          endReason: 'ai_hangup',
          aiNote: action.reason || ''
        })
        return true
      }

      return false
    }

    const tryFinishReply = () => {
      if (!streamFinished || pendingSpeechCount > 0) return
      isWaitingReply.value = false
      if (executePendingCallAction()) return
      scheduleResumeSpeechInput()
    }

    const queueSpeak = (sentence, emotionHint = null) => {
      if (!callActive.value || callPhase.value !== 'connected') return false
      const cleaned = cleanCallText(sentence)
      if (!cleaned || spokenSentences.has(cleaned)) return false
      const ttsEmotion = String(emotionHint || lastEmotionApplied || aiEmotion.value || 'normal')

      spokenSentences.add(cleaned)
      rememberAISentence(cleaned)
      pendingSpeechCount += 1

      speakSentence(cleaned, {
        emotion: ttsEmotion,
        onEnded: () => {
          pendingSpeechCount = Math.max(0, pendingSpeechCount - 1)
          markAISpeechEnded()
          tryFinishReply()
        }
      })

      return true
    }

    const result = await sendCallMessage(userInput, (delta) => {
      streamBuffer.value += delta
      const { sentences, emotion, callAction } = extractCompleteSentences(streamBuffer.value)

      if (emotion && emotion !== lastEmotionApplied) {
        lastEmotionApplied = emotion
        updateEmotion(emotion)
      }
      if (callAction) {
        pendingCallAction = callAction
      }

      subtitleText.value = cleanCallText(streamBuffer.value)

      for (const sentence of sentences) {
        queueSpeak(sentence, emotion || lastEmotionApplied || aiEmotion.value)
      }
    }, { isGreeting })

    if (result.success) {
      const { lastEmotion, callAction } = parseCallContent(result.fullText)
      const hasEmotionTag = /\[\s*emotion\s*[:：]\s*[^\]\r\n]+\s*\]/i.test(String(result.fullText || ''))
      if (hasEmotionTag) {
        lastEmotionApplied = lastEmotion
        updateEmotion(lastEmotion)
      }
      if (callAction) {
        pendingCallAction = callAction
      }

      const { remainder } = extractCompleteSentences(streamBuffer.value)
      queueSpeak(remainder, lastEmotionApplied || aiEmotion.value)
      subtitleText.value = ''
      streamFinished = true
      tryFinishReply()
    } else {
      subtitleText.value = result.error || '请求失败'
      streamFinished = true
      tryFinishReply()
    }
  }

  function handleEndCall(options = {}) {
    if (endingInProgress) return
    endingInProgress = true

    const endedBy = options.endedBy === 'ai' ? 'ai' : 'user'
    const phaseBeforeEnd = callPhase.value
    const modeBeforeEnd = normalizeCallMode(callMode.value)
    const durationBeforeEnd = Number(callDuration.value) || 0
    const endReason = getEndReason(options.endReason, phaseBeforeEnd, endedBy)

    const activeContact = contactsStore.contacts.find(item => item.id === callContactId.value)
    const shouldSaveRecord = phaseBeforeEnd === 'connected' || phaseBeforeEnd === 'ended'

    if (shouldSaveRecord) {
      saveCallRecord({
        contact: activeContact,
        callMode: modeBeforeEnd,
        callDuration: durationBeforeEnd,
        callMessages: callMessages.value,
        formatDuration,
        makeMessageId: makeCallMessageId,
        scheduleSave,
        endedBy,
        endReason,
        aiNote: String(options.aiNote || '').trim()
      })
    }
    if (activeContact) {
      appendHiddenCallEvent(activeContact, {
        phase: phaseBeforeEnd,
        mode: modeBeforeEnd,
        durationSeconds: durationBeforeEnd,
        endedBy,
        endReason,
        aiNote: String(options.aiNote || '').trim()
      }, {
        formatDuration,
        makeMessageId: () => makeCallMessageId('msg')
      })
    }

    isWaitingReply.value = false
    resetSpeechTurnGuards()
    stopSpeaking()
    stopSpeechRuntime()
    endCall()
    scheduleSave()

    if (endingReleaseTimer) {
      clearTimeout(endingReleaseTimer)
      endingReleaseTimer = null
    }
    endingReleaseTimer = setTimeout(() => {
      endingInProgress = false
      endingReleaseTimer = null
    }, 1300)
  }

  onBeforeUnmount(() => {
    stopSpeaking()
    stopSpeechRuntime()
    if (endingReleaseTimer) {
      clearTimeout(endingReleaseTimer)
      endingReleaseTimer = null
    }
    endingInProgress = false
  })

  return {
    callActive,
    callPhase,
    callMode,
    videoSubMode,
    aiSpeaking,
    aiText,
    aiEmotion,
    callMessages,
    currentSpriteUrl,
    currentBgUrl,
    currentCharacterImage,
    sttListening,
    interimText,
    muted,
    showTextInput,
    showResourcePanel,
    isWaitingReply,
    subtitleText,
    durationText,
    transcriptTopSafeArea,
    isManualSTTTriggerMode,
    canTriggerManualRecognition,
    manualRecognitionButtonLabel,
    userPersonaAvatar,
    userPersonaAvatarType,
    userPersonaEmoji,
    toggleMute,
    handleEndCall,
    handleAcceptCall,
    toggleTextInput,
    toggleVideoSubMode,
    handleManualRecognition,
    handleUserInput,
    startCall,
    receiveCall
  }
}
