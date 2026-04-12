/**
 * Vector store — persists embedding vectors in IndexedDB (kv store)
 * with prefix-namespaced keys. Supports cosine similarity search via dot product
 * on pre-normalized vectors.
 *
 * Key pattern: `vec:${contactId}:${type}:${itemId}`
 * type = 'round' | 'summary' | 'core'
 */

import { idbGet, idbSet, idbDelete } from '../storage/idbKv'

const PREFIX = 'vec:'

function makeKey(contactId, type, itemId) {
  return `${PREFIX}${contactId}:${type}:${itemId}`
}

function dotProduct(a, b) {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) sum += a[i] * b[i]
  return sum
}

/**
 * List all keys in the kv store matching a prefix.
 * IndexedDB doesn't have native prefix scan on a plain key-value store,
 * so we use getAllKeys and filter client-side.
 */
async function getAllKeysWithPrefix(prefix) {
  // Use the same DB as idbKv
  const DB_NAME = 'aichat'
  const DB_VERSION = 3
  const STORE_KV = 'kv'

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(STORE_KV, 'readonly')
      const store = tx.objectStore(STORE_KV)
      const keysReq = store.getAllKeys()
      keysReq.onsuccess = () => {
        const allKeys = keysReq.result || []
        resolve(allKeys.filter(k => typeof k === 'string' && k.startsWith(prefix)))
      }
      keysReq.onerror = () => reject(keysReq.error)
    }
    req.onerror = () => reject(req.error)
  })
}

async function deleteMany(keys) {
  if (!keys.length) return
  const DB_NAME = 'aichat'
  const DB_VERSION = 3
  const STORE_KV = 'kv'

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(STORE_KV, 'readwrite')
      const store = tx.objectStore(STORE_KV)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      for (const key of keys) store.delete(key)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Creates a vector store scoped to a contact.
 * @param {string} contactId
 */
export function createVectorStore(contactId) {
  const contactPrefix = `${PREFIX}${contactId}:`

  return {
    /**
     * Insert or update a vector entry.
     * @param {'round'|'summary'|'core'} type
     * @param {string} itemId
     * @param {Float32Array} vector - must be pre-normalized
     * @param {string} text - original text (for debugging/display)
     * @param {Object} [metadata] - extra data (amCode, time, etc.)
     */
    async upsert(type, itemId, vector, text, metadata = {}) {
      const key = makeKey(contactId, type, itemId)
      await idbSet(key, {
        vector,
        text: text || '',
        time: Date.now(),
        metadata: metadata || {}
      })
    },

    /**
     * Delete a single entry.
     */
    async delete(type, itemId) {
      const key = makeKey(contactId, type, itemId)
      await idbDelete(key)
    },

    /**
     * Delete all entries of a given type (e.g. all 'round' vectors).
     */
    async deleteByType(type) {
      const prefix = `${contactPrefix}${type}:`
      const keys = await getAllKeysWithPrefix(prefix)
      if (keys.length) await deleteMany(keys)
      return keys.length
    },

    /**
     * Cosine similarity search (via dot product on normalized vectors).
     * @param {Float32Array} queryVector - must be pre-normalized
     * @param {{ type?: string, topK?: number, minScore?: number }} options
     * @returns {Promise<Array<{ itemId: string, score: number, text: string, metadata: Object }>>}
     */
    async search(queryVector, options = {}) {
      const { type, topK = 5, minScore = 0.3 } = options
      const prefix = type ? `${contactPrefix}${type}:` : contactPrefix
      const keys = await getAllKeysWithPrefix(prefix)
      if (!keys.length) return []

      const scored = []
      for (const key of keys) {
        const entry = await idbGet(key)
        if (!entry?.vector) continue
        const score = dotProduct(queryVector, entry.vector)
        if (score < minScore) continue

        // Extract itemId from key: vec:contactId:type:itemId
        const parts = key.slice(PREFIX.length).split(':')
        const entryType = parts[1]
        const itemId = parts.slice(2).join(':')

        scored.push({
          itemId,
          type: entryType,
          score,
          text: entry.text || '',
          time: entry.time || 0,
          metadata: entry.metadata || {}
        })
      }

      scored.sort((a, b) => b.score - a.score)
      return scored.slice(0, topK)
    },

    /**
     * Get all entries of a given type.
     * @param {string} type
     * @returns {Promise<Array<{ itemId: string, text: string, time: number, metadata: Object }>>}
     */
    async getAll(type) {
      const prefix = `${contactPrefix}${type}:`
      const keys = await getAllKeysWithPrefix(prefix)
      const results = []
      for (const key of keys) {
        const entry = await idbGet(key)
        if (!entry) continue
        const parts = key.slice(PREFIX.length).split(':')
        const itemId = parts.slice(2).join(':')
        results.push({
          itemId,
          text: entry.text || '',
          time: entry.time || 0,
          metadata: entry.metadata || {}
        })
      }
      return results
    },

    /**
     * Clear all vectors for this contact.
     */
    async clear() {
      const keys = await getAllKeysWithPrefix(contactPrefix)
      if (keys.length) await deleteMany(keys)
      return keys.length
    },

    /**
     * Get vector store statistics.
     * @returns {Promise<{ rounds: number, summaries: number, core: number, total: number }>}
     */
    async getStats() {
      const keys = await getAllKeysWithPrefix(contactPrefix)
      const stats = { rounds: 0, summaries: 0, core: 0, total: keys.length }
      for (const key of keys) {
        if (key.includes(':round:')) stats.rounds++
        else if (key.includes(':summary:')) stats.summaries++
        else if (key.includes(':core:')) stats.core++
      }
      return stats
    }
  }
}
