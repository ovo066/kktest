// @ts-check

import { lower, normalizeExpression, normalizeText } from './utils'

function findNamedResource(map, name) {
  if (!name) return null
  if (map?.[name]) return map[name]
  const target = lower(name)
  for (const [key, value] of Object.entries(map || {})) {
    if (lower(key) === target) return value
  }
  return null
}

function createMeetResourceStore(deps) {
  const {
    characterResourcesStore,
    contactsStore,
    meetStore,
    normalizeMediaUrlForUse
  } = deps

  function getMeetingResourceByName(type, name) {
    const meeting = meetStore.currentMeeting
    const map = meeting?.resources?.[type] || {}
    return findNamedResource(map, name)
  }

  function resolveSpriteResource(characterId, expression = 'normal') {
    if (!characterId) return null
    const expr = normalizeExpression(expression)
    const key = `${characterId}_${expr}`
    const exact = meetStore.getResource('sprites', key)
    if (exact?.url) return exact.url
    if (expr !== 'normal') {
      const normal = meetStore.getResource('sprites', `${characterId}_normal`)
      if (normal?.url) return normal.url
    }
    const base = meetStore.getResource('sprites', `${characterId}_baseImage`)
    return base?.url || null
  }

  function resolveExactSpriteResource(characterId, expression = 'normal') {
    const cid = normalizeText(characterId)
    if (!cid) return null
    const expr = normalizeExpression(expression)
    const exact = meetStore.getResource('sprites', `${cid}_${expr}`)
    return exact?.url || null
  }

  function persistBackground(name, url, extra = {}) {
    const sceneName = normalizeText(name)
    const normalizedUrl = normalizeMediaUrlForUse(url, 'image')
    if (!sceneName || !normalizedUrl) return
    meetStore.setResource('backgrounds', sceneName, {
      url: normalizedUrl,
      ...extra
    })
  }

  function persistCg(name, url, extra = {}) {
    const cgName = normalizeText(name)
    const normalizedUrl = normalizeMediaUrlForUse(url, 'image')
    if (!cgName || !normalizedUrl) return
    meetStore.setResource('cgs', cgName, {
      url: normalizedUrl,
      ...extra
    })
  }

  function persistSprite(characterId, expression, url, extra = {}) {
    const cid = normalizeText(characterId)
    const expr = normalizeExpression(expression)
    const normalizedUrl = normalizeMediaUrlForUse(url, 'image')
    if (!cid || !normalizedUrl) return

    meetStore.setResource('sprites', `${cid}_${expr}`, {
      url: normalizedUrl,
      expression: expr,
      ...extra
    })
    if (expr === 'normal') {
      meetStore.setResource('sprites', `${cid}_baseImage`, {
        url: normalizedUrl,
        expression: expr,
        ...extra
      })
    }

    const contactExists = (contactsStore.contacts || []).some(contact => contact?.id === cid)
    if (!contactExists) return

    if (expr === 'normal') {
      characterResourcesStore.setBaseImage(cid, {
        url: normalizedUrl,
        seed: null,
        params: { source: 'meet' }
      })
      return
    }

    characterResourcesStore.setExpression(cid, expr, {
      url: normalizedUrl,
      seed: null,
      params: { source: 'meet' },
      method: 'meet_realtime'
    })
  }

  return {
    getMeetingBackgroundByName(name) {
      return getMeetingResourceByName('backgrounds', name)
    },
    getMeetingCgByName(name) {
      return getMeetingResourceByName('cgs', name)
    },
    getMeetingBgmByName(name) {
      return getMeetingResourceByName('bgm', name)
    },
    getMeetingSfxByName(name) {
      return getMeetingResourceByName('sfx', name)
    },
    persistBackground,
    persistCg,
    persistSprite,
    resolveExactSpriteResource,
    resolveSpriteResource
  }
}

export {
  createMeetResourceStore,
  findNamedResource
}
