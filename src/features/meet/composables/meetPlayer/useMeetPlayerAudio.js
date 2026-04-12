// @ts-check

/** @typedef {import('../meetInstructionContracts').MeetBgmInstruction} MeetBgmInstruction */
/** @typedef {import('../meetInstructionContracts').MeetSfxInstruction} MeetSfxInstruction */
/** @typedef {import('./meetPlayerContracts').MeetPlayerAudioApi} MeetPlayerAudioApi */
/** @typedef {import('./meetPlayerContracts').MeetPlayerAudioOptions} MeetPlayerAudioOptions */

import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

/** @param {MeetPlayerAudioOptions['player']} player */
function getPlaybackContext(player) {
  return {
    location: player.currentLocation,
    timeOfDay: player.currentTimeOfDay,
    text: player.currentDialog?.text || ''
  }
}

function pauseAudioSafe(audio) {
  try {
    audio.pause()
  } catch {
    // Ignore cleanup failures during teardown.
  }
}

/**
 * @param {MeetPlayerAudioOptions} options
 * @returns {MeetPlayerAudioApi}
 */
export function useMeetPlayerAudio({
  player,
  bgmAudio,
  resolveBGM,
  resolveBGMAsync,
  resolveSFXAsync
}) {
  const currentBgmUrl = ref(null)
  const needsAudioUnlock = ref(false)

  const bgmResolveToken = ref(0)
  const activeSfxAudios = new Set()
  const pendingSfxUrls = []

  function clearActiveSfxAudios() {
    activeSfxAudios.forEach((audio) => {
      pauseAudioSafe(audio)
    })
    activeSfxAudios.clear()
  }

  function resetAudioRuntime() {
    currentBgmUrl.value = null
    clearActiveSfxAudios()
    pendingSfxUrls.length = 0
    needsAudioUnlock.value = false
  }

  function playSfx(url) {
    if (!url) return
    try {
      const audio = new Audio(url)
      audio.volume = Number(player.volume?.sfx ?? 0.8)
      audio.preload = 'auto'
      audio.onended = () => {
        activeSfxAudios.delete(audio)
      }
      audio.onerror = () => {
        activeSfxAudios.delete(audio)
      }
      activeSfxAudios.add(audio)
      audio.play().catch((error) => {
        if (String(error?.name || '') === 'NotAllowedError') {
          needsAudioUnlock.value = true
          if (!pendingSfxUrls.includes(url)) pendingSfxUrls.push(url)
        }
        activeSfxAudios.delete(audio)
      })
    } catch {
      // Ignore one-shot SFX playback failures.
    }
  }

  async function tryResumeAudioPlayback() {
    if (!needsAudioUnlock.value) return

    let resumed = false
    const audio = bgmAudio.value
    if (audio && currentBgmUrl.value) {
      try {
        await audio.play()
        resumed = true
      } catch {
        // Keep waiting for the next gesture.
      }
    }

    if (pendingSfxUrls.length > 0) {
      const queued = pendingSfxUrls.splice(0, pendingSfxUrls.length)
      queued.forEach((url) => playSfx(url))
      resumed = true
    }

    if (resumed) needsAudioUnlock.value = false
  }

  watch(() => player.currentBgm, async (name) => {
    const token = ++bgmResolveToken.value
    if (!name) {
      currentBgmUrl.value = null
      return
    }

    const context = getPlaybackContext(player)
    const quick = resolveBGM(name, context)
    if (quick) {
      if (token === bgmResolveToken.value) currentBgmUrl.value = quick
      return
    }

    const resolved = await resolveBGMAsync(name, context).catch(() => null)
    if (token === bgmResolveToken.value) {
      currentBgmUrl.value = resolved || null
    }
  }, { immediate: true })

  watch(currentBgmUrl, async (url) => {
    if (!url) return
    await nextTick()
    const audio = bgmAudio.value
    if (!audio) return
    audio.volume = Number(player.volume?.bgm ?? 0.7)
    try {
      await audio.play()
    } catch (error) {
      if (String(error?.name || '') === 'NotAllowedError') {
        needsAudioUnlock.value = true
      }
    }
  })

  watch(() => player.volume?.bgm, (volume) => {
    if (!bgmAudio.value) return
    bgmAudio.value.volume = Number(volume ?? 0.7)
  })

  onBeforeUnmount(() => {
    resetAudioRuntime()
  })

  /** @param {MeetBgmInstruction} inst */
  async function handleBgmInstruction(inst) {
    if (!inst.name) {
      player.currentBgm = null
      currentBgmUrl.value = null
      return
    }
    player.currentBgm = inst.name

    const context = getPlaybackContext(player)
    const quick = resolveBGM(inst.name, context)
    if (quick) {
      currentBgmUrl.value = quick
      return
    }

    const url = await resolveBGMAsync(inst.name, context).catch(() => null)
    if (url) currentBgmUrl.value = url
  }

  /** @param {MeetSfxInstruction} inst */
  async function handleSfxInstruction(inst) {
    if (!inst?.name) {
      clearActiveSfxAudios()
      return
    }

    const context = getPlaybackContext(player)
    const url = await resolveSFXAsync(inst.name, context).catch(() => null)
    if (url) playSfx(url)
  }

  return {
    currentBgmUrl,
    needsAudioUnlock,
    tryResumeAudioPlayback,
    resetAudioRuntime,
    handleBgmInstruction,
    handleSfxInstruction
  }
}
