import { parseMessageContent } from '../features/chat'
import { extractQuoteFromText } from './messageQuote'

function normalizePreviewText(text) {
  return String(text || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripQuoteLines(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^\[quote:[^\]]*]$/i.test(line))
    .join(' ')
}

export function getLastVisibleMessage(contact) {
  const msgs = Array.isArray(contact?.msgs) ? contact.msgs : []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const msg = msgs[i]
    if (msg && !msg.hideInChat && !msg.hidden) return msg
  }
  return null
}

function normalizeTextPreview(text) {
  const cleanText = extractQuoteFromText(String(text ?? '')).cleanText
  return normalizePreviewText(
    stripQuoteLines(cleanText)
      .replace(/\[emotion:[^\]]+]\(voice:[^)]+\)/gi, '[语音]')
      .replace(/\(voice:[^)]+\)/gi, '[语音]')
      .replace(/\(image:[^)]+\)/gi, '[图片]')
      .replace(/\(sticker:[^)]+\)/gi, '[表情包]')
      .replace(/\(music:[^)]+\)/gi, '[音乐]')
      .replace(/\(call:[^)]+\)/gi, '[通话]')
      .replace(/\(gift:[^)]+\)/gi, '[礼物]')
      .replace(/\(transfer:[^)]+\)/gi, '[转账]')
      .replace(/\*([^*]+)\*/g, '$1')
  )
}

function getLastPreviewablePart(rawContent) {
  const parts = parseMessageContent(rawContent, {
    allowStickers: true,
    allowTransfer: true,
    allowGift: true,
    allowVoice: true,
    allowCall: true,
    allowMockImage: true,
    allowMusic: true,
    allowNarration: true
  })
  if (!Array.isArray(parts) || parts.length === 0) return null
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
    if (part?.type !== 'narration') return part
  }
  return parts[parts.length - 1] || null
}

export function buildMessagePreview(message) {
  if (!message || typeof message !== 'object') return ''
  if (message.isMockImage) return '[相机]'
  if (message.isImage || message.imageUrl) return '[图片]'
  if (message.isSticker) {
    const name = normalizePreviewText(message.stickerName)
    return name ? `[表情包: ${name}]` : '[表情包]'
  }
  if (message.isCallRecord) return '[通话]'

  const rawContent = String((message.displayContent ?? message.content) ?? '').trim()
  if (!rawContent) return ''
  const part = getLastPreviewablePart(rawContent)
  if (!part) {
    return normalizeTextPreview(rawContent) || normalizePreviewText(rawContent)
  }

  if (part.type === 'sticker') {
    const name = normalizePreviewText(part.name)
    return name ? `[表情包: ${name}]` : '[表情包]'
  }
  if (part.type === 'voice') return '[语音]'
  if (part.type === 'call') return '[通话]'
  if (part.type === 'gift') return '[礼物]'
  if (part.type === 'transfer') return '[转账]'
  if (part.type === 'music') return '[音乐]'
  if (part.type === 'mockImage') return '[相机]'

  const preview = normalizeTextPreview(part.content ?? rawContent)
  return preview || normalizeTextPreview(rawContent) || normalizePreviewText(rawContent)
}

export function readCachedContactMessageSummary(contact) {
  return {
    lastVisibleMessage: null,
    lastMsgId: contact?.lastMsgId || null,
    lastMsgPreview: normalizePreviewText(contact?.lastMsgPreview || ''),
    lastMsgSenderName: normalizePreviewText(contact?.lastMsgSenderName || ''),
    lastMsgTime: Number(contact?.lastMsgTime || 0) || 0,
    msgCount: Math.max(0, Number(contact?.msgCount || 0) || 0)
  }
}

export function buildContactMessageSummary(contact) {
  const cached = readCachedContactMessageSummary(contact)
  const msgCount = Array.isArray(contact?.msgs)
    ? contact.msgs.length
    : cached.msgCount
  const lastVisibleMessage = getLastVisibleMessage(contact)

  if (!lastVisibleMessage) {
    return {
      ...cached,
      msgCount
    }
  }

  return {
    lastVisibleMessage,
    lastMsgId: lastVisibleMessage.id ?? null,
    lastMsgPreview: buildMessagePreview(lastVisibleMessage),
    lastMsgSenderName: normalizePreviewText(lastVisibleMessage.senderName || ''),
    lastMsgTime: Number(lastVisibleMessage.time || 0) || 0,
    msgCount
  }
}

export function refreshContactMessageSummary(contact, options = {}) {
  if (!contact || typeof contact !== 'object') {
    return buildContactMessageSummary(contact)
  }

  const forceRescan = options?.forceRescan === true
  const msgs = Array.isArray(contact.msgs) ? contact.msgs : []
  const cached = readCachedContactMessageSummary(contact)
  let summary = null

  if (forceRescan) {
    summary = buildContactMessageSummary(contact)
  } else if (msgs.length === 0) {
    summary = {
      ...cached,
      lastVisibleMessage: null,
      lastMsgId: null,
      lastMsgPreview: '',
      lastMsgSenderName: '',
      lastMsgTime: 0,
      msgCount: 0
    }
  } else {
    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg && !lastMsg.hideInChat && !lastMsg.hidden) {
      summary = {
        lastVisibleMessage: lastMsg,
        lastMsgId: lastMsg.id ?? null,
        lastMsgPreview: buildMessagePreview(lastMsg),
        lastMsgSenderName: normalizePreviewText(lastMsg.senderName || ''),
        lastMsgTime: Number(lastMsg.time || 0) || 0,
        msgCount: msgs.length
      }
    } else {
      summary = buildContactMessageSummary(contact)
    }
  }

  contact.lastMsgId = summary.lastMsgId
  contact.lastMsgPreview = summary.lastMsgPreview
  contact.lastMsgSenderName = summary.lastMsgSenderName
  contact.lastMsgTime = summary.lastMsgTime
  contact.msgCount = summary.msgCount
  return summary
}

export function applyContactMessageSummary(contact) {
  return refreshContactMessageSummary(contact, { forceRescan: true })
}

