function toSessionId(value) {
  const id = String(value || '').trim()
  return id || ''
}

function toMsgId(value) {
  const id = String(value || '').trim()
  return id || ''
}

export function ensureOfflineContactFields(contact) {
  if (!contact || typeof contact !== 'object') return
  if (!Array.isArray(contact.offlineMsgs)) contact.offlineMsgs = []
  if (!Array.isArray(contact.offlineSessions)) contact.offlineSessions = []
  if (!Array.isArray(contact.offlineSnapshots)) contact.offlineSnapshots = []
  const cursor = Number(contact.offlineArchiveCursor || 0)
  contact.offlineArchiveCursor = Number.isFinite(cursor)
    ? Math.max(0, Math.min(Math.round(cursor), contact.offlineMsgs.length))
    : 0
}

export function buildOfflineMemoryPrefix(startTime, endTime) {
  if (!Number.isFinite(Number(startTime)) || !Number.isFinite(Number(endTime))) return ''
  const startText = formatBeijingLocale(new Date(startTime), {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const endText = formatBeijingLocale(new Date(endTime), {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `[线下见面] ${startText}-${endText}`
}

function hasMsgId(session, msgId) {
  if (!Array.isArray(session?.msgIds) || session.msgIds.length === 0) return false
  const target = toMsgId(msgId)
  if (!target) return false
  return session.msgIds.some(id => toMsgId(id) === target)
}

function getSessionById(contact, sessionId) {
  const target = toSessionId(sessionId)
  if (!target || !Array.isArray(contact?.offlineSessions)) return null
  return contact.offlineSessions.find(s => toSessionId(s?.id) === target) || null
}

function isSessionTracked(session) {
  return Array.isArray(session?.msgIds) && session.msgIds.length > 0
}

function shouldRemoveMemory(memory, sessionIdSet, sessionInfoMap) {
  if (!memory || typeof memory !== 'object') return false

  if (sessionInfoMap.memoryIdSet.has(toMsgId(memory.id))) return true

  const linkedSessionId = toSessionId(memory.offlineSessionId || memory.sessionId)
  if (linkedSessionId && sessionIdSet.has(linkedSessionId)) return true

  const content = String(memory.content || '')
  if (!content) return false

  for (const prefix of sessionInfoMap.prefixes) {
    if (prefix && content.startsWith(prefix)) return true
  }
  return false
}

function buildSessionInfoMap(sessions = []) {
  const memoryIdSet = new Set()
  const cardMsgIdSet = new Set()
  const prefixes = []
  for (const session of sessions) {
    const memoryId = toMsgId(session?.memoryId)
    if (memoryId) memoryIdSet.add(memoryId)
    const cardMsgId = toMsgId(session?.cardMsgId)
    if (cardMsgId) cardMsgIdSet.add(cardMsgId)
    const prefix = buildOfflineMemoryPrefix(session?.startTime, session?.endTime)
    if (prefix) prefixes.push(prefix)
  }
  return { memoryIdSet, cardMsgIdSet, prefixes }
}

export function removeOfflineSessionsAndArtifacts(contact, sessionIds = []) {
  ensureOfflineContactFields(contact)
  const stats = { removedSessions: 0, removedCards: 0, removedMemories: 0 }

  const sessionIdSet = new Set(
    (Array.isArray(sessionIds) ? sessionIds : [])
      .map(toSessionId)
      .filter(Boolean)
  )
  if (sessionIdSet.size === 0) return stats

  const sessions = contact.offlineSessions || []
  const targetSessions = sessions.filter(s => sessionIdSet.has(toSessionId(s?.id)))
  if (targetSessions.length === 0) return stats

  const sessionInfoMap = buildSessionInfoMap(targetSessions)
  contact.offlineSessions = sessions.filter(s => !sessionIdSet.has(toSessionId(s?.id)))
  stats.removedSessions = targetSessions.length

  if (Array.isArray(contact.msgs) && contact.msgs.length > 0) {
    const prevLen = contact.msgs.length
    contact.msgs = contact.msgs.filter((msg) => {
      if (!msg || msg.type !== 'offlineCard') return true
      const sid = toSessionId(msg.sessionId)
      if (sid && sessionIdSet.has(sid)) return false
      const msgId = toMsgId(msg.id)
      if (msgId && sessionInfoMap.cardMsgIdSet.has(msgId)) return false
      return true
    })
    stats.removedCards = prevLen - contact.msgs.length
  }

  if (Array.isArray(contact?.memory?.core) && contact.memory.core.length > 0) {
    const prevLen = contact.memory.core.length
    contact.memory.core = contact.memory.core.filter(mem => !shouldRemoveMemory(mem, sessionIdSet, sessionInfoMap))
    stats.removedMemories = prevLen - contact.memory.core.length
  }

  return stats
}

export function removeOfflineArtifactsByDeletedOfflineMessage(contact, deletedMsgId, options = {}) {
  ensureOfflineContactFields(contact)
  const deletedId = toMsgId(deletedMsgId)
  if (!deletedId) return { removedSessions: 0, removedCards: 0, removedMemories: 0 }

  const deletedWasArchived = options.deletedWasArchived === true
  const sessions = contact.offlineSessions || []
  if (sessions.length === 0) return { removedSessions: 0, removedCards: 0, removedMemories: 0 }

  let targetSessions = sessions.filter(session => hasMsgId(session, deletedId))
  if (targetSessions.length === 0 && deletedWasArchived) {
    // Legacy fallback: old sessions had no msgIds; archived content deletion should clear stale cards/memory.
    targetSessions = sessions.filter(session => !isSessionTracked(session))
  }
  if (targetSessions.length === 0) return { removedSessions: 0, removedCards: 0, removedMemories: 0 }

  return removeOfflineSessionsAndArtifacts(
    contact,
    targetSessions.map(session => session.id)
  )
}

export function removeOfflineArtifactsByRemovedChatMessages(contact, removedMessages = []) {
  ensureOfflineContactFields(contact)
  if (!Array.isArray(removedMessages) || removedMessages.length === 0) {
    return { removedSessions: 0, removedCards: 0, removedMemories: 0 }
  }

  const sessionIds = new Set()
  const removedCardMsgIds = new Set()

  for (const msg of removedMessages) {
    if (!msg || msg.type !== 'offlineCard') continue
    const sid = toSessionId(msg.sessionId)
    if (sid) sessionIds.add(sid)
    const msgId = toMsgId(msg.id)
    if (msgId) removedCardMsgIds.add(msgId)
  }

  if (removedCardMsgIds.size > 0) {
    for (const session of contact.offlineSessions || []) {
      const cardMsgId = toMsgId(session?.cardMsgId)
      if (cardMsgId && removedCardMsgIds.has(cardMsgId)) {
        const sid = toSessionId(session?.id)
        if (sid) sessionIds.add(sid)
      }
    }
  }

  if (sessionIds.size === 0) return { removedSessions: 0, removedCards: 0, removedMemories: 0 }
  return removeOfflineSessionsAndArtifacts(contact, Array.from(sessionIds))
}

export function findOfflineSessionById(contact, sessionId) {
  return getSessionById(contact, sessionId)
}
import { formatBeijingLocale } from './beijingTime'
