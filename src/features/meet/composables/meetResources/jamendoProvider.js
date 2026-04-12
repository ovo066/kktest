// @ts-check

import { BGM_HINTS, buildAudioHintTokens } from './sourceHelpers'
import { clampNumber, normalizeText, tokenizeText } from './utils'

const DEFAULT_JAMENDO_TEST_CLIENT_ID = '709fa152'
const JAMENDO_API_BASE = 'https://api.jamendo.com/v3.0/tracks/'
const CACHE_LIMIT = 72
const CACHE_TTL_MS = 30 * 60 * 1000
const TAG_TOKEN_RE = /^[a-z][a-z0-9_-]{1,31}$/
const SEARCH_TOKEN_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/
const TAG_STOP_WORDS = new Set(['music', 'bgm', 'theme', 'track', 'sound', 'scene'])
const SEARCH_STOP_WORDS = new Set(['music', 'bgm', 'theme', 'track', 'sound', 'scene'])

const requestCache = new Map()

function flattenValueText(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach(item => flattenValueText(item, out))
    return out
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(item => flattenValueText(item, out))
    return out
  }
  const text = normalizeText(value)
  if (text) out.push(text)
  return out
}

function readCache(cacheKey) {
  const cached = requestCache.get(cacheKey)
  if (!cached) return null
  if ((Date.now() - cached.at) > CACHE_TTL_MS) {
    requestCache.delete(cacheKey)
    return null
  }
  return cached.value
}

function writeCache(cacheKey, value) {
  requestCache.set(cacheKey, {
    at: Date.now(),
    value
  })
  if (requestCache.size <= CACHE_LIMIT) return
  const first = requestCache.keys().next().value
  if (first) requestCache.delete(first)
}

function collectJamendoTags(track) {
  const text = flattenValueText(track?.musicinfo?.tags).join(' ')
  return Array.from(new Set(tokenizeText(text)))
}

function normalizeJamendoTrack(track) {
  const url = normalizeText(track?.audio || track?.audiodownload || '')
  if (!/^https?:/i.test(url)) return null
  return {
    id: normalizeText(track?.id || ''),
    title: normalizeText(track?.name || track?.track_name || ''),
    artist: normalizeText(track?.artist_name || ''),
    url,
    duration: Number(track?.duration || 0) || 0,
    tags: collectJamendoTags(track)
  }
}

function scoreTrack(track, queryTokens, hintTokens) {
  const tokenSet = new Set(tokenizeText(`${track.title} ${track.artist} ${track.tags.join(' ')}`))
  let score = 12

  if (queryTokens.length > 0) {
    queryTokens.forEach((token) => {
      if (tokenSet.has(token)) score += 7
      if (track.title.toLowerCase() === token) score += 8
    })
  }

  hintTokens.forEach((token) => {
    if (tokenSet.has(token)) score += 3
  })

  if (track.duration >= 60 && track.duration <= 8 * 60) score += 4
  else if (track.duration > 0 && track.duration < 40) score -= 8

  if (track.tags.includes('instrumental')) score += 4
  if (track.tags.includes('ambient')) score += 2
  if (track.tags.includes('calm')) score += 2

  return score
}

function buildRequestPlan(name, context, config) {
  const hintTokens = buildAudioHintTokens(name, context, BGM_HINTS)
  const queryTokens = tokenizeText(name)
  const fuzzyTags = Array.from(new Set(
    hintTokens.filter(token => TAG_TOKEN_RE.test(token) && !TAG_STOP_WORDS.has(token))
  )).slice(0, 6)
  const searchTokens = queryTokens
    .filter(token => SEARCH_TOKEN_RE.test(token) && !SEARCH_STOP_WORDS.has(token))
    .slice(0, 6)
  const hasContext = !!normalizeText(name || context?.text || context?.location || context?.timeOfDay || context?.scene)

  if (!hasContext && fuzzyTags.length === 0 && searchTokens.length === 0) return null

  const clientId = normalizeText(
    config.clientId ||
    import.meta.env?.VITE_JAMENDO_CLIENT_ID ||
    DEFAULT_JAMENDO_TEST_CLIENT_ID
  )
  if (!clientId) return null

  return {
    clientId,
    search: searchTokens.join(' '),
    fuzzyTags,
    queryTokens,
    hintTokens,
    instrumentalOnly: config.instrumentalOnly !== false,
    limit: clampNumber(config.limit, 1, 20, 8)
  }
}

function buildCacheKey(plan) {
  return [
    plan.clientId,
    plan.search || '_',
    plan.fuzzyTags.join(',') || '_',
    plan.instrumentalOnly ? 'instrumental' : 'mixed',
    plan.limit
  ].join('|')
}

function buildRequestUrl(plan) {
  const params = new URLSearchParams({
    client_id: plan.clientId,
    format: 'json',
    limit: String(plan.limit),
    audioformat: 'mp32'
  })
  if (plan.search) params.set('search', plan.search)
  if (plan.fuzzyTags.length > 0) params.set('fuzzytags', plan.fuzzyTags.join(','))
  if (plan.instrumentalOnly) params.set('vocalinstrumental', 'instrumental')
  return `${JAMENDO_API_BASE}?${params.toString()}`
}

async function fetchJamendoTracks(plan) {
  const cacheKey = buildCacheKey(plan)
  const cached = readCache(cacheKey)
  if (cached) return cached

  const response = await fetch(buildRequestUrl(plan), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) return []

  const payload = await response.json().catch(() => null)
  const list = Array.isArray(payload?.results) ? payload.results : []
  const tracks = list
    .map(normalizeJamendoTrack)
    .filter(Boolean)

  writeCache(cacheKey, tracks)
  return tracks
}

function pickBestTrack(tracks, plan) {
  let best = null
  let bestScore = -Infinity

  tracks.forEach((track) => {
    const score = scoreTrack(track, plan.queryTokens, plan.hintTokens)
    if (score > bestScore) {
      best = track
      bestScore = score
    }
  })

  return best
}

export function createJamendoBgmProvider({
  getConfig,
  normalizeMediaUrlForUse
}) {
  async function searchBestTrack(name = '', context = {}) {
    const config = getConfig?.() || {}
    if (config.enabled === false) return null

    const plan = buildRequestPlan(name, context, config)
    if (!plan) return null

    try {
      const tracks = await fetchJamendoTracks(plan)
      if (tracks.length === 0) return null
      const best = pickBestTrack(tracks, plan)
      if (!best?.url) return null
      const url = normalizeMediaUrlForUse(best.url, 'audio')
      if (!url) return null
      return {
        id: best.id,
        title: best.title || name || 'Jamendo BGM',
        artist: best.artist,
        url
      }
    } catch {
      return null
    }
  }

  return {
    resolveBGM(name, context = {}) {
      return searchBestTrack(name, context)
    },
    pickAutoBGM(context = {}) {
      return searchBestTrack('', context)
    }
  }
}
