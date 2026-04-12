import { makeId } from '../../utils/id'
import { normalizeRoleAliasesToTemplateVars } from '../api/prompts'
import {
  assignAmCode,
  clampNumber,
  DEFAULT_MEMORY_SETTINGS,
  getNewTextMessages,
  getTextMessagesInStrictRange,
  initContactMemory,
  normalizeSummaryRequestOptions,
  shortErrorText
} from './shared'

export function buildSummaryPromptByType(type = 'short') {
  if (type === 'long') {
    return [
      '请将以下对话内容提炼为一段高密度概要（不超过100字）。',
      '重点保留稳定设定、关键关系变化与重要决定。',
      '使用{{char}}和{{user}}。'
    ].join('\n')
  }

  return [
    '请用1-2句话简洁总结以下对话要点，只保留重要信息。',
    '使用{{char}}和{{user}}。'
  ].join('\n')
}

export function upsertSummaryEntry(contact, payload, options = {}) {
  initContactMemory(contact)
  const type = options.type === 'long' ? 'long' : 'short'
  const replaceSummaryId = options.replaceSummaryId ? String(options.replaceSummaryId) : ''
  let list = type === 'long' ? contact.memory.longTerm : contact.memory.shortTerm

  let target = null
  if (replaceSummaryId) {
    target = list.find(s => String(s?.id || '') === replaceSummaryId) || null
  }

  if (target) {
    const baseMerged = typeof target.merged === 'boolean' ? target.merged : false
    Object.assign(target, payload, { time: Date.now(), id: target.id })
    if (type === 'short' && typeof target.merged !== 'boolean') target.merged = baseMerged
    return target
  }

  const amCode = assignAmCode(contact)
  list = type === 'long' ? contact.memory.longTerm : contact.memory.shortTerm
  const summary = {
    id: makeId(type === 'long' ? 'long' : 'short'),
    time: Date.now(),
    amCode,
    ...payload
  }
  if (type === 'short' && typeof summary.merged !== 'boolean') summary.merged = false
  list.push(summary)
  return summary
}

export function createFailedSummaryEntry(contact, requestOptions, chunk, error) {
  if (!requestOptions?.persistFailure) return null
  if (!chunk?.length) return null
  const targetType = requestOptions.targetType === 'long' ? 'long' : 'short'
  const fallbackText = targetType === 'long'
    ? '（长期总结失败，点击重Roll重试）'
    : '（总结失败，点击重Roll重试）'

  return upsertSummaryEntry(contact, {
    content: fallbackText,
    status: 'failed',
    lastError: shortErrorText(error || '总结失败', 200) || '总结失败',
    msgRange: {
      start: chunk[0]?.id || null,
      end: chunk[chunk.length - 1]?.id || null,
      count: chunk.length
    },
    merged: false
  }, {
    type: targetType,
    replaceSummaryId: requestOptions.replaceSummaryId || null
  })
}

// 生成小总结
export async function generateShortSummary(contact, request = null, deps = {}) {
  const { callSummaryAPI } = deps
  if (!contact?.msgs?.length) {
    return { success: false, error: '没有消息记录' }
  }

  if (typeof callSummaryAPI !== 'function') {
    return { success: false, error: '总结服务未初始化' }
  }

  initContactMemory(contact)

  const opts = normalizeSummaryRequestOptions(request)
  const targetType = opts.targetType === 'long' ? 'long' : 'short'
  const hasExplicitRange = !!(opts.startMsgId || opts.endMsgId)
  const minMessages = clampNumber(opts.minMessages, 1, 50, hasExplicitRange ? 2 : 5)
  const maxMessages = clampNumber(opts.maxMessages, 8, 200, hasExplicitRange ? 120 : 60)

  let candidates = []
  if (hasExplicitRange) {
    if (!opts.startMsgId || !opts.endMsgId) {
      return { success: false, error: '请选择完整的起止范围' }
    }
    const rangeResult = getTextMessagesInStrictRange(contact, opts.startMsgId, opts.endMsgId)
    if (!rangeResult.success) {
      return { success: false, error: rangeResult.error }
    }
    candidates = rangeResult.messages
  } else {
    candidates = getNewTextMessages(contact, opts.startMsgId || null, opts.endMsgId || null)
  }

  if (candidates.length === 0) {
    return { success: false, error: '没有可总结的文本内容' }
  }
  if (!opts.force && candidates.length < minMessages) {
    return { success: false, error: `新消息不足（${candidates.length}/${minMessages}）` }
  }

  const chunk = candidates.slice(0, maxMessages)
  const msgText = chunk
    .map(m => {
      const who = m.role === 'user' ? '{{user}}' : '{{char}}'
      return `${who}: ${m.content}`
    })
    .join('\n')

  if (!msgText.trim()) {
    return { success: false, error: '没有可总结的文本内容' }
  }

  const prompt = buildSummaryPromptByType(targetType)
  const result = await callSummaryAPI(prompt, msgText, contact, {
    temperature: 0.3,
    maxRetries: opts.maxRetries
  })
  if (!result.success) {
    const failedSummary = createFailedSummaryEntry(contact, { ...opts, targetType }, chunk, result.error)
    return { success: false, error: result.error || 'API 调用失败', summary: failedSummary }
  }

  const summary = upsertSummaryEntry(contact, {
    content: normalizeRoleAliasesToTemplateVars(result.content),
    msgRange: {
      start: chunk[0]?.id || null,
      end: chunk[chunk.length - 1]?.id || null,
      count: chunk.length
    },
    status: result.truncated ? 'truncated' : 'ok',
    lastError: result.truncated ? '响应被截断，可重Roll补全' : null,
    merged: false
  }, {
    type: targetType,
    replaceSummaryId: opts.replaceSummaryId || null
  })

  const shouldAdvanceCursor = targetType === 'short' && !hasExplicitRange && !opts.replaceSummaryId
  if (shouldAdvanceCursor) {
    contact.memory.lastSummaryMsgId = chunk[chunk.length - 1]?.id
  }

  // 手动选范围总结应保留为可见的近期总结，不要立即并入长期总结。
  if (targetType === 'short' && !hasExplicitRange && !opts.replaceSummaryId) {
    await checkAndMergeLongTerm(contact, deps)
  }

  return { success: true, summary, truncated: !!result.truncated }
}

// 合并小总结为大总结
export async function checkAndMergeLongTerm(contact, deps = {}) {
  const { callSummaryAPI } = deps
  if (!contact || typeof callSummaryAPI !== 'function') return null
  initContactMemory(contact)

  const settings = contact.memorySettings || DEFAULT_MEMORY_SETTINGS
  const unmerged = contact.memory.shortTerm.filter(s => s && !s.merged && s.content && s.status !== 'failed' && s.status !== 'truncated')

  if (unmerged.length < settings.shortTermMergeThreshold) return null

  // 构建小总结文本
  const summaryText = unmerged.map(s => '- ' + normalizeRoleAliasesToTemplateVars(s.content)).join('\n')

  const prompt = [
    '请将以下多条对话总结合并为一段简洁的概要（不超过100字）。',
    '使用{{char}}和{{user}}。'
  ].join('\n')

  const result = await callSummaryAPI(prompt, summaryText, contact, { temperature: 0.3 })
  if (!result.success) return null

  const longSummary = {
    id: makeId('long'),
    content: normalizeRoleAliasesToTemplateVars(result.content),
    time: Date.now(),
    msgRange: {
      start: unmerged[0]?.msgRange?.start,
      end: unmerged[unmerged.length - 1]?.msgRange?.end,
      count: unmerged.reduce((sum, s) => sum + (s.msgRange?.count || 0), 0)
    },
    childIds: unmerged.map(s => s.id),
    status: result.truncated ? 'truncated' : 'ok',
    lastError: result.truncated ? '响应被截断，可重Roll补全' : null
  }

  // 标记小总结为已合并
  unmerged.forEach(s => { s.merged = true })
  contact.memory.longTerm.push(longSummary)
  contact.memory.lastLongTermTime = Date.now()

  return longSummary
}

function pickLatestSummaryCursor(contact) {
  if (!contact?.memory?.shortTerm?.length) return null
  const msgs = Array.isArray(contact.msgs) ? contact.msgs : []
  if (!msgs.length) return null
  const idxMap = new Map(msgs.map((m, i) => [m?.id, i]))

  const candidates = contact.memory.shortTerm
    .filter(s => s?.msgRange?.end)
    .map(s => ({ end: s.msgRange.end, idx: idxMap.has(s.msgRange.end) ? idxMap.get(s.msgRange.end) : -1 }))
    .filter(item => item.idx >= 0)

  if (!candidates.length) return null
  candidates.sort((a, b) => b.idx - a.idx)
  return candidates[0].end
}

// 删除总结
export function deleteSummary(contact, summaryId, type = 'short') {
  if (!contact?.memory) return
  if (type === 'short') {
    const deleted = contact.memory.shortTerm.find(s => s.id === summaryId)
    contact.memory.shortTerm = contact.memory.shortTerm.filter(s => s.id !== summaryId)
    // 如果删除的是最后一个总结对应的消息范围，重置 lastSummaryMsgId
    if (deleted && contact.memory.lastSummaryMsgId === deleted.msgRange?.end) {
      contact.memory.lastSummaryMsgId = pickLatestSummaryCursor(contact)
    }
    return
  }

  contact.memory.longTerm = contact.memory.longTerm.filter(s => s.id !== summaryId)
}

// 更新总结内容
export function updateSummary(contact, summaryId, content, type = 'short') {
  if (!contact?.memory) return null
  const list = type === 'short' ? contact.memory.shortTerm : contact.memory.longTerm
  const summary = list?.find(s => s.id === summaryId)
  if (summary) {
    summary.content = content.trim()
    summary.time = Date.now()
    summary.status = 'ok'
    summary.lastError = null
  }
  return summary
}

export async function rerollSummary(contact, summaryId, type = 'short', deps = {}) {
  if (!contact?.memory) return { success: false, error: '没有记忆数据' }
  const list = type === 'long' ? contact.memory.longTerm : contact.memory.shortTerm
  const summary = list?.find(s => String(s?.id || '') === String(summaryId || ''))
  if (!summary) return { success: false, error: '未找到对应总结' }

  const startMsgId = summary?.msgRange?.start
  const endMsgId = summary?.msgRange?.end
  if (!startMsgId || !endMsgId) {
    return { success: false, error: '该总结缺少消息范围，无法重Roll' }
  }

  return generateShortSummary(contact, {
    startMsgId,
    endMsgId,
    targetType: type === 'long' ? 'long' : 'short',
    replaceSummaryId: summary.id,
    minMessages: 1,
    maxMessages: type === 'long' ? 140 : 120,
    force: true,
    persistFailure: true
  }, deps)
}
