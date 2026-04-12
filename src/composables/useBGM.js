import { useVNStore } from '../stores/vn'

let currentAudio = null

export function useBGM() {
  const vnStore = useVNStore()

  /**
   * 播放 BGM
   */
  function play(name) {
    const bgm = vnStore.getResource('bgm', name)
    if (!bgm?.url) {
      console.warn('BGM 资源未找到:', name)
      return false
    }

    // 停止当前播放
    stop()

    currentAudio = new Audio(bgm.url)
    currentAudio.loop = true
    currentAudio.volume = vnStore.player.volume?.bgm ?? 0.7

    currentAudio.onended = () => {
      // loop 模式下不会触发，但以防万一
    }

    currentAudio.onerror = (e) => {
      console.warn('BGM 播放失败:', name, e)
      vnStore.player.currentBgm = null
    }

    currentAudio.play().then(() => {
      vnStore.player.currentBgm = { name, url: bgm.url }
    }).catch(e => {
      console.warn('BGM 播放被阻止:', e)
      // 可能是自动播放策略限制
    })

    return true
  }

  /**
   * 停止 BGM
   */
  function stop() {
    if (currentAudio) {
      try {
        currentAudio.pause()
        currentAudio.currentTime = 0
      } catch {}
      currentAudio = null
    }
    vnStore.player.currentBgm = null
  }

  /**
   * 暂停 BGM
   */
  function pause() {
    if (currentAudio) {
      currentAudio.pause()
    }
  }

  /**
   * 恢复播放
   */
  function resume() {
    if (currentAudio && currentAudio.paused) {
      currentAudio.play().catch(() => {})
    }
  }

  /**
   * 设置音量
   */
  function setVolume(vol) {
    const v = Math.max(0, Math.min(1, vol))
    vnStore.player.volume.bgm = v
    if (currentAudio) {
      currentAudio.volume = v
    }
  }

  /**
   * 淡入淡出切换 BGM
   */
  async function fadeToTrack(name, duration = 1000) {
    if (!currentAudio || !vnStore.player.currentBgm) {
      // 没有当前播放，直接播放新的
      play(name)
      return
    }

    const oldAudio = currentAudio
    const oldVolume = oldAudio.volume
    const steps = 20
    const stepTime = duration / 2 / steps
    const volumeStep = oldVolume / steps

    // 淡出
    for (let i = 0; i < steps; i++) {
      oldAudio.volume = Math.max(0, oldVolume - volumeStep * (i + 1))
      await new Promise(r => setTimeout(r, stepTime))
    }

    oldAudio.pause()

    // 播放新的并淡入
    const bgm = vnStore.getResource('bgm', name)
    if (!bgm?.url) return

    currentAudio = new Audio(bgm.url)
    currentAudio.loop = true
    currentAudio.volume = 0

    await currentAudio.play().catch(() => {})
    vnStore.player.currentBgm = { name, url: bgm.url }

    const targetVolume = vnStore.player.volume?.bgm ?? 0.7
    const fadeInStep = targetVolume / steps

    for (let i = 0; i < steps; i++) {
      currentAudio.volume = Math.min(targetVolume, fadeInStep * (i + 1))
      await new Promise(r => setTimeout(r, stepTime))
    }
  }

  /**
   * 获取当前播放状态
   */
  function isPlaying() {
    return currentAudio && !currentAudio.paused
  }

  return {
    play,
    stop,
    pause,
    resume,
    setVolume,
    fadeToTrack,
    isPlaying
  }
}
