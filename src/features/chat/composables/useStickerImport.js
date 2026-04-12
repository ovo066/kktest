import {
  normalizeStickerGroupIds,
  sameStickerGroupSelection
} from '../../../utils/stickerGroups'

const STICKER_IMPORT_NAME_KEYS = ['name', 'label', 'tag', 'title', 'keyword', 'keywords', '关键词', '关键字', '标签']
const STICKER_IMPORT_URL_KEYS = ['url', 'imageUrl', 'image', 'img', 'src', 'link', 'uri']
const STICKER_IMPORT_GROUP_KEYS = ['group', 'groups', 'folder', 'category', 'groupName', 'groupNames', '分组', '分类']
const STICKER_URL_TOKEN_REGEX = /(https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+|www\.[^\s"'<>]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+|blob:[^\s"'<>]+|[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s"'<>]*)?)/i

function normalizeStickerLookupKey(name) {
  return String(name ?? '').trim().toLowerCase()
}

function normalizeStickerGroupLookupKey(name) {
  return String(name ?? '').trim().toLowerCase()
}

function normalizeImportedStickerName(value) {
  return String(value ?? '')
    .trim()
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function guessStickerNameFromFile(file) {
  const fileName = String(file?.name || '').trim()
  if (!fileName) return ''
  return normalizeImportedStickerName(fileName.replace(/\.[^.]+$/, ''))
}

function makeUniqueStickerName(baseName, usedKeys = new Set()) {
  const normalizedBase = normalizeImportedStickerName(baseName) || '贴纸'
  let candidate = normalizedBase
  let suffix = 2
  let key = normalizeStickerLookupKey(candidate)

  while (!key || usedKeys.has(key)) {
    candidate = `${normalizedBase} ${suffix}`
    key = normalizeStickerLookupKey(candidate)
    suffix += 1
  }

  usedKeys.add(key)
  return candidate
}

function looksLikeStickerUrl(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return false
  return /^(?:https?:\/\/|\/\/|www\.|data:image\/|blob:)/i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(text)
}

function normalizeImportedStickerUrl(raw) {
  let text = String(raw ?? '').trim()
  if (!text) return ''

  text = text
    .replace(/^url\s*[:：]?\s*/i, '')
    .replace(/^["'“”‘’「」『』<\[(（【]+/, '')
    .replace(/["'“”‘’「」『』>\])）】]+$/, '')
    .replace(/[，；;,]+$/, '')
    .replace(/^([a-z]+)：\/\//i, '$1://')
    .trim()

  if (!text) return ''
  if (/^\/\//.test(text)) text = `https:${text}`
  if (/^www\./i.test(text)) text = `https://${text}`
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(text)) text = `https://${text}`

  if (/^(?:https?:\/\/|data:image\/|blob:)/i.test(text)) return text
  return ''
}

function guessStickerNameFromUrl(url) {
  if (!url || /^data:|^blob:/i.test(url)) return ''
  let filename = ''

  try {
    const normalized = /^\/\//.test(url) ? `https:${url}` : url
    const parsed = new URL(normalized)
    filename = decodeURIComponent(String(parsed.pathname || '').split('/').pop() || '')
  } catch {
    const cleaned = String(url).split(/[?#]/)[0]
    filename = decodeURIComponent(cleaned.split('/').pop() || '')
  }

  return normalizeImportedStickerName(filename.replace(/\.[a-z0-9]{2,8}$/i, ''))
}

function normalizeImportedGroupNames(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value
      .map(item => normalizeImportedStickerName(item))
      .filter(Boolean)))
  }

  return Array.from(new Set(
    String(value ?? '')
      .split(/[\n,，、]+/g)
      .map(item => normalizeImportedStickerName(item))
      .filter(Boolean)
  ))
}

function extractNameAndGroups(rawName) {
  let name = normalizeImportedStickerName(rawName)
  const groupNames = []
  if (!name) return { name: '', groupNames }

  const bracketMatch = name.match(/^(?:\[([^\]]+)\]|【([^】]+)】)\s*(.+)$/)
  if (bracketMatch) {
    const rawGroup = bracketMatch[1] || bracketMatch[2] || ''
    groupNames.push(...normalizeImportedGroupNames(rawGroup))
    name = normalizeImportedStickerName(bracketMatch[3])
  }

  const prefixMatch = name.match(/^([^/:：｜|]{1,24})\s*[\/:：｜|]\s*(.+)$/)
  if (prefixMatch) {
    const maybeGroups = normalizeImportedGroupNames(prefixMatch[1])
    const restName = normalizeImportedStickerName(prefixMatch[2])
    if (maybeGroups.length > 0 && restName) {
      groupNames.push(...maybeGroups)
      name = restName
    }
  }

  return {
    name,
    groupNames: Array.from(new Set(groupNames))
  }
}

function appendStickerCandidate(list, rawName, rawUrl, rawGroups = []) {
  const url = normalizeImportedStickerUrl(rawUrl)
  if (!url) return false

  const parsed = extractNameAndGroups(rawName)
  const name = parsed.name || guessStickerNameFromUrl(url)
  if (!name) return false

  list.push({
    name,
    url,
    groupNames: Array.from(new Set([
      ...parsed.groupNames,
      ...normalizeImportedGroupNames(rawGroups)
    ]))
  })
  return true
}

function parseStickerLine(line) {
  const text = String(line ?? '').trim()
  if (!text) return null

  const match = text.match(STICKER_URL_TOKEN_REGEX)
  if (!match?.[1]) return null

  const rawUrl = match[1].trim()
  const before = text.slice(0, match.index).replace(/[：:|\-\s]+$/g, '').trim()
  const after = text.slice((match.index || 0) + rawUrl.length).replace(/^[|：:\-\s]+/g, '').trim()
  const rawName = before || after || guessStickerNameFromUrl(rawUrl)
  const rawGroups = before && after ? after : []
  return rawName ? { name: rawName, url: rawUrl, groups: rawGroups } : null
}

function pickStickerField(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function pickStickerValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (typeof value === 'string' && value.trim()) return value
    if (Array.isArray(value) && value.length > 0) return value
  }
  return null
}

function collectStickersFromJsonValue(value, list, depth = 0) {
  if (depth > 5 || value == null) return

  if (typeof value === 'string') {
    const parsedLine = parseStickerLine(value)
    if (parsedLine) appendStickerCandidate(list, parsedLine.name, parsedLine.url, parsedLine.groups)
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectStickersFromJsonValue(item, list, depth + 1))
    return
  }

  if (typeof value !== 'object') return

  const nameFromField = pickStickerField(value, STICKER_IMPORT_NAME_KEYS)
  const urlFromField = pickStickerField(value, STICKER_IMPORT_URL_KEYS)
  const groupsFromField = pickStickerValue(value, STICKER_IMPORT_GROUP_KEYS)
  if (urlFromField) {
    appendStickerCandidate(list, nameFromField, urlFromField, groupsFromField)
  } else {
    for (const fieldValue of Object.values(value)) {
      if (typeof fieldValue === 'string' && looksLikeStickerUrl(fieldValue)) {
        appendStickerCandidate(list, nameFromField, fieldValue, groupsFromField)
        break
      }
    }
  }

  Object.values(value).forEach((child) => {
    if (Array.isArray(child) || (child && typeof child === 'object')) {
      collectStickersFromJsonValue(child, list, depth + 1)
    }
  })
}

export function parseStickerImportEntries(text) {
  const raw = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!raw) return []

  const entries = []
  let parsedJson = false

  if (/^[\[{]/.test(raw)) {
    try {
      const parsed = JSON.parse(raw)
      collectStickersFromJsonValue(parsed, entries)
      parsedJson = true
    } catch {
      parsedJson = false
    }
  }

  if (!parsedJson || entries.length === 0) {
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return

      if (/^[\[{]/.test(trimmed)) {
        try {
          const parsed = JSON.parse(trimmed)
          collectStickersFromJsonValue(parsed, entries)
          return
        } catch {
          // ignore invalid single-line json, fallback to text parsing below
        }
      }

      const parsedLine = parseStickerLine(trimmed)
      if (parsedLine) appendStickerCandidate(entries, parsedLine.name, parsedLine.url, parsedLine.groups)
    })
  }

  return entries
}

function ensureImportedStickerGroups(store, makeId, groupNames = []) {
  if (!Array.isArray(store.stickerGroups)) {
    store.stickerGroups = []
  }

  const existingByKey = new Map()
  store.stickerGroups.forEach((group) => {
    const key = normalizeStickerGroupLookupKey(group?.name)
    if (key) existingByKey.set(key, group)
  })

  const ids = []
  let added = 0
  normalizeImportedGroupNames(groupNames).forEach((groupName) => {
    const key = normalizeStickerGroupLookupKey(groupName)
    if (!key) return

    let group = existingByKey.get(key)
    if (!group) {
      group = {
        id: makeId('sticker_group'),
        name: groupName,
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      store.stickerGroups.push(group)
      existingByKey.set(key, group)
      added += 1
    }
    ids.push(group.id)
  })

  return {
    ids: Array.from(new Set(ids)),
    added
  }
}

function applyImportedStickers(store, entries, makeId, options = {}) {
  if (!Array.isArray(store.stickers)) {
    store.stickers = []
  }

  const defaultGroupIds = normalizeStickerGroupIds(options.defaultGroupIds)

  const nameToIndex = new Map()
  store.stickers.forEach((sticker, index) => {
    const key = normalizeStickerLookupKey(sticker?.name)
    if (key) nameToIndex.set(key, index)
  })

  const latestByName = new Map()
  entries.forEach(entry => {
    const key = normalizeStickerLookupKey(entry?.name)
    if (!key) return
    latestByName.set(key, entry)
  })

  let added = 0
  let updated = 0
  let skipped = Math.max(0, entries.length - latestByName.size)
  const now = Date.now()
  let groupsAdded = 0

  latestByName.forEach((entry, key) => {
    const groupResult = ensureImportedStickerGroups(store, makeId, entry?.groupNames || [])
    groupsAdded += groupResult.added

    const importedGroupIds = groupResult.ids.length > 0
      ? groupResult.ids
      : defaultGroupIds
    const existingIdx = nameToIndex.get(key)
    if (existingIdx == null) {
      store.stickers.push({
        id: makeId('sticker'),
        name: entry.name,
        url: entry.url,
        source: 'remote',
        aliases: [],
        keywords: [],
        groupIds: importedGroupIds,
        createdAt: now,
        updatedAt: now
      })
      nameToIndex.set(key, store.stickers.length - 1)
      added += 1
      return
    }

    const current = store.stickers[existingIdx] || {}
    const nextGroupIds = importedGroupIds.length > 0
      ? importedGroupIds
      : (Array.isArray(current.groupIds) ? current.groupIds : [])

    if (String(current.url || '').trim() === entry.url && sameStickerGroupSelection(current.groupIds, nextGroupIds)) {
      skipped += 1
      return
    }

    store.stickers[existingIdx] = {
      ...current,
      name: entry.name,
      url: entry.url,
      source: 'remote',
      groupIds: nextGroupIds,
      updatedAt: now
    }
    updated += 1
  })

  return { added, updated, skipped, groupsAdded }
}

export function useStickerImport({
  store,
  makeId,
  compressImage,
  showToast,
  scheduleSave
}) {
  async function importLocalStickerFiles(files = [], options = {}) {
    if (!Array.isArray(store.stickers)) {
      store.stickers = []
    }

    const fileList = Array.from(files).filter(Boolean)
    if (fileList.length === 0) return false
    const defaultGroupIds = normalizeStickerGroupIds(options.defaultGroupIds)

    const usedKeys = new Set(
      (store.stickers || [])
        .map(sticker => normalizeStickerLookupKey(sticker?.name))
        .filter(Boolean)
    )

    let added = 0
    let skipped = 0

    for (const file of fileList) {
      try {
        const url = await compressImage(file, 200)
        if (!url) {
          skipped += 1
          continue
        }

        const name = makeUniqueStickerName(guessStickerNameFromFile(file), usedKeys)
        const now = Date.now()
        store.stickers.push({
          id: makeId('sticker'),
          name,
          url,
          source: 'local',
          aliases: [],
          keywords: [],
          groupIds: [...defaultGroupIds],
          createdAt: now,
          updatedAt: now
        })
        added += 1
      } catch (err) {
        console.warn('Failed to import sticker:', file?.name, err)
        skipped += 1
      }
    }

    if (added <= 0) {
      showToast('未导入成功')
      return false
    }

    scheduleSave()
    const parts = [`已导入 ${added} 张贴纸`]
    if (skipped > 0) parts.push(`跳过 ${skipped} 张`)
    showToast(parts.join('，'))
    return true
  }

  function runStickerBatchImport(rawText, options = {}) {
    const text = String(rawText ?? '').trim()
    if (!text) {
      showToast('请输入内容')
      return false
    }

    const entries = parseStickerImportEntries(text)
    if (entries.length === 0) {
      showToast('未识别到可导入贴纸，支持 JSON / 标签:URL / 标签 URL')
      return false
    }

    const { added, updated, skipped, groupsAdded } = applyImportedStickers(store, entries, makeId, options)
    if (added + updated <= 0) {
      showToast('没有可导入的新贴纸（可能已存在）')
      return false
    }

    scheduleSave()
    const parts = []
    if (added > 0) parts.push(`新增 ${added}`)
    if (updated > 0) parts.push(`更新 ${updated}`)
    if (groupsAdded > 0) parts.push(`新建分组 ${groupsAdded}`)
    if (skipped > 0) parts.push(`跳过 ${skipped}`)
    showToast('导入完成：' + parts.join('，'))
    return true
  }

  async function readStickerBatchFileText(file) {
    if (!file) return null

    const lowerName = String(file.name || '').toLowerCase()
    if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.json')) {
      showToast('仅支持 .txt 或 .json 文件')
      return null
    }

    try {
      const content = await file.text()
      if (!String(content || '').trim()) {
        showToast('文件内容为空')
        return null
      }
      return content
    } catch (err) {
      console.warn('Failed to read sticker import file:', err)
      showToast('读取文件失败')
      return null
    }
  }

  return {
    guessStickerNameFromFile,
    importLocalStickerFiles,
    runStickerBatchImport,
    readStickerBatchFileText
  }
}
