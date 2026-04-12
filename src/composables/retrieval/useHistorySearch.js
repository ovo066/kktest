/**
 * History search with TF-IDF relevance scoring.
 * Supports Chinese text via character bigrams and optional LLM reranking.
 */

import { estimateTokens, trimToMaxTokens } from '../../utils/tokens'
import { normalizeSearchText } from '../../utils/searchText'
import { useConfigsStore } from '../../stores/configs'
import { applyOptionalMaxTokens } from '../api/chatCompletions'

const MAX_QUERY_VARIANTS = 6
const MAX_QUERY_PHRASES = 4
const REFERENCE_CUE_REGEX = /(那个|这个|那次|这次|上次|之前|后来|当时|刚才|继续|还记得|记得吗|你说的|前面|那件事|这件事|它|他|她|她们|他们|这样|那样|这边|那边)/i

function getMessageSearchContent(message) {
  if (!message) return ''
  if (message.isImage || message.isSticker) return ''
  if (typeof message.content !== 'string') return ''
  return normalizeSearchText(message.content)
}

function isRetrievableMessage(message) {
  if (!message) return false
  if (message.role !== 'user' && message.role !== 'assistant') return false
  return !!getMessageSearchContent(message)
}

function getSpeakerLabel(message) {
  if (!message) return ''
  if (message.role === 'user') return '用户'
  return String(message.senderName || '').trim() || 'AI'
}

function truncateSnippet(text, maxLen = 120) {
  const normalized = normalizeSearchText(text)
  if (!normalized) return ''
  if (normalized.length <= maxLen) return normalized
  return normalized.slice(0, maxLen).trimEnd() + '...'
}

function extractSearchPhrases(text, maxItems = MAX_QUERY_PHRASES) {
  const normalized = normalizeSearchText(text)
  if (!normalized) return []

  const candidates = normalized
    .split(/[。！？!?；;，,\n]/)
    .map(chunk => chunk.trim())
    .filter(Boolean)

  const phrases = []
  const seen = new Set()
  for (const candidate of candidates) {
    if (candidate.length < 2) continue
    const key = candidate.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    phrases.push(candidate)
    if (phrases.length >= maxItems) break
  }
  return phrases
}

function isUnderspecifiedQuery(text) {
  const normalized = normalizeSearchText(text)
  if (!normalized) return false
  if (normalized.length <= 8) return true
  return REFERENCE_CUE_REGEX.test(normalized)
}

function pushQueryVariant(list, text, weight, label) {
  const normalized = normalizeSearchText(text)
  if (!normalized) return
  if (list.length >= MAX_QUERY_VARIANTS) return
  const key = normalized.toLowerCase()
  const existing = list.find(item => item.key === key)
  if (existing) {
    existing.weight = Math.max(existing.weight, weight)
    return
  }

  list.push({
    text: normalized,
    normalized,
    key,
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
    label: label || 'query',
    phrases: extractSearchPhrases(normalized)
  })
}

export function buildHistorySearchQueries(msgs, options = {}) {
  const recentWindow = Number.isFinite(Number(options.recentWindow))
    ? Math.max(2, Math.min(12, Math.floor(Number(options.recentWindow))))
    : 6

  const textMsgs = (Array.isArray(msgs) ? msgs : []).filter(isRetrievableMessage)
  if (textMsgs.length === 0) return []

  const variants = []
  const lastUserMsg = [...textMsgs].reverse().find(message => message.role === 'user') || null
  const recentMsgs = textMsgs.slice(-recentWindow)
  const recentUserMsgs = recentMsgs.filter(message => message.role === 'user')
  const previousUserMsg = recentUserMsgs.length >= 2 ? recentUserMsgs[recentUserMsgs.length - 2] : null
  const recentAssistantMsg = [...recentMsgs].reverse().find(message => message.role === 'assistant') || null

  if (lastUserMsg?.content) {
    const lastText = getMessageSearchContent(lastUserMsg)
    const vague = isUnderspecifiedQuery(lastText)

    pushQueryVariant(variants, lastText, 1.8, 'latest_user')

    if (lastUserMsg.replyToText) {
      pushQueryVariant(variants, lastUserMsg.replyToText, 1.45, 'reply_context')
    }

    if (previousUserMsg?.content) {
      const previousText = getMessageSearchContent(previousUserMsg)
      pushQueryVariant(variants, `${previousText}\n${lastText}`, vague ? 1.5 : 0.95, 'recent_user_window')

      if (vague) {
        pushQueryVariant(variants, previousText, 1.25, 'previous_user')
      }
    }

    if (vague && recentAssistantMsg?.content) {
      pushQueryVariant(
        variants,
        `${getMessageSearchContent(recentAssistantMsg)}\n${lastText}`,
        1.1,
        'assistant_bridge'
      )
    }

    if (recentMsgs.length >= 3) {
      const exchangeText = recentMsgs
        .slice(-4)
        .map(message => getMessageSearchContent(message))
        .filter(Boolean)
        .join('\n')
      pushQueryVariant(variants, exchangeText, vague ? 1.15 : 0.8, 'recent_exchange')
    }

    extractSearchPhrases(lastText, 2).forEach(phrase => {
      pushQueryVariant(variants, phrase, 1.3, 'latest_phrase')
    })
  }

  if (variants.length === 0 && recentMsgs.length > 0) {
    pushQueryVariant(
      variants,
      recentMsgs.map(message => getMessageSearchContent(message)).join('\n'),
      1,
      'recent_fallback'
    )
  }

  return variants
}

// ---- Chinese tokenization ----

/**
 * Tokenize text into searchable terms.
 * For CJK characters: character bigrams + single characters.
 * For ASCII: split on whitespace/punctuation into words.
 */
export function tokenizeChinese(text) {
  const s = String(text || '')
  const terms = []
  const asciiBuf = []

  function flushAscii() {
    if (asciiBuf.length > 0) {
      const word = asciiBuf.join('').toLowerCase()
      if (word.length >= 2) terms.push(word)
      asciiBuf.length = 0
    }
  }

  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)

    if (code < 128) {
      // ASCII
      if (/[a-zA-Z0-9]/.test(s[i])) {
        asciiBuf.push(s[i])
      } else {
        flushAscii()
      }
    } else {
      flushAscii()
      // CJK character: add as single term
      terms.push(s[i])
      // Bigram with next character if it's also CJK
      if (i + 1 < s.length && s.charCodeAt(i + 1) >= 128) {
        terms.push(s[i] + s[i + 1])
      }
    }
  }
  flushAscii()

  return terms
}

// ---- Inverted index ----

function buildRoundDocuments(msgs) {
  const docs = []
  let current = null

  function flushCurrent() {
    if (!current || current.lines.length === 0) return
    const body = current.lines.join('\n')
    docs.push({
      startIndex: current.startIndex,
      endIndex: current.endIndex,
      time: current.time,
      text: body,
      preview: truncateSnippet(body, 140),
      containsUser: current.containsUser
    })
  }

  for (let i = 0; i < msgs.length; i++) {
    const message = msgs[i]
    if (!isRetrievableMessage(message)) continue

    const content = getMessageSearchContent(message)
    if (!content) continue

    if (!current || message.role === 'user') {
      flushCurrent()
      current = {
        startIndex: i,
        endIndex: i,
        time: message.time,
        lines: [],
        containsUser: message.role === 'user'
      }
    } else {
      current.endIndex = i
      if (!current.time && message.time) current.time = message.time
    }

    current.lines.push(`${getSpeakerLabel(message)}: ${content}`)
    if (message.role === 'user') current.containsUser = true
  }

  flushCurrent()
  return docs
}

// WeakMap cache: keyed by msgs array reference
const indexCache = new WeakMap()

/**
 * Build an inverted index from round documents.
 * @param {Array} msgs - message array
 * @returns {{ docs: Array, index: Map<string, Set<number>>, docLengths: number[], docTermCounts: Map<string, number>[], totalDocs: number }}
 */
export function buildSearchIndex(msgs) {
  // Check cache
  const cached = indexCache.get(msgs)
  const lastKey = msgs?.[msgs.length - 1]?.id || msgs?.length || 0
  if (cached && cached.length === msgs.length && cached.lastKey === lastKey) return cached.data

  const docs = buildRoundDocuments(msgs)

  const index = new Map() // term -> Set<msgIndex>
  const docLengths = []
  const docTermCounts = []

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]
    const content = doc?.text
    if (!content) {
      docLengths.push(0)
      docTermCounts.push(new Map())
      continue
    }

    const terms = tokenizeChinese(content)
    docLengths.push(terms.length)
    const counts = new Map()

    const seen = new Set()
    for (const term of terms) {
      counts.set(term, (counts.get(term) || 0) + 1)
      if (seen.has(term)) continue
      seen.add(term)

      if (!index.has(term)) index.set(term, new Set())
      index.get(term).add(i)
    }
    docTermCounts.push(counts)
  }

  const data = { docs, index, docLengths, docTermCounts, totalDocs: docs.length }
  indexCache.set(msgs, { length: msgs.length, lastKey, data })
  return data
}

function normalizeQuerySpecs(query, options = {}) {
  if (Array.isArray(options.queryVariants) && options.queryVariants.length > 0) {
    return options.queryVariants
      .map(item => {
        if (!item || typeof item !== 'object') return null
        const normalized = normalizeSearchText(item.text)
        if (!normalized) return null
        return {
          text: normalized,
          normalized,
          weight: Number.isFinite(Number(item.weight)) && Number(item.weight) > 0 ? Number(item.weight) : 1,
          phrases: Array.isArray(item.phrases) && item.phrases.length > 0
            ? item.phrases.map(phrase => normalizeSearchText(phrase)).filter(Boolean).slice(0, MAX_QUERY_PHRASES)
            : extractSearchPhrases(normalized)
        }
      })
      .filter(Boolean)
      .slice(0, MAX_QUERY_VARIANTS)
  }

  const normalized = normalizeSearchText(query)
  if (!normalized) return []
  return [{
    text: normalized,
    normalized,
    weight: 1,
    phrases: extractSearchPhrases(normalized)
  }]
}

function buildPhraseBonus(docText, querySpecs) {
  let bonus = 0
  for (const spec of querySpecs) {
    if (!spec?.normalized) continue
    if (spec.normalized.length >= 4 && docText.includes(spec.normalized)) {
      bonus += spec.weight * Math.min(1.4, 0.35 + spec.normalized.length / 24)
      continue
    }
    for (const phrase of spec.phrases || []) {
      if (phrase.length < 2) continue
      if (docText.includes(phrase)) {
        bonus += spec.weight * Math.min(0.7, 0.18 + phrase.length / 30)
      }
    }
  }
  return bonus
}

// ---- TF-IDF search ----

/**
 * Search messages using TF-IDF scoring.
 * @param {Array} msgs - all messages
 * @param {string} query - search query
 * @param {Object} options
 * @param {number} options.maxResults - max results (default 3)
 * @param {number} options.excludeRecent - exclude last N messages (default 10)
 * @param {number} options.maxTokens - token budget for results (default 400)
 * @returns {Array<{ msgIndex: number, score: number, snippet: string }>}
 */
export function searchMessages(msgs, query, options = {}) {
  if (!msgs?.length || !query) return []

  const maxResults = options.maxResults || 3
  const excludeRecent = options.excludeRecent || 10
  const maxTokens = options.maxTokens || 400

  const { docs, index, docLengths, docTermCounts, totalDocs } = buildSearchIndex(msgs)
  const querySpecs = normalizeQuerySpecs(query, options)

  if (docs.length === 0 || querySpecs.length === 0) return []

  // Calculate TF-IDF scores for each message
  const scores = new Map()
  const searchableDocs = docs
    .map((doc, docIdx) => ({ doc, docIdx }))
    .filter(({ doc }) => doc && doc.startIndex < Math.max(0, msgs.length - excludeRecent))
  const searchableSet = new Set(searchableDocs.map(item => item.docIdx))
  if (searchableSet.size === 0) return []

  for (const spec of querySpecs) {
    const queryTerms = tokenizeChinese(spec.text)
    if (queryTerms.length === 0) continue

    for (const term of queryTerms) {
      const postings = index.get(term)
      if (!postings) continue

      const df = postings.size
      const idf = Math.log((totalDocs + 1) / (df + 1)) + 1

      for (const docIdx of postings) {
        if (!searchableSet.has(docIdx)) continue
        if (docLengths[docIdx] === 0) continue

        const tf = docTermCounts[docIdx]?.get(term) || 0
        if (tf <= 0) continue
        const normalizedTf = tf / (docLengths[docIdx] || 1)
        const tfidf = normalizedTf * idf * spec.weight
        scores.set(docIdx, (scores.get(docIdx) || 0) + tfidf)
      }
    }
  }

  if (scores.size === 0) return []

  const searchableCount = searchableDocs.length
  searchableDocs.forEach(({ doc, docIdx }, position) => {
    if (!scores.has(docIdx)) return
    const docText = normalizeSearchText(doc.text)
    const phraseBonus = buildPhraseBonus(docText, querySpecs)
    const recencyBonus = searchableCount <= 1 ? 1 : (0.94 + (position / (searchableCount - 1)) * 0.18)
    const roleBonus = doc.containsUser ? 1.08 : 1
    const combined = (scores.get(docIdx) || 0) + phraseBonus
    scores.set(docIdx, combined * recencyBonus * roleBonus)
  })

  // Sort by score descending
  const sorted = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults * 3) // Get extra candidates for token budgeting

  // Build results with token budget
  const results = []
  let tokenCount = 0

  for (const [docIdx, score] of sorted) {
    if (results.length >= maxResults) break

    const doc = docs[docIdx]
    if (!doc?.preview) continue

    const snippet = doc.preview

    const snippetTokens = estimateTokens(snippet)
    if (tokenCount + snippetTokens > maxTokens && results.length > 0) break

    results.push({
      msgIndex: doc.startIndex,
      startIndex: doc.startIndex,
      endIndex: doc.endIndex,
      score,
      snippet
    })
    tokenCount += snippetTokens
  }

  return results
}

// ---- Format results ----

const RETRIEVAL_HEADER = '[过去对话回忆 — 仅供参考，非当前对话]'

function describeRelativeTime(timestampMs) {
  if (!timestampMs) return ''
  const ts = Number(timestampMs)
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const diffMs = Date.now() - ts
  if (diffMs < 0) return ''
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return '约' + Math.max(1, minutes) + '分钟前'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return '约' + hours + '小时前'
  const days = Math.floor(hours / 24)
  if (days === 1) return '约1天前'
  if (days < 30) return '约' + days + '天前'
  const months = Math.floor(days / 30)
  return '约' + months + '个月前'
}

/**
 * Format search results into a context string for injection.
 * Each result includes the matched message and 1 message before/after for context.
 * @param {Array} results - from searchMessages
 * @param {Array} msgs - all messages
 * @returns {string}
 */
export function formatRetrievedContext(results, msgs, options = {}) {
  if (!results?.length || !msgs?.length) return ''

  const budget = Number(options?.maxTokens)
  const hasBudget = Number.isFinite(budget) && budget > 0

  const parts = []

  const seenRanges = new Set()

  for (const { msgIndex, startIndex, endIndex } of results) {
    const lines = []
    const rangeStart = Number.isFinite(Number(startIndex)) ? Number(startIndex) : Math.max(0, msgIndex - 1)
    const rangeEnd = Number.isFinite(Number(endIndex)) ? Number(endIndex) : Math.min(msgs.length - 1, msgIndex + 1)
    const rangeKey = `${rangeStart}:${rangeEnd}`
    if (seenRanges.has(rangeKey)) continue
    seenRanges.add(rangeKey)

    // Add relative time anchor from the matched message
    const matchedMsg = msgs[msgIndex] || msgs[rangeStart]
    const timeLabel = describeRelativeTime(matchedMsg?.time)
    lines.push(timeLabel ? `(${timeLabel})` : `(早期对话)`)

    for (let i = rangeStart; i <= rangeEnd; i++) {
      const m = msgs[i]
      if (!m?.content || m.isImage || m.isSticker) continue

      const who = m.role === 'user' ? '用户' : (m.senderName || 'AI')
      const content = m.content.length > 120
        ? m.content.slice(0, 120) + '...'
        : m.content
      lines.push(`${who}: ${content}`)
    }

    const chunk = lines.join('\n')
    if (hasBudget) {
      const remaining = budget - estimateTokens(RETRIEVAL_HEADER + '\n') - estimateTokens(parts.join('\n---\n'))
      if (remaining <= 0) break
      const trimmed = trimToMaxTokens(chunk, remaining)
      if (!trimmed) break
      parts.push(trimmed)
    } else {
      parts.push(chunk)
    }
  }

  if (parts.length === 0) return ''
  const rendered = RETRIEVAL_HEADER + '\n' + parts.join('\n---\n')
  return hasBudget ? trimToMaxTokens(rendered, budget) : rendered
}

// ---- LLM reranking (optional) ----

/**
 * Rerank search candidates using an LLM for better relevance.
 * @param {Array} candidates - results from searchMessages (top 8-10)
 * @param {string} query - the user's query
 * @param {Object} contact - the contact object (for API config)
 * @returns {Array} reranked top results
 */
// ---- Vector search (replaces TF-IDF when enabled) ----

/**
 * Build "round documents" for vector embedding — each round = one user msg + following assistant msgs.
 * Reuses the same logic as buildRoundDocuments but returns the text for embedding.
 */
function buildRoundTextsForEmbedding(msgs) {
  const docs = buildRoundDocuments(msgs)
  return docs.map((doc, idx) => ({
    roundIndex: idx,
    text: doc.text,
    startIndex: doc.startIndex,
    endIndex: doc.endIndex,
    time: doc.time,
    preview: doc.preview,
    containsUser: doc.containsUser
  }))
}

/**
 * Ensure all conversation rounds have vectors in the store.
 * Only embeds new rounds since the last vectorized position.
 * @param {Object} contact
 * @param {Array} msgs
 * @param {Object} embeddingConfig - { url, key, model, dimensions }
 * @returns {Promise<number>} number of newly embedded rounds
 */
export async function ensureRoundVectors(contact, msgs, embeddingConfig) {
  const { createVectorStore } = await import('../memory/vectorStore')
  const { fetchEmbeddings } = await import('../memory/embeddingApi')
  const { initContactMemory } = await import('../memory/shared')

  initContactMemory(contact)
  const vstore = createVectorStore(contact.id)
  if (contact.memory.roundVectorsDirty) {
    await vstore.deleteByType('round')
  }
  const existingRounds = await vstore.getAll('round')
  const existingIds = new Set(existingRounds.map(r => r.itemId))

  const allRounds = buildRoundTextsForEmbedding(msgs)
  const newRounds = allRounds.filter(r => !existingIds.has(String(r.roundIndex)))

  if (!newRounds.length) {
    contact.memory.lastVectorizedMsgId = msgs[msgs.length - 1]?.id || null
    contact.memory.roundVectorsDirty = false
    return 0
  }

  const EMBED_BATCH = 20
  let embedded = 0
  for (let i = 0; i < newRounds.length; i += EMBED_BATCH) {
    const batch = newRounds.slice(i, i + EMBED_BATCH)
    const texts = batch.map(r => r.text)
    const vectors = await fetchEmbeddings(texts, embeddingConfig)
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j]
      await vstore.upsert('round', String(r.roundIndex), vectors[j], r.text, {
        startIndex: r.startIndex,
        endIndex: r.endIndex,
        time: r.time
      })
    }
    embedded += batch.length
  }

  // Update cursor
  if (msgs.length) {
    contact.memory.lastVectorizedMsgId = msgs[msgs.length - 1].id
  }
  contact.memory.roundVectorsDirty = false

  return embedded
}

/**
 * Search messages using vector similarity (replaces TF-IDF when enabled).
 * Falls back to TF-IDF on any error.
 * @param {Array} msgs - all messages
 * @param {Object} contact - contact with memorySettings
 * @param {Object} options - { maxResults, excludeRecent, maxTokens }
 * @returns {Promise<Array<{ msgIndex, score, snippet }>>}
 */
export async function vectorSearchMessages(msgs, contact, options = {}) {
  const { createVectorStore } = await import('../memory/vectorStore')
  const { fetchEmbeddings } = await import('../memory/embeddingApi')
  const { getEmbeddingConfig, initContactMemory } = await import('../memory/shared')

  initContactMemory(contact)
  const embeddingConfig = getEmbeddingConfig(contact)
  if (!embeddingConfig) return searchMessages(msgs, '', options)

  const maxResults = options.maxResults || 3
  const excludeRecent = options.excludeRecent || 10
  const maxTokens = options.maxTokens || 400

  // Ensure round vectors are up to date (on-demand mode does it here)
  const settings = contact.memorySettings || {}
  if (settings.vectorIndexMode === 'ondemand' || contact.memory.roundVectorsDirty) {
    await ensureRoundVectors(contact, msgs, embeddingConfig)
  }

  // Build query from recent messages
  const queries = buildHistorySearchQueries(msgs, options)
  if (!queries.length) return []

  // Use the highest-weight query for embedding
  const bestQuery = queries.reduce((a, b) => (a.weight >= b.weight ? a : b))
  const [queryVec] = await fetchEmbeddings([bestQuery.text], embeddingConfig)
  if (!queryVec) return []

  const vstore = createVectorStore(contact.id)
  const candidates = await vstore.search(queryVec, {
    type: 'round',
    topK: maxResults * 3,
    minScore: 0.2
  })

  if (!candidates.length) return []

  // Rebuild round documents for consistent indexing
  const allRounds = buildRoundTextsForEmbedding(msgs)
  const cutoff = Math.max(0, msgs.length - excludeRecent)

  const results = []
  let tokenCount = 0

  for (const c of candidates) {
    if (results.length >= maxResults) break

    const roundIdx = parseInt(c.itemId, 10)
    const round = allRounds[roundIdx]
    if (!round) continue
    if (round.startIndex >= cutoff) continue

    const snippet = round.preview
    const snippetTokens = estimateTokens(snippet)
    if (tokenCount + snippetTokens > maxTokens && results.length > 0) break

    // Apply recency bonus
    const position = roundIdx / Math.max(1, allRounds.length - 1)
    const recencyBonus = 0.94 + position * 0.18
    const roleBonus = round.containsUser ? 1.08 : 1

    results.push({
      msgIndex: round.startIndex,
      startIndex: round.startIndex,
      endIndex: round.endIndex,
      score: c.score * recencyBonus * roleBonus,
      snippet
    })
    tokenCount += snippetTokens
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, maxResults)
}

export async function rerankWithLLM(candidates, query, contact) {
  if (!candidates?.length || candidates.length <= 1) return candidates

  const configsStore = useConfigsStore()
  const settings = contact?.memorySettings || {}

  // Get API config (prefer summaryConfigId for cheaper model)
  let cfg = null
  if (settings.summaryConfigId) {
    cfg = configsStore.configs.find(c => c.id === settings.summaryConfigId)
  }
  if (!cfg && contact?.configId) {
    cfg = configsStore.configs.find(c => c.id === contact.configId)
  }
  if (!cfg) cfg = configsStore.getConfig
  if (!cfg?.key || !cfg?.url) return candidates

  const maxCount = settings.historyRetrievalCount || 3

  // Build the reranking prompt
  const snippetList = candidates.map((c, i) => {
    return `[${i}] ${c.snippet}`
  }).join('\n')

  const prompt = `请从以下历史片段中选出与"${query}"最相关的 ${maxCount} 条，按相关性从高到低排列。
只输出序号列表（如：0,2,4），不要解释。

历史片段：
${snippetList}`

  try {
    let url = cfg.url.replace(/\/$/, '')
    if (!url.endsWith('/chat/completions')) url += '/chat/completions'

    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: '你是一个信息检索助手，只输出数字序号。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0
    }
    applyOptionalMaxTokens(body, cfg.maxTokens)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) return candidates

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return candidates

    // Parse the indices from the response
    const indices = content
      .replace(/[[\]]/g, '')
      .split(/[,，\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n >= 0 && n < candidates.length)

    if (indices.length === 0) return candidates

    // Deduplicate and take top N
    const seen = new Set()
    const reranked = []
    for (const idx of indices) {
      if (seen.has(idx)) continue
      seen.add(idx)
      reranked.push(candidates[idx])
      if (reranked.length >= maxCount) break
    }

    return reranked.length > 0 ? reranked : candidates
  } catch {
    return candidates
  }
}
