/**
 * useMusic - Howler.js playback engine composable
 * Manages audio playback, Media Session API, progress tracking.
 */
import { watch, ref } from 'vue'
import { Howl } from 'howler'
import { useMusicStore } from '../../../stores/music'
import { useStorage } from '../../../composables/useStorage'

let howlInstance = null
let progressTimer = null

export function useMusic() {
  const musicStore = useMusicStore()
  const { scheduleSave } = useStorage()

  // 内部加载状态
  const isLoading = ref(false)

  function destroyHowl() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    if (howlInstance) {
      howlInstance.unload()
      howlInstance = null
    }
  }

  function startProgressTimer() {
    if (progressTimer) clearInterval(progressTimer)
    progressTimer = setInterval(() => {
      if (howlInstance && howlInstance.playing()) {
        musicStore.progress = howlInstance.seek() || 0
      }
    }, 500)
  }

  function loadTrack(track) {
    if (!track || !track.url) return
    destroyHowl()
    isLoading.value = true

    howlInstance = new Howl({
      src: [track.url],
      html5: true,
      volume: musicStore.volume,
      onload() {
        isLoading.value = false
        musicStore.duration = howlInstance.duration() || 0
      },
      onplay() {
        musicStore.isPlaying = true
        startProgressTimer()
        updateMediaSession(track)
      },
      onpause() {
        musicStore.isPlaying = false
      },
      onstop() {
        musicStore.isPlaying = false
        musicStore.progress = 0
      },
      onend() {
        musicStore.progress = 0
        handleTrackEnd()
      },
      onloaderror() {
        isLoading.value = false
        console.warn('[useMusic] Failed to load:', track.url)
      }
    })

    if (musicStore.isPlaying) {
      howlInstance.play()
    }
  }

  function handleTrackEnd() {
    const mode = musicStore.playMode
    if (mode === 'single') {
      // 单曲循环
      if (howlInstance) {
        howlInstance.seek(0)
        howlInstance.play()
      }
    } else {
      musicStore.nextTrack()
    }
  }

  function play() {
    if (howlInstance) howlInstance.play()
    else if (musicStore.currentTrack) loadTrack(musicStore.currentTrack)
  }

  function pause() {
    if (howlInstance) howlInstance.pause()
  }

  function togglePlay() {
    if (!howlInstance && musicStore.currentTrack) {
      loadTrack(musicStore.currentTrack)
      return
    }
    if (howlInstance) {
      if (howlInstance.playing()) howlInstance.pause()
      else howlInstance.play()
    }
  }
  function seek(time) {
    if (howlInstance) {
      howlInstance.seek(time)
      musicStore.progress = time
    }
  }

  function setVolume(vol) {
    musicStore.volume = vol
    if (howlInstance) howlInstance.volume(vol)
    scheduleSave()
  }

  // Media Session API (锁屏控制)
  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || '未知曲目',
      artist: track.artist || '未知歌手',
      album: track.album || '',
      artwork: track.cover ? [{ src: track.cover, sizes: '512x512', type: 'image/png' }] : []
    })
    navigator.mediaSession.setActionHandler('play', play)
    navigator.mediaSession.setActionHandler('pause', pause)
    navigator.mediaSession.setActionHandler('previoustrack', () => musicStore.prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => musicStore.nextTrack())
    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) seek(details.seekTime)
      })
    } catch { /* not supported */ }
  }

  // 用户上传音频文件
  function handleFileUpload(files) {
    if (!files || files.length === 0) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) return
      const url = URL.createObjectURL(file)
      const name = file.name.replace(/\.[^.]+$/, '')
      const track = {
        id: 'track_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: name,
        artist: '',
        album: '',
        cover: '',
        url,
        source: 'local',
        fileName: file.name
      }
      musicStore.addToLibrary(track)
      scheduleSave()
    })
  }

  // Watch track changes to load new audio
  const stopWatchTrack = watch(
    () => musicStore.currentTrack,
    (track, oldTrack) => {
      if (track && (!oldTrack || track.id !== oldTrack.id)) {
        loadTrack(track)
      } else if (!track) {
        destroyHowl()
      }
    }
  )

  // Watch play state for external toggles
  const stopWatchPlay = watch(
    () => musicStore.isPlaying,
    (playing) => {
      if (!howlInstance) {
        if (playing && musicStore.currentTrack) loadTrack(musicStore.currentTrack)
        return
      }
      if (playing && !howlInstance.playing()) howlInstance.play()
      else if (!playing && howlInstance.playing()) howlInstance.pause()
    }
  )

  // Watch volume
  const stopWatchVolume = watch(
    () => musicStore.volume,
    (vol) => { if (howlInstance) howlInstance.volume(vol) }
  )

  function cleanup() {
    stopWatchTrack()
    stopWatchPlay()
    stopWatchVolume()
    destroyHowl()
  }

  return {
    isLoading,
    play, pause, togglePlay, seek, setVolume,
    handleFileUpload, cleanup
  }
}
