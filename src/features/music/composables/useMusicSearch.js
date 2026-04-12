import { ref } from 'vue'
import { useMusicStore } from '../../../stores/music'
import { useSettingsStore } from '../../../stores/settings'

/**
 * Online music search + auto resolve composable.
 * - Out-of-box built-in sources (no user config required)
 * - Optional custom API compatibility (NeteaseCloudMusicApi / generic JSON)
 * - Can resolve (music:歌名:歌手) style tracks into playable URLs
 */

const FETCH_TIMEOUT_MS = 9000
const SEARCH_LIMIT = 24
const RESOLVE_CACHE_LIMIT = 200
const RESOLVE_CACHE = new Map()
const DEFAULT_JAMENDO_TEST_CLIENT_ID = '709fa152'
const JAMENDO_CLIENT_ID = String(import.meta.env.VITE_JAMENDO_CLIENT_ID || DEFAULT_JAMENDO_TEST_CLIENT_ID).trim()
const GDSTUDIO_API_BASE = 'https://music-api.gdstudio.xyz/api.php'
const ENABLE_GDSTUDIO_SOURCE = String(import.meta.env.VITE_ENABLE_GDSTUDIO_SOURCE ?? '1').trim() !== '0'
const GDSTUDIO_SOURCES = String(import.meta.env.VITE_GDSTUDIO_SOURCES || 'netease,tencent,migu,kugou,kuwo')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .slice(0, 8)

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeForCompare(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s\-_/\\|.,，。!！?？:'"“”‘’（）()\[\]【】<>]/g, '')
}

function normalizeTrackKey(title, artist) {
  const t = normalizeForCompare(title)
  const a = normalizeForCompare(artist)
  if (!t && !a) return ''
  return `${t}::${a}`
}

function writeResolveCache(key, value) {
  if (!key || !value?.url) return
  RESOLVE_CACHE.set(key, value)
  if (RESOLVE_CACHE.size <= RESOLVE_CACHE_LIMIT) return
  const first = RESOLVE_CACHE.keys().next().value
  if (first) RESOLVE_CACHE.delete(first)
}

function normalizeUrl(url) {
  const raw = normalizeText(url)
  if (!raw) return ''
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw
  return ''
}

function normalizeTrack(raw, fallbackSource = 'online') {
  return {
    id: raw.id || `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    songId: raw.songId || null,
    title: normalizeText(raw.title),
    artist: normalizeText(raw.artist),
    url: normalizeUrl(raw.url),
    cover: normalizeUrl(raw.cover),
    needResolve: !!raw.needResolve,
    isPreview: !!raw.isPreview,
    resolver: normalizeText(raw.resolver),
    vendor: normalizeText(raw.vendor),
    source: raw.source || fallbackSource
  }
}

function dedupeTracks(list, limit = SEARCH_LIMIT) {
  const out = []
  const seen = new Set()
  for (const item of list) {
    const track = normalizeTrack(item, item.source || 'online')
    const dedupeKey = track.url || normalizeTrackKey(track.title, track.artist)
    if (!dedupeKey || seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    out.push(track)
    if (out.length >= limit) break
  }
  return out
}

function scoreCandidate(candidate, target) {
  const title = normalizeForCompare(target?.title)
  const artist = normalizeForCompare(target?.artist)
  const candTitle = normalizeForCompare(candidate?.title)
  const candArtist = normalizeForCompare(candidate?.artist)

  let score = candidate?.url ? 10 : -100

  if (title) {
    if (candTitle === title) score += 90
    else if (candTitle.includes(title)) score += 70
    else if (title.includes(candTitle)) score += 55
    else if (candTitle && title.slice(0, 4) === candTitle.slice(0, 4)) score += 25
  }

  if (artist) {
    if (candArtist === artist) score += 50
    else if (candArtist.includes(artist) || artist.includes(candArtist)) score += 30
  }

  if (candidate?.isPreview) score -= 90
  else score += 15

  if (candidate?.source === 'jamendo') score += 10
  if (candidate?.source === 'gdstudio') score += 14
  if (candidate?.source === 'custom') score += 8
  if (candidate?.source === 'itunes') score += 5
  if (candidate?.source === 'openverse') score += 3

  return score
}

function pickBestPlayableTrack(candidates, target, allowPreview = false) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const filtered = allowPreview ? candidates : candidates.filter(c => !c?.isPreview)
  const list = filtered.length > 0 ? filtered : candidates
  let best = null
  let bestScore = -Infinity
  for (const candidate of list) {
    if (!candidate?.url) continue
    const s = scoreCandidate(candidate, target)
    if (s > bestScore) {
      best = candidate
      bestScore = s
    }
  }
  return best || list.find(c => c?.url) || null
}

function normalizeCustomResults(data) {
  if (data?.result?.songs) {
    return data.result.songs.map((item, i) => normalizeTrack({
      id: `netease_${item.id || i}`,
      songId: item.id,
      title: item.name || '未知曲目',
      artist: (item.artists || item.ar || []).map(a => a.name).join('/'),
      cover: item.album?.picUrl || item.al?.picUrl || '',
      url: '',
      needResolve: true,
      source: 'custom'
    }, 'custom'))
  }

  const list = data?.data || data?.songs || data?.list || (Array.isArray(data) ? data : null)
  if (!Array.isArray(list)) return []

  return list.map((item, i) => normalizeTrack({
    id: `custom_${Date.now()}_${i}`,
    title: item.song || item.title || item.name || item.songname || item.track_name || '',
    artist: item.singer || item.artist || item.author || item.ar_name || '',
    url: item.url || item.src || item.play_url || item.music_url || '',
    cover: item.cover || item.pic || item.album_img || item.picurl || '',
    source: 'custom'
  }, 'custom'))
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchTextWithTimeout(url) {
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
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getNeteaseBase(apiUrl) {
  return normalizeText(apiUrl).replace(/\/(?:search|cloudsearch).*$/i, '').replace(/\/$/, '')
}

async function resolveNeteaseUrl(apiUrl, songId) {
  const base = getNeteaseBase(apiUrl)
  if (!base || !songId) return ''
  try {
    const data = await fetchJsonWithTimeout(`${base}/song/url?id=${encodeURIComponent(songId)}&br=320000`)
    return normalizeUrl(data?.data?.[0]?.url)
  } catch {
    return ''
  }
}

async function searchCustomApi(apiUrl, query) {
  const base = normalizeText(apiUrl)
  if (!base) return []
  const sep = base.includes('?') ? '&' : '?'
  const isNetease = /\/(?:search|cloudsearch)/i.test(base)
  const paramKey = isNetease ? 'keywords' : 'word'
  const url = `${base}${sep}${paramKey}=${encodeURIComponent(query)}`
  const data = await fetchJsonWithTimeout(url)
  return normalizeCustomResults(data)
}

function normalizeGdStudioSearchResults(data, source) {
  const list = Array.isArray(data)
    ? data
    : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.result) ? data.result : []))
  if (!Array.isArray(list)) return []

  return list.map((item, i) => {
    const sid = item.id || item.songid || item.songId || item.rid || item.mid || ''
    const url = item.url || item.music_url || item.play_url || ''
    return normalizeTrack({
      id: `gdstudio_${source}_${sid || i}`,
      songId: sid || null,
      title: item.name || item.song || item.title || item.songname || '',
      artist: item.artist || item.author || item.singer || item.ar_name || '',
      cover: item.pic || item.cover || item.picurl || '',
      url,
      needResolve: !url && !!sid,
      resolver: 'gdstudio',
      vendor: source,
      source: 'gdstudio',
      isPreview: false
    }, 'gdstudio')
  })
}

function pickUrlFromUnknownPayload(payload) {
  const tryString = (value) => {
    const direct = normalizeUrl(String(value ?? '').replace(/^["']|["']$/g, '').trim())
    if (direct) return direct
    const match = String(value ?? '').match(/https?:\/\/[^\s"'<>]+/i)
    return normalizeUrl(match?.[0] || '')
  }

  if (payload == null) return ''
  if (typeof payload === 'string') return tryString(payload)
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const url = pickUrlFromUnknownPayload(item)
      if (url) return url
    }
    return ''
  }
  if (typeof payload === 'object') {
    const candidates = [
      payload.url,
      payload.data?.url,
      payload.data?.[0]?.url,
      payload.music_url,
      payload.src,
      payload.play_url
    ]
    for (const item of candidates) {
      const url = tryString(item)
      if (url) return url
    }
  }
  return ''
}

async function resolveGdStudioUrl(songId, source) {
  const sid = normalizeText(songId)
  const vendor = normalizeText(source)
  if (!sid || !vendor) return ''
  const url = `${GDSTUDIO_API_BASE}?types=url&source=${encodeURIComponent(vendor)}&id=${encodeURIComponent(sid)}&br=999`
  try {
    const text = await fetchTextWithTimeout(url)
    const parsed = tryParseJson(text)
    if (parsed) {
      return pickUrlFromUnknownPayload(parsed)
    }
    return pickUrlFromUnknownPayload(text)
  } catch {
    return ''
  }
}

async function searchGdStudioBySource(query, source) {
  const url = `${GDSTUDIO_API_BASE}?types=search&source=${encodeURIComponent(source)}&name=${encodeURIComponent(query)}&count=12&pages=1`
  const text = await fetchTextWithTimeout(url)
  const parsed = tryParseJson(text)
  const data = parsed || text
  return normalizeGdStudioSearchResults(data, source)
}

async function searchGdStudio(query) {
  if (!ENABLE_GDSTUDIO_SOURCE || GDSTUDIO_SOURCES.length === 0) return []
  const settled = await Promise.allSettled(
    GDSTUDIO_SOURCES.map(source => searchGdStudioBySource(query, source))
  )
  const merged = []
  settled.forEach((item) => {
    if (item.status === 'fulfilled') {
      merged.push(...(item.value || []))
    }
  })
  return merged
}

async function searchJamendo(query) {
  if (!JAMENDO_CLIENT_ID) return []
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(JAMENDO_CLIENT_ID)}&format=json&limit=20&search=${encodeURIComponent(query)}&audioformat=mp32`
  const data = await fetchJsonWithTimeout(url)
  const list = Array.isArray(data?.results) ? data.results : []
  return list
    .map((item, i) => normalizeTrack({
      id: `jamendo_${item.id || i}`,
      title: item.name || item.track_name || '',
      artist: item.artist_name || '',
      url: item.audio || item.audiodownload || '',
      cover: item.image || item.album_image || '',
      source: 'jamendo',
      isPreview: false
    }, 'jamendo'))
    .filter(item => item.url)
}

async function searchItunes(query) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&media=music&limit=20&country=US`
  const data = await fetchJsonWithTimeout(url)
  const list = Array.isArray(data?.results) ? data.results : []
  return list
    .map((item, i) => normalizeTrack({
      id: `itunes_${item.trackId || item.collectionId || i}`,
      title: item.trackName || item.trackCensoredName || item.collectionName || '',
      artist: item.artistName || '',
      url: item.previewUrl || '',
      cover: (item.artworkUrl100 || item.artworkUrl60 || '').replace(/100x100bb/i, '512x512bb'),
      source: 'itunes',
      isPreview: true
    }, 'itunes'))
    .filter(item => item.url)
}

async function searchOpenverse(query) {
  const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&page_size=20`
  const data = await fetchJsonWithTimeout(url)
  const list = Array.isArray(data?.results) ? data.results : []
  return list
    .map((item, i) => normalizeTrack({
      id: `openverse_${item.id || i}`,
      title: item.title || '',
      artist: item.creator || item.audio_set?.creator || '',
      url: item.url || '',
      cover: item.thumbnail || '',
      source: 'openverse'
    }, 'openverse'))
    .filter(item => item.url)
}

function buildSearchTasks(query, apiUrl) {
  const tasks = [
    { source: 'gdstudio', run: () => searchGdStudio(query) },
    { source: 'jamendo', run: () => searchJamendo(query) },
    { source: 'itunes', run: () => searchItunes(query) },
    { source: 'openverse', run: () => searchOpenverse(query) }
  ]
  if (apiUrl) {
    tasks.unshift({ source: 'custom', run: () => searchCustomApi(apiUrl, query) })
  }
  return tasks
}

async function searchAcrossSources(query, apiUrl = '') {
  const tasks = buildSearchTasks(query, apiUrl)
  const settled = await Promise.allSettled(tasks.map(item => item.run()))
  const tracks = []
  const failures = []

  settled.forEach((item, idx) => {
    if (item.status === 'fulfilled') {
      tracks.push(...(item.value || []))
      return
    }
    failures.push({
      source: tasks[idx].source,
      reason: item.reason?.message || 'source_error'
    })
  })

  return {
    tracks: dedupeTracks(tracks),
    failures,
    totalSources: tasks.length
  }
}

export async function resolveMusicTrack(track, options = {}) {
  if (!track) return null
  const apiUrl = normalizeText(options.apiUrl)
  const allowPreview = options.allowPreview === true
  const normalizedInput = normalizeTrack(track, track.source || 'online')

  if (normalizedInput.url && (allowPreview || !normalizedInput.isPreview)) return normalizedInput

  const cacheKey = normalizeTrackKey(normalizedInput.title, normalizedInput.artist)
  if (cacheKey && RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey)
    if (!allowPreview && cached?.isPreview) {
      // Ignore preview-only cache hit when full track is required.
    } else {
      return normalizeTrack({
        ...cached,
        ...normalizedInput,
        url: cached.url,
        cover: normalizedInput.cover || cached.cover
      }, cached.source || normalizedInput.source || 'online')
    }
  }

  if (normalizedInput.needResolve && normalizedInput.songId && apiUrl) {
    const neteaseUrl = await resolveNeteaseUrl(apiUrl, normalizedInput.songId)
    if (neteaseUrl) {
      const resolved = normalizeTrack({
        ...normalizedInput,
        url: neteaseUrl,
        needResolve: false
      }, normalizedInput.source || 'online')
      writeResolveCache(cacheKey, resolved)
      return resolved
    }
  }

  const query = [normalizedInput.title, normalizedInput.artist].filter(Boolean).join(' ').trim()
  if (!query) return null

  const { tracks } = await searchAcrossSources(query, apiUrl)
  const maybePlayable = [...tracks]

  const unresolved = tracks
    .filter(item => !item.url && item.needResolve && item.songId && apiUrl)
    .slice(0, 3)

  if (unresolved.length > 0) {
    const resolved = await Promise.all(unresolved.map(async (item) => {
      const url = await resolveNeteaseUrl(apiUrl, item.songId)
      if (!url) return null
      return normalizeTrack({ ...item, url, needResolve: false }, item.source || 'custom')
    }))
    maybePlayable.push(...resolved.filter(Boolean))
  }

  const unresolvedGdStudio = tracks
    .filter(item => !item.url && item.resolver === 'gdstudio' && item.songId && item.vendor)
    .slice(0, 6)
  if (unresolvedGdStudio.length > 0) {
    const resolved = await Promise.all(unresolvedGdStudio.map(async (item) => {
      const url = await resolveGdStudioUrl(item.songId, item.vendor)
      if (!url) return null
      return normalizeTrack({ ...item, url, needResolve: false }, item.source || 'gdstudio')
    }))
    maybePlayable.push(...resolved.filter(Boolean))
  }

  const playable = maybePlayable.filter(item => !!item?.url)
  const best = pickBestPlayableTrack(playable, normalizedInput, allowPreview)
  if (!best) return null

  const merged = normalizeTrack({
    ...best,
    ...normalizedInput,
    title: normalizedInput.title || best.title,
    artist: normalizedInput.artist || best.artist,
    cover: normalizedInput.cover || best.cover,
    url: best.url,
    needResolve: false
  }, best.source || normalizedInput.source || 'online')

  writeResolveCache(cacheKey, merged)
  return merged
}

function getSearchErrorMessage(tracks, failures, totalSources) {
  if (tracks.length > 0) return ''
  if (failures.length === totalSources) return '音乐源暂时不可用，请稍后重试'
  return '未找到相关歌曲'
}

export function useMusicSearch() {
  const musicStore = useMusicStore()
  const settingsStore = useSettingsStore()
  const results = ref([])
  const searching = ref(false)
  const error = ref('')

  function getApiUrl() {
    return normalizeText(settingsStore.musicSearchApiUrl)
  }

  async function search(query) {
    const cleanQuery = normalizeText(query)
    if (!cleanQuery) {
      results.value = []
      error.value = ''
      return
    }

    searching.value = true
    error.value = ''
    results.value = []

    try {
      const { tracks, failures, totalSources } = await searchAcrossSources(cleanQuery, getApiUrl())
      const fullTracks = tracks.filter(item => !item.isPreview)
      results.value = fullTracks
        .filter(item => item.url || (item.needResolve && item.songId))
        .map(item => ({
          ...item,
          title: item.title || '未知曲目',
          artist: item.artist || '未知歌手'
        }))
      if (results.value.length === 0 && tracks.length > 0) {
        error.value = '该关键词只找到试听片段，暂无可用完整版音源'
      } else {
        error.value = getSearchErrorMessage(results.value, failures, totalSources)
      }
    } catch (e) {
      error.value = e.message || '搜索失败'
      results.value = []
    } finally {
      searching.value = false
    }
  }

  async function playResult(track) {
    if (!track) return
    const resolved = await resolveMusicTrack(track, { apiUrl: getApiUrl(), allowPreview: false })
    if (!resolved?.url) {
      error.value = '暂无可播放的完整版音源'
      return
    }
    musicStore.playTrack({
      title: resolved.title || track.title || '未知曲目',
      artist: resolved.artist || track.artist || '未知歌手',
      cover: resolved.cover || track.cover || '',
      url: resolved.url,
      source: resolved.source || track.source || 'online'
    })
  }

  async function addToLibrary(track) {
    if (!track) return
    const resolved = await resolveMusicTrack(track, { apiUrl: getApiUrl(), allowPreview: false })
    if (!resolved?.url) {
      error.value = '该歌曲暂无可用音源'
      return
    }
    const exists = musicStore.library.some(t => t.url === resolved.url)
    if (exists) return
    musicStore.library.push({
      id: `lib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: resolved.title || track.title || '未知曲目',
      artist: resolved.artist || track.artist || '未知歌手',
      cover: resolved.cover || track.cover || '',
      url: resolved.url,
      source: resolved.source || track.source || 'online'
    })
  }

  return {
    results,
    searching,
    error,
    search,
    playResult,
    addToLibrary,
    resolveTrack: (track) => resolveMusicTrack(track, { apiUrl: getApiUrl(), allowPreview: false })
  }
}
