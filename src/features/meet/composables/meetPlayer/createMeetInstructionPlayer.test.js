import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createMeetInstructionPlayer } from './createMeetInstructionPlayer'

function createRunner(overrides = {}) {
  const meeting = ref({
    characters: [
      { contactId: 'c1', nameColor: '#ff66aa' }
    ],
    ...(overrides.meeting || {})
  })
  const player = {
    currentDialog: null,
    currentChoices: null,
    currentLocation: '',
    currentTimeOfDay: '',
    moodValues: {},
    isPlaying: false,
    isWaitingInput: false,
    isAutoPlay: false,
    autoPlayDelay: 0,
    instructionQueue: [],
    instructionIndex: 0,
    _resolveWait: null,
    ...(overrides.player || {})
  }
  const meetStore = {
    addToHistory: vi.fn()
  }
  const scheduleSave = vi.fn()
  const speak = vi.fn().mockResolvedValue(undefined)
  const stopSpeaking = vi.fn()
  const media = {
    handleBgInstruction: vi.fn().mockResolvedValue(undefined),
    handleCgInstruction: vi.fn().mockResolvedValue(undefined),
    handleSpriteInstruction: vi.fn().mockResolvedValue(undefined),
    handleBgmInstruction: vi.fn().mockResolvedValue(undefined),
    handleSfxInstruction: vi.fn().mockResolvedValue(undefined),
    applyAutoSceneFixups: vi.fn().mockResolvedValue(undefined)
  }
  const clearPendingWait = vi.fn(() => {
    if (player._resolveWait) {
      const resolve = player._resolveWait
      player._resolveWait = null
      player.isWaitingInput = false
      resolve()
    }
  })
  const applyMoodInstruction = vi.fn((inst) => {
    player.moodValues[inst.characterName] = Number(inst.value || 0)
  })
  const applyVariableInstruction = vi.fn()

  const runner = createMeetInstructionPlayer({
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
  })

  return {
    applyMoodInstruction,
    applyVariableInstruction,
    clearPendingWait,
    media,
    meetStore,
    player,
    runner,
    scheduleSave,
    speak,
    stopSpeaking
  }
}

describe('createMeetInstructionPlayer', () => {
  it('plays instructions, records history, and applies fixups after choices', async () => {
    const {
      applyMoodInstruction,
      applyVariableInstruction,
      clearPendingWait,
      media,
      meetStore,
      player,
      runner,
      scheduleSave,
      speak
    } = createRunner()

    const execution = runner.playInstructions([
      { type: 'bg', name: 'park' },
      { type: 'mood', characterName: 'Alice', value: 3 },
      { type: 'variable', key: 'affection', value: 1 },
      { type: 'dialog', characterId: 'c1', vnName: 'Alice', text: '晚上好。' },
      { type: 'choices', options: [{ text: '  继续  ' }, { text: '' }] }
    ])

    await Promise.resolve()
    await Promise.resolve()
    expect(typeof player._resolveWait).toBe('function')

    clearPendingWait()
    await execution

    expect(media.handleBgInstruction).toHaveBeenCalledWith({ type: 'bg', name: 'park' })
    expect(applyMoodInstruction).toHaveBeenCalledWith({ type: 'mood', characterName: 'Alice', value: 3 })
    expect(applyVariableInstruction).toHaveBeenCalledWith({ type: 'variable', key: 'affection', value: 1 })
    expect(speak).toHaveBeenCalledWith('晚上好。', 'c1')
    expect(meetStore.addToHistory).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dialog',
      nameColor: '#ff66aa'
    }))
    expect(player.currentChoices).toEqual([
      { text: '继续', effect: null }
    ])
    expect(media.applyAutoSceneFixups).toHaveBeenCalledWith({
      sawBg: true,
      sawBgm: false,
      sawCg: false,
      locationChanged: false,
      timeChanged: false
    })
    expect(scheduleSave).toHaveBeenCalledTimes(5)
  })

  it('uses tap handling to stop playback before advancing wait state', () => {
    const { clearPendingWait, player, runner } = createRunner()

    player.currentChoices = [{ text: '继续' }]
    runner.handleAdvanceTap()
    expect(clearPendingWait).not.toHaveBeenCalled()

    player.currentChoices = null
    player.isPlaying = true
    runner.handleAdvanceTap()
    expect(player.isPlaying).toBe(false)
    expect(clearPendingWait).not.toHaveBeenCalled()

    runner.handleAdvanceTap()
    expect(clearPendingWait).toHaveBeenCalledTimes(1)
  })
})
