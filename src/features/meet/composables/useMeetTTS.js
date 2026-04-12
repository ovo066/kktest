import { computed } from 'vue'
import { useVoicePlayback } from '../../../composables/useVoicePlayback'

function sanitizeSpeechText(text) {
  return String(text || '')
    .replace(/\[.*?\]/g, '')
    .replace(/[*_~`]/g, '')
    .trim()
}

export function useMeetTTS({ meeting, player }) {
  const { play, stop } = useVoicePlayback()

  const enabled = computed(() => meeting.value?.voice?.ttsEnabled === true)

  async function speak(text, characterId) {
    if (!enabled.value) return null

    const cleanText = sanitizeSpeechText(text)
    const contactId = String(characterId || '').trim()
    if (!cleanText || !contactId) return null

    await play({
      text: cleanText,
      isUser: false,
      contactId,
      stableTimbre: true,
      durationSec: Math.max(1, cleanText.length / 5),
      volume: Number(player.volume?.voice ?? 1)
    })

    return true
  }

  function stopSpeaking() {
    stop()
  }

  return {
    meetTtsEnabled: enabled,
    speak,
    stopSpeaking
  }
}
