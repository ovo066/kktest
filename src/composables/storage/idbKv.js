import { serializeMediaForStorage } from './mediaBinary'

const DB_NAME = 'aichat'
const DB_VERSION = 3
const STORE_KV = 'kv'
const STORE_MEDIA = 'media'
const STORE_MESSAGES = 'messages'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV)
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA)
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        db.createObjectStore(STORE_MESSAGES)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function getFromStore(storeName, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function setInStore(storeName, key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    store.put(value, key)
  })
}

async function deleteFromStore(storeName, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    store.delete(key)
  })
}

async function getManyFromStore(storeName, keys) {
  const list = Array.isArray(keys) ? keys.filter(key => typeof key === 'string' && key) : []
  if (list.length === 0) return []
  const unique = Array.from(new Set(list))
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const results = new Array(unique.length)
    let done = 0
    let failed = false

    const finishIfDone = () => {
      if (failed || done !== unique.length) return
      resolve(unique.map((key, idx) => [key, results[idx]]))
    }

    unique.forEach((key, idx) => {
      const req = store.get(key)
      req.onsuccess = () => {
        results[idx] = req.result
        done += 1
        finishIfDone()
      }
      req.onerror = () => {
        if (failed) return
        failed = true
        reject(req.error)
      }
    })
  })
}

async function setManyInStore(storeName, entries) {
  const list = Array.isArray(entries)
    ? entries.filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' && entry[0])
    : []
  if (list.length === 0) return
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    list.forEach(([key, value]) => {
      store.put(value, key)
    })
  })
}

async function getAllKeysFromStore(storeName) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAllKeys()
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : [])
    req.onerror = () => reject(req.error)
  })
}

async function deleteManyFromStore(storeName, keys) {
  const list = Array.isArray(keys) ? keys.filter(key => typeof key === 'string' && key) : []
  if (list.length === 0) return
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
    list.forEach((key) => {
      store.delete(key)
    })
  })
}

export async function idbGet(key) {
  return getFromStore(STORE_KV, key)
}

export async function idbSet(key, value) {
  return setInStore(STORE_KV, key, value)
}

export async function idbDelete(key) {
  return deleteFromStore(STORE_KV, key)
}

export async function idbMessagesGet(key) {
  return getFromStore(STORE_MESSAGES, key)
}

export async function idbMessagesSet(key, value) {
  return setInStore(STORE_MESSAGES, key, value)
}

export async function idbMessagesDelete(key) {
  return deleteFromStore(STORE_MESSAGES, key)
}

export async function idbMessagesGetMany(keys) {
  return getManyFromStore(STORE_MESSAGES, keys)
}

export async function idbMessagesSetMany(entries) {
  return setManyInStore(STORE_MESSAGES, entries)
}

export async function idbMessagesGetAllKeys() {
  return getAllKeysFromStore(STORE_MESSAGES)
}

export async function idbMessagesDeleteMany(keys) {
  return deleteManyFromStore(STORE_MESSAGES, keys)
}

export async function idbMediaGet(key) {
  return getFromStore(STORE_MEDIA, key)
}

export async function idbMediaSet(key, value) {
  const storedValue = await serializeMediaForStorage(value)
  return setInStore(STORE_MEDIA, key, storedValue)
}

export async function idbMediaDelete(key) {
  return deleteFromStore(STORE_MEDIA, key)
}

export async function idbMediaGetMany(keys) {
  return getManyFromStore(STORE_MEDIA, keys)
}

export async function idbMediaSetMany(entries) {
  const list = Array.isArray(entries)
    ? entries.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && entry[0])
    : []
  if (list.length === 0) return

  const storedEntries = []
  for (const [key, value] of list) {
    storedEntries.push([key, await serializeMediaForStorage(value)])
  }

  return setManyInStore(STORE_MEDIA, storedEntries)
}

export async function idbMediaGetAllKeys() {
  return getAllKeysFromStore(STORE_MEDIA)
}

export async function idbMediaDeleteMany(keys) {
  return deleteManyFromStore(STORE_MEDIA, keys)
}

