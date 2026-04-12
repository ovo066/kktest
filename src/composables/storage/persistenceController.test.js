import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStoragePersistenceController,
  resetStoragePersistenceControllerForTests
} from './persistenceController'

function stubStorage(storage) {
  vi.stubGlobal('navigator', { storage })
}

describe('persistenceController', () => {
  beforeEach(() => {
    resetStoragePersistenceControllerForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('warns once when persistence is unavailable for meaningful data', async () => {
    const showToast = vi.fn()
    stubStorage({
      persist: vi.fn(async () => false),
      persisted: vi.fn(async () => false)
    })

    const controller = createStoragePersistenceController({
      hasUserData: () => true,
      showToast,
      snapshotAppData: () => ({ snapshot: { contacts: [{ id: 'c1' }] } }),
      flushSaveNow: vi.fn()
    })

    await controller.maybeWarnAboutPersistence({ contacts: [{ id: 'c1' }] })
    await controller.maybeWarnAboutPersistence({ contacts: [{ id: 'c1' }] })

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('建议将本站添加到主屏幕或定期导出备份，避免浏览器清理站点数据', 5000)
  })

  it('requests persistence and warns if the browser declines with real data', async () => {
    const showToast = vi.fn()
    stubStorage({
      persist: vi.fn(async () => false)
    })

    const controller = createStoragePersistenceController({
      hasUserData: (snapshot) => Array.isArray(snapshot?.contacts) && snapshot.contacts.length > 0,
      showToast,
      snapshotAppData: () => ({ snapshot: { contacts: [{ id: 'c1' }] } }),
      flushSaveNow: vi.fn()
    })

    const granted = await controller.requestPersistence()

    expect(granted).toBe(false)
    expect(showToast).toHaveBeenCalledWith('建议将本站添加到主屏幕以防数据丢失', 4000)
  })

  it('binds lifecycle handlers once and flushes on page hide signals', async () => {
    const showToast = vi.fn()
    const flushSaveNow = vi.fn(async () => {})
    const windowListeners = new Map()
    const documentListeners = new Map()

    vi.stubGlobal('window', {
      addEventListener: vi.fn((event, handler) => {
        windowListeners.set(event, handler)
      })
    })
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn((event, handler) => {
        documentListeners.set(event, handler)
      })
    })

    const controller = createStoragePersistenceController({
      hasUserData: () => true,
      showToast,
      snapshotAppData: () => ({ snapshot: { contacts: [] } }),
      flushSaveNow
    })

    expect(controller.bindAutoFlushLifecycle()).toBe(true)
    expect(controller.bindAutoFlushLifecycle()).toBe(false)

    await windowListeners.get('pagehide')?.()
    document.hidden = true
    await documentListeners.get('visibilitychange')?.()
    await documentListeners.get('freeze')?.()

    expect(flushSaveNow).toHaveBeenCalledTimes(3)
    expect(flushSaveNow).toHaveBeenCalledWith({ backupFirst: true, reason: 'pagehide' })
  })

  it('skips lifecycle flush when pagehide persistence is blocked', async () => {
    const flushSaveNow = vi.fn(async () => {})
    const windowListeners = new Map()

    vi.stubGlobal('window', {
      addEventListener: vi.fn((event, handler) => {
        windowListeners.set(event, handler)
      })
    })
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn()
    })

    const controller = createStoragePersistenceController({
      hasUserData: () => true,
      showToast: vi.fn(),
      snapshotAppData: () => ({ snapshot: { contacts: [] } }),
      flushSaveNow,
      canFlushOnPageHide: () => false
    })

    controller.bindAutoFlushLifecycle()
    await windowListeners.get('pagehide')?.()

    expect(flushSaveNow).not.toHaveBeenCalled()
  })
})
