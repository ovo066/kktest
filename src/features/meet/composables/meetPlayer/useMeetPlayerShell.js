// @ts-check

/** @typedef {import('./meetPlayerContracts').MeetPlayerShellOptions} MeetPlayerShellOptions */

import { computed, ref } from 'vue'

/** @param {MeetPlayerShellOptions} options */
export function useMeetPlayerShell({
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
}) {
  const showHistory = ref(false)
  const showSave = ref(false)
  const showMenu = ref(false)
  const moodGaugeRef = ref(null)

  const meetingTitle = computed(() => meeting.value?.name || '约会')
  const hasHistory = computed(() => (meeting.value?.history?.length || 0) > 0)
  const hasRuntime = computed(() => (
    !!player.currentDialog ||
    !!player.currentBg ||
    !!player.currentCg ||
    !!player.currentBgm ||
    (player.sprites?.length || 0) > 0 ||
    (player.currentChoices?.length || 0) > 0
  ))
  const startActionLabel = computed(() => (hasHistory.value ? '继续约会' : '开始约会'))
  const startDescription = computed(() => (
    hasHistory.value
      ? '检测到上次进度，可继续推进剧情，也可以选择重新开始。'
      : '点击下方按钮开始你们的约会故事。'
  ))
  const showStartOverlay = computed(() => {
    if (!meeting.value) return false
    return !hasRuntime.value && !player.isGenerating
  })

  function initializePlayerView() {
    if (!meeting.value) {
      router.replace('/meet')
      return false
    }
    meetStore.setCurrentMeeting(meetingId.value)
    restoreMeetingRuntime()
    return true
  }

  function closeHistory() {
    showHistory.value = false
  }

  function closeSave() {
    showSave.value = false
  }

  function closeMenu() {
    showMenu.value = false
  }

  function openHistory() {
    showHistory.value = true
    showMenu.value = false
  }

  function openSave() {
    showSave.value = true
    showMenu.value = false
  }

  function openMenu() {
    showMenu.value = true
  }

  function handleKeydown(event) {
    const targetTag = String(event?.target?.tagName || '').toUpperCase()
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return

    if (showHistory.value || showSave.value || showMenu.value) {
      if (event.key === 'Escape') {
        showHistory.value = false
        showSave.value = false
        showMenu.value = false
      }
      return
    }

    switch (event.key) {
      case ' ': {
        event.preventDefault()
        handleTap()
        break
      }
      case 'Enter':
        handleTap()
        break
      case 'Escape':
        showMenu.value = true
        break
      default:
        break
    }
  }

  function goHome() {
    router.push('/meet')
  }

  function goSetup() {
    router.push(`/meet/setup/${meetingId.value}`)
  }

  function toggleAutoPlay() {
    player.isAutoPlay = !player.isAutoPlay
    showMenu.value = false
  }

  function showMoodDetails() {
    showMenu.value = false
    if (moodGaugeRef.value) moodGaugeRef.value.showDetails = true
  }

  function handleTap() {
    if (showHistory.value || showSave.value || showMenu.value) return
    Promise.resolve(tryResumeAudioPlayback()).catch(() => {})
    handleAdvanceTap()
  }

  async function start() {
    if (hasHistory.value) {
      await continueMeeting()
      return
    }
    await restartMeeting({ closeMenu: false })
  }

  async function restartMeeting(options = {}) {
    if (options.closeMenu !== false) {
      showMenu.value = false
    }
    await restartMeetingFlow()
  }

  return {
    closeHistory,
    closeMenu,
    closeSave,
    goHome,
    goSetup,
    handleKeydown,
    handleTap,
    hasHistory,
    initializePlayerView,
    meetingTitle,
    moodGaugeRef,
    openHistory,
    openMenu,
    openSave,
    restartMeeting,
    showHistory,
    showMenu,
    showMoodDetails,
    showSave,
    showStartOverlay,
    start,
    startActionLabel,
    startDescription,
    toggleAutoPlay
  }
}
