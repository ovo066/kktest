// @ts-check

/** @typedef {import('../meetInstructionContracts').MeetDialogInstruction} MeetDialogInstruction */
/** @typedef {import('../meetInstructionContracts').MeetInstruction} MeetInstruction */
/** @typedef {import('../meetInstructionContracts').MeetNarrationInstruction} MeetNarrationInstruction */
/** @typedef {import('./meetPlayerContracts').MeetInstructionPlayerApi} MeetInstructionPlayerApi */
/** @typedef {import('./meetPlayerContracts').MeetInstructionPlayerOptions} MeetInstructionPlayerOptions */

import { defaultChoices, normalizeChoices } from './instructionHelpers'

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)))
}

/**
 * @param {MeetInstructionPlayerOptions} options
 * @returns {MeetInstructionPlayerApi}
 */
export function createMeetInstructionPlayer({
  meeting,
  meetStore,
  player,
  scheduleSave,
  speak,
  stopSpeaking,
  media,
  clearPendingWait,
  applyMoodInstruction,
  applyVariableInstruction
}) {
  function waitForUserInput() {
    return new Promise((resolve) => {
      player.isWaitingInput = true
      player._resolveWait = () => resolve()
    })
  }

  /**
   * @param {MeetDialogInstruction} inst
   * @returns {Promise<MeetDialogInstruction & { nameColor: string }>}
   */
  async function handleDialogInstruction(inst) {
    const character = meeting.value?.characters?.find((item) => item.contactId === inst.characterId)
    const nameColor = character?.nameColor || '#fff'
    player.isPlaying = true
    player.currentDialog = {
      characterId: inst.characterId,
      vnName: inst.vnName,
      text: inst.text,
      nameColor,
      isNarration: false
    }
    speak(inst.text, inst.characterId).catch(() => {})
    return { ...inst, nameColor }
  }

  /**
   * @param {MeetNarrationInstruction} inst
   * @returns {Promise<MeetNarrationInstruction>}
   */
  async function handleNarrationInstruction(inst) {
    player.isPlaying = true
    player.currentDialog = {
      characterId: '',
      vnName: '',
      text: inst.text,
      nameColor: '#fff',
      isNarration: true
    }
    stopSpeaking()
    return { ...inst }
  }

  function handleAdvanceTap() {
    if ((player.currentChoices?.length || 0) > 0) return

    if (player.isPlaying) {
      player.isPlaying = false
      return
    }

    clearPendingWait()
  }

  function onTextComplete() {
    player.isPlaying = false
  }

  /**
   * @param {MeetInstruction[]} instructions
   * @returns {Promise<void>}
   */
  async function playInstructions(instructions) {
    player.instructionQueue = instructions
    player.instructionIndex = 0

    let sawBg = false
    let sawBgm = false
    let sawCg = false
    let locationChanged = false
    let timeChanged = false

    for (let i = 0; i < instructions.length; i += 1) {
      player.instructionIndex = i
      const inst = instructions[i]
      let historyEntry = inst

      switch (inst.type) {
        case 'bg':
          sawBg = true
          await media.handleBgInstruction(inst)
          break
        case 'cg':
          sawCg = true
          await media.handleCgInstruction(inst)
          break
        case 'sprite':
          await media.handleSpriteInstruction(inst)
          break
        case 'location':
          if ((inst.value || '') !== player.currentLocation) locationChanged = true
          player.currentLocation = inst.value || ''
          break
        case 'time':
          if ((inst.value || '') !== player.currentTimeOfDay) timeChanged = true
          player.currentTimeOfDay = inst.value || ''
          break
        case 'mood':
          applyMoodInstruction(inst)
          break
        case 'variable':
          applyVariableInstruction(inst)
          break
        case 'bgm':
          sawBgm = true
          await media.handleBgmInstruction(inst)
          break
        case 'sfx':
          await media.handleSfxInstruction(inst)
          break
        case 'dialog':
          historyEntry = await handleDialogInstruction(inst)
          await waitForUserInput()
          break
        case 'narration':
          historyEntry = await handleNarrationInstruction(inst)
          await waitForUserInput()
          break
        case 'choices':
          player.currentChoices = normalizeChoices(inst.options) || defaultChoices()
          meetStore.addToHistory({ ...inst, options: player.currentChoices })
          scheduleSave()
          await media.applyAutoSceneFixups({ sawBg, sawBgm, sawCg, locationChanged, timeChanged })
          return
        default:
          break
      }

      meetStore.addToHistory(historyEntry || inst)
      scheduleSave()

      if (player.isAutoPlay && (inst.type === 'dialog' || inst.type === 'narration')) {
        await sleep(player.autoPlayDelay || 2000)
        clearPendingWait()
      }
    }

    await media.applyAutoSceneFixups({ sawBg, sawBgm, sawCg, locationChanged, timeChanged })
    player.instructionQueue = []
    player.instructionIndex = 0

    if (!player.currentChoices) {
      player.currentChoices = defaultChoices()
    }
  }

  return {
    handleAdvanceTap,
    onTextComplete,
    playInstructions
  }
}
