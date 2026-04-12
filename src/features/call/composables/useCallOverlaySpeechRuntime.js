import {
  createCallSpeechEchoGuard,
} from './callSpeechSupport'
import { useCallSpeechSession } from './useCallSpeechSession'

export function useCallOverlaySpeechRuntime(options = {}) {
  const {
    rememberAISentence,
    markAISpeechEnded,
    isLikelyEchoText,
    resetEchoGuard
  } = createCallSpeechEchoGuard()
  const speechSession = useCallSpeechSession({
    callActive: options.callActive,
    callPhase: options.callPhase,
    aiSpeaking: options.aiSpeaking,
    isWaitingReply: options.isWaitingReply,
    onRecognizedText: options.onRecognizedText,
    isLikelyEchoText,
    resetEchoGuard
  })

  return {
    ...speechSession,
    rememberAISentence,
    markAISpeechEnded,
    isLikelyEchoText
  }
}
