// @ts-check

/** @typedef {import('../meetInstructionContracts').MeetChoiceOption} MeetChoiceOption */
/** @typedef {import('../meetInstructionContracts').MeetInstruction} MeetInstruction */
/** @typedef {import('../meetInstructionContracts').MeetMoodInstruction} MeetMoodInstruction */
/** @typedef {import('../meetInstructionContracts').MeetVariableInstruction} MeetVariableInstruction */
/** @typedef {import('./meetPlayerContracts').MeetPlayerRuntimeApi} MeetPlayerRuntimeApi */
/** @typedef {import('./meetPlayerContracts').MeetPlayerRuntimeOptions} MeetPlayerRuntimeOptions */

import { onBeforeUnmount } from 'vue'
import { defaultChoices, normalizeChoices } from './instructionHelpers'
import { createMeetInstructionPlayer } from './createMeetInstructionPlayer'

/**
 * @param {MeetPlayerRuntimeOptions} options
 * @returns {MeetPlayerRuntimeApi}
 */
export function useMeetPlayerRuntime({
  meeting,
  meetStore,
  player,
  scheduleSave,
  startMeeting,
  sendChoice,
  sendInput,
  speak,
  stopSpeaking,
  media
}) {
  function clearPendingWait() {
    if (player._resolveWait) {
      player._resolveWait()
      player._resolveWait = null
      player.isWaitingInput = false
    }
  }

  onBeforeUnmount(() => {
    stopSpeaking()
    clearPendingWait()
  })

  /** @param {MeetMoodInstruction} inst */
  function handleMoodInstruction(inst) {
    const current = player.moodValues[inst.characterName] || 0
    if (inst.operation === 'add') {
      player.moodValues[inst.characterName] = Math.max(0, Math.min(5, current + Number(inst.value || 0)))
    } else {
      player.moodValues[inst.characterName] = Number(inst.value || 0)
    }
  }

  /** @param {MeetVariableInstruction} inst */
  function handleVariableInstruction(inst) {
    if (!inst?.key) return
    const key = String(inst.key)
    if (inst.operation === 'add') {
      const current = Number(meetStore.getVariable(key, 0) || 0)
      meetStore.setVariable(key, current + Number(inst.value || 0))
    } else {
      meetStore.setVariable(key, inst.value)
    }
  }

  /** @param {MeetInstruction} inst */
  function applyInstructionSnapshot(inst) {
    if (media.applySnapshotMediaInstruction(inst)) return

    switch (inst.type) {
      case 'location':
        player.currentLocation = inst.value || ''
        break
      case 'time':
        player.currentTimeOfDay = inst.value || ''
        break
      case 'mood':
        handleMoodInstruction(inst)
        break
      case 'dialog':
        player.currentDialog = {
          characterId: inst.characterId,
          vnName: inst.vnName,
          text: inst.text,
          nameColor: inst.nameColor || '#fff',
          isNarration: false
        }
        break
      case 'narration':
        player.currentDialog = {
          characterId: '',
          vnName: '',
          text: inst.text,
          nameColor: '#fff',
          isNarration: true
        }
        break
      case 'choices':
        player.currentChoices = normalizeChoices(inst.options)
        break
      default:
        break
    }
  }

  function restoreMeetingRuntime() {
    meetStore.resetPlayer()
    media.resetMediaRuntime()

    const history = Array.isArray(meeting.value?.history) ? meeting.value.history : []
    if (history.length === 0) return

    history.forEach((inst) => {
      if (!inst || typeof inst !== 'object' || typeof inst.type !== 'string') return
      applyInstructionSnapshot(/** @type {MeetInstruction} */ (inst))
    })
    player.isPlaying = false
    player.isWaitingInput = false
    player._resolveWait = null
    player.isGenerating = false
    player.instructionQueue = []
    player.instructionIndex = 0

    if (!player.currentChoices) {
      player.currentChoices = defaultChoices()
    }
  }

  const {
    handleAdvanceTap,
    onTextComplete,
    playInstructions
  } = createMeetInstructionPlayer({
    meeting,
    meetStore,
    player,
    scheduleSave,
    speak,
    stopSpeaking,
    media,
    clearPendingWait,
    applyMoodInstruction: handleMoodInstruction,
    applyVariableInstruction: handleVariableInstruction
  })

  async function continueMeeting() {
    stopSpeaking()
    media.clearTransientSceneMedia?.()
    player.currentDialog = null
    player.currentChoices = null
    const res = await sendInput('继续约会互动，承接上一轮状态，推进剧情并给出新的 [choices]。')
    if (!res.success) {
      player.currentChoices = defaultChoices()
      return
    }
    await playInstructions(res.instructions || [])
    scheduleSave()
  }

  async function restartMeeting() {
    stopSpeaking()
    clearPendingWait()
    meetStore.resetPlayer()
    media.resetMediaRuntime()

    const res = await startMeeting({ resetState: true })
    if (!res.success) return
    await playInstructions(res.instructions || [])
    scheduleSave()
  }

  async function onCustomInput(text) {
    if (!text || player.isGenerating) return
    stopSpeaking()
    media.clearTransientSceneMedia?.()
    player.currentChoices = null
    meetStore.addToHistory({ type: 'user', text, source: 'custom' })
    scheduleSave()

    const res = await sendInput(text)
    if (!res.success) {
      player.currentChoices = defaultChoices()
      return
    }
    await playInstructions(res.instructions || [])
    scheduleSave()
  }

  /** @param {MeetChoiceOption | null} opt */
  async function onChoiceSelect(opt) {
    if (!opt || !opt.text) return
    stopSpeaking()
    media.clearTransientSceneMedia?.()
    player.currentChoices = null
    meetStore.addToHistory({ type: 'user', text: opt.text, source: 'choice' })
    scheduleSave()

    const res = await sendChoice(opt.text)
    if (!res.success) {
      player.currentChoices = defaultChoices()
      return
    }
    await playInstructions(res.instructions || [])
    scheduleSave()
  }

  return {
    restoreMeetingRuntime,
    continueMeeting,
    restartMeeting,
    onCustomInput,
    onChoiceSelect,
    handleAdvanceTap,
    onTextComplete
  }
}
