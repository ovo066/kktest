import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useMeetPlayerShell } from './useMeetPlayerShell'

function createShell(overrides = {}) {
  const meeting = ref(overrides.meeting === undefined ? { id: 'm1', name: '约会', history: [] } : overrides.meeting)
  const meetingId = ref('m1')
  const player = {
    currentDialog: null,
    currentBg: null,
    currentCg: null,
    currentBgm: null,
    sprites: [],
    currentChoices: [],
    isGenerating: false,
    isAutoPlay: false,
    ...(overrides.player || {})
  }
  const meetStore = {
    setCurrentMeeting: vi.fn()
  }
  const router = {
    push: vi.fn(),
    replace: vi.fn()
  }
  const restoreMeetingRuntime = vi.fn()
  const continueMeeting = vi.fn().mockResolvedValue(undefined)
  const restartMeetingFlow = vi.fn().mockResolvedValue(undefined)
  const handleAdvanceTap = vi.fn()
  const tryResumeAudioPlayback = vi.fn().mockResolvedValue(undefined)

  const shell = useMeetPlayerShell({
    continueMeeting,
    handleAdvanceTap,
    meeting,
    meetingId,
    meetStore,
    player,
    restartMeetingFlow,
    restoreMeetingRuntime,
    router,
    tryResumeAudioPlayback
  })

  return {
    continueMeeting,
    handleAdvanceTap,
    meetStore,
    meeting,
    restartMeetingFlow,
    restoreMeetingRuntime,
    router,
    shell,
    tryResumeAudioPlayback
  }
}

describe('useMeetPlayerShell', () => {
  it('initializes runtime for an existing meeting', () => {
    const { shell, meetStore, restoreMeetingRuntime } = createShell()

    expect(shell.initializePlayerView()).toBe(true)
    expect(meetStore.setCurrentMeeting).toHaveBeenCalledWith('m1')
    expect(restoreMeetingRuntime).toHaveBeenCalled()
  })

  it('redirects to meet home when meeting is missing', () => {
    const { shell, router } = createShell({ meeting: null })

    expect(shell.initializePlayerView()).toBe(false)
    expect(router.replace).toHaveBeenCalledWith('/meet')
  })

  it('uses continue flow when history exists', async () => {
    const { shell, continueMeeting, restartMeetingFlow } = createShell({
      meeting: { id: 'm1', name: '约会', history: [{}] }
    })

    await shell.start()

    expect(continueMeeting).toHaveBeenCalled()
    expect(restartMeetingFlow).not.toHaveBeenCalled()
  })

  it('handles keyboard shortcuts and blocks tap behind overlays', () => {
    const { shell, handleAdvanceTap, tryResumeAudioPlayback } = createShell()

    shell.openMenu()
    shell.handleTap()
    expect(handleAdvanceTap).not.toHaveBeenCalled()

    shell.closeMenu()
    const preventDefault = vi.fn()
    shell.handleKeydown({ key: ' ', preventDefault, target: { tagName: 'div' } })
    expect(preventDefault).toHaveBeenCalled()
    expect(tryResumeAudioPlayback).toHaveBeenCalled()
    expect(handleAdvanceTap).toHaveBeenCalled()
  })
})
