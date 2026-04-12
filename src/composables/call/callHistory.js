import { cleanCallText } from './callParser'

export function normalizeCallMode(mode) {
  return mode === 'video' ? 'video' : 'voice'
}

export function modeLabel(mode) {
  return normalizeCallMode(mode) === 'video' ? '视频通话' : '语音通话'
}

export function getEndReason(reason, phase, endedBy) {
  const explicit = String(reason || '').trim().toLowerCase()
  if (explicit) return explicit

  if (phase === 'incoming') {
    return endedBy === 'ai' ? 'ai_reject' : 'user_decline'
  }
  if (phase === 'ringing' || phase === 'connecting') {
    return endedBy === 'ai' ? 'ai_cancel' : 'user_cancel'
  }
  return endedBy === 'ai' ? 'ai_hangup' : 'user_hangup'
}

export function resolveCallStatus(durationSeconds, endReason) {
  if (durationSeconds > 0) return 'completed'
  const reason = String(endReason || '').trim().toLowerCase()
  if (reason === 'user_cancel' || reason === 'user_decline' || reason === 'ai_reject' || reason === 'ai_cancel') {
    return 'cancelled'
  }
  return 'missed'
}

function reasonLabel(reason) {
  const value = String(reason || '').trim().toLowerCase()
  if (value === 'user_hangup') return '用户挂断'
  if (value === 'ai_hangup') return 'AI 挂断'
  if (value === 'user_cancel') return '用户取消呼叫'
  if (value === 'ai_cancel') return 'AI 取消呼叫'
  if (value === 'user_decline') return '用户拒接来电'
  if (value === 'ai_reject') return 'AI 拒绝接听/继续'
  return '通话结束'
}

export function buildInviteLifecycleEventText(mode, eventType) {
  const callModeLabel = modeLabel(mode)

  if (eventType === 'decline') {
    return `[通话事件] 用户拒接了 AI 发起的${callModeLabel}邀请。`
  }
  if (eventType === 'accept') {
    return `[通话事件] 用户接听了 AI 发起的${callModeLabel}邀请。`
  }
  return `[通话事件] 用户处理了${callModeLabel}邀请。`
}

export function buildCallEventText({ phase, mode, durationSeconds, endedBy, endReason, aiNote }, formatDuration) {
  const callModeLabel = modeLabel(mode)
  const durationText = formatDuration(durationSeconds)
  const noteText = aiNote ? ` AI说明：${aiNote}。` : ''

  if (phase === 'incoming' && endReason === 'user_decline') {
    return buildInviteLifecycleEventText(mode, 'decline')
  }
  if ((phase === 'ringing' || phase === 'connecting') && endReason === 'user_cancel') {
    return `[通话事件] 用户取消了${callModeLabel}呼叫。`
  }
  if ((phase === 'ringing' || phase === 'connecting') && endReason === 'ai_cancel') {
    return `[通话事件] AI 取消了${callModeLabel}呼叫。${noteText}`.trim()
  }

  const actor = endedBy === 'ai' ? 'AI' : '用户'
  return `[通话事件] ${callModeLabel}已结束。结束方：${actor}。原因：${reasonLabel(endReason)}。时长：${durationText}。${noteText}`.trim()
}

export function appendInviteLifecycleEvent(contact, payload, options = {}) {
  if (!contact || !Array.isArray(contact.msgs)) return false

  const makeMessageId = typeof options.makeMessageId === 'function' ? options.makeMessageId : () => ''
  contact.msgs.push({
    id: makeMessageId(),
    role: 'user',
    content: buildInviteLifecycleEventText(payload.mode, payload.eventType),
    time: Date.now(),
    hideInChat: true,
    callLifecycleEvent: true
  })

  return true
}

export function appendHiddenCallEvent(contact, payload, options = {}) {
  if (!contact || !Array.isArray(contact.msgs)) return

  const endedBy = payload.endedBy === 'ai' ? 'ai' : 'user'
  const makeMessageId = typeof options.makeMessageId === 'function' ? options.makeMessageId : () => ''
  const formatDuration = typeof options.formatDuration === 'function' ? options.formatDuration : (value) => String(value || '')

  contact.msgs.push({
    id: makeMessageId(),
    role: endedBy === 'ai' ? 'assistant' : 'user',
    content: buildCallEventText(payload, formatDuration),
    time: Date.now(),
    hideInChat: true,
    callLifecycleEvent: true
  })
}

export function pushCallSystemEvent(callMessages, content, makeMessageId) {
  const text = String(content || '').trim()
  if (!text || !Array.isArray(callMessages)) return

  callMessages.push({
    id: makeMessageId(),
    role: 'system',
    content: text,
    time: Date.now()
  })
}

export function saveCallRecord({
  contact,
  callMode,
  callDuration,
  callMessages,
  formatDuration,
  makeMessageId,
  scheduleSave,
  endedBy,
  endReason,
  aiNote
}) {
  if (!contact) return

  const normalizedMode = normalizeCallMode(callMode)
  const durationSeconds = Number(callDuration) || 0
  const status = resolveCallStatus(durationSeconds, endReason)
  const now = Date.now()
  const durationText = formatDuration(durationSeconds)
  const transcript = Array.isArray(callMessages)
    ? callMessages
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .map(message => ({
        role: message.role,
        text: cleanCallText(message.content),
        time: message.time
      }))
    : []

  const callHistoryItem = {
    id: makeMessageId('call'),
    mode: normalizedMode,
    duration: durationSeconds,
    time: now,
    status,
    endedBy,
    endReason,
    aiNote,
    transcript
  }

  if (!Array.isArray(contact.callHistory)) {
    contact.callHistory = []
  }
  contact.callHistory.unshift(callHistoryItem)
  if (contact.callHistory.length > 200) {
    contact.callHistory.length = 200
  }

  contact.msgs.push({
    id: makeMessageId('msg'),
    role: 'system',
    content: `📞 ${modeLabel(normalizedMode)} ${durationText}`,
    time: now,
    isCallRecord: true,
    callDuration: durationSeconds,
    callMode: normalizedMode,
    callStatus: status,
    callEndedBy: endedBy,
    callEndReason: endReason,
    callEndNote: aiNote,
    callHistoryId: callHistoryItem.id,
    callTranscript: transcript
  })

  scheduleSave()
}
