function normalizeText(value) {
  return String(value ?? '').trim()
}

function uniqueStrings(values = []) {
  const result = []
  const seen = new Set()
  values.forEach((value) => {
    const text = normalizeText(value)
    if (!text || seen.has(text)) return
    seen.add(text)
    result.push(text)
  })
  return result
}

export function normalizeStickerGroupIds(values = []) {
  if (!Array.isArray(values)) return []
  return uniqueStrings(values)
}

export function normalizeStickerKeywordList(values = []) {
  if (Array.isArray(values)) return uniqueStrings(values)
  if (typeof values === 'string') {
    return uniqueStrings(values.split(/[\n,，、|/\\]+/g))
  }
  return []
}

export function normalizeStickerGroup(group, index = 0) {
  if (!group || typeof group !== 'object') return null
  const id = normalizeText(group.id) || `sticker_group_${index}`
  const name = normalizeText(group.name)
  if (!name) return null
  return {
    id,
    name,
    description: normalizeText(group.description),
    createdAt: Number(group.createdAt) || Date.now(),
    updatedAt: Number(group.updatedAt) || Date.now()
  }
}

export function normalizeStickerGroups(groups = []) {
  if (!Array.isArray(groups)) return []
  const list = []
  const seen = new Set()
  groups.forEach((group, index) => {
    const normalized = normalizeStickerGroup(group, index)
    if (!normalized || seen.has(normalized.id)) return
    seen.add(normalized.id)
    list.push(normalized)
  })
  return list
}

export function normalizeSticker(sticker, index = 0, validGroupIds = null) {
  if (!sticker || typeof sticker !== 'object') return null
  const name = normalizeText(sticker.name)
  const url = normalizeText(sticker.url)
  const imageRef = normalizeText(sticker.imageRef)
  if (!name || (!url && !imageRef)) return null

  const groupIds = normalizeStickerGroupIds(sticker.groupIds).filter((id) => {
    if (!(validGroupIds instanceof Set) || validGroupIds.size === 0) return true
    return validGroupIds.has(id)
  })

  return {
    ...sticker,
    id: normalizeText(sticker.id) || `sticker_${index}`,
    name,
    url,
    imageRef,
    aliases: normalizeStickerKeywordList(sticker.aliases),
    keywords: normalizeStickerKeywordList(sticker.keywords),
    tags: normalizeStickerKeywordList(sticker.tags),
    searchText: normalizeText(sticker.searchText),
    source: normalizeText(sticker.source) || 'local',
    groupIds,
    createdAt: Number(sticker.createdAt) || Date.now(),
    updatedAt: Number(sticker.updatedAt) || Number(sticker.createdAt) || Date.now()
  }
}

export function normalizeStickers(stickers = [], groups = []) {
  if (!Array.isArray(stickers)) return []
  const validGroupIds = new Set(normalizeStickerGroups(groups).map(group => group.id))
  const list = []
  const seen = new Set()
  stickers.forEach((sticker, index) => {
    const normalized = normalizeSticker(sticker, index, validGroupIds)
    if (!normalized) return
    if (seen.has(normalized.id)) {
      normalized.id = `${normalized.id}_${index}`
    }
    seen.add(normalized.id)
    list.push(normalized)
  })
  return list
}

export function sanitizeStickerGroupSelection(values = [], groups = []) {
  const validGroupIds = new Set(normalizeStickerGroups(groups).map(group => group.id))
  return normalizeStickerGroupIds(values).filter(id => validGroupIds.has(id))
}

export function sameStickerGroupSelection(left = [], right = []) {
  const a = normalizeStickerGroupIds(left).slice().sort()
  const b = normalizeStickerGroupIds(right).slice().sort()
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export function filterStickersByGroupIds(stickers = [], selectedGroupIds = []) {
  const groupIds = normalizeStickerGroupIds(selectedGroupIds)
  if (groupIds.length === 0) return Array.isArray(stickers) ? stickers : []
  const selected = new Set(groupIds)
  return (Array.isArray(stickers) ? stickers : []).filter((sticker) => {
    const stickerGroupIds = normalizeStickerGroupIds(sticker?.groupIds)
    return stickerGroupIds.some(id => selected.has(id))
  })
}

export function getStickerGroupNameMap(groups = []) {
  const map = new Map()
  normalizeStickerGroups(groups).forEach((group) => {
    map.set(group.id, group.name)
  })
  return map
}

export function describeStickerGroups(groupIds = [], groups = []) {
  const nameMap = getStickerGroupNameMap(groups)
  return sanitizeStickerGroupSelection(groupIds, groups)
    .map(id => nameMap.get(id))
    .filter(Boolean)
}
