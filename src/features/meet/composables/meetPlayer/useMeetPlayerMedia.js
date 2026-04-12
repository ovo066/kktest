// @ts-check

/** @typedef {import('./meetPlayerContracts').MeetPlayerMediaController} MeetPlayerMediaController */
/** @typedef {import('./meetPlayerContracts').MeetPlayerMediaOptions} MeetPlayerMediaOptions */

import { useMeetPlayerAudio } from './useMeetPlayerAudio'
import { useMeetPlayerVisuals } from './useMeetPlayerVisuals'

/**
 * @param {MeetPlayerMediaOptions} options
 * @returns {MeetPlayerMediaController}
 */
export function useMeetPlayerMedia({
  player,
  meetStore,
  scheduleSave,
  bgmAudio,
  resolveBackground,
  resolveCG,
  resolveBGM,
  resolveBGMAsync,
  pickAutoBGM,
  resolveSFXAsync,
  getSpriteUrl,
  ensureSprite
}) {
  const audio = useMeetPlayerAudio({
    player,
    bgmAudio,
    resolveBGM,
    resolveBGMAsync,
    resolveSFXAsync
  })
  const visuals = useMeetPlayerVisuals({
    player,
    meetStore,
    scheduleSave,
    resolveBackground,
    resolveCG,
    pickAutoBGM,
    getSpriteUrl,
    ensureSprite,
    currentBgmUrl: audio.currentBgmUrl
  })

  function resetMediaRuntime() {
    audio.resetAudioRuntime()
    visuals.resetVisualRuntime()
  }

  return {
    currentBgmUrl: audio.currentBgmUrl,
    needsAudioUnlock: audio.needsAudioUnlock,
    tryResumeAudioPlayback: audio.tryResumeAudioPlayback,
    resetMediaRuntime,
    clearTransientSceneMedia: visuals.clearTransientSceneMedia,
    applySnapshotMediaInstruction: visuals.applySnapshotMediaInstruction,
    handleBgInstruction: visuals.handleBgInstruction,
    handleCgInstruction: visuals.handleCgInstruction,
    handleSpriteInstruction: visuals.handleSpriteInstruction,
    handleBgmInstruction: audio.handleBgmInstruction,
    handleSfxInstruction: audio.handleSfxInstruction,
    applyAutoSceneFixups: visuals.applyAutoSceneFixups
  }
}
