import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { makeId } from '../utils/id'

export const useMusicStore = defineStore('music', () => {
  // 播放列表
  const queue = ref([])
  // 当前播放索引
  const currentIndex = ref(-1)
  // 播放状态
  const isPlaying = ref(false)
  // 当前进度 (秒)
  const progress = ref(0)
  // 总时长 (秒)
  const duration = ref(0)
  // 音量 0-1
  const volume = ref(0.8)
  // 一起听模式 (per-contact)
  const listenTogether = ref(false)
  // 关联的联系人 ID（一起听时）
  const listenContactId = ref(null)
  // 播放模式: 'order' | 'loop' | 'single' | 'shuffle'
  const playMode = ref('order')
  // 灵动岛是否展开
  const islandExpanded = ref(false)
  // 全屏播放器是否打开
  const playerOpen = ref(false)
  // 音乐库面板是否打开
  const libraryOpen = ref(false)
  // 用户音乐库（持久化）
  const library = ref([])

  // 当前曲目
  const currentTrack = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
      return queue.value[currentIndex.value]
    }
    return null
  })

  // 添加曲目到队列并播放
  function playTrack(track) {
    if (!track.id) track.id = makeId('track')
    const idx = queue.value.findIndex(t => t.id === track.id)
    if (idx >= 0) {
      currentIndex.value = idx
    } else {
      queue.value.push(track)
      currentIndex.value = queue.value.length - 1
    }
    isPlaying.value = true
  }

  // 添加到队列（不立即播放）
  function addToQueue(track) {
    if (!track.id) track.id = makeId('track')
    if (!queue.value.find(t => t.id === track.id)) {
      queue.value.push(track)
    }
  }

  // 从队列移除
  function removeFromQueue(trackId) {
    const idx = queue.value.findIndex(t => t.id === trackId)
    if (idx < 0) return
    queue.value.splice(idx, 1)
    if (queue.value.length === 0) {
      currentIndex.value = -1
      isPlaying.value = false
    } else if (idx < currentIndex.value) {
      currentIndex.value--
    } else if (idx === currentIndex.value) {
      if (currentIndex.value >= queue.value.length) {
        currentIndex.value = 0
      }
    }
  }

  function clearQueue() {
    queue.value = []
    currentIndex.value = -1
    isPlaying.value = false
    progress.value = 0
    duration.value = 0
  }

  function nextTrack() {
    if (queue.value.length === 0) return
    if (playMode.value === 'shuffle') {
      currentIndex.value = Math.floor(Math.random() * queue.value.length)
    } else {
      currentIndex.value = (currentIndex.value + 1) % queue.value.length
    }
    isPlaying.value = true
  }

  function prevTrack() {
    if (queue.value.length === 0) return
    if (progress.value > 3) {
      // 超过3秒，重新播放当前曲目
      progress.value = 0
      return
    }
    currentIndex.value = (currentIndex.value - 1 + queue.value.length) % queue.value.length
    isPlaying.value = true
  }

  function togglePlay() {
    if (queue.value.length === 0) return
    isPlaying.value = !isPlaying.value
  }

  function setListenTogether(contactId, enabled) {
    listenTogether.value = enabled
    listenContactId.value = enabled ? contactId : null
  }

  function exitListenTogether() {
    // 退出一起听时同步清理播放态，避免灵动岛残留在顶部。
    listenTogether.value = false
    listenContactId.value = null
    islandExpanded.value = false
    playerOpen.value = false
    clearQueue()
  }

  // 添加到用户音乐库
  function addToLibrary(track) {
    if (!track.id) track.id = makeId('track')
    if (!library.value.find(t => t.id === track.id)) {
      library.value.push({ ...track, addedAt: Date.now() })
    }
  }

  function removeFromLibrary(trackId) {
    library.value = library.value.filter(t => t.id !== trackId)
  }

  // 获取当前播放状态描述（供 AI prompt 注入）
  function getMusicContext() {
    if (!currentTrack.value) return null
    const track = currentTrack.value
    return {
      title: track.title || '未知曲目',
      artist: track.artist || '未知歌手',
      cover: track.cover || '',
      url: track.url || '',
      isPlaying: !!isPlaying.value,
      progress: Number(progress.value || 0),
      duration: Number(duration.value || 0),
      listenTogether: !!listenTogether.value,
      listenContactId: listenContactId.value || null
    }
  }

  // 持久化
  function exportData() {
    return {
      library: JSON.parse(JSON.stringify(library.value)),
      volume: volume.value,
      playMode: playMode.value
    }
  }

  function importData(data) {
    if (!data || typeof data !== 'object') return
    if (Array.isArray(data.library)) library.value = data.library
    if (typeof data.volume === 'number') volume.value = data.volume
    if (typeof data.playMode === 'string') playMode.value = data.playMode
  }

  return {
    queue, currentIndex, isPlaying, progress, duration,
    volume, listenTogether, listenContactId, playMode,
    islandExpanded, playerOpen, libraryOpen, library,
    currentTrack,
    playTrack, addToQueue, removeFromQueue, clearQueue,
    nextTrack, prevTrack, togglePlay,
    setListenTogether, exitListenTogether, addToLibrary, removeFromLibrary,
    getMusicContext, exportData, importData
  }
})
