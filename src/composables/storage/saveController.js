// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StorageFlushSaveOptions} StorageFlushSaveOptions */
/** @typedef {import('./storageContracts').StorageFlushSaveResult} StorageFlushSaveResult */
/** @typedef {import('./storageContracts').StorageMediaEntryMap} StorageMediaEntryMap */
/** @typedef {import('./storageContracts').StorageMessagePartitions} StorageMessagePartitions */
/** @typedef {import('./storageContracts').StorageSnapshotPack} StorageSnapshotPack */

import { buildCompactBackupSnapshot } from './localCompactBackup'
import { computeFinalSaveDelay, shouldReestimateSnapshotSize } from './savePolicy'

function normalizeTimestamp(value) {
  return Math.max(0, Number(value || 0) || 0)
}

function estimateSnapshotBytes(snapshot) {
  try {
    const str = JSON.stringify(snapshot)
    return str ? str.length * 2 : 0
  } catch {
    return 0
  }
}

function summarizeSnapshotForSafetyGuard(snapshot, messagePartitions) {
  const contacts = Array.isArray(snapshot?.contacts)
    ? snapshot.contacts.filter(contact => contact && typeof contact === 'object')
    : []
  const meaningfulContacts = contacts.filter(contact => String(contact?.id || '') !== 'demo')
  const contactPool = meaningfulContacts.length > 0 ? meaningfulContacts : contacts
  let messageBearingContactCount = 0
  let totalMessages = 0

  if (messagePartitions instanceof Map && messagePartitions.size > 0) {
    messagePartitions.forEach((msgs) => {
      const count = Array.isArray(msgs) ? msgs.length : 0
      if (count > 0) {
        messageBearingContactCount += 1
        totalMessages += count
      }
    })
  } else {
    contactPool.forEach((contact) => {
      const count = Array.isArray(contact?.msgs)
        ? contact.msgs.length
        : Math.max(0, Number(contact?.msgCount || 0) || 0)
      if (count > 0) {
        messageBearingContactCount += 1
        totalMessages += count
      }
    })
  }

  return {
    contactCount: contactPool.length,
    messageBearingContactCount,
    totalMessages
  }
}

function detectSuspiciousDataLoss(previousSummary, nextSummary) {
  if (!previousSummary || !nextSummary) return null

  const contactsCollapsed =
    previousSummary.contactCount >= 4 &&
    nextSummary.contactCount <= 1 &&
    previousSummary.contactCount - nextSummary.contactCount >= 3

  const messageHistoryCollapsed =
    previousSummary.messageBearingContactCount >= 3 &&
    previousSummary.totalMessages >= 20 &&
    nextSummary.messageBearingContactCount <= 1 &&
    nextSummary.totalMessages <= Math.max(5, Math.floor(previousSummary.totalMessages * 0.2))

  if (!contactsCollapsed && !messageHistoryCollapsed) return null

  return {
    previousSummary,
    nextSummary
  }
}

/**
 * @param {object} options
 * @param {string} options.keyAppData
 * @param {Record<string, number>} options.savePolicy
 * @param {number} options.snapshotSizeLargeBytes
 * @param {number} options.snapshotSizeHugeBytes
 * @param {number} options.idleSaveTimeoutMs
 * @param {number} options.mediaGcEverySaves
 * @param {number} options.localBackupIntervalMs
 * @param {number} options.localBackupFullMaxBytes
 * @param {number} options.localBackupMsgLimitNormal
 * @param {number} options.localBackupMsgLimitLarge
 * @param {(options?: Record<string, unknown>) => StorageSnapshotPack} options.snapshotAppData
 * @param {() => void} options.trimMessagesIfNeeded
 * @param {(mediaEntries: StorageMediaEntryMap) => Promise<void>} options.persistMediaEntries
 * @param {(snapshot: Record<string, unknown>, mediaEntries: StorageMediaEntryMap) => void} options.restoreInlineMediaFromMap
 * @param {(messagePartitions: StorageMessagePartitions, mediaEntries: StorageMediaEntryMap, restoreInlineMediaFromMap: (snapshot: Record<string, unknown>, mediaEntries: StorageMediaEntryMap) => void) => StorageMessagePartitions} options.restoreInlineMediaInMessagePartitions
 * @param {(snapshot: StorageAppData, messagePartitions: StorageMessagePartitions) => StorageAppData} options.buildSnapshotForMediaGc
 * @param {(snapshot: StorageAppData, options?: Record<string, unknown>) => unknown} options.maybeGarbageCollectUnusedMedia
 * @param {(entries: Array<[string, unknown[]]>) => Promise<void>} options.idbMessagesSetMany
 * @param {(ids: string[]) => Promise<void>} options.idbMessagesDeleteMany
 * @param {(key: string, value: StorageAppData) => Promise<void>} options.idbSet
 * @param {(snapshot: unknown) => void} options.saveBackupToLocalStorage
 * @param {(snapshot: StorageAppData) => unknown} options.maybeWarnAboutPersistence
 * @param {(payload: Record<string, unknown>) => unknown} options.notifyCloudSyncLocalSave
 * @param {() => unknown} options.getStorageApi
 * @param {(error: unknown, details: Record<string, unknown>) => void} options.handleError
 * @returns {{
 *   flushSaveNow: (options?: StorageFlushSaveOptions) => Promise<StorageFlushSaveResult>,
 *   getLastLocalUpdatedAt: () => number,
 *   scheduleSave: (options?: { urgent?: boolean }) => void,
 *   setLastLocalUpdatedAt: (value: unknown) => void,
 *   setPersistedMessageContactIds: (ids: Set<string> | string[] | unknown) => void,
 *   setPersistedSnapshotSummary: (snapshot: StorageAppData, messagePartitions?: StorageMessagePartitions) => void
 * }}
 */
export function createStorageSaveController(options) {
  const {
    keyAppData,
    savePolicy,
    snapshotSizeLargeBytes,
    snapshotSizeHugeBytes,
    idleSaveTimeoutMs,
    mediaGcEverySaves,
    localBackupIntervalMs,
    localBackupFullMaxBytes,
    localBackupMsgLimitNormal,
    localBackupMsgLimitLarge,
    snapshotAppData,
    trimMessagesIfNeeded,
    persistMediaEntries,
    restoreInlineMediaFromMap,
    restoreInlineMediaInMessagePartitions,
    buildSnapshotForMediaGc,
    maybeGarbageCollectUnusedMedia,
    idbMessagesSetMany,
    idbMessagesDeleteMany,
    idbSet,
    saveBackupToLocalStorage,
    maybeWarnAboutPersistence,
    notifyCloudSyncLocalSave,
    getStorageApi,
    handleError
  } = options

  let saveTimer = null
  let idleSaveId = null
  let saveInFlight = false
  let saveAgain = false
  let saveCount = 0
  let lastSnapshotApproxBytes = 0
  let lastBackupAt = 0
  let lastLocalUpdatedAt = 0
  let lastSaveFinishedAt = 0
  let lastPersistedMessageContactIds = new Set()
  let lastPersistedSnapshotSummary = null

  /**
   * @param {StorageAppData | null} snapshot
   * @param {StorageMessagePartitions} messagePartitions
   * @param {StorageMediaEntryMap} mediaEntries
   * @param {number} [approxBytes]
   * @param {{ force?: boolean }} [saveOptions]
   */
  function maybeSaveLocalBackup(snapshot, messagePartitions, mediaEntries, approxBytes = 0, saveOptions = {}) {
    if (!snapshot) return
    const force = saveOptions && saveOptions.force === true
    const now = Date.now()
    if (!force && now - lastBackupAt < localBackupIntervalMs) return

    const bytes = Number(approxBytes) > 0 ? Number(approxBytes) : estimateSnapshotBytes(snapshot)
    if (bytes <= 0) return

    try {
      if (bytes <= localBackupFullMaxBytes) {
        let fullBackup = buildSnapshotForMediaGc(snapshot, messagePartitions)
        try {
          fullBackup = JSON.parse(JSON.stringify(fullBackup))
        } catch {
          // Keep the original snapshot object when deep clone is unavailable.
        }
        restoreInlineMediaFromMap(fullBackup, mediaEntries)
        saveBackupToLocalStorage(fullBackup)
      } else {
        const msgLimit = bytes >= snapshotSizeLargeBytes
          ? localBackupMsgLimitLarge
          : localBackupMsgLimitNormal
        const compact = buildCompactBackupSnapshot(snapshot, {
          mediaEntries,
          messagePartitions,
          msgLimit,
          restoreInlineMediaFromMap
        })
        saveBackupToLocalStorage(compact)
      }
      lastBackupAt = now
    } catch {
      // ignore local backup errors
    }
  }

  function clearIdleSave() {
    if (idleSaveId == null) return
    if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleSaveId)
    } else {
      clearTimeout(idleSaveId)
    }
    idleSaveId = null
  }

  function queueFlushSave() {
    const canUseIdleCallback =
      typeof window !== 'undefined' &&
      typeof window.requestIdleCallback === 'function' &&
      typeof document !== 'undefined' &&
      !document.hidden

    const shouldPreferIdle = canUseIdleCallback && lastSnapshotApproxBytes >= snapshotSizeLargeBytes
    if (!shouldPreferIdle) {
      void flushSave()
      return
    }

    if (idleSaveId != null) return
    idleSaveId = window.requestIdleCallback(() => {
      idleSaveId = null
      void flushSave()
    }, { timeout: idleSaveTimeoutMs })
  }

  /**
   * @param {StorageFlushSaveOptions} [options]
   * @returns {Promise<StorageFlushSaveResult>}
   */
  async function flushSave(options = {}) {
    if (saveInFlight) {
      saveAgain = true
      return
    }
    const backupFirst = options && options.backupFirst === true
    const suppressCloudSync = options && options.suppressCloudSync === true
    clearIdleSave()
    saveInFlight = true
    let snapshot = null
    let mediaEntries = new Map()
    let messagePartitions = new Map()

    try {
      trimMessagesIfNeeded()
      const packed = snapshotAppData()
      snapshot = packed.snapshot
      mediaEntries = packed.mediaEntries
      messagePartitions = packed.messagePartitions || new Map()
      snapshot.localUpdatedAt = Date.now()
      const snapshotSummary = summarizeSnapshotForSafetyGuard(snapshot, messagePartitions)

      if (options?.allowSignificantDataLoss !== true) {
        const suspiciousDataLoss = detectSuspiciousDataLoss(lastPersistedSnapshotSummary, snapshotSummary)
        if (suspiciousDataLoss) {
          handleError(new Error('Blocked suspicious snapshot shrink before persistence'), {
            mode: 'toast',
            context: 'Storage:SafetyGuard',
            fallbackMessage: '检测到异常数据缩水，已阻止覆盖保存',
            toastMessage: '检测到异常数据缩水，已阻止覆盖保存，请先导出备份',
            toastDuration: 5000
          })
          return null
        }
      }

      if (backupFirst) {
        maybeSaveLocalBackup(snapshot, messagePartitions, mediaEntries, estimateSnapshotBytes(snapshot), { force: true })
      }

      try {
        await persistMediaEntries(mediaEntries)
      } catch (mediaErr) {
        handleError(mediaErr, {
          mode: 'warn',
          context: 'Storage:MediaSave',
          fallbackMessage: 'IndexedDB media save failed'
        })
        restoreInlineMediaFromMap(snapshot, mediaEntries)
        restoreInlineMediaInMessagePartitions(messagePartitions, mediaEntries, restoreInlineMediaFromMap)
      }

      saveCount += 1
      if (shouldReestimateSnapshotSize({
        approxBytes: lastSnapshotApproxBytes,
        saveCount,
        largeBytes: snapshotSizeLargeBytes,
        hugeBytes: snapshotSizeHugeBytes
      })) {
        lastSnapshotApproxBytes = estimateSnapshotBytes(snapshot)
      }

      const currentMessageContactIds = new Set(Array.from(messagePartitions.keys()))
      await idbMessagesSetMany(Array.from(messagePartitions.entries()))
      const staleMessageContactIds = Array.from(lastPersistedMessageContactIds).filter(id => !currentMessageContactIds.has(id))
      if (staleMessageContactIds.length > 0) {
        await idbMessagesDeleteMany(staleMessageContactIds)
      }
      lastPersistedMessageContactIds = currentMessageContactIds
      lastPersistedSnapshotSummary = snapshotSummary

      await idbSet(keyAppData, snapshot)
      lastLocalUpdatedAt = normalizeTimestamp(snapshot.localUpdatedAt)
      maybeSaveLocalBackup(snapshot, messagePartitions, mediaEntries, lastSnapshotApproxBytes, { force: backupFirst })

      const snapshotForMediaGc = (
        mediaGcEverySaves > 0 &&
        saveCount > 0 &&
        saveCount % mediaGcEverySaves === 0
      )
        ? buildSnapshotForMediaGc(snapshot, messagePartitions)
        : snapshot
      void maybeGarbageCollectUnusedMedia(snapshotForMediaGc, {
        saveCount,
        gcEverySaves: mediaGcEverySaves
      })

      void maybeWarnAboutPersistence(snapshot)
      if (!suppressCloudSync && options?.reason === 'pagehide') {
        void notifyCloudSyncLocalSave({
          snapshot,
          storageApi: getStorageApi(),
          reason: 'pagehide'
        })
      }
      return { snapshot, mediaEntries, messagePartitions }
    } catch (error) {
      handleError(error, {
        mode: 'toast',
        context: 'Storage:Save',
        fallbackMessage: '数据保存失败',
        toastMessage: '数据保存失败，请尽快导出备份',
        toastDuration: 4000
      })
      try {
        if (!snapshot) {
          const packed = snapshotAppData()
          snapshot = packed.snapshot
          mediaEntries = packed.mediaEntries || new Map()
          messagePartitions = packed.messagePartitions || new Map()
        }
        snapshot.localUpdatedAt = normalizeTimestamp(snapshot.localUpdatedAt || lastLocalUpdatedAt)
        restoreInlineMediaFromMap(snapshot, mediaEntries)
        restoreInlineMediaInMessagePartitions(messagePartitions, mediaEntries, restoreInlineMediaFromMap)
        maybeSaveLocalBackup(snapshot, messagePartitions, mediaEntries, lastSnapshotApproxBytes, { force: backupFirst })
      } catch {
        // ignore backup fallback errors
      }
      return null
    } finally {
      saveInFlight = false
      lastSaveFinishedAt = Date.now()
      if (saveAgain) {
        saveAgain = false
        scheduleSave()
      }
    }
  }

  /**
   * @param {StorageFlushSaveOptions} [options]
   * @returns {Promise<StorageFlushSaveResult>}
   */
  function flushSaveNow(options = {}) {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    clearIdleSave()
    return flushSave(options)
  }

  function scheduleSave(options = {}) {
    const urgent = options && options.urgent === true
    if (!urgent && saveTimer) return
    if (urgent && saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (urgent) {
      clearIdleSave()
      queueFlushSave()
      return
    }

    const finalDelay = computeFinalSaveDelay({
      approxBytes: lastSnapshotApproxBytes,
      lastSaveFinishedAt,
      policy: savePolicy
    })
    saveTimer = setTimeout(() => {
      saveTimer = null
      queueFlushSave()
    }, finalDelay)
  }

  function getLastLocalUpdatedAt() {
    return lastLocalUpdatedAt
  }

  function setLastLocalUpdatedAt(value) {
    lastLocalUpdatedAt = normalizeTimestamp(value)
  }

  function setPersistedMessageContactIds(ids) {
    if (ids instanceof Set) {
      lastPersistedMessageContactIds = new Set(ids)
      return
    }
    if (Array.isArray(ids)) {
      lastPersistedMessageContactIds = new Set(ids)
      return
    }
    lastPersistedMessageContactIds = new Set()
  }

  function setPersistedSnapshotSummary(snapshot, messagePartitions = new Map()) {
    lastPersistedSnapshotSummary = summarizeSnapshotForSafetyGuard(snapshot, messagePartitions)
  }

  return {
    flushSaveNow,
    getLastLocalUpdatedAt,
    scheduleSave,
    setLastLocalUpdatedAt,
    setPersistedMessageContactIds,
    setPersistedSnapshotSummary
  }
}
