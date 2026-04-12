// @ts-check

/** @typedef {import('./storageContracts').HydratedStoredSnapshotResult} HydratedStoredSnapshotResult */
/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StorageMediaEntryMap} StorageMediaEntryMap */
/** @typedef {import('./storageContracts').StorageMessagePartitions} StorageMessagePartitions */
/** @typedef {import('./storageContracts').StorageSnapshotEnvelope} StorageSnapshotEnvelope */
/** @typedef {import('./storageContracts').StorageSnapshotPack} StorageSnapshotPack */

import { buildContactMessageSummary } from '../../utils/contactMessageSummary'

function createRecoveredContactName(contactId, index) {
  const suffix = String(contactId || '').slice(-6)
  return suffix ? `已恢复会话 ${suffix}` : `已恢复会话 ${index + 1}`
}

/**
 * @param {StorageSnapshotEnvelope} packed
 * @returns {StorageSnapshotPack}
 */
export function partitionContactMessages(packed) {
  const messagePartitions = new Map()
  const snapshot = packed.snapshot

  if (Array.isArray(snapshot.contacts)) {
    snapshot.contacts = snapshot.contacts.map((contact) => {
      if (!contact || typeof contact !== 'object') return contact

      const summary = buildContactMessageSummary(contact)
      const next = /** @type {Record<string, unknown>} */ ({
        ...contact,
        lastMsgId: summary.lastMsgId,
        lastMsgPreview: summary.lastMsgPreview,
        lastMsgSenderName: summary.lastMsgSenderName,
        lastMsgTime: summary.lastMsgTime,
        msgCount: summary.msgCount
      })
      const contactId = typeof contact.id === 'string' ? contact.id : ''

      if (contactId) {
        messagePartitions.set(contactId, Array.isArray(contact.msgs) ? contact.msgs : [])
        delete next.msgs
      }

      return next
    })
  }

  return {
    snapshot,
    mediaEntries: packed.mediaEntries,
    messagePartitions
  }
}

/**
 * @param {StorageAppData} snapshot
 * @param {StorageMessagePartitions} messagePartitions
 * @returns {StorageAppData}
 */
export function buildSnapshotForMediaGc(snapshot, messagePartitions) {
  if (!snapshot || !Array.isArray(snapshot.contacts)) return snapshot
  if (!(messagePartitions instanceof Map) || messagePartitions.size === 0) return snapshot

  let hasPatchedContact = false
  const contacts = snapshot.contacts.map((contact) => {
    if (!contact || typeof contact !== 'object') return contact
    const contactId = typeof contact.id === 'string' ? contact.id : ''
    if (!contactId || !messagePartitions.has(contactId)) return contact
    const msgs = messagePartitions.get(contactId)
    if (!Array.isArray(msgs)) return contact
    hasPatchedContact = true
    return { ...contact, msgs }
  })

  if (!hasPatchedContact) return snapshot
  return { ...snapshot, contacts }
}

/**
 * @param {StorageMessagePartitions} messagePartitions
 * @param {StorageMediaEntryMap} mediaEntries
 * @param {(snapshot: Record<string, unknown>, mediaEntries: StorageMediaEntryMap) => void} restoreInlineMediaFromMap
 * @returns {StorageMessagePartitions}
 */
export function restoreInlineMediaInMessagePartitions(messagePartitions, mediaEntries, restoreInlineMediaFromMap) {
  if (!(messagePartitions instanceof Map) || messagePartitions.size === 0 || !(mediaEntries instanceof Map) || mediaEntries.size === 0) {
    return messagePartitions
  }

  const tempSnapshot = {
    contacts: Array.from(messagePartitions.entries()).map(([id, msgs]) => ({
      id,
      msgs: Array.isArray(msgs) ? msgs : []
    }))
  }

  restoreInlineMediaFromMap(tempSnapshot, mediaEntries)
  messagePartitions.clear()
  tempSnapshot.contacts.forEach((contact) => {
    messagePartitions.set(String(contact.id || ''), Array.isArray(contact.msgs) ? contact.msgs : [])
  })
  return messagePartitions
}

/**
 * @param {{ getAllKeys?: () => Promise<unknown[]>, getMany?: (contactIds: string[]) => Promise<unknown[]> }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function recoverContactsFromPersistedMessages(options = {}) {
  const {
    getAllKeys = async () => [],
    getMany = async () => []
  } = options

  let persistedKeys = []
  let persistedEntries = []
  try {
    persistedKeys = await getAllKeys()
    const contactIds = Array.from(new Set(
      (Array.isArray(persistedKeys) ? persistedKeys : [])
        .filter((key) => typeof key === 'string' && key)
    ))
    if (contactIds.length === 0) return []

    persistedEntries = await getMany(contactIds)
  } catch {
    return []
  }

  const messageMap = new Map(
    Array.isArray(persistedEntries)
      ? persistedEntries.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && Array.isArray(entry[1]))
      : []
  )

  return Array.from(messageMap.entries())
    .map(([contactId, msgs], index) => {
      if (!Array.isArray(msgs) || msgs.length === 0) return null
      const summary = buildContactMessageSummary({ id: contactId, msgs })
      return {
        id: contactId,
        name: createRecoveredContactName(contactId, index),
        msgs,
        lastMsgId: summary.lastMsgId,
        lastMsgPreview: summary.lastMsgPreview,
        lastMsgSenderName: summary.lastMsgSenderName,
        lastMsgTime: summary.lastMsgTime,
        msgCount: summary.msgCount,
        recoveredFromMessages: true
      }
    })
    .filter(Boolean)
}

/**
 * @param {StorageAppData} snapshot
 * @param {{ getAllKeys?: () => Promise<unknown[]>, getMany?: (contactIds: string[]) => Promise<unknown[]> }} [options]
 * @returns {Promise<HydratedStoredSnapshotResult>}
 */
export async function hydrateStoredContactMessages(snapshot, options = {}) {
  const {
    getAllKeys = async () => [],
    getMany = async () => []
  } = options
  if (!snapshot || !Array.isArray(snapshot.contacts) || snapshot.contacts.length === 0) {
    return {
      snapshot,
      shouldMigrateInlineMessages: false,
      persistedContactIds: new Set()
    }
  }

  const contactIds = Array.from(new Set(
    snapshot.contacts
      .map(contact => (typeof contact?.id === 'string' ? contact.id : ''))
      .filter(Boolean)
  ))

  let persistedKeys = []
  let persistedEntries = []
  try {
    persistedKeys = await getAllKeys()
    persistedEntries = await getMany(contactIds)
  } catch {
    persistedKeys = []
    persistedEntries = []
  }

  const persistedContactIds = new Set(
    Array.isArray(persistedKeys)
      ? persistedKeys.filter(key => typeof key === 'string' && key)
      : []
  )

  const messageMap = new Map(
    Array.isArray(persistedEntries)
      ? persistedEntries.filter((entry) => Array.isArray(entry) && Array.isArray(entry[1]))
      : []
  )

  let shouldMigrateInlineMessages = false
  snapshot.contacts = snapshot.contacts.map((contact) => {
    if (!contact || typeof contact !== 'object') return contact
    const next = { ...contact }
    const contactId = typeof contact.id === 'string' ? contact.id : ''

    if (contactId && messageMap.has(contactId)) {
      next.msgs = messageMap.get(contactId)
      return next
    }

    if (Array.isArray(contact.msgs)) {
      next.msgs = contact.msgs
      if (contact.msgs.length > 0) shouldMigrateInlineMessages = true
      return next
    }

    next.msgs = []
    return next
  })

  return { snapshot, shouldMigrateInlineMessages, persistedContactIds }
}
