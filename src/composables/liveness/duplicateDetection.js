import { formatBeijingLocale } from '../../utils/beijingTime'

const DEFAULT_DUPLICATE_WINDOW_MS = 6 * 60 * 60 * 1000

function formatTimeHHMM(ts) {
  const time = Number(ts)
  if (!Number.isFinite(time) || time <= 0) return '--:--'
  try {
    return formatBeijingLocale(new Date(time), { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

export function normalizeForSimilarity(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s`~!@#$%^&*()_\-+=[\]{}|\\:;"'<>,.?/，。！？；：、“”‘’（）【】《》…·]+/g, '')
    .trim()
}

export function buildBigramMap(text) {
  const map = new Map()
  if (!text || text.length < 2) return map
  for (let i = 0; i < text.length - 1; i += 1) {
    const bg = text.slice(i, i + 2)
    map.set(bg, (map.get(bg) || 0) + 1)
  }
  return map
}

export function diceSimilarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const mapA = buildBigramMap(a)
  const mapB = buildBigramMap(b)
  let overlap = 0
  let totalA = 0
  let totalB = 0
  mapA.forEach((count) => { totalA += count })
  mapB.forEach((count) => { totalB += count })
  mapA.forEach((countA, bg) => {
    const countB = mapB.get(bg) || 0
    overlap += Math.min(countA, countB)
  })
  if (!totalA || !totalB) return 0
  return (2 * overlap) / (totalA + totalB)
}

export function isNearDuplicateText(nextContent, historyContent, similarityThreshold = 0.88) {
  const nextPlain = normalizeForSimilarity(nextContent)
  const histPlain = normalizeForSimilarity(historyContent)
  if (!nextPlain || !histPlain) return false
  if (nextPlain === histPlain) return true

  const minLen = Math.min(nextPlain.length, histPlain.length)
  if (minLen <= 4) return false

  if (minLen >= 8 && (nextPlain.includes(histPlain) || histPlain.includes(nextPlain))) {
    return true
  }

  return diceSimilarity(nextPlain, histPlain) >= similarityThreshold
}

export function countRecentProactiveMessages(contact, {
  sinceMs = 0,
  stopAfter = Infinity,
  maxScan = 40
} = {}) {
  if (!contact || !Array.isArray(contact.msgs)) return 0
  let count = 0
  let scanned = 0
  for (let i = contact.msgs.length - 1; i >= 0; i -= 1) {
    const msg = contact.msgs[i]
    if (!msg || msg.role !== 'assistant') continue
    if (msg.hideInChat || msg.hidden) continue
    scanned += 1
    if (scanned > maxScan) break
    const time = Number(msg.time) || 0
    if (sinceMs && time > 0 && time < sinceMs) break
    if (msg.proactive === true) {
      count += 1
      if (count >= stopAfter) return count
    }
  }
  return count
}

export function countRecentGlobalProactiveMessages(contacts, { sinceMs = 0, stopAfter = Infinity } = {}) {
  if (!Array.isArray(contacts) || contacts.length === 0) return 0
  let total = 0
  for (const contact of contacts) {
    if (!contact || contact.type === 'group') continue
    total += countRecentProactiveMessages(contact, { sinceMs, stopAfter: Math.max(1, stopAfter - total) })
    if (total >= stopAfter) return total
  }
  return total
}

export function getLatestGlobalProactiveTimestamp(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return 0
  let latest = 0
  for (const contact of contacts) {
    if (!contact || contact.type === 'group' || !Array.isArray(contact.msgs)) continue
    for (let i = contact.msgs.length - 1; i >= 0; i -= 1) {
      const msg = contact.msgs[i]
      if (!msg || msg.role !== 'assistant') continue
      if (msg.hideInChat || msg.hidden) continue
      if (msg.proactive !== true) continue
      const time = Number(msg.time) || 0
      if (time > latest) latest = time
      break
    }
  }
  return latest
}

export function collectRecentProactiveSummaries(contact, { sinceMs = 0, limit = 3 } = {}) {
  if (!contact || !Array.isArray(contact.msgs) || limit <= 0) return []
  const result = []
  for (let i = contact.msgs.length - 1; i >= 0; i -= 1) {
    const msg = contact.msgs[i]
    if (!msg || msg.role !== 'assistant' || msg.proactive !== true) continue
    if (msg.hideInChat || msg.hidden) continue
    const time = Number(msg.time) || 0
    if (sinceMs && time > 0 && time < sinceMs) break
    const content = String(msg.content || '').replace(/\s+/g, ' ').trim()
    if (!content) continue
    result.push(`${formatTimeHHMM(time)} ${content.slice(0, 36)}`)
    if (result.length >= limit) break
  }
  return result.reverse()
}

export function normalizeMessageText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function hasRecentDuplicateAssistantMessage(contact, nextContent, {
  windowMs = DEFAULT_DUPLICATE_WINDOW_MS,
  maxScan = 20,
  similarityThreshold = 0.88
} = {}) {
  if (!contact || !Array.isArray(contact.msgs)) return false
  const normalizedNext = normalizeMessageText(nextContent)
  if (!normalizedNext) return false

  const now = Date.now()
  let scanned = 0
  for (let i = contact.msgs.length - 1; i >= 0; i -= 1) {
    const msg = contact.msgs[i]
    if (!msg || msg.role !== 'assistant') continue
    if (msg.hideInChat || msg.hidden) continue
    scanned += 1
    if (scanned > maxScan) break

    const sentAt = Number(msg.time) || 0
    if (sentAt > 0 && now - sentAt > windowMs) break

    const normalizedHistory = normalizeMessageText(msg.content)
    if (normalizedHistory && isNearDuplicateText(normalizedNext, normalizedHistory, similarityThreshold)) {
      return true
    }
  }
  return false
}
