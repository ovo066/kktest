// @ts-check

import { recoverContactsFromPersistedMessages } from './contactMessagePersistence'

/** @typedef {import('./storageContracts').HydratedStoredSnapshotResult} HydratedStoredSnapshotResult */
/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */

/**
 * @param {unknown} data
 * @param {object} [options]
 * @param {string} options.keyAppData
 * @param {(key: string, value: StorageAppData) => Promise<void>} options.idbSet
 * @param {(data: unknown) => StorageAppData} options.normalizeLoadedAppData
 * @param {(data: unknown) => { data: StorageAppData }} [options.prepareLoadedAppData]
 * @param {(error: unknown) => void} [options.onError]
 */
async function persistRecoveredSnapshot(data, options) {
  const {
    keyAppData,
    idbSet,
    normalizeLoadedAppData,
    prepareLoadedAppData,
    onError
  } = options

  try {
    const prepared = typeof prepareLoadedAppData === 'function'
      ? prepareLoadedAppData(data)
      : { data: normalizeLoadedAppData(data) }
    await idbSet(keyAppData, prepared.data)
  } catch (error) {
    if (typeof onError === 'function') onError(error)
  }
}

function isPartialLocalBackup(data) {
  return !!(
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    data.backupMeta &&
    typeof data.backupMeta === 'object' &&
    data.backupMeta.isPartial === true
  )
}

/**
 * @param {object} options
 * @param {string} options.keyAppData
 * @param {(key: string) => Promise<unknown>} options.idbGet
 * @param {(key: string, value: StorageAppData) => Promise<void>} options.idbSet
 * @param {() => unknown} options.getLocalStorageBackup
 * @param {() => unknown} options.getLegacyLocalStorageData
 * @param {(data: unknown) => boolean} options.hasUserData
 * @param {(data: unknown) => StorageAppData} options.normalizeLoadedAppData
 * @param {(data: unknown) => { data: StorageAppData }} [options.prepareLoadedAppData]
 * @param {() => StorageAppData} options.defaultAppData
 * @param {(snapshot: StorageAppData, options?: { getAllKeys: () => Promise<unknown[]>, getMany: (contactIds: string[]) => Promise<unknown[]> }) => Promise<HydratedStoredSnapshotResult>} options.hydrateStoredContactMessages
 * @param {() => Promise<unknown[]>} options.getMessageKeys
 * @param {(contactIds: string[]) => Promise<unknown[]>} options.getMessages
 * @param {(message: string, duration?: number) => void} options.showToast
 * @param {(error: unknown, details: Record<string, unknown>) => void} options.handleError
 * @returns {Promise<HydratedStoredSnapshotResult>}
 */
export async function loadStoredSnapshot(options) {
  const {
    keyAppData,
    idbGet,
    idbSet,
    getLocalStorageBackup,
    getLegacyLocalStorageData,
    hasUserData,
    normalizeLoadedAppData,
    prepareLoadedAppData,
    defaultAppData,
    hydrateStoredContactMessages,
    getMessageKeys,
    getMessages,
    showToast,
    handleError
  } = options

  const prepareSnapshot = (value) => {
    if (typeof prepareLoadedAppData === 'function') {
      return prepareLoadedAppData(value).data
    }
    return normalizeLoadedAppData(value)
  }

  let data = null
  try {
    data = await idbGet(keyAppData)
  } catch {
    data = null
  }

  const backup = getLocalStorageBackup()
  const partialBackup = isPartialLocalBackup(backup)

  if (!data) {
    if (backup && hasUserData(backup)) {
      data = backup
      console.info(partialBackup ? 'Recovered data from partial localStorage backup' : 'Recovered data from localStorage backup')
      showToast(partialBackup ? '已从精简备份恢复部分数据，部分模块可能缺失' : '已从备份恢复数据', partialBackup ? 4200 : 3000)
      if (!partialBackup) {
        await persistRecoveredSnapshot(data, {
          keyAppData,
          idbSet,
          normalizeLoadedAppData,
          prepareLoadedAppData
        })
      }
    }
  } else if (backup && hasUserData(backup)) {
    const normalizedData = prepareSnapshot(data)
    if (!hasUserData(normalizedData)) {
      data = backup
      console.info(partialBackup
        ? 'Recovered data from partial localStorage backup (replaced empty IndexedDB snapshot)'
        : 'Recovered data from localStorage backup (replaced empty IndexedDB snapshot)')
      showToast(partialBackup ? '已从精简备份恢复部分数据，部分模块可能缺失' : '已从本地备份恢复数据', partialBackup ? 4200 : 3200)
      if (!partialBackup) {
        await persistRecoveredSnapshot(data, {
          keyAppData,
          idbSet,
          normalizeLoadedAppData,
          prepareLoadedAppData
        })
      }
    }
  }

  const legacy = getLegacyLocalStorageData()
  const reportMigrationError = (error) => {
    handleError(error, {
      mode: 'warn',
      context: 'Storage:Migration',
      fallbackMessage: 'IndexedDB migration save failed'
    })
  }

  if (!data && legacy) {
    data = legacy
    await persistRecoveredSnapshot(data, {
      keyAppData,
      idbSet,
      normalizeLoadedAppData,
      prepareLoadedAppData,
      onError: reportMigrationError
    })
  } else if (data && legacy) {
    const normalized = prepareSnapshot(data)
    if (!hasUserData(normalized) && hasUserData(legacy)) {
      data = legacy
      await persistRecoveredSnapshot(data, {
        keyAppData,
        idbSet,
        normalizeLoadedAppData,
        prepareLoadedAppData,
        onError: reportMigrationError
      })
    }
  }

  if (!data) data = defaultAppData()

  let normalizedData = prepareSnapshot(data)
  let recoveredFromMessageStore = false
  if (!hasUserData(normalizedData)) {
    const recoveredContacts = await recoverContactsFromPersistedMessages({
      getAllKeys: getMessageKeys,
      getMany: getMessages
    })

    if (recoveredContacts.length > 0) {
      data = {
        ...normalizedData,
        contacts: recoveredContacts
      }
      normalizedData = prepareSnapshot(data)
      recoveredFromMessageStore = true
      console.info('Recovered contacts from persisted message store')
      showToast('已从本地消息记录恢复聊天数据', 4200)
      await persistRecoveredSnapshot(data, {
        keyAppData,
        idbSet,
        normalizeLoadedAppData,
        prepareLoadedAppData
      })
    }
  }

  const hydratedData = await hydrateStoredContactMessages(normalizedData, {
    getAllKeys: getMessageKeys,
    getMany: getMessages
  })

  return {
    snapshot: prepareSnapshot(hydratedData.snapshot),
    persistedContactIds: hydratedData.persistedContactIds,
    shouldMigrateInlineMessages: hydratedData.shouldMigrateInlineMessages || recoveredFromMessageStore
  }
}
