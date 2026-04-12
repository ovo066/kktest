import { parseMessageContent } from './messageParser/contentParts'

const INTERACTIVE_PART_TYPES = new Set(['transfer', 'gift', 'meet'])
const VALID_INTERACTION_STATUSES = new Set(['pending', 'accepted', 'rejected'])
const DECISION_TOKEN_REGEX = /(?:\(|（|\[|【)\s*(accept|reject)\s*[:：]\s*(transfer|gift|meet)\s*(?:\)|）|\]|】)/gi

function getInteractionParseOptions() {
  return {
    allowStickers: false,
    allowTransfer: true,
    allowGift: true,
    allowVoice: false,
    allowCall: false,
    allowMockImage: false,
    allowMusic: false,
    allowMeet: true,
    allowNarration: true
  }
}

export function normalizeInteractionStatus(status, fallback = 'pending') {
  const normalized = String(status || '').trim().toLowerCase()
  if (VALID_INTERACTION_STATUSES.has(normalized)) return normalized
  const nextFallback = String(fallback || '').trim().toLowerCase()
  return VALID_INTERACTION_STATUSES.has(nextFallback) ? nextFallback : ''
}

export function getInteractiveParts(messageOrContent) {
  const raw = typeof messageOrContent === 'string'
    ? messageOrContent
    : (messageOrContent?.content ?? '')
  const parts = parseMessageContent(String(raw || ''), getInteractionParseOptions())
  return parts
    .map((part, partIndex) => ({ ...part, partIndex }))
    .filter(part => INTERACTIVE_PART_TYPES.has(part?.type))
}

export function getInteractivePart(messageOrContent, partIndex = null) {
  const parts = getInteractiveParts(messageOrContent)
  if (!parts.length) return null
  if (partIndex == null || partIndex === '') return parts[0]
  const key = Number(partIndex)
  return parts.find(part => part.partIndex === key) || null
}

export function getPrimaryInteractivePart(messageOrContent) {
  return getInteractivePart(messageOrContent, null)
}

export function getInteractionState(message, partIndex, fallback = 'pending') {
  const key = String(partIndex ?? '')
  const interactiveParts = getInteractiveParts(message)
  const explicit = (message?.interactionStates && key in message.interactionStates)
    ? message.interactionStates[key]
    : null

  if (explicit && typeof explicit === 'object') {
    const explicitStatus = normalizeInteractionStatus(explicit.status, '')
    if (explicitStatus) {
      return {
        status: explicitStatus,
        respondedAt: explicit.respondedAt ?? null
      }
    }
  }

  const legacyStatus = normalizeInteractionStatus(message?.interactionStatus, '')
  if (legacyStatus && interactiveParts.length <= 1) {
    return {
      status: legacyStatus,
      respondedAt: message?.interactionRespondedAt ?? null
    }
  }

  return {
    status: normalizeInteractionStatus('', fallback),
    respondedAt: null
  }
}

export function setInteractionState(message, partIndex, status, respondedAt = Date.now()) {
  if (!message || typeof message !== 'object' || partIndex == null) return false
  const normalizedStatus = normalizeInteractionStatus(status, '')
  if (!normalizedStatus) return false

  const key = String(partIndex)
  const current = getInteractionState(message, partIndex, '')
  if (current.status === normalizedStatus) return false

  if (!message.interactionStates || typeof message.interactionStates !== 'object') {
    message.interactionStates = {}
  }

  const nextState = { status: normalizedStatus }
  if (normalizedStatus !== 'pending') {
    nextState.respondedAt = Number.isFinite(Number(respondedAt)) ? Number(respondedAt) : Date.now()
  }
  message.interactionStates[key] = nextState

  const interactiveParts = getInteractiveParts(message)
  if (interactiveParts.length <= 1) {
    message.interactionStatus = normalizedStatus
    if (normalizedStatus === 'pending') {
      delete message.interactionRespondedAt
    } else {
      message.interactionRespondedAt = nextState.respondedAt
    }
  }

  return true
}

function cloneMeetOfflineConfig(contact) {
  return {
    presetId: String(contact?.offlinePresetId || '').trim() || null,
    layout: String(contact?.offlineLayout || '').trim() || null,
    avatarMode: String(contact?.offlineAvatarMode || '').trim() || null,
    themeConfig: contact?.offlineThemeConfig ? { ...contact.offlineThemeConfig } : null,
    regexRules: Array.isArray(contact?.offlineRegexRules)
      ? contact.offlineRegexRules.map(rule => ({ ...rule }))
      : []
  }
}

export function activateAcceptedMeetScene(contact, messageOrContent, partIndex = null) {
  if (!contact || typeof contact !== 'object') return null

  const meetPart = getInteractivePart(messageOrContent, partIndex)
  if (!meetPart || meetPart.type !== 'meet') return null

  contact.meetSceneContext = {
    location: meetPart.location || '',
    time: meetPart.time || '',
    note: meetPart.note || '',
    offlineConfig: cloneMeetOfflineConfig(contact)
  }
  contact.offlineMsgs = []
  contact.offlineArchiveCursor = 0
  return contact.meetSceneContext
}

export function ensureInteractiveMessagePending(message, fallback = 'pending') {
  if (!message || typeof message !== 'object') return false
  const interactiveParts = getInteractiveParts(message)
  if (!interactiveParts.length) return false

  let changed = false
  interactiveParts.forEach((part) => {
    const current = getInteractionState(message, part.partIndex, '')
    const next = normalizeInteractionStatus(current.status, fallback)
    if (!next) return
    if (!current.status) {
      changed = setInteractionState(message, part.partIndex, next) || changed
    } else if (current.status !== next) {
      changed = setInteractionState(message, part.partIndex, next, current.respondedAt) || changed
    }
  })

  return changed
}

function buildDetailText(part) {
  if (!part) return ''
  if (part.type === 'transfer') {
    const detail = [`¥${part.amount}`]
    if (part.note) detail.push(`备注：${part.note}`)
    return detail.join('，')
  }

  if (part.type === 'gift') {
    const detail = [part.item]
    if (part.message) detail.push(`留言：${part.message}`)
    return detail.join('，')
  }

  if (part.type === 'meet') {
    const detail = [`地点：${part.location}`]
    if (part.time) detail.push(`时间：${part.time}`)
    if (part.note) detail.push(`备注：${part.note}`)
    return detail.join('，')
  }

  return ''
}

export function buildHiddenInteractionEvent({
  makeId,
  message,
  partIndex,
  status,
  actorRole,
  now = Date.now()
}) {
  if (typeof makeId !== 'function' || !message || !actorRole) return null

  const normalizedStatus = normalizeInteractionStatus(status, '')
  if (normalizedStatus !== 'accepted' && normalizedStatus !== 'rejected') return null

  const part = getInteractivePart(message, partIndex)
  if (!part) return null

  const actorPrefix = actorRole === 'assistant' ? '你已' : '用户已'
  const originPrefix = actorRole === 'assistant' ? '用户发起的' : '你发起的'
  const actionText = part.type === 'meet'
    ? (normalizedStatus === 'accepted' ? '同意' : '拒绝')
    : (normalizedStatus === 'accepted' ? '接收' : '拒收')
  const objectText = part.type === 'meet'
    ? '线下邀约'
    : (part.type === 'gift' ? '礼物' : '转账')
  const detailText = buildDetailText(part)
  const suffix = detailText ? `：${detailText}` : ''

  return {
    id: makeId('msg'),
    role: actorRole,
    content: `[互动事件] ${actorPrefix}${actionText}${originPrefix}${objectText}${suffix}。`,
    time: now,
    hideInChat: true,
    interactionEvent: true,
    interactionEventStatus: normalizedStatus,
    interactionSourceMsgId: message.id,
    interactionSourcePartIndex: part.partIndex,
    interactionSourceType: part.type
  }
}

export function extractInteractionDecisionTokens(content) {
  const decisions = []
  const cleanedContent = String(content || '')
    .replace(DECISION_TOKEN_REGEX, (_, action, type) => {
      decisions.push({
        type: String(type || '').trim().toLowerCase(),
        status: String(action || '').trim().toLowerCase() === 'accept' ? 'accepted' : 'rejected'
      })
      return ''
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { cleanedContent, decisions }
}

function findLatestPendingInteraction(messages, type, excludeMsgId = '') {
  const list = Array.isArray(messages) ? messages : []
  for (let msgIndex = list.length - 1; msgIndex >= 0; msgIndex -= 1) {
    const message = list[msgIndex]
    if (!message || String(message.id || '') === String(excludeMsgId || '')) continue
    if (message.role !== 'user') continue
    const parts = getInteractiveParts(message)
    for (let partIdx = parts.length - 1; partIdx >= 0; partIdx -= 1) {
      const part = parts[partIdx]
      if (part.type !== type) continue
      const state = getInteractionState(message, part.partIndex)
      if (state.status !== 'pending') continue
      return { message, part }
    }
  }
  return null
}

export function applyAssistantInteractionDecisions({ activeChat, message, makeId }) {
  if (!activeChat || !message || typeof makeId !== 'function') {
    return {
      resolvedCount: 0,
      cleanedContent: String(message?.content || ''),
      acceptedMeet: false,
      acceptedMeetCount: 0
    }
  }

  const { cleanedContent, decisions } = extractInteractionDecisionTokens(message.content)
  message.content = cleanedContent

  let resolvedCount = 0
  let acceptedMeetCount = 0
  decisions.forEach((decision) => {
    const target = findLatestPendingInteraction(activeChat.msgs, decision.type, message.id)
    if (!target) return
    const changed = setInteractionState(target.message, target.part.partIndex, decision.status, Date.now())
    if (!changed) return
    const event = buildHiddenInteractionEvent({
      makeId,
      message: target.message,
      partIndex: target.part.partIndex,
      status: decision.status,
      actorRole: 'assistant'
    })
    if (event) activeChat.msgs.push(event)
    if (decision.type === 'meet' && decision.status === 'accepted') {
      const scene = activateAcceptedMeetScene(activeChat, target.message, target.part.partIndex)
      if (scene) acceptedMeetCount += 1
    }
    resolvedCount += 1
  })

  return {
    resolvedCount,
    cleanedContent,
    acceptedMeet: acceptedMeetCount > 0,
    acceptedMeetCount
  }
}

export function buildInteractionContextNote(message) {
  const parts = getInteractiveParts(message)
  if (!parts.length) return ''

  const lines = parts.map((part) => {
    const state = getInteractionState(message, part.partIndex)
    const objectText = part.type === 'meet'
      ? '线下邀约'
      : (part.type === 'gift' ? '礼物' : '转账')
    let statusText = '待处理'
    if (state.status === 'accepted') {
      statusText = message.role === 'user' ? '你已接受' : '用户已接受'
    } else if (state.status === 'rejected') {
      statusText = message.role === 'user' ? '你已拒绝' : '用户已拒绝'
    } else if (state.status === 'pending') {
      statusText = message.role === 'user' ? '等待你决定' : '等待用户决定'
    }
    return `[互动状态] ${objectText}卡片#${part.partIndex + 1}：${statusText}`
  })

  return lines.join('\n')
}
