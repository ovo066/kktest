const MINIMAX_CACHE_DB_NAME = 'aichat_tts_cache'
const MINIMAX_CACHE_DB_VERSION = 1
const MINIMAX_CACHE_STORE = 'minimax_audio'
const MINIMAX_CACHE_MAX_ITEMS = 600
const MINIMAX_CACHE_MAX_BYTES = 180 * 1024 * 1024
const MINIMAX_CACHE_TOUCH_INTERVAL_MS = 30 * 1000

const minimaxInflight = new Map()
let minimaxCacheDbPromise = null

export function toUint8Array(value) {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return null
}

function toArrayBuffer(bytes) {
  const arr = toUint8Array(bytes)
  if (!arr) return null
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
}

export function createObjectUrlFromBytes(bytes, mimeType = 'audio/mpeg') {
  const arr = toUint8Array(bytes)
  if (!arr || !arr.byteLength) return null
  const blob = new Blob([arr], { type: mimeType || 'audio/mpeg' })
  return URL.createObjectURL(blob)
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

export function withMiniMaxInflight(cacheKey, producer) {
  const key = String(cacheKey || '')
  if (!key) return producer()
  const pending = minimaxInflight.get(key)
  if (pending) return pending

  const task = Promise.resolve()
    .then(() => producer())
    .finally(() => {
      minimaxInflight.delete(key)
    })

  minimaxInflight.set(key, task)
  return task
}

function openMiniMaxCacheDb() {
  if (!hasIndexedDb()) return Promise.resolve(null)
  if (minimaxCacheDbPromise) return minimaxCacheDbPromise

  minimaxCacheDbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(MINIMAX_CACHE_DB_NAME, MINIMAX_CACHE_DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(MINIMAX_CACHE_STORE)) {
          db.createObjectStore(MINIMAX_CACHE_STORE, { keyPath: 'key' })
        }
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => {
          try { db.close() } catch {}
          minimaxCacheDbPromise = null
        }
        resolve(db)
      }
      req.onerror = () => {
        minimaxCacheDbPromise = null
        resolve(null)
      }
    } catch {
      minimaxCacheDbPromise = null
      resolve(null)
    }
  })

  return minimaxCacheDbPromise
}

async function readMiniMaxCacheEntry(key) {
  const db = await openMiniMaxCacheDb()
  if (!db || !key) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(MINIMAX_CACHE_STORE, 'readonly')
      const store = tx.objectStore(MINIMAX_CACHE_STORE)
      const req = store.get(key)
      req.onsuccess = () => {
        const entry = req.result || null
        resolve(entry)
        if (entry) {
          touchMiniMaxCacheEntry(db, key, entry)
        }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function touchMiniMaxCacheEntry(db, key, entry) {
  if (!db || !key || !entry) return
  const prev = Number(entry.updatedAt || 0)
  const now = Date.now()
  if (now - prev < MINIMAX_CACHE_TOUCH_INTERVAL_MS) return
  try {
    const tx = db.transaction(MINIMAX_CACHE_STORE, 'readwrite')
    const store = tx.objectStore(MINIMAX_CACHE_STORE)
    store.put({
      ...entry,
      key,
      updatedAt: now
    })
  } catch {
    // Ignore touch failures.
  }
}

async function listMiniMaxCacheMeta(db) {
  if (!db) return []
  return new Promise((resolve) => {
    const rows = []
    try {
      const tx = db.transaction(MINIMAX_CACHE_STORE, 'readonly')
      const store = tx.objectStore(MINIMAX_CACHE_STORE)
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) {
          resolve(rows)
          return
        }
        const value = cursor.value || {}
        rows.push({
          key: String(value.key || cursor.key || ''),
          byteLength: Number(value.byteLength || 0),
          updatedAt: Number(value.updatedAt || 0)
        })
        cursor.continue()
      }
      req.onerror = () => resolve(rows)
    } catch {
      resolve(rows)
    }
  })
}

async function deleteMiniMaxCacheKeys(db, keys) {
  if (!db || !Array.isArray(keys) || !keys.length) return
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(MINIMAX_CACHE_STORE, 'readwrite')
      const store = tx.objectStore(MINIMAX_CACHE_STORE)
      keys.forEach((key) => {
        if (key) {
          try { store.delete(key) } catch {}
        }
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function pruneMiniMaxCache(db) {
  if (!db) return
  const rows = await listMiniMaxCacheMeta(db)
  if (!rows.length) return

  let totalBytes = 0
  rows.forEach((item) => {
    totalBytes += Number(item.byteLength || 0)
  })

  if (rows.length <= MINIMAX_CACHE_MAX_ITEMS && totalBytes <= MINIMAX_CACHE_MAX_BYTES) return

  const sorted = [...rows].sort((a, b) => {
    const ta = Number(a.updatedAt || 0)
    const tb = Number(b.updatedAt || 0)
    return ta - tb
  })

  let count = sorted.length
  const toDelete = []
  for (const item of sorted) {
    if (count <= MINIMAX_CACHE_MAX_ITEMS && totalBytes <= MINIMAX_CACHE_MAX_BYTES) break
    toDelete.push(item.key)
    count -= 1
    totalBytes -= Number(item.byteLength || 0)
  }

  if (toDelete.length) {
    await deleteMiniMaxCacheKeys(db, toDelete)
  }
}

export async function writeMiniMaxCacheEntry(key, payload = {}) {
  const db = await openMiniMaxCacheDb()
  if (!db || !key) return

  const data = toArrayBuffer(payload.bytes)
  const remoteUrl = String(payload.remoteUrl || '').trim()
  const byteLength = data ? data.byteLength : 0
  if (!byteLength && !remoteUrl) return

  await new Promise((resolve) => {
    try {
      const tx = db.transaction(MINIMAX_CACHE_STORE, 'readwrite')
      const store = tx.objectStore(MINIMAX_CACHE_STORE)
      store.put({
        key,
        audio: data || null,
        remoteUrl,
        mimeType: String(payload.mimeType || 'audio/mpeg'),
        byteLength,
        updatedAt: Date.now()
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })

  await pruneMiniMaxCache(db)
}

export async function readMiniMaxCachedAudio(key) {
  const entry = await readMiniMaxCacheEntry(key)
  if (!entry) return null
  const bytes = toUint8Array(entry.audio)
  const remoteUrl = String(entry.remoteUrl || '').trim()
  const hasBytes = Boolean(bytes && bytes.byteLength)
  if (!hasBytes && !remoteUrl) return null
  return {
    bytes: hasBytes ? bytes : null,
    remoteUrl,
    mimeType: String(entry.mimeType || 'audio/mpeg')
  }
}