import { buildContextMessages, insertTimeGapMarkers } from './contextWindow'
import { shouldSkipMessageForAIContext } from './chatMessages'
import { buildHistorySearchQueries, searchMessages, formatRetrievedContext, rerankWithLLM, vectorSearchMessages } from '../retrieval/useHistorySearch'

/**
 * Get context-windowed messages for a contact, with optional history retrieval.
 * Returns { contextMsgs, retrievedContext } so retrievedContext can be placed
 * in post-history instructions instead of the middle attention valley.
 */
export async function getContextWindowedMsgs(contact) {
  const settings = contact?.memorySettings || {}
  const rawMsgs = Array.isArray(contact?.msgs) ? contact.msgs : []
  const allMsgs = rawMsgs.filter(msg => !shouldSkipMessageForAIContext(msg))

  // If smart context is disabled, fall back to slice(-20) but still insert
  // time-gap markers so the LLM can distinguish old vs current conversation
  if (!settings.enabled || !settings.smartContext) {
    return { contextMsgs: insertTimeGapMarkers(allMsgs.slice(-20)), retrievedContext: null }
  }

  // Perform history retrieval if enabled
  let retrievedContext = null
  if (settings.historyRetrievalEnabled && allMsgs.length > 0) {
    const tailCount = settings.contextTailRounds ? settings.contextTailRounds * 2 : 10
    const maxResults = settings.historyRetrievalCount || 3
    const maxTokens = settings.maxRetrievalTokens || 400
    const useVector = settings.vectorSearchEnabled && settings.embeddingApiUrl && settings.embeddingModel

    let results = []

    if (useVector) {
      // Vector search mode
      try {
        results = await vectorSearchMessages(allMsgs, contact, {
          maxResults,
          excludeRecent: tailCount,
          maxTokens
        })
      } catch {
        // Fall back to TF-IDF on vector search failure
        results = []
      }
    }

    // TF-IDF fallback (or primary mode when vector is disabled)
    if (!results.length) {
      const queryVariants = buildHistorySearchQueries(allMsgs)
      const primaryQuery = queryVariants[0]?.text || ''
      if (primaryQuery) {
        results = searchMessages(allMsgs, primaryQuery, {
          maxResults,
          excludeRecent: tailCount,
          maxTokens,
          queryVariants
        })
      }
    }

    if (results.length > 0) {
      // LLM reranking if enabled
      let finalResults = results
      if (settings.historyRetrievalMode === 'llm' && results.length > 1) {
        const queryVariants = buildHistorySearchQueries(allMsgs)
        const primaryQuery = queryVariants[0]?.text || ''
        if (primaryQuery) {
          try {
            finalResults = await rerankWithLLM(results, primaryQuery, contact)
          } catch {
            finalResults = results
          }
        }
      }
      retrievedContext = formatRetrievedContext(finalResults, allMsgs, { maxTokens })
    }
  }

  // Get context summary
  const middleSummary = contact?.memory?.contextSummary?.content || null

  const contextMsgs = buildContextMessages(allMsgs, {
    headRounds: settings.contextHeadRounds ?? 2,
    tailRounds: settings.contextTailRounds ?? 5,
    middleSummary
  })

  return { contextMsgs, retrievedContext }
}
