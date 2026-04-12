import { extractQuoteFromText } from './messageQuote'
import { normalizeSearchText } from './searchText'

export const MESSAGE_CONTENT_PART_PARSE_OPTIONS = Object.freeze({
  allowStickers: true,
  allowTransfer: true,
  allowGift: true,
  allowVoice: true,
  allowCall: true,
  allowMockImage: true,
  allowMusic: true,
  allowMeet: true,
  allowNarration: true
})

function normalizeInlineText(text) {
  return String(text ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBlockText(text) {
  return extractQuoteFromText(String(text ?? '')).cleanText
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function joinParts(parts) {
  return parts.map(part => normalizeInlineText(part)).filter(Boolean).join(' · ')
}

export function buildMessagePartSearchText(part) {
  if (!part || typeof part !== 'object') return ''

  if (part.type === 'sticker') {
    const name = normalizeSearchText(part.name)
    return name ? `表情包 ${name}` : '表情包'
  }
  if (part.type === 'transfer') {
    return normalizeSearchText(`转账 ${part.amount || ''} ${part.note || ''}`)
  }
  if (part.type === 'gift') {
    return normalizeSearchText(`礼物 ${part.item || ''} ${part.message || ''}`)
  }
  if (part.type === 'voice') {
    return normalizeSearchText(`语音 ${part.text || ''}`)
  }
  if (part.type === 'call') {
    return normalizeSearchText(part.callText || (part.callMode === 'video' ? '视频通话' : '语音通话'))
  }
  if (part.type === 'mockImage') {
    return normalizeSearchText(`相机 ${part.text || ''}`)
  }
  if (part.type === 'music') {
    return normalizeSearchText(`音乐 ${part.title || ''} ${part.artist || ''}`)
  }
  if (part.type === 'meet') {
    return normalizeSearchText(`邀约 ${part.location || ''} ${part.time || ''} ${part.note || ''}`)
  }

  return normalizeSearchText(part.content)
}

export function buildMessagePartSnippet(part) {
  if (!part || typeof part !== 'object') return ''

  if (part.type === 'sticker') {
    const name = normalizeInlineText(part.name)
    return name ? `[表情包: ${name}]` : '[表情包]'
  }
  if (part.type === 'voice') return '[语音]'
  if (part.type === 'transfer') return '[转账]'
  if (part.type === 'gift') return '[礼物]'
  if (part.type === 'meet') return '[邀约]'
  if (part.type === 'call') return '[通话]'
  if (part.type === 'music') return '[音乐]'
  if (part.type === 'mockImage') return '[相机]'

  return normalizeBlockText(part.content)
}

export function buildMessagePartDetailText(part) {
  if (!part || typeof part !== 'object') return ''

  if (part.type === 'sticker') {
    const name = normalizeInlineText(part.name)
    return name ? `[表情包: ${name}]` : '[表情包]'
  }
  if (part.type === 'voice') {
    const text = normalizeBlockText(part.text)
    return text ? `语音：${text}` : '[语音]'
  }
  if (part.type === 'transfer') {
    const text = joinParts([part.amount, part.note])
    return text ? `转账：${text}` : '[转账]'
  }
  if (part.type === 'gift') {
    const text = joinParts([part.item, part.message])
    return text ? `礼物：${text}` : '[礼物]'
  }
  if (part.type === 'meet') {
    const text = joinParts([part.location, part.time, part.note])
    return text ? `邀约：${text}` : '[邀约]'
  }
  if (part.type === 'call') {
    const text = normalizeBlockText(part.callText)
    return text || '[通话]'
  }
  if (part.type === 'music') {
    const text = joinParts([part.title, part.artist])
    return text ? `音乐：${text}` : '[音乐]'
  }
  if (part.type === 'mockImage') {
    const text = normalizeBlockText(part.text)
    return text ? `相机：${text}` : '[相机]'
  }

  return normalizeBlockText(part.content)
}