// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StoragePersistenceController} StoragePersistenceController */
/** @typedef {import('./storageContracts').StoragePersistenceControllerOptions} StoragePersistenceControllerOptions */

let autoFlushBound = false
let persistenceWarned = false

function getNavigatorStorage() {
  return typeof navigator !== 'undefined' ? navigator.storage : null
}

/**
 * @param {StoragePersistenceControllerOptions} options
 * @returns {StoragePersistenceController}
 */
export function createStoragePersistenceController(options) {
  const {
    hasUserData,
    showToast,
    snapshotAppData,
    flushSaveNow,
    canFlushOnPageHide = () => true
  } = options

  /** @param {StorageAppData} snapshot */
  async function maybeWarnAboutPersistence(snapshot) {
    if (persistenceWarned) return
    if (!snapshot || !hasUserData(snapshot)) return

    const storage = getNavigatorStorage()
    if (!storage) return

    if (typeof storage.persist === 'function') {
      try {
        await storage.persist()
      } catch {
        // ignore persistence request failures
      }
    }

    let persisted = null
    if (typeof storage.persisted === 'function') {
      try {
        persisted = await storage.persisted()
      } catch {
        persisted = null
      }
    }

    if (persisted === false) {
      showToast('建议将本站添加到主屏幕或定期导出备份，避免浏览器清理站点数据', 5000)
      persistenceWarned = true
      return
    }

    if (persisted === null) {
      showToast('建议定期导出备份，避免浏览器清理站点数据', 4500)
    }

    if (persisted === true || persisted === null) persistenceWarned = true
  }

  async function requestPersistence() {
    const storage = getNavigatorStorage()
    if (!storage || typeof storage.persist !== 'function') return false

    try {
      const granted = await storage.persist()
      if (!granted) {
        const hasData = hasUserData(snapshotAppData().snapshot)
        if (hasData) {
          showToast('建议将本站添加到主屏幕以防数据丢失', 4000)
        }
      }
      return granted
    } catch {
      return false
    }
  }

  function bindAutoFlushLifecycle() {
    if (autoFlushBound || typeof window === 'undefined' || typeof document === 'undefined') return false

    autoFlushBound = true
    const flushOnHide = () => {
      if (typeof canFlushOnPageHide === 'function' && !canFlushOnPageHide()) return
      void flushSaveNow({ backupFirst: true, reason: 'pagehide' })
    }

    window.addEventListener('pagehide', flushOnHide)
    window.addEventListener('beforeunload', flushOnHide)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushOnHide()
    })
    document.addEventListener?.('freeze', flushOnHide)
    return true
  }

  return {
    bindAutoFlushLifecycle,
    maybeWarnAboutPersistence,
    requestPersistence
  }
}

export function resetStoragePersistenceControllerForTests() {
  autoFlushBound = false
  persistenceWarned = false
}
