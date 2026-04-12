import { parseMessageContent, rebuildMessageContent } from '../features/chat'
import { formatBeijingLocale } from './beijingTime'
import { buildMessagePreview } from './contactMessageSummary'
import { resolveMessageImageUrl } from './mediaUrl'
import {
  FAVORITE_PART_WHOLE_MESSAGE,
  favoritePartIndexToKey,
  favoritePartKeyToIndex,
  getStoredFavoritePartIndexes,
  normalizeFavoritePartIndex
} from './messageFavorites'
import {
  MESSAGE_CONTENT_PART_PARSE_OPTIONS,
  buildMessagePartDetailText,
  buildMessagePartSnippet
} from './messageContentParts'

export const FAVORITE_KIND_MESSAGE = 'message'
export const FAVORITE_KIND_COLLECTION = 'collection'


function parseFavoriteContent(message) {
  const rawContent = String((message?.displayContent ?? message?.content) ?? '').trim()
  if (!rawContent) return []
  return parseMessageContent(rawContent, MESSAGE_CONTENT_PART_PARSE_OPTIONS)
}

const buildPartSnippet = buildMessagePartSnippet
const buildDetailPartText = buildMessagePartDetailText

function parseFavoritePart(message, partIndex) {
  const normalizedPartIndex = normalizeFavoritePartIndex(partIndex)
  if (normalizedPartIndex == null) return null

  const parts = parseFavoriteContent(message)
  const part = parts[normalizedPartIndex]
  if (!part || part.type === 'narration') return null
  return part
}

function resolveFavoriteAssistantContactId(contact, message) {
  if (!contact || !message || message.role === 'user') return ''

  const explicitContactId = String(message.contactId ?? '').trim()
  if (explicitContactId) return explicitContactId

  if (String(contact?.type || '').trim() !== 'group') {
    return String(contact?.id ?? '').trim()
  }

  const members = Array.isArray(contact.members) ? contact.members : []
  const senderId = String(message.senderId ?? '').trim()
  if (senderId) {
    const member = members.find(item => String(item?.id ?? '').trim() === senderId)
    const memberContactId = String(member?.contactId ?? '').trim()
    if (memberContactId) return memberContactId
  }

  const senderName = String(message.senderName ?? '').trim()
  if (senderName) {
    const member = members.find(item => String(item?.name ?? '').trim() === senderName)
    const memberContactId = String(member?.contactId ?? '').trim()
    if (memberContactId) return memberContactId
  }

  return ''
}

function buildFavoritePreviewMessage(contact, message, partIndex = null, previewKey = '') {
  if (!contact || !message || typeof message !== 'object') return null

  const sourceMsgId = String(message.id ?? '').trim()
  if (!sourceMsgId) return null

  const normalizedPartIndex = normalizeFavoritePartIndex(partIndex)
  const partKey = favoritePartIndexToKey(normalizedPartIndex)
  const suffix = String(previewKey || partKey).trim() || partKey
  const baseMessage = {
    ...message,
    id: `${sourceMsgId}::favorite::${suffix}`,
    sourceMsgId,
    contactId: message.role === 'user' ? '' : resolveFavoriteAssistantContactId(contact, message)
  }

  if (normalizedPartIndex == null) return baseMessage

  const targetPart = parseFavoritePart(message, normalizedPartIndex)
  if (!targetPart) return null

  const singlePartContent = rebuildMessageContent([targetPart])
  return {
    ...baseMessage,
    content: singlePartContent,
    displayContent: singlePartContent,
    replyTo: null,
    replyToText: null,
    isImage: false,
    isSticker: false,
    isCallRecord: false,
    isMockImage: false,
    isImageRendering: false,
    imageUrl: '',
    image: '',
    url: '',
    stickerName: '',
    callTranscript: [],
    callDuration: 0
  }
}

function normalizeFavoriteCollectionItems(items) {
  if (!Array.isArray(items)) return []

  const seen = new Set()
  const result = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const msgId = String(item.msgId ?? item.messageId ?? '').trim()
    if (!msgId) continue

    const partKey = favoritePartIndexToKey(
      Object.prototype.hasOwnProperty.call(item, 'partIndex')
        ? item.partIndex
        : favoritePartKeyToIndex(item.partKey ?? item.favoritePartKey ?? FAVORITE_PART_WHOLE_MESSAGE)
    )

    const key = `${msgId}:${partKey}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ msgId, partKey })
  }

  return result
}

function areFavoriteCollectionItemsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false
  if (left.length !== right.length) return false

  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index]
    const rightItem = right[index]
    if (!leftItem || !rightItem) return false
    if (leftItem.msgId !== rightItem.msgId) return false
    if (leftItem.partKey !== rightItem.partKey) return false
  }

  return true
}

export function getStoredFavoriteCollections(contact) {
  const rawCollections = Array.isArray(contact?.favoriteCollections) ? contact.favoriteCollections : []
  const seenIds = new Set()
  const results = []

  rawCollections.forEach((rawCollection, index) => {
    if (!rawCollection || typeof rawCollection !== 'object') return

    const id = String(rawCollection.id ?? `favorite_collection_${index}`).trim()
    if (!id || seenIds.has(id)) return

    const items = normalizeFavoriteCollectionItems(rawCollection.items)
    if (items.length === 0) return

    seenIds.add(id)
    results.push({
      id,
      createdAt: Math.max(0, Number(rawCollection.createdAt ?? rawCollection.time ?? 0) || 0),
      items
    })
  })

  return results
}

function findStoredFavoriteCollection(contact, favoriteId) {
  const favoriteKey = String(favoriteId ?? '').trim()
  if (!favoriteKey) return null
  return getStoredFavoriteCollections(contact).find(item => item.id === favoriteKey) || null
}

function buildFavoriteCollectionSnippet(entries) {
  const snippets = entries.map(entry => entry.snippet).filter(Boolean)
  if (snippets.length === 0) {
    return entries.length > 0 ? `已收藏 ${entries.length} 条气泡` : '收藏卡片'
  }

  const preview = snippets.slice(0, 2).join(' · ')
  if (entries.length > 2) return `${preview} 等${entries.length}条`
  return preview
}

function resolveFavoriteCollectionRole(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 'assistant'
  const firstRole = String(entries[0].role || '').trim() || 'assistant'
  return entries.every(entry => String(entry.role || '').trim() === firstRole)
    ? firstRole
    : 'mixed'
}

function resolveFavoriteCollectionEntries(contact, collection, options = {}) {
  const includePreviewMessages = options.includePreviewMessages === true
  const refs = normalizeFavoriteCollectionItems(collection?.items)
  if (!contact || refs.length === 0) return []

  const messages = Array.isArray(contact.msgs) ? contact.msgs : []
  const messageMap = new Map(
    messages
      .filter(message => message && typeof message === 'object')
      .map(message => [String(message.id ?? '').trim(), message])
  )

  const entries = []
  refs.forEach((ref, index) => {
    const message = messageMap.get(ref.msgId)
    if (!message) return

    const partIndex = favoritePartKeyToIndex(ref.partKey)
    const favoritePart = partIndex == null ? null : parseFavoritePart(message, partIndex)
    if (partIndex != null && !favoritePart) return

    const snippet = favoritePart
      ? (buildPartSnippet(favoritePart) || buildFavoriteSnippet(message))
      : buildFavoriteSnippet(message)
    const detailContent = favoritePart
      ? (buildDetailPartText(favoritePart) || snippet)
      : buildWholeMessageDetailContent(message)

    entries.push({
      msgId: String(message.id ?? '').trim(),
      role: message.role,
      time: Number(message.time || 0) || 0,
      partIndex,
      partKey: ref.partKey,
      snippet,
      detailContent,
      imageUrl: resolveMessageImageUrl(message),
      previewMessage: includePreviewMessages
        ? buildFavoritePreviewMessage(contact, message, partIndex, `${collection.id}:${index}:${ref.partKey}`)
        : null
    })
  })

  return includePreviewMessages
    ? entries.filter(entry => entry.previewMessage)
    : entries
}

export function formatFavoriteTime(time) {
  if (!time) return ''
  return formatBeijingLocale(new Date(time), {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function buildFavoriteSnippet(message) {
  return buildMessagePreview(message) || '收藏消息'
}

function buildWholeMessageDetailContent(message) {
  if (!message || typeof message !== 'object') return ''

  if (message.isSticker) {
    return buildMessagePartDetailText({ type: 'sticker', name: message.stickerName }) || '[表情包]'
  }
  if (message.isCallRecord) return '[通话]'

  const parts = parseFavoriteContent(message)
  if (parts.length === 0) return buildFavoriteSnippet(message)

  const detailBlocks = parts
    .map(buildDetailPartText)
    .filter(Boolean)

  return detailBlocks.join('\n\n') || buildFavoriteSnippet(message)
}

export function buildFavoriteDetailContent(message, partIndex = null) {
  const part = parseFavoritePart(message, partIndex)
  if (part) {
    return buildDetailPartText(part) || buildPartSnippet(part) || buildFavoriteSnippet(message)
  }
  return buildWholeMessageDetailContent(message)
}

export function buildFavoriteItem(contact, message, partIndex = null) {
  if (!contact || !message) return null

  const favoritePartIndex = normalizeFavoritePartIndex(partIndex)
  const favoritePartKey = favoritePartIndexToKey(favoritePartIndex)
  const favoritePart = parseFavoritePart(message, favoritePartIndex)
  const snippet = favoritePart
    ? (buildPartSnippet(favoritePart) || buildFavoriteSnippet(message))
    : buildFavoriteSnippet(message)

  return {
    kind: FAVORITE_KIND_MESSAGE,
    key: `${contact.id}:${message.id}:${favoritePartKey}`,
    msgId: message.id,
    anchorMsgId: message.id,
    anchorPartKey: favoritePartKey,
    favoriteId: '',
    contactId: contact.id,
    contactName: contact.name || 'Bot',
    contactAvatar: contact.avatar,
    contactAvatarType: contact.avatarType,
    role: message.role,
    favoritePartIndex,
    favoritePartKey,
    itemCount: 1,
    snippet,
    detailContent: favoritePart
      ? (buildDetailPartText(favoritePart) || snippet)
      : buildWholeMessageDetailContent(message),
    imageUrl: resolveMessageImageUrl(message),
    time: message.time,
    timeText: formatFavoriteTime(message.time)
  }
}

export function buildFavoriteCollectionItem(contact, collection) {
  if (!contact || !collection) return null

  const entries = resolveFavoriteCollectionEntries(contact, collection)
  if (entries.length === 0) return null

  const anchor = entries[0]
  const time = Math.max(0, Number(collection.createdAt || 0) || anchor.time || 0)

  return {
    kind: FAVORITE_KIND_COLLECTION,
    key: `collection:${contact.id}:${collection.id}`,
    msgId: anchor.msgId,
    anchorMsgId: anchor.msgId,
    anchorPartKey: anchor.partKey,
    favoriteId: collection.id,
    contactId: contact.id,
    contactName: contact.name || 'Bot',
    contactAvatar: contact.avatar,
    contactAvatarType: contact.avatarType,
    role: resolveFavoriteCollectionRole(entries),
    favoritePartIndex: null,
    favoritePartKey: anchor.partKey,
    itemCount: entries.length,
    snippet: buildFavoriteCollectionSnippet(entries),
    detailContent: entries.map(entry => entry.detailContent).filter(Boolean).join('\n\n'),
    imageUrl: entries.length === 1 ? entries[0].imageUrl : '',
    time,
    timeText: formatFavoriteTime(time)
  }
}

export function addFavoriteCollection(contact, items, options = {}) {
  if (!contact || typeof contact !== 'object') {
    return { created: false, duplicate: false, collection: null }
  }

  const normalizedItems = normalizeFavoriteCollectionItems(items)
  if (normalizedItems.length === 0) {
    return { created: false, duplicate: false, collection: null }
  }

  const duplicate = getStoredFavoriteCollections(contact)
    .find(collection => areFavoriteCollectionItemsEqual(collection.items, normalizedItems)) || null
  if (duplicate) {
    return { created: false, duplicate: true, collection: duplicate }
  }

  const nextCollection = {
    id: String(options.id ?? '').trim() || `favorite_collection_${Date.now()}`,
    createdAt: Math.max(0, Number(options.createdAt ?? Date.now()) || Date.now()),
    items: normalizedItems
  }

  const nextCollections = Array.isArray(contact.favoriteCollections)
    ? contact.favoriteCollections.filter(Boolean)
    : []
  nextCollections.unshift(nextCollection)
  contact.favoriteCollections = nextCollections

  return {
    created: true,
    duplicate: false,
    collection: nextCollection
  }
}

export function removeFavoriteCollection(contact, favoriteId) {
  if (!contact || typeof contact !== 'object') return false

  const favoriteKey = String(favoriteId ?? '').trim()
  if (!favoriteKey) return false

  const currentCollections = Array.isArray(contact.favoriteCollections) ? contact.favoriteCollections : []
  const nextCollections = currentCollections.filter(
    item => String(item?.id ?? '').trim() !== favoriteKey
  )

  if (nextCollections.length === currentCollections.length) return false
  contact.favoriteCollections = nextCollections
  return true
}

export function collectFavorites(contacts) {
  const results = []
  if (!Array.isArray(contacts)) return results

  for (const contact of contacts) {
    if (Array.isArray(contact?.msgs)) {
      for (const message of contact.msgs) {
        const favoritePartIndexes = getStoredFavoritePartIndexes(message)
        favoritePartIndexes.forEach((partIndex) => {
          const item = buildFavoriteItem(contact, message, partIndex)
          if (item) results.push(item)
        })
      }
    }

    const collections = getStoredFavoriteCollections(contact)
    collections.forEach((collection) => {
      const item = buildFavoriteCollectionItem(contact, collection)
      if (item) results.push(item)
    })
  }

  results.sort((a, b) => (b.time || 0) - (a.time || 0))
  return results
}

export function findFavorite(contacts, contactId, msgId, favoritePartKey = FAVORITE_PART_WHOLE_MESSAGE) {
  if (!Array.isArray(contacts)) return null
  const contactKey = String(contactId ?? '').trim()
  const msgKey = String(msgId ?? '').trim()
  const targetPartIndex = favoritePartKeyToIndex(favoritePartKey)
  const targetPartKey = favoritePartIndexToKey(targetPartIndex)
  if (!contactKey || !msgKey) return null

  const contact = contacts.find(item => String(item?.id ?? '') === contactKey)
  if (!contact || !Array.isArray(contact.msgs)) return null

  const message = contact.msgs.find(item => String(item?.id ?? '') === msgKey)
  const favoritePartIndexes = getStoredFavoritePartIndexes(message)
  if (!favoritePartIndexes.some((partIndex) => favoritePartIndexToKey(partIndex) === targetPartKey)) return null

  return buildFavoriteItem(contact, message, targetPartIndex)
}

export function resolveFavoriteDetailData(contacts, options = {}) {
  if (!Array.isArray(contacts)) {
    return { favorite: null, previewMessages: [] }
  }

  const contactKey = String(options.contactId ?? '').trim()
  if (!contactKey) {
    return { favorite: null, previewMessages: [] }
  }

  const contact = contacts.find(item => String(item?.id ?? '') === contactKey)
  if (!contact) {
    return { favorite: null, previewMessages: [] }
  }

  const kind = String(options.kind ?? FAVORITE_KIND_MESSAGE).trim().toLowerCase()
  if (kind === FAVORITE_KIND_COLLECTION) {
    const collection = findStoredFavoriteCollection(contact, options.favoriteId)
    if (!collection) {
      return { favorite: null, previewMessages: [] }
    }

    const favorite = buildFavoriteCollectionItem(contact, collection)
    if (!favorite) {
      return { favorite: null, previewMessages: [] }
    }

    const previewMessages = resolveFavoriteCollectionEntries(contact, collection, { includePreviewMessages: true })
      .map(entry => entry.previewMessage)
      .filter(Boolean)

    return { favorite, previewMessages }
  }

  const favorite = findFavorite(contacts, contactKey, options.msgId, options.favoritePartKey)
  if (!favorite) {
    return { favorite: null, previewMessages: [] }
  }

  const messages = Array.isArray(contact.msgs) ? contact.msgs : []
  const message = messages.find(item => String(item?.id ?? '') === String(options.msgId ?? '').trim()) || null
  const previewMessage = buildFavoritePreviewMessage(
    contact,
    message,
    favoritePartKeyToIndex(favorite.favoritePartKey),
    favorite.favoritePartKey
  )

  return {
    favorite,
    previewMessages: previewMessage ? [previewMessage] : []
  }
}
