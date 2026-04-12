import { ref, computed, watch } from 'vue'
import { useMusicStore } from '../stores/music'

const GDSTUDIO_API_BASE = 'https://music-api.gdstudio.xyz/api.php'
const FETCH_TIMEOUT_MS = 8000
const LRC_CACHE_LIMIT = 100
const lrcCache = new Map()

function writeLrcCache(key, value) {
  if (!key) return
  lrcCache.set(key, value)
  if (lrcCache.size <= LRC_CACHE_LIMIT) return
  const first = lrcCache.keys().next().value
  if (first) lrcCache.delete(first)
}

function cacheKey(title, artist) {
  return `${(title || '').trim().toLowerCase()}::${(artist || '').trim().toLowerCase()}`
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function tryParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null
  try { return JSON.parse(raw) } catch { return null }
}

/**
 * Parse LRC format text into sorted array of { time (seconds), text }
 */
export function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return []
  const lines = lrcText.split('\n')
  const result = []
  const timeRe = /\[(\d{1,3}):(\d{1,2})(?:[.:])(\d{1,3})?\]/g

  for (const line of lines) {
    const times = []
    let match
    timeRe.lastIndex = 0
    while ((match = timeRe.exec(line)) !== null) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0
      times.push(min * 60 + sec + ms / 1000)
    }
    if (times.length === 0) continue
    const text = line.replace(/\[\d{1,3}:\d{1,2}[.:]\d{1,3}?\]/g, '').trim()
    if (!text) continue
    for (const t of times) {
      result.push({ time: t, text })
    }
  }

  result.sort((a, b) => a.time - b.time)
  return result
}

/**
 * Search for a song on GDStudio netease source, then fetch its LRC lyrics.
 */
async function fetchLyricsFromGdStudio(title, artist) {
  const query = [title, artist].filter(Boolean).join(' ').trim()
  if (!query) return null

  // Step 1: search to get songId
  const searchUrl = `${GDSTUDIO_API_BASE}?types=search&source=netease&name=${encodeURIComponent(query)}&count=5&pages=1`
  const searchText = await fetchWithTimeout(searchUrl)
  const searchData = tryParseJson(searchText)
  const list = Array.isArray(searchData) ? searchData
    : (Array.isArray(searchData?.data) ? searchData.data
      : (Array.isArray(searchData?.result) ? searchData.result : []))
  if (list.length === 0) return null

  const songId = list[0]?.id || list[0]?.songid || list[0]?.songId
  if (!songId) return null

  // Step 2: fetch lyric
  const lyricUrl = `${GDSTUDIO_API_BASE}?types=lyric&source=netease&id=${encodeURIComponent(songId)}`
  const lyricText = await fetchWithTimeout(lyricUrl)
  const lyricData = tryParseJson(lyricText)

  // GDStudio may return { lyric: "...", tlyric: "..." } or raw LRC string
  const lrc = lyricData?.lyric || lyricData?.lrc?.lyric || (typeof lyricText === 'string' && lyricText.includes('[') ? lyricText : null)
  if (!lrc) return null

  const parsed = parseLRC(lrc)
  return parsed.length > 0 ? parsed : null
}

/**
 * Fallback: Netease public API (music.163.com)
 */
async function fetchLyricsFromNetease(title, artist) {
  const query = [title, artist].filter(Boolean).join(' ').trim()
  if (!query) return null

  try {
    const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=5`
    const searchText = await fetchWithTimeout(searchUrl)
    const searchData = tryParseJson(searchText)
    const songs = searchData?.result?.songs
    if (!Array.isArray(songs) || songs.length === 0) return null

    const songId = songs[0].id
    if (!songId) return null

    const lyricUrl = `https://music.163.com/api/song/lyric?id=${songId}&lv=1`
    const lyricText = await fetchWithTimeout(lyricUrl)
    const lyricData = tryParseJson(lyricText)
    const lrc = lyricData?.lrc?.lyric
    if (!lrc) return null

    const parsed = parseLRC(lrc)
    return parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

/**
 * Main lyrics fetcher with fallback chain + caching
 */
async function fetchLyrics(title, artist) {
  const key = cacheKey(title, artist)
  if (!key || key === '::') return null
  if (lrcCache.has(key)) return lrcCache.get(key)

  let result = null
  try {
    result = await fetchLyricsFromGdStudio(title, artist)
  } catch { /* ignore */ }

  if (!result) {
    try {
      result = await fetchLyricsFromNetease(title, artist)
    } catch { /* ignore */ }
  }

  // Cache even null to avoid repeated failed fetches
  writeLrcCache(key, result)
  return result
}

// Singleton shared state — initialized once, reused by all callers
let _initialized = false
const _lines = ref([])
const _loading = ref(false)

function _initWatcher() {
  if (_initialized) return
  _initialized = true
  const musicStore = useMusicStore()
  watch(
    () => musicStore.currentTrack,
    async (track) => {
      _lines.value = []
      if (!track?.title) return
      _loading.value = true
      try {
        const result = await fetchLyrics(track.title, track.artist)
        if (musicStore.currentTrack?.title === track.title &&
            musicStore.currentTrack?.artist === track.artist) {
          _lines.value = result || []
        }
      } finally {
        _loading.value = false
      }
    },
    { immediate: true }
  )
}

/**
 * Composable: reactive lyrics synced to current playing track.
 * Shared singleton — all components get the same reactive state.
 */
export function useLyrics() {
  const musicStore = useMusicStore()
  _initWatcher()

  const hasLyrics = computed(() => _lines.value.length > 0)

  const currentLineIndex = computed(() => {
    if (_lines.value.length === 0) return -1
    const t = musicStore.progress
    let idx = -1
    for (let i = 0; i < _lines.value.length; i++) {
      if (_lines.value[i].time <= t) idx = i
      else break
    }
    return idx
  })

  const currentLineText = computed(() => {
    if (currentLineIndex.value < 0) return ''
    return _lines.value[currentLineIndex.value]?.text || ''
  })

  return { lines: _lines, loading: _loading, hasLyrics, currentLineIndex, currentLineText }
}
