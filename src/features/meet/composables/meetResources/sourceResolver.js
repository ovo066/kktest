// @ts-check

import { clampNumber, isDirectUrl, lower, normalizeExpression, normalizeText, tokenizeText } from './utils'
import {
  BGM_HINTS,
  DEFAULT_BACKGROUND_TIMEOUT_MS,
  SAFEBORU_API,
  SFX_HINTS,
  applyTemplate,
  buildAudioHintTokens,
  buildSafebooruTags,
  chooseBestByScore,
  ensureAbsoluteUrlMaybe,
  extractFirstMediaUrl,
  extractSafebooruPosts,
  getNestedValue,
  isLikelyMediaUrl,
  normalizeUrlSourceEntries,
  parseObjectLike,
  scoreSafebooruPost,
  toAbsoluteSafebooruUrl
} from './sourceHelpers'
import { createJamendoBgmProvider } from './jamendoProvider'

function createMeetSourceResolver({
  getAssetFlags,
  getMeetingBgmByName,
  getMeetingSfxByName,
  meetStore,
  normalizeMediaUrlForUse
}) {
  const jamendoBgm = createJamendoBgmProvider({
    getConfig: () => {
      const flags = getAssetFlags?.() || {}
      return {
        enabled: flags.enableJamendoBgm !== false,
        clientId: flags.jamendoClientId,
        instrumentalOnly: flags.jamendoInstrumentalOnly !== false,
        limit: flags.jamendoSearchLimit
      }
    },
    normalizeMediaUrlForUse
  })

  async function resolveApiEntryUrl(entry, vars, type = 'image') {
    const endpoint = applyTemplate(entry.api || entry.url, vars)
    if (!/^https?:/i.test(endpoint)) return ''

    const method = normalizeText(entry.method || 'GET').toUpperCase()
    const headers = parseObjectLike(entry.headers) || {}
    const bodyTemplate = normalizeText(entry.body || '')
    const bodyText = bodyTemplate ? applyTemplate(bodyTemplate, vars) : ''

    try {
      const response = await fetch(endpoint, {
        method,
        headers: headers && typeof headers === 'object' ? headers : {},
        body: (method === 'GET' || method === 'HEAD' || !bodyText) ? undefined : bodyText
      })
      if (!response.ok) return ''
      const contentType = String(response.headers.get('content-type') || '').toLowerCase()

      if (contentType.startsWith(type === 'audio' ? 'audio/' : 'image/')) {
        return normalizeMediaUrlForUse(response.url || endpoint, type)
      }

      if (contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('+json')) {
        const payload = await response.json().catch(() => null)
        if (!payload) return ''
        const fromPath = entry.responsePath ? getNestedValue(payload, entry.responsePath) : null
        let mediaUrl = normalizeText(fromPath || '')
        if (!mediaUrl) mediaUrl = extractFirstMediaUrl(payload, type)
        if (!mediaUrl) return ''
        mediaUrl = ensureAbsoluteUrlMaybe(mediaUrl, endpoint)
        return normalizeMediaUrlForUse(mediaUrl, type)
      }

      const text = normalizeText(await response.text().catch(() => ''))
      if (!text) return ''
      if (text.startsWith('{') || text.startsWith('[')) {
        const payload = parseObjectLike(text)
        if (payload) {
          const fromPath = entry.responsePath ? getNestedValue(payload, entry.responsePath) : null
          let mediaUrl = normalizeText(fromPath || '')
          if (!mediaUrl) mediaUrl = extractFirstMediaUrl(payload, type)
          if (!mediaUrl) return ''
          mediaUrl = ensureAbsoluteUrlMaybe(mediaUrl, endpoint)
          return normalizeMediaUrlForUse(mediaUrl, type)
        }
      }

      const maybeUrl = ensureAbsoluteUrlMaybe(text, endpoint)
      if (!/^https?:/i.test(maybeUrl)) return ''
      return normalizeMediaUrlForUse(maybeUrl, type)
    } catch {
      return ''
    }
  }

  async function resolveSourceEntryUrl(entry, vars, type = 'image') {
    const urlTemplate = normalizeText(entry?.url || '')
    const resolvedUrl = urlTemplate ? applyTemplate(urlTemplate, vars) : ''
    const normalized = normalizeMediaUrlForUse(resolvedUrl, type)
    const hasApi = !!normalizeText(entry?.api || '')
    const directLike = isDirectUrl(normalized) || /^https?:/i.test(normalized)

    if (directLike && isLikelyMediaUrl(normalized, type)) {
      return normalized
    }
    if (hasApi || directLike) {
      const fromApi = await resolveApiEntryUrl(entry, vars, type)
      if (fromApi) return fromApi
    }
    return directLike ? normalized : ''
  }

  function scoreNamedEntry(entry, queryTokens, exactName = '') {
    let score = 0
    const entryName = lower(entry.name)
    const entryAliases = lower(entry.aliases || '')
    const entryTokens = tokenizeText(`${entry.name} ${entry.tags} ${entry.aliases}`)
    if (exactName && entryName && entryName === exactName) score += 24
    if (exactName && entryAliases && entryAliases.split(/[,\s/|]+/).includes(exactName)) score += 20
    if (exactName && entryName && (entryName.includes(exactName) || exactName.includes(entryName))) score += 10
    for (const token of queryTokens) {
      if (entryTokens.includes(token)) score += 3
      if (entryAliases.includes(token)) score += 2
    }
    return score
  }

  async function getBackgroundFromAssetSources(name, prompt) {
    const entries = normalizeUrlSourceEntries(meetStore.assetSources?.backgroundUrls)
    if (entries.length === 0) return null

    const targetName = lower(name)
    const queryTokens = tokenizeText(`${name} ${prompt}`)
    const chosen = chooseBestByScore(entries, (entry) => {
      if (!entry.url && !entry.api) return -10000
      return scoreNamedEntry(entry, queryTokens, targetName)
    })
    if (!chosen) return null
    const url = await resolveSourceEntryUrl(chosen, {
      name: name || '',
      prompt: prompt || '',
      keyword: name || '',
      scene: name || ''
    }, 'image')
    return url || null
  }

  function getSpriteFromAssetSources(characterId, expression, vnName) {
    const entries = normalizeUrlSourceEntries(meetStore.assetSources?.spriteUrls)
    if (entries.length === 0) return null

    const cid = lower(characterId)
    const expr = normalizeExpression(expression)
    const nameTokens = tokenizeText(`${vnName || ''} ${characterId}`)

    const chosen = chooseBestByScore(entries, (entry) => {
      if (!entry.url && !entry.api) return -10000
      let score = scoreNamedEntry(entry, nameTokens, lower(vnName || ''))
      if (entry.characterId && lower(entry.characterId) === cid) score += 24
      if (entry.expression && normalizeExpression(entry.expression) === expr) score += 14
      if (entry.expression && normalizeExpression(entry.expression) === 'normal' && expr !== 'normal') score += 5
      return score
    })
    if (!chosen?.url) return null
    return normalizeMediaUrlForUse(chosen.url, 'image')
  }

  async function resolveSpriteFromAssetSources(characterId, expression, vnName, prompt) {
    const entries = normalizeUrlSourceEntries(meetStore.assetSources?.spriteUrls)
    if (entries.length === 0) return null
    const cid = lower(characterId)
    const expr = normalizeExpression(expression)
    const nameTokens = tokenizeText(`${vnName || ''} ${characterId}`)
    const chosen = chooseBestByScore(entries, (entry) => {
      if (!entry.url && !entry.api) return -10000
      let score = scoreNamedEntry(entry, nameTokens, lower(vnName || ''))
      if (entry.characterId && lower(entry.characterId) === cid) score += 24
      if (entry.expression && normalizeExpression(entry.expression) === expr) score += 14
      if (entry.expression && normalizeExpression(entry.expression) === 'normal' && expr !== 'normal') score += 5
      return score
    })
    if (!chosen) return null
    const url = await resolveSourceEntryUrl(chosen, {
      name: vnName || '',
      prompt: prompt || '',
      keyword: `${vnName || ''} ${expression || ''}`.trim(),
      characterId,
      expression: expr
    }, 'image')
    if (!url) return null
    return {
      url,
      characterId: normalizeText(chosen.characterId || ''),
      expression: normalizeExpression(chosen.expression || 'normal'),
      isExplicitExpression: !!normalizeText(chosen.expression || '')
    }
  }

  function collectAudioEntries(kind) {
    const meeting = meetStore.currentMeeting
    const map = meeting?.resources?.[kind] || {}
    const fromMeeting = Object.entries(map).map(([name, value], index) => ({
      id: `meeting_${kind}_${index}`,
      name,
      url: normalizeText(value?.url || ''),
      tags: normalizeText(value?.tags || value?.prompt || ''),
      aliases: normalizeText(value?.aliases || ''),
      api: /** @type {string | undefined} */ (undefined),
      source: 'meeting'
    }))

    const sourceField = kind === 'bgm' ? 'bgmUrls' : 'sfxUrls'
    const fromAsset = normalizeUrlSourceEntries(meetStore.assetSources?.[sourceField])
      .map((entry, index) => ({
        id: `asset_${kind}_${index}`,
        name: entry.name,
        url: entry.url,
        tags: entry.tags,
        aliases: entry.aliases,
        api: entry.api,
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
        responsePath: entry.responsePath,
        source: 'asset'
      }))
    return [...fromMeeting, ...fromAsset].filter(entry => !!entry.url || !!entry.api)
  }

  function scoreAudioEntry(entry, queryTokens, hintTokens, exactName = '') {
    const fullTokens = tokenizeText(`${entry.name} ${entry.tags} ${entry.aliases}`)
    let score = scoreNamedEntry(entry, queryTokens, exactName)
    for (const token of hintTokens) {
      if (fullTokens.includes(token)) score += 2
    }
    if (entry.source === 'meeting') score += 1
    return score
  }

  function selectAudioEntry(kind, name, context = {}) {
    const entries = collectAudioEntries(kind)
    if (entries.length === 0) return null
    const exactName = lower(name)
    const queryTokens = tokenizeText(name)
    const hintTokens = buildAudioHintTokens(
      name,
      context,
      kind === 'bgm' ? BGM_HINTS : SFX_HINTS
    )
    return chooseBestByScore(entries, (entry) => {
      if (!entry.url && !entry.api) return -10000
      return scoreAudioEntry(entry, queryTokens, hintTokens, exactName)
    })
  }

  async function resolveAudioFromSources(kind, name, context = {}) {
    const chosen = selectAudioEntry(kind, name, context)
    if (!chosen) return null
    const audioKind = 'audio'
    if (chosen.url && isLikelyMediaUrl(chosen.url, audioKind) && !chosen.api) {
      return normalizeMediaUrlForUse(chosen.url, audioKind)
    }
    const url = await resolveSourceEntryUrl(chosen, {
      name: name || '',
      prompt: normalizeText(context.text || ''),
      keyword: name || normalizeText(context.text || ''),
      scene: normalizeText(context.location || '')
    }, audioKind)
    return url || null
  }

  async function fetchSafebooruBackground(input) {
    const tags = buildSafebooruTags(input)
    if (!tags) return null

    const { safebooruProxy } = getAssetFlags()
    const encoded = encodeURIComponent(tags)
    const directUrl = `${SAFEBORU_API}${encoded}`
    const endpoints = []

    if (safebooruProxy) {
      endpoints.push(`${safebooruProxy}/${directUrl}`)
    }
    endpoints.push(`https://cors.isomorphic-git.org/${directUrl}`)
    endpoints.push(directUrl)

    let lastError = null
    for (const url of endpoints) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeoutMs = clampNumber(
        meetStore.assetSources?.safebooruTimeoutMs,
        2000,
        15000,
        DEFAULT_BACKGROUND_TIMEOUT_MS
      )
      const timer = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller?.signal
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const posts = extractSafebooruPosts(payload)
          .map(post => ({
            ...post,
            _score: scoreSafebooruPost(post)
          }))
          .filter(post => Number.isFinite(post._score))
          .sort((a, b) => b._score - a._score)

        if (posts.length === 0) continue

        const pool = posts.slice(0, Math.min(posts.length, 12))
        const picked = pool[Math.floor(Math.random() * pool.length)]
        const fileUrl = toAbsoluteSafebooruUrl(
          picked.file_url || picked.sample_url || picked.preview_url
        )
        if (fileUrl) return fileUrl
      } catch (error) {
        lastError = error
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    if (lastError && /** @type {any} */ (import.meta).env?.DEV) {
      console.warn('[MeetResources] Safebooru fetch failed:', lastError)
    }
    return null
  }

  function resolveBGM(name, context = {}) {
    const key = normalizeText(name)
    if (!key) return null
    if (isDirectUrl(key)) return normalizeMediaUrlForUse(key, 'audio')

    const exact = getMeetingBgmByName(key)
    if (exact?.url) return normalizeMediaUrlForUse(exact.url, 'audio')

    const chosen = selectAudioEntry('bgm', key, context)
    if (chosen?.url && !chosen.api) {
      return normalizeMediaUrlForUse(chosen.url, 'audio')
    }
    return null
  }

  async function resolveBGMAsync(name, context = {}) {
    const quick = resolveBGM(name, context)
    if (quick) return quick
    const fromSources = await resolveAudioFromSources('bgm', name, context)
    if (fromSources) return fromSources
    const fromJamendo = await jamendoBgm.resolveBGM(name, context)
    return fromJamendo?.url || null
  }

  async function pickAutoBGM(context = {}) {
    const chosen = selectAudioEntry('bgm', '', context)
    if (chosen) {
      return {
        name: normalizeText(chosen.name || ''),
        url: chosen.url && !chosen.api ? normalizeMediaUrlForUse(chosen.url, 'audio') : null
      }
    }

    const fromJamendo = await jamendoBgm.pickAutoBGM(context)
    if (!fromJamendo?.url) return null
    return {
      name: fromJamendo.url,
      url: fromJamendo.url
    }
  }

  function resolveSFX(name, context = {}) {
    const key = normalizeText(name)
    if (!key) return null
    if (isDirectUrl(key)) return normalizeMediaUrlForUse(key, 'audio')

    const exact = getMeetingSfxByName(key)
    if (exact?.url) return normalizeMediaUrlForUse(exact.url, 'audio')

    const chosen = selectAudioEntry('sfx', key, context)
    if (chosen?.url && !chosen.api) {
      return normalizeMediaUrlForUse(chosen.url, 'audio')
    }
    return null
  }

  async function resolveSFXAsync(name, context = {}) {
    const quick = resolveSFX(name, context)
    if (quick) return quick
    return await resolveAudioFromSources('sfx', name, context)
  }

  return {
    fetchSafebooruBackground,
    getBackgroundFromAssetSources,
    getSpriteFromAssetSources,
    pickAutoBGM,
    resolveBGM,
    resolveBGMAsync,
    resolveSFX,
    resolveSFXAsync,
    resolveSpriteFromAssetSources
  }
}

export {
  createMeetSourceResolver
}
