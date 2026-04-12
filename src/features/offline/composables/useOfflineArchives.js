import { computed } from 'vue'
import { makeId } from '../../../utils/id'
import { formatBeijingLocale } from '../../../utils/beijingTime'
import { applyDisplayRegexRules, stripHtmlForPreview } from '../utils/offlineRichText'
import {
  ensureOfflineContactFields,
  removeOfflineSessionsAndArtifacts
} from '../../../utils/offlineSessionLinkage'

const MAX_OFFLINE_SNAPSHOTS = 30

function buildSimpleTextSummary(msgs, regexRules) {
  const textMsgs = msgs.filter(m =>
    m.role === 'assistant' && m.content && typeof m.content === 'string'
  )
  if (textMsgs.length === 0) return '线下剧情'

  const picks = []
  picks.push(textMsgs[0])
  if (textMsgs.length > 1) picks.push(textMsgs[textMsgs.length - 1])

  const snippets = picks.map(m => {
    const clean = stripHtmlForPreview(
      applyDisplayRegexRules(
        String(m.content),
        regexRules || []
      )
    )
    return clean.length > 80 ? clean.slice(0, 80) + '…' : clean
  })

  return snippets.join(' … ')
}

function buildOfflineSummaryPrompt() {
  return [
    '你是一位擅长捕捉人际互动细节的记忆记录者。请将以下线下见面场景转化为一段简洁的回忆片段。',
    '',
    '【记录原则】',
    '1. 只记录实际发生的事件和互动，严禁心理分析或主观臆断',
    '2. 用具体行为代替抽象描述',
    '   ✗ "气氛变得暧昧" ✗ "两人关系升温"',
    '   ✓ "{{char}}主动挽住了{{user}}的手臂" ✓ "{{user}}把外套披在{{char}}肩上"',
    '3. 保留关键对话的核心内容，不用"聊了很多"一笔带过',
    '   ✗ "两人进行了深入交流"',
    '   ✓ "{{char}}提到了自己小时候的经历，{{user}}承诺会陪着她"',
    '4. 记录承诺、约定、冲突、身体接触等具有延续性的事件',
    '5. 过去式，使用{{user}}和{{char}}指代',
    '',
    '【输出要求】',
    '- 一段连贯的叙事文字，不超过150字',
    '- 按时间顺序叙述，保留因果关系',
    '- 不要标题、列表、Markdown、XML标签',
    '- 仅输出总结内容本身'
  ].join('\n')
}

function formatOfflineMsgsForSummary(msgs, maxMsgs = 30) {
  const textMsgs = msgs.filter(m =>
    (m.role === 'user' || m.role === 'assistant') &&
    m.content && typeof m.content === 'string'
  )
  let selected = textMsgs
  if (textMsgs.length > maxMsgs) {
    const head = textMsgs.slice(0, Math.floor(maxMsgs / 3))
    const tail = textMsgs.slice(-Math.ceil(maxMsgs * 2 / 3))
    selected = [...head, ...tail]
  }
  return selected.map(m => {
    const who = m.role === 'user' ? '{{user}}' : '{{char}}'
    const text = String(m.content).replace(/\n+/g, ' ').trim()
    const truncated = text.length > 120 ? text.slice(0, 120) + '…' : text
    return `${who}: ${truncated}`
  }).join('\n')
}

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
}

function normalizeOfflineSessionRecord(raw) {
  const startTime = Number(raw?.startTime || Date.now())
  const endTime = Number(raw?.endTime || startTime)
  const msgIds = Array.isArray(raw?.msgIds)
    ? raw.msgIds.map(id => String(id || '').trim()).filter(Boolean)
    : []
  return {
    id: String(raw?.id || makeId('osess')),
    startTime: Number.isFinite(startTime) ? startTime : Date.now(),
    endTime: Number.isFinite(endTime) ? endTime : Date.now(),
    summary: String(raw?.summary || '').trim() || '线下剧情',
    msgIds,
    cardMsgId: String(raw?.cardMsgId || '').trim() || null,
    memoryId: String(raw?.memoryId || '').trim() || null,
    injectedToChat: raw?.injectedToChat === true
  }
}

function buildOfflineSnapshotName() {
  const now = new Date()
  const stamp = formatBeijingLocale(now, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `线下分支 ${stamp}`
}

function createSnapshotRecord(name, payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {
    offlineMsgs: [],
    offlineSessions: [],
    offlineArchiveCursor: 0,
    offlineCards: [],
    offlineMemories: []
  }
  return {
    id: makeId('offsnap'),
    name: String(name || '').trim() || buildOfflineSnapshotName(),
    savedAt: Date.now(),
    messageCount: Array.isArray(safePayload.offlineMsgs) ? safePayload.offlineMsgs.length : 0,
    sessionCount: Array.isArray(safePayload.offlineSessions) ? safePayload.offlineSessions.length : 0,
    payload: safePayload
  }
}

export function useOfflineArchives({
  contact,
  contactId,
  offlineStore,
  effectiveRegexRules,
  settingsStore,
  scheduleSave,
  showToast,
  initContactMemory,
  addCoreMemory,
  callSummaryAPI,
  router,
  scrollStoryToBottom,
  closeArchivePanel
}) {
  const offlineSnapshots = computed(() => {
    if (!contact.value) return []
    ensureOfflineContactFields(contact.value)
    const list = Array.isArray(contact.value.offlineSnapshots) ? contact.value.offlineSnapshots : []
    return [...list].sort((a, b) => Number(b?.savedAt || 0) - Number(a?.savedAt || 0))
  })

  const collectOfflineSnapshotPayload = () => {
    if (!contact.value) return null
    ensureOfflineContactFields(contact.value)

    const sessions = (contact.value.offlineSessions || []).map(normalizeOfflineSessionRecord)
    const sessionIdSet = new Set(sessions.map(s => s.id))

    const offlineCards = (contact.value.msgs || [])
      .filter(msg => msg?.type === 'offlineCard' && sessionIdSet.has(String(msg?.sessionId || '').trim()))
      .map(msg => cloneJson(msg, null))
      .filter(Boolean)

    const offlineMemories = []
    const coreMemories = Array.isArray(contact.value?.memory?.core) ? contact.value.memory.core : []
    const sessionMemoryIdSet = new Set(sessions.map(s => String(s.memoryId || '').trim()).filter(Boolean))

    for (const mem of coreMemories) {
      if (!mem || typeof mem !== 'object') continue
      const memoryId = String(mem.id || '').trim()
      const linkedSessionId = String(mem.offlineSessionId || mem.sessionId || '').trim()
      if (linkedSessionId && sessionIdSet.has(linkedSessionId)) {
        offlineMemories.push(cloneJson(mem, null))
        continue
      }
      if (memoryId && sessionMemoryIdSet.has(memoryId)) {
        offlineMemories.push(cloneJson(mem, null))
      }
    }

    const dedupe = new Set()
    const dedupedMemories = offlineMemories.filter((mem) => {
      const id = String(mem?.id || '').trim()
      if (!id) return true
      if (dedupe.has(id)) return false
      dedupe.add(id)
      return true
    })

    return {
      offlineMsgs: cloneJson(contact.value.offlineMsgs || [], []),
      offlineSessions: cloneJson(sessions, []),
      offlineArchiveCursor: Number(contact.value.offlineArchiveCursor || 0),
      offlineCards,
      offlineMemories: dedupedMemories
    }
  }

  const applyOfflineSnapshotPayload = (snapshot) => {
    if (!contact.value || !snapshot || typeof snapshot !== 'object') return false
    ensureOfflineContactFields(contact.value)

    const payload = snapshot.payload && typeof snapshot.payload === 'object'
      ? snapshot.payload
      : snapshot

    const nextMsgs = Array.isArray(payload.offlineMsgs) ? cloneJson(payload.offlineMsgs, []) : []
    const nextSessionsRaw = Array.isArray(payload.offlineSessions) ? payload.offlineSessions : []
    const nextSessions = nextSessionsRaw.map(normalizeOfflineSessionRecord)
    const sessionIdSet = new Set(nextSessions.map(s => s.id))

    const cursorRaw = Number(payload.offlineArchiveCursor || 0)
    const nextCursor = Number.isFinite(cursorRaw)
      ? Math.max(0, Math.min(Math.round(cursorRaw), nextMsgs.length))
      : 0

    const nextCards = Array.isArray(payload.offlineCards)
      ? payload.offlineCards
          .map(card => cloneJson(card, null))
          .filter(card => card && card.type === 'offlineCard' && sessionIdSet.has(String(card.sessionId || '').trim()))
      : []

    contact.value.offlineMsgs = nextMsgs
    contact.value.offlineSessions = nextSessions
    contact.value.offlineArchiveCursor = nextCursor

    if (!Array.isArray(contact.value.msgs)) contact.value.msgs = []
    const nonOfflineMsgs = contact.value.msgs.filter(msg => msg?.type !== 'offlineCard')
    contact.value.msgs = [...nonOfflineMsgs, ...nextCards].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0))

    initContactMemory(contact.value)
    const cleanedExisting = (contact.value.memory.core || []).filter((mem) => {
      const source = String(mem?.offlineSource || '').trim().toLowerCase()
      const linkedSessionId = String(mem?.offlineSessionId || mem?.sessionId || '').trim()
      if (source === 'offline') return false
      if (linkedSessionId) return false
      if (String(mem?.source || '').trim() === 'manager' && String(mem?.content || '').startsWith('[线下见面] ')) {
        return false
      }
      return true
    })

    const restored = (Array.isArray(payload.offlineMemories) ? payload.offlineMemories : [])
      .map(mem => cloneJson(mem, null))
      .filter(Boolean)
      .map((mem) => {
        if (!mem.id) mem.id = makeId('mem')
        if (!Number.isFinite(Number(mem.time))) mem.time = Date.now()
        if (typeof mem.enabled !== 'boolean') mem.enabled = true
        if (!mem.source) mem.source = 'manager'
        if (!mem.offlineSource) mem.offlineSource = 'offline'
        return mem
      })

    contact.value.memory.core = [...cleanedExisting, ...restored]

    return true
  }

  const getSnapshotById = (snapshotId) => {
    if (!contact.value) return null
    ensureOfflineContactFields(contact.value)
    const key = String(snapshotId || '').trim()
    if (!key) return null
    return (contact.value.offlineSnapshots || []).find(s => String(s?.id || '').trim() === key) || null
  }

  const pushSnapshot = (snapshot) => {
    if (!contact.value || !snapshot) return null
    ensureOfflineContactFields(contact.value)
    contact.value.offlineSnapshots.unshift(snapshot)
    if (contact.value.offlineSnapshots.length > MAX_OFFLINE_SNAPSHOTS) {
      contact.value.offlineSnapshots.length = MAX_OFFLINE_SNAPSHOTS
    }
    return snapshot
  }

  const handleSaveArchive = (customName = '', options = {}) => {
    if (!contact.value) return
    const payload = collectOfflineSnapshotPayload()
    if (!payload) return
    const finalName = String(customName || '').trim() || buildOfflineSnapshotName()
    const snapshot = createSnapshotRecord(finalName, payload)
    pushSnapshot(snapshot)
    scheduleSave()
    if (options?.silent !== true) {
      showToast('线下分支已存档')
    }
    return snapshot
  }

  const handleCreateNewArchiveBranch = (customName = '') => {
    if (!contact.value) return
    ensureOfflineContactFields(contact.value)

    const hasCurrentProgress =
      (Array.isArray(contact.value.offlineMsgs) && contact.value.offlineMsgs.length > 0) ||
      (Array.isArray(contact.value.offlineSessions) && contact.value.offlineSessions.length > 0)

    if (hasCurrentProgress) {
      const shouldAutoSave = window.confirm('当前线下进度可先自动存档，是否先保存再新开分支？')
      if (shouldAutoSave) {
        handleSaveArchive('', { silent: true })
      }
    }

    const branchName = String(customName || '').trim() || buildOfflineSnapshotName().replace('线下分支', '新分支')
    const emptyPayload = {
      offlineMsgs: [],
      offlineSessions: [],
      offlineArchiveCursor: 0,
      offlineCards: [],
      offlineMemories: []
    }
    const branchSnapshot = createSnapshotRecord(branchName, emptyPayload)
    pushSnapshot(branchSnapshot)
    applyOfflineSnapshotPayload(branchSnapshot)
    scheduleSave()
    scrollStoryToBottom()
    closeArchivePanel?.()
    showToast('已新开线下分支')
  }

  const handleLoadArchive = (snapshotId) => {
    if (!contact.value) return
    const snapshot = getSnapshotById(snapshotId)
    if (!snapshot) {
      showToast('未找到存档')
      return
    }
    const ok = window.confirm(`读档后将覆盖当前线下内容，确定读取“${snapshot.name || '未命名存档'}”吗？`)
    if (!ok) return

    const restored = applyOfflineSnapshotPayload(snapshot)
    if (!restored) {
      showToast('读档失败')
      return
    }
    scheduleSave()
    scrollStoryToBottom()
    closeArchivePanel?.()
    showToast('已读取线下存档')
  }

  const handleDeleteArchive = (snapshotId) => {
    if (!contact.value) return
    ensureOfflineContactFields(contact.value)
    const key = String(snapshotId || '').trim()
    if (!key) return
    const snapshot = getSnapshotById(key)
    if (!snapshot) return
    const ok = window.confirm(`确定删除存档“${snapshot.name || '未命名存档'}”？`)
    if (!ok) return

    const snapshotSessionIds = Array.isArray(snapshot?.payload?.offlineSessions)
      ? snapshot.payload.offlineSessions
          .map(s => String(s?.id || '').trim())
          .filter(Boolean)
      : []
    const existingSessionIdSet = new Set((contact.value.offlineSessions || []).map(s => String(s?.id || '').trim()))
    const cleanupCandidates = snapshotSessionIds.filter(id => existingSessionIdSet.has(id))

    let cleanupStats = null
    if (cleanupCandidates.length > 0) {
      const needCleanup = window.confirm('是否同时删除该存档关联的主聊天线下卡片和注入总结？')
      if (needCleanup) {
        cleanupStats = removeOfflineSessionsAndArtifacts(contact.value, cleanupCandidates)
      }
    }

    const prev = contact.value.offlineSnapshots.length
    contact.value.offlineSnapshots = contact.value.offlineSnapshots.filter(s => String(s?.id || '').trim() !== key)
    if (contact.value.offlineSnapshots.length !== prev) {
      scheduleSave()
      if (cleanupStats) {
        showToast(`存档已删除，并清理 ${cleanupStats.removedCards} 张卡片 / ${cleanupStats.removedMemories} 条记忆`)
      } else {
        showToast('存档已删除')
      }
    }
  }

  const handleRenameArchive = (snapshotId, nextName) => {
    if (!contact.value) return
    const snapshot = getSnapshotById(snapshotId)
    if (!snapshot) return
    const name = String(nextName || '').trim()
    if (!name) {
      showToast('名称不能为空')
      return
    }
    snapshot.name = name
    snapshot.savedAt = Date.now()
    scheduleSave()
  }

  const quickReturnToChat = () => {
    scheduleSave()
    router.push('/chat/' + contactId.value)
  }

  const finalizeOfflineSessionAndReturn = async (options = {}) => {
    const { forceToast = false } = options
    if (!contact.value) return
    ensureOfflineContactFields(contact.value)

    const allMsgs = contact.value.offlineMsgs || []
    const rawCursor = Number(contact.value.offlineArchiveCursor || 0)
    const archiveCursor = Math.max(0, Math.min(rawCursor, allMsgs.length))
    const msgs = allMsgs.slice(archiveCursor)

    if (msgs.length > 0) {
      const startTime = msgs[0]?.time || Date.now()
      const endTime = msgs[msgs.length - 1]?.time || Date.now()

      let summaryContent = ''
      let detailedSummary = ''

      // Always attempt LLM summary
      const msgText = formatOfflineMsgsForSummary(msgs)
      if (msgText.trim()) {
        showToast('正在生成总结…')
        try {
          const prompt = buildOfflineSummaryPrompt()
          const result = await callSummaryAPI(prompt, msgText, contact.value, {
            temperature: 0.3
          })
          if (result.success && result.content) {
            detailedSummary = result.content.trim()
            summaryContent = detailedSummary
          }
        } catch {
          // LLM failed, fall through to simple summary
        }
      }

      if (!summaryContent) {
        summaryContent = buildSimpleTextSummary(msgs, effectiveRegexRules?.value || offlineStore.regexRules || [])
      }

      const displaySummary = summaryContent.length > 60
        ? summaryContent.slice(0, 60) + '…'
        : summaryContent

      const startText = formatBeijingLocale(new Date(startTime), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      const endText = formatBeijingLocale(new Date(endTime), { hour: '2-digit', minute: '2-digit' })
      const framedContent = [
        `<offline_meeting time="${startText}-${endText}">`,
        `{{user}}和{{char}}刚刚在线下见面了。以下是这次见面的经过：`,
        summaryContent,
        '请在后续对话中自然地参考这次线下见面的经历，不要当作没发生过。',
        '</offline_meeting>'
      ].join('\n')

      const session = normalizeOfflineSessionRecord({
        id: makeId('osess'),
        startTime,
        endTime,
        summary: displaySummary,
        msgIds: msgs.map(msg => msg?.id).filter(Boolean),
        injectedToChat: settingsStore.offlineInjectToChat === true
      })

      if (!Array.isArray(contact.value.msgs)) contact.value.msgs = []
      const offlineCardMsg = {
        id: makeId('msg'),
        role: 'system',
        content: framedContent,
        time: Date.now(),
        type: 'offlineCard',
        sessionId: session.id,
        offlineSummary: displaySummary,
        offlineStartTime: startTime,
        offlineEndTime: endTime
      }
      contact.value.msgs.push(offlineCardMsg)
      session.cardMsgId = String(offlineCardMsg.id || '').trim() || null

      contact.value.offlineSessions.push(session)

      if (settingsStore.offlineInjectToChat) {
        initContactMemory(contact.value)

        const memoryText = detailedSummary || displaySummary
        const memory = addCoreMemory(
          contact.value,
          `[线下见面] ${startText}-${endText}，{{user}}和{{char}}在线下见面了。${memoryText}`,
          'manager',
          { priority: 'normal', category: 'fact', enabled: true }
        )
        if (memory) {
          memory.offlineSource = 'offline'
          memory.offlineSessionId = session.id
          session.memoryId = String(memory.id || '').trim() || null
        }
      }

      contact.value.offlineArchiveCursor = allMsgs.length

      if (!settingsStore.offlineKeepHistory) {
        contact.value.offlineMsgs = []
        contact.value.offlineArchiveCursor = 0
      }
    }

    scheduleSave()
    if (forceToast || msgs.length > 0) {
      showToast(msgs.length > 0 ? '线下会话已结束' : '已返回聊天')
    }
    router.push('/chat/' + contactId.value)
  }

  return {
    offlineSnapshots,
    handleSaveArchive,
    handleCreateNewArchiveBranch,
    handleLoadArchive,
    handleDeleteArchive,
    handleRenameArchive,
    quickReturnToChat,
    finalizeOfflineSessionAndReturn
  }
}
