import { resolveMockImagePlaceholder } from '../mockImage'
import { extractQuoteFromText } from '../../../../utils/messageQuote'
import { favoritePartIndexToKey, isMessagePartFavorited } from '../../../../utils/messageFavorites'
import { resolveMessageImageUrl } from '../../../../utils/mediaUrl'
import {
  formatGiftToken,
  formatMeetToken,
  formatMockImageToken,
  formatMusicToken,
  formatStickerToken,
  formatTransferToken,
  formatVoiceToken
} from './contentParts'
import { formatTailMetaText, formatTimestampDisplay, isSameDay, normalizeReplyPreviewText } from './display'
import { getCachedParsedParts, isMessageEndingWithCallPart } from './parseCache'
import { getInteractionState } from '../interactiveMessages'

const TOOL_LOG_TEXT_MAX_CHARS = 320

function truncateToolLogText(value, maxChars = TOOL_LOG_TEXT_MAX_CHARS) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

function buildToolLogBlocks(message, blockMsgId, logEntries = []) {
  if (!Array.isArray(logEntries) || logEntries.length === 0) return []

  return logEntries.map((entry, index) => ({
    type: 'toolLog',
    key: `tool-log-${message.id}-${index}`,
    msgId: blockMsgId,
    source: String(entry?.source || '').trim() || 'internal',
    sourceLabel: truncateToolLogText(entry?.sourceLabel || '内置工具', 18),
    success: entry?.success !== false,
    title: truncateToolLogText(entry?.displayName || entry?.toolName || '工具调用', 80),
    subtitle: truncateToolLogText(entry?.subtitle || '', 120),
    summary: truncateToolLogText(entry?.summary || '', 160),
    argsPreview: truncateToolLogText(entry?.argsPreview || ''),
    resultPreview: truncateToolLogText(entry?.resultPreview || ''),
    errorText: truncateToolLogText(entry?.errorText || '', 160),
    durationLabel: truncateToolLogText(entry?.durationLabel || '', 24),
    round: Math.max(1, Number(entry?.round || 1) || 1)
  }))
}

function normalizeGiftSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null

  const name = String(snapshot.name || snapshot.item || '').trim()
  if (!name) return null

  const rawPrice = snapshot.price
  const numericPrice = rawPrice === null || rawPrice === undefined || rawPrice === ''
    ? null
    : Number(rawPrice)

  return {
    id: String(snapshot.id || '').trim(),
    name,
    description: String(snapshot.description || ''),
    price: Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice : null,
    image: String(snapshot.image || '').trim()
  }
}

function resolveGiftDisplayData(message, part, partIndex) {
  const snapshot = normalizeGiftSnapshot(
    message?.giftPartSnapshots?.[String(partIndex)] ?? message?.giftPartSnapshots?.[partIndex]
  )
  if (!snapshot) {
    return {
      item: part.item,
      imageUrl: part.imageUrl,
      price: part.price,
      description: part.description
    }
  }

  return {
    item: snapshot.name || part.item,
    imageUrl: snapshot.image || part.imageUrl,
    price: snapshot.price,
    description: snapshot.description || null
  }
}

export function buildMessageBlocks(options) {
  const {
    getMessages,
    getStickerUrl,
    showTimestamps,
    allowAIStickers,
    allowAITransfer,
    allowAIGift,
    allowAIVoice,
    allowAICall,
    allowAIMockImage,
    allowAIMusicRecommend,
    allowAIMeet,
    showToolLog,
    timestampGapMs,
    getAnimateMsgId,
    isGroupChat,
    getGroupMembers,
    showChatAvatars,
    getContactAvatar,
    getUserAvatar,
    showNarrations,
    getMockImagePlaceholder,
    getActiveContactId
  } = options

  const allMsgs = getMessages() || []
  if (allMsgs.length === 0) return []
  const msgs = allMsgs.filter(m => m && !m.hideInChat && !m.hidden)
  if (msgs.length === 0) return []

    const idMap = new Map()
    for (const m of allMsgs) {
      if (!m) continue
      if (m.displayContent != null) {
        idMap.set(m.id, { ...m, content: m.displayContent })
      } else {
        idMap.set(m.id, m)
      }
    }

    const groupChat = isGroupChat ? isGroupChat() : false
    const members = groupChat && getGroupMembers ? getGroupMembers() : []
    const memberMap = new Map()
    const memberNameMap = new Map()
    for (const m of members) {
      memberMap.set(m.id, m)
      const memberName = String(m?.name || '').trim()
      if (memberName && !memberNameMap.has(memberName)) {
        memberNameMap.set(memberName, m)
      }
    }

    const shouldShowChatAvatars = showChatAvatars ? showChatAvatars() : false
    const forceShowAvatar = shouldShowChatAvatars || groupChat
    const activeContactId = getActiveContactId ? String(getActiveContactId() || '').trim() : ''
    const contactAvatarInfo = getContactAvatar ? getContactAvatar() : null
    const userAvatarInfo = getUserAvatar ? getUserAvatar() : null
    const timestampEnabled = showTimestamps ? showTimestamps() : false
    const aiStickersEnabled = allowAIStickers ? allowAIStickers() : true
    const aiTransferEnabled = allowAITransfer ? allowAITransfer() : true
    const aiGiftEnabled = allowAIGift ? allowAIGift() : true
    const aiVoiceEnabled = allowAIVoice ? allowAIVoice() : true
    const aiCallEnabled = allowAICall ? allowAICall() : true
    const aiMockImageEnabled = allowAIMockImage ? allowAIMockImage() : true
    const aiMusicEnabled = allowAIMusicRecommend ? allowAIMusicRecommend() : false
    const aiMeetEnabled = allowAIMeet ? allowAIMeet() : false
    const toolLogEnabled = showToolLog ? showToolLog() : false
    const shouldShowNarrations = showNarrations ? showNarrations() : true
    const createFavoriteState = (message, partIndex = null) => ({
      favorited: isMessagePartFavorited(message, partIndex),
      msgPartKey: favoritePartIndexToKey(partIndex)
    })

    const result = []
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      const blockMsgId = String(m?.sourceMsgId ?? m?.id ?? '').trim() || String(m?.id ?? '').trim()
      const next = msgs[i + 1]
      const prev = msgs[i - 1]
      const isUser = m.role === 'user'

      const nextIsSame = !!(next && next.role === m.role && (!groupChat || next.senderId === m.senderId))
      const prevIsSame = !!(prev && prev.role === m.role && (!groupChat || prev.senderId === m.senderId))
      const isLastInGroup = !nextIsSame
      const isFirstInGroup = !prevIsSame

      let senderName = null
      let senderAvatar = null
      let senderAvatarType = 'emoji'
      if (groupChat && !isUser && m.senderId) {
        let member = memberMap.get(m.senderId)
        if (!member && m.senderName) {
          member = memberNameMap.get(m.senderName)
        }
        if (member) {
          senderName = member.name
          senderAvatar = member.avatar
          senderAvatarType = member.avatarType || 'emoji'
        } else if (m.senderName) {
          senderName = m.senderName
          senderAvatar = '🤖'
        }
      } else if (groupChat && !isUser && m.senderName) {
        const member = memberNameMap.get(m.senderName)
        if (member) {
          senderName = member.name
          senderAvatar = member.avatar
          senderAvatarType = member.avatarType || 'emoji'
        } else {
          senderName = m.senderName
          senderAvatar = '🤖'
        }
      } else if (groupChat && isUser && userAvatarInfo) {
        senderAvatar = userAvatarInfo.avatar
        senderAvatarType = userAvatarInfo.avatarType || 'emoji'
      } else if (!groupChat && !isUser && contactAvatarInfo) {
        senderAvatar = contactAvatarInfo.avatar
        senderAvatarType = contactAvatarInfo.avatarType || 'emoji'
      } else if (!groupChat && isUser && userAvatarInfo) {
        senderAvatar = userAvatarInfo.avatar
        senderAvatarType = userAvatarInfo.avatarType || 'emoji'
      }

      const prevTime = prev && prev.time ? prev.time : null
      const currTime = m.time || null
      const shouldShowTimestamp = !!(
        timestampEnabled && currTime && (
          !prevTime || !isSameDay(prevTime, currTime) || (currTime - prevTime) >= timestampGapMs
        )
      )
      const isPenultimateMsg = i === msgs.length - 2
      const suppressTailMeta = isPenultimateMsg && isMessageEndingWithCallPart(
        next,
        next?.role === 'user' || aiCallEnabled
      )
      const tailMetaText = (isLastInGroup && !suppressTailMeta) ? formatTailMetaText(m, isUser) : ''

      if (shouldShowTimestamp) {
        result.push({
          type: 'timestamp',
          key: 'ts-' + m.id,
          text: formatTimestampDisplay(currTime, prevTime)
        })
      }

      const animateMsgId = getAnimateMsgId ? getAnimateMsgId() : null
      const anim = !!(animateMsgId && animateMsgId === m.id)
      const bubbleAnimClass = anim ? 'bubble-appear' : ''
      const narrationAnimClass = anim ? 'narration-appear' : ''
      const resolvedAssistantVoiceContactId = (() => {
        const explicitContactId = typeof m.contactId === 'string' ? m.contactId.trim() : ''
        if (explicitContactId) return explicitContactId
        if (isUser) return ''
        if (!groupChat) return activeContactId
        return ''
      })()

      // Offline card
      if (m && m.type === 'offlineCard') {
        result.push({
          type: 'offlineCard',
          key: 'offline-card-' + m.id,
          msgId: blockMsgId,
          sessionId: m.sessionId,
          summary: m.offlineSummary || '线下剧情',
          startTime: m.offlineStartTime,
          endTime: m.offlineEndTime,
          mb: 'mb-2'
        })
        continue
      }

      if (m && m.isCallRecord) {
        result.push({
          type: 'callRecord',
          key: 'call-rec-' + m.id,
          msgId: blockMsgId,
          isUser,
          mb: isLastInGroup ? 'mb-2' : 'mb-[2px]',
          callMode: m.callMode || 'voice',
          callDuration: m.callDuration || 0,
          callTranscript: m.callTranscript || [],
          time: m.time,
          meta: m.meta || {},
          animClass: bubbleAnimClass,
          contextContent: '[通话记录]',
          isGroupChat: groupChat,
          senderName: isFirstInGroup ? senderName : null,
          senderAvatar,
          senderAvatarType,
          showAvatar: forceShowAvatar || (isLastInGroup && (groupChat || shouldShowChatAvatars)),
          metaText: tailMetaText,
          ...createFavoriteState(m, null)
        })
        continue
      }

      if (m && m.isMockImage) {
        const mockText = String(m.mockImageText || m.content || '').trim()
        const placeholder = resolveMockImagePlaceholder(
          m.mockImagePlaceholder || (getMockImagePlaceholder ? getMockImagePlaceholder() : '')
        )
        result.push({
          type: 'mockImage',
          key: 'mock-' + m.id,
          msgId: blockMsgId,
          isUser,
          mb: isLastInGroup ? 'mb-2' : 'mb-[2px]',
          imageUrl: placeholder,
          mockText,
          animClass: bubbleAnimClass,
          contextContent: mockText || '[相机]',
          isGroupChat: groupChat,
          senderName: isFirstInGroup ? senderName : null,
          senderAvatar,
          senderAvatarType,
          showAvatar: forceShowAvatar || (isLastInGroup && (groupChat || shouldShowChatAvatars)),
          metaText: tailMetaText,
          ...createFavoriteState(m, null)
        })
        continue
      }

      const resolvedImageUrl = resolveMessageImageUrl(m)
      if (m && m.isImage && resolvedImageUrl) {
        result.push({
          type: 'image',
          key: 'img-' + m.id,
          msgId: blockMsgId,
          isUser,
          mb: isLastInGroup ? 'mb-2' : 'mb-[2px]',
          imageUrl: resolvedImageUrl,
          animClass: bubbleAnimClass,
          contextContent: '[图片]',
          isGroupChat: groupChat,
          senderName: isFirstInGroup ? senderName : null,
          senderAvatar,
          senderAvatarType,
          showAvatar: forceShowAvatar || (isLastInGroup && (groupChat || shouldShowChatAvatars)),
          metaText: tailMetaText,
          ...createFavoriteState(m, null)
        })
        continue
      }

      if (m && m.isImageRendering) {
        result.push({
          type: 'imageRendering',
          key: 'img-rendering-' + m.id,
          msgId: blockMsgId,
          isUser,
          mb: isLastInGroup ? 'mb-2' : 'mb-[2px]',
          text: String(m.content || '正在渲染图片…'),
          animClass: bubbleAnimClass,
          contextContent: '[图片渲染中]',
          isGroupChat: groupChat,
          senderName: isFirstInGroup ? senderName : null,
          senderAvatar,
          senderAvatarType,
          showAvatar: forceShowAvatar || (isLastInGroup && (groupChat || shouldShowChatAvatars)),
          metaText: tailMetaText,
          ...createFavoriteState(m, null)
        })
        continue
      }

      if (m && m.isSticker && m.stickerName) {
        const url = getStickerUrl(m.stickerName)
        result.push({
          type: 'stickerMessage',
          key: 'stkmsg-' + m.id,
          msgId: blockMsgId,
          isUser,
          mb: isLastInGroup ? 'mb-2' : 'mb-[2px]',
          stickerName: m.stickerName,
          stickerUrl: url,
          animClass: bubbleAnimClass,
          contextContent: String(m.content ?? ''),
          isGroupChat: groupChat,
          senderName: isFirstInGroup ? senderName : null,
          senderAvatar,
          senderAvatarType,
          showAvatar: forceShowAvatar || (isLastInGroup && (groupChat || shouldShowChatAvatars)),
          metaText: tailMetaText,
          ...createFavoriteState(m, null)
        })
        continue
      }

      if (toolLogEnabled && Array.isArray(m?.toolLogs) && m.toolLogs.length > 0) {
        result.push(...buildToolLogBlocks(m, blockMsgId, m.toolLogs))
      }

      const displayContent = m.displayContent != null ? m.displayContent : m.content
      const parseOptions = {
        allowStickers: isUser || aiStickersEnabled,
        allowTransfer: isUser || aiTransferEnabled,
        allowGift: isUser || aiGiftEnabled,
        allowVoice: isUser || aiVoiceEnabled,
        allowCall: isUser || aiCallEnabled,
        allowMockImage: isUser || aiMockImageEnabled,
        allowMusic: isUser || aiMusicEnabled,
        allowMeet: isUser || aiMeetEnabled,
        allowNarration: !isUser
      }
      const parts = getCachedParsedParts(m, displayContent, parseOptions)

      if (parts.length === 1 && parts[0].type === 'narration') {
        if (shouldShowNarrations) {
          result.push({
            type: 'narration',
            key: 'nar-' + m.id + '-only',
            msgId: blockMsgId,
            partIndex: 0,
            msgPartKey: favoritePartIndexToKey(0),
            text: String(parts[0].content ?? ''),
            animClass: narrationAnimClass
          })
        }
        continue
      }

      const renderPartIndexes = []
      for (let idx = 0; idx < parts.length; idx += 1) {
        if (parts[idx].type !== 'narration') renderPartIndexes.push(idx)
      }
      const firstRenderPartIndex = renderPartIndexes.length > 0 ? renderPartIndexes[0] : -1
      const lastRenderPartIndex = renderPartIndexes.length > 0 ? renderPartIndexes[renderPartIndexes.length - 1] : -1
      let normalIndex = 0

      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const part = parts[partIndex]

        if (part.type === 'narration') {
          if (shouldShowNarrations) {
            result.push({
              type: 'narration',
              key: 'nar-' + m.id + '-' + partIndex,
              msgId: blockMsgId,
              partIndex,
              msgPartKey: favoritePartIndexToKey(partIndex),
              text: String(part.content ?? ''),
              animClass: narrationAnimClass
            })
          }
          continue
        }

        const isFirstRenderPart = partIndex === firstRenderPartIndex
        const isLastRenderPart = partIndex === lastRenderPartIndex

        if (part.type === 'sticker') {
          const url = getStickerUrl(part.name)
          result.push({
            type: 'sticker',
            key: 'stk-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            stickerName: part.name,
            stickerUrl: url,
            animClass: bubbleAnimClass,
            contextContent: formatStickerToken(part.name),
            isGroupChat: groupChat,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'transfer') {
          const interaction = getInteractionState(m, partIndex)
          result.push({
            type: 'transfer',
            key: 'transfer-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            amount: part.amount,
            note: part.note,
            interactionStatus: interaction.status,
            interactionRespondedAt: interaction.respondedAt,
            time: m.time,
            animClass: bubbleAnimClass,
            contextContent: formatTransferToken(part.amount, part.note),
            isGroupChat: groupChat,
            detailSenderName: senderName || null,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'gift') {
          const interaction = getInteractionState(m, partIndex)
          const giftData = resolveGiftDisplayData(m, part, partIndex)
          result.push({
            type: 'gift',
            key: 'gift-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            item: giftData.item,
            message: part.message,
            imageUrl: giftData.imageUrl,
            price: giftData.price,
            description: giftData.description,
            interactionStatus: interaction.status,
            interactionRespondedAt: interaction.respondedAt,
            time: m.time,
            animClass: bubbleAnimClass,
            contextContent: formatGiftToken(giftData.item, part.message),
            isGroupChat: groupChat,
            detailSenderName: senderName || null,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'meet') {
          const interaction = getInteractionState(m, partIndex)
          result.push({
            type: 'meet',
            key: 'meet-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            location: part.location,
            time: part.time,
            note: part.note,
            interactionStatus: interaction.status,
            interactionRespondedAt: interaction.respondedAt,
            animClass: bubbleAnimClass,
            contextContent: formatMeetToken(part.location, part.time, part.note),
            isGroupChat: groupChat,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'voice') {
          result.push({
            type: 'voice',
            key: 'voice-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            contactId: resolvedAssistantVoiceContactId,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            text: part.text,
            emotion: part.emotion || 'normal',
            duration: part.duration,
            waveform: part.waveform,
            animClass: bubbleAnimClass,
            contextContent: formatVoiceToken(part.text),
            isGroupChat: groupChat,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'mockImage') {
          const placeholder = resolveMockImagePlaceholder(getMockImagePlaceholder ? getMockImagePlaceholder() : '')
          const mockText = String(part.text || '').trim()
          result.push({
            type: 'mockImage',
            key: 'mock-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            imageUrl: placeholder,
            mockText,
            animClass: bubbleAnimClass,
            contextContent: formatMockImageToken(mockText),
            isGroupChat: groupChat,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'call') {
          result.push({
            type: 'call',
            key: 'call-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            callMode: part.callMode,
            callText: part.callText,
            isCallInvite: part.isCallInvite,
            animClass: bubbleAnimClass,
            contextContent: part.callText,
            isGroupChat: groupChat,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        if (part.type === 'music') {
          result.push({
            type: 'music',
            key: 'music-' + m.id + '-' + partIndex,
            msgId: blockMsgId,
            partIndex,
            isUser,
            mb: (isLastInGroup && isLastRenderPart) ? 'mb-2' : 'mb-[2px]',
            title: part.title,
            artist: part.artist,
            url: part.url,
            cover: part.cover,
            animClass: bubbleAnimClass,
            contextContent: formatMusicToken(part.title, part.artist, part.url, part.cover),
            isGroupChat: groupChat,
            senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
            senderAvatar,
            senderAvatarType,
            showAvatar: forceShowAvatar || (isLastInGroup && isLastRenderPart && (groupChat || shouldShowChatAvatars)),
            metaText: (isLastInGroup && isLastRenderPart) ? tailMetaText : '',
            ...createFavoriteState(m, partIndex)
          })
          continue
        }

        const isLastNormalPart = isLastRenderPart
        const isFirstNormalPart = normalIndex === 0
        normalIndex += 1

        let bubbleClass = isUser ? 'bubble-user' : 'bubble-ai'
        if (isLastInGroup && isLastNormalPart) {
          bubbleClass += ' has-tail'
        }
        if (!isLastNormalPart || nextIsSame) {
          bubbleClass += ' in-group'
        }

        let replyText = ''
        let bubbleText = String(part.content ?? '')

        const { quote: partQuote, cleanText } = extractQuoteFromText(bubbleText)
        if (partQuote) {
          replyText = normalizeReplyPreviewText(partQuote)
          bubbleText = cleanText
        } else if ((m.replyTo || m.replyToText) && isFirstNormalPart) {
          const org = m.replyTo ? idMap.get(m.replyTo) : null
          replyText = normalizeReplyPreviewText(
            m.replyToText != null ? m.replyToText : (org ? org.content : '已删除')
          )
        }

        const mb = (isLastInGroup && isLastNormalPart) ? 'mb-2' : 'mb-[2px]'
        const metaText = (isLastInGroup && isLastNormalPart) ? tailMetaText : ''

        result.push({
          type: 'bubble',
          key: 'msg-' + m.id + '-n-' + normalIndex,
          msgId: blockMsgId,
          partIndex,
          isUser,
          mb,
          bubbleClass,
          animClass: bubbleAnimClass,
          replyText,
          text: bubbleText,
          emotion: part.emotion || 'normal',
          metaText,
          contextContent: String(part.content ?? ''),
          isGroupChat: groupChat,
          senderName: (isFirstInGroup && isFirstRenderPart) ? senderName : null,
          senderAvatar,
          senderAvatarType,
          showAvatar: forceShowAvatar || (isLastInGroup && isLastNormalPart && (groupChat || shouldShowChatAvatars)),
          fromOffline: !!m.fromOffline,
          ...createFavoriteState(m, partIndex)
        })
      }
    }

  return result
}
