import { createApiError, createApiFailureResult, trimText } from './errors'
import { hasImageToken } from './imageTokens'
import { createGiftSnapshot } from '../../data/gifts'
import { extractQuoteFromText } from '../../utils/messageQuote'
import {
  applyAssistantInteractionDecisions,
  ensureInteractiveMessagePending,
  parseMessageContent
} from '../../features/chat'

const CONTENT_FILTER_NOTICE = '⚠️ 回复被内容安全策略截断。'

function attachGiftPartSnapshots(message) {
  if (!message || typeof message !== 'object') return

  const parts = parseMessageContent(String(message.content || ''), {
    allowStickers: false,
    allowTransfer: false,
    allowGift: true,
    allowVoice: false,
    allowCall: false,
    allowMockImage: false,
    allowMusic: false,
    allowMeet: false,
    allowNarration: true
  })

  const snapshots = {}
  parts.forEach((part, partIndex) => {
    if (part?.type !== 'gift') return
    const snapshot = createGiftSnapshot(part.item)
    if (!snapshot) return
    snapshots[partIndex] = snapshot
  })

  if (Object.keys(snapshots).length > 0) {
    message.giftPartSnapshots = snapshots
    return
  }

  delete message.giftPartSnapshots
}

export function createAssistantMessage(makeMsgId, traceId, extra = {}) {
  const msg = {
    id: makeMsgId(),
    role: 'assistant',
    content: '',
    time: Date.now(),
    traceId,
    ...extra
  }
  ensureInteractiveMessagePending(msg)
  attachGiftPartSnapshots(msg)
  return msg
}

export function applyReplyMetadata(message, allMessages = [], options = {}) {
  if (!message || typeof message !== 'object') {
    return { quote: null, cleanContent: '' }
  }

  const prefixRegex = options.prefixRegex instanceof RegExp ? options.prefixRegex : null
  let nextContent = typeof message.content === 'string' ? message.content : String(message.content || '')
  if (prefixRegex) {
    nextContent = nextContent.replace(prefixRegex, '').trim()
  }
  message.content = nextContent

  if (prefixRegex && typeof message.displayContent === 'string') {
    message.displayContent = message.displayContent.replace(prefixRegex, '').trim()
  }

  const { quote, cleanText } = extractQuoteFromText(nextContent)

  if (!quote) {
    if (typeof options.buildDisplayContent === 'function') {
      message.displayContent = options.buildDisplayContent(nextContent)
    }
    const visible = message.displayContent != null ? String(message.displayContent) : nextContent
    return { quote: null, cleanContent: visible }
  }

  message.replyToText = quote
  const quotedMsg = Array.isArray(allMessages)
    ? allMessages.find(item => item?.id !== message.id && typeof item?.content === 'string' && item.content.includes(quote))
    : null
  if (quotedMsg) {
    message.replyTo = quotedMsg.id
  }

  message.content = cleanText
  if (typeof options.buildDisplayContent === 'function') {
    message.displayContent = options.buildDisplayContent(cleanText)
  } else if (message.displayContent != null) {
    message.displayContent = cleanText
  }

  const visible = message.displayContent != null ? String(message.displayContent) : cleanText
  return { quote, cleanContent: visible }
}

export function applyContentFilterNotice(message, streamInfo, notice = CONTENT_FILTER_NOTICE) {
  if (!message || streamInfo?.finishReason !== 'content_filter') {
    return false
  }

  message.contentFiltered = true
  const baseContent = typeof message.content === 'string' ? message.content : String(message.content || '')
  message.content = baseContent ? `${baseContent}

${notice}` : notice
  return true
}

export function assertVisibleAssistantReply({
  message,
  mode,
  traceId,
  model,
  url,
  streamInfo,
  allowAIImageGeneration,
  extra = {}
}) {
  const visibleContent = trimText(message?.displayContent != null ? message.displayContent : message?.content)
  const imageOnlyReply = hasImageToken(message?.content, allowAIImageGeneration)
  if (visibleContent || imageOnlyReply) {
    return { visibleContent, imageOnlyReply }
  }

  const meta = {
    mode,
    traceId,
    model,
    url,
    streamInfo,
    ...extra
  }
  console.warn('[api-empty-reply]', meta)
  throw createApiError('EMPTY_REPLY', 'empty reply', meta)
}

export function finalizeStreamingAssistantReply({
  message,
  activeChat,
  streamInfo,
  prefixRegex,
  buildDisplayContent,
  makeMsgId,
  syncForumToAI = false,
  parseMomentContent,
  actor = {},
  applyForumOnlyPlaceholder,
  pushMomentsIslandNotifications,
  visibility = {}
}) {
  applyContentFilterNotice(message, streamInfo)
  applyReplyMetadata(message, activeChat?.msgs, {
    prefixRegex,
    buildDisplayContent
  })
  const interactionResult = applyAssistantInteractionDecisions({
    activeChat,
    message,
    makeId: makeMsgId
  })
  attachGiftPartSnapshots(message)
  if (typeof buildDisplayContent === 'function') {
    message.displayContent = buildDisplayContent(message.content)
  } else if (message.displayContent != null) {
    message.displayContent = message.content
  }
  ensureInteractiveMessagePending(message)

  const visibleAfterInteraction = trimText(message?.displayContent != null ? message.displayContent : message?.content)
  const interactionOnly = interactionResult.resolvedCount > 0 && !visibleAfterInteraction
  if (interactionOnly) {
    message.hideInChat = true
    return {
      forumOnly: false,
      parsedMomentsResult: null,
      interactionOnly: true,
      acceptedMeet: interactionResult.acceptedMeet === true
    }
  }

  let forumOnly = false
  let parsedMomentsResult = null
  if (syncForumToAI && message?.content && typeof parseMomentContent === 'function') {
    parsedMomentsResult = parseMomentContent(message.content, actor)
    if (typeof applyForumOnlyPlaceholder === 'function') {
      forumOnly = !!applyForumOnlyPlaceholder(message, parsedMomentsResult)
    }
    if (typeof pushMomentsIslandNotifications === 'function') {
      pushMomentsIslandNotifications(parsedMomentsResult, actor)
    }
  }

  assertVisibleAssistantReply({
    ...visibility,
    message,
    streamInfo
  })

  return {
    forumOnly,
    parsedMomentsResult,
    acceptedMeet: interactionResult.acceptedMeet === true
  }
}

export function appendAssistantErrorMessage({
  activeChat,
  makeMsgId,
  friendlyError,
  traceId,
  errorCode = 'API_ERROR',
  extra = {}
}) {
  if (!activeChat) return null

  const msg = createAssistantMessage(makeMsgId, traceId, {
    content: '⚠️ ' + friendlyError,
    errorCode,
    ...extra
  })
  activeChat.msgs.push(msg)
  return msg
}

export function handleAssistantRequestFailure({
  activeChat,
  removeMessageIfVisiblyEmpty,
  createdMsgId,
  buildFriendlyErrorMessage,
  makeMsgId,
  traceId,
  error,
  extra = {}
}) {
  if (typeof removeMessageIfVisiblyEmpty === 'function') {
    removeMessageIfVisiblyEmpty(activeChat, createdMsgId)
  }

  const errorCode = error?.code || 'API_ERROR'
  const friendlyError = typeof buildFriendlyErrorMessage === 'function'
    ? buildFriendlyErrorMessage(error, traceId)
    : String(error?.message || error || 'API error')

  appendAssistantErrorMessage({
    activeChat,
    makeMsgId,
    friendlyError,
    traceId,
    errorCode,
    extra
  })

  return createApiFailureResult(error, {
    traceId,
    errorMessage: friendlyError,
    defaultCode: errorCode
  })
}
