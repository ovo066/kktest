import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStorageSaveController } from './saveController'

function createController(overrides = {}) {
  const calls = {
    trimMessagesIfNeeded: vi.fn(),
    snapshotAppData: vi.fn(() => ({
      snapshot: { contacts: [{ id: 'c1' }] },
      mediaEntries: new Map([['media:1', 'data:image/png;base64,abc']]),
      messagePartitions: new Map([['c1', [{ id: 'm1', text: 'hello' }]]])
    })),
    persistMediaEntries: vi.fn(async () => {}),
    restoreInlineMediaFromMap: vi.fn(),
    restoreInlineMediaInMessagePartitions: vi.fn(),
    buildSnapshotForMediaGc: vi.fn((snapshot, messagePartitions) => ({
      ...snapshot,
      gc: true,
      contacts: Array.isArray(snapshot?.contacts)
        ? snapshot.contacts.map((contact) => {
            const contactId = typeof contact?.id === 'string' ? contact.id : ''
            const msgs = contactId ? messagePartitions?.get?.(contactId) : null
            return Array.isArray(msgs) ? { ...contact, msgs } : contact
          })
        : snapshot.contacts
    })),
    maybeGarbageCollectUnusedMedia: vi.fn(),
    idbMessagesSetMany: vi.fn(async () => {}),
    idbMessagesDeleteMany: vi.fn(async () => {}),
    idbSet: vi.fn(async () => {}),
    saveBackupToLocalStorage: vi.fn(),
    maybeWarnAboutPersistence: vi.fn(async () => {}),
    notifyCloudSyncLocalSave: vi.fn(async () => {}),
    getStorageApi: vi.fn(() => ({ flushSaveNow: true })),
    handleError: vi.fn()
  }

  const controller = createStorageSaveController({
    keyAppData: 'appData',
    savePolicy: {
      mediumBytes: 10,
      largeBytes: 20,
      hugeBytes: 30,
      smallDelayMs: 25,
      mediumDelayMs: 25,
      largeDelayMs: 25,
      hugeDelayMs: 25,
      largeMinIntervalMs: 0,
      hugeMinIntervalMs: 0
    },
    snapshotSizeLargeBytes: 20,
    snapshotSizeHugeBytes: 30,
    idleSaveTimeoutMs: 50,
    mediaGcEverySaves: 2,
    localBackupIntervalMs: 60 * 1000,
    localBackupFullMaxBytes: 1024,
    localBackupMsgLimitNormal: 30,
    localBackupMsgLimitLarge: 10,
    ...calls,
    ...overrides
  })

  return { controller, calls }
}

describe('saveController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes a snapshot, updates persisted ids, and notifies pagehide cloud sync', async () => {
    const { controller, calls } = createController()
    controller.setPersistedMessageContactIds(new Set(['stale_contact']))

    const result = await controller.flushSaveNow({ backupFirst: true, reason: 'pagehide' })

    expect(result?.snapshot.localUpdatedAt).toBe(Date.now())
    expect(calls.trimMessagesIfNeeded).toHaveBeenCalledTimes(1)
    expect(calls.persistMediaEntries).toHaveBeenCalledWith(new Map([['media:1', 'data:image/png;base64,abc']]))
    expect(calls.idbMessagesSetMany).toHaveBeenCalledWith([
      ['c1', [{ id: 'm1', text: 'hello' }]]
    ])
    expect(calls.idbMessagesDeleteMany).toHaveBeenCalledWith(['stale_contact'])
    expect(calls.idbSet).toHaveBeenCalledWith('appData', expect.objectContaining({
      localUpdatedAt: Date.now()
    }))
    expect(calls.saveBackupToLocalStorage).toHaveBeenCalledWith(expect.objectContaining({
      contacts: [
        expect.objectContaining({
          id: 'c1',
          msgs: [{ id: 'm1', text: 'hello' }]
        })
      ]
    }))
    expect(calls.maybeWarnAboutPersistence).toHaveBeenCalledTimes(1)
    expect(calls.notifyCloudSyncLocalSave).toHaveBeenCalledWith({
      snapshot: expect.objectContaining({ localUpdatedAt: Date.now() }),
      storageApi: { flushSaveNow: true },
      reason: 'pagehide'
    })
    expect(controller.getLastLocalUpdatedAt()).toBe(Date.now())
  })

  it('restores inline media when external media persistence fails', async () => {
    const mediaError = new Error('persist failed')
    const { controller, calls } = createController({
      persistMediaEntries: vi.fn(async () => {
        throw mediaError
      })
    })

    const result = await controller.flushSaveNow()

    expect(result).not.toBeNull()
    expect(calls.handleError).toHaveBeenCalledWith(mediaError, expect.objectContaining({
      context: 'Storage:MediaSave',
      mode: 'warn'
    }))
    expect(calls.restoreInlineMediaFromMap).toHaveBeenCalled()
    expect(calls.restoreInlineMediaInMessagePartitions).toHaveBeenCalledTimes(1)
    expect(calls.idbSet).toHaveBeenCalledTimes(1)
  })

  it('blocks suspicious snapshot shrink from overwriting persisted data', async () => {
    const { controller, calls } = createController({
      snapshotAppData: vi.fn(() => ({
        snapshot: {
          contacts: [
            { id: 'c1', msgCount: 0 },
            { id: 'c2', msgCount: 0 },
            { id: 'c3', msgCount: 1 }
          ]
        },
        mediaEntries: new Map(),
        messagePartitions: new Map([['c3', [{ id: 'm-last' }]]])
      }))
    })

    controller.setPersistedSnapshotSummary({
      contacts: [
        { id: 'c1', msgCount: 20 },
        { id: 'c2', msgCount: 18 },
        { id: 'c3', msgCount: 15 }
      ]
    })

    const result = await controller.flushSaveNow()

    expect(result).toBeNull()
    expect(calls.idbMessagesSetMany).not.toHaveBeenCalled()
    expect(calls.idbMessagesDeleteMany).not.toHaveBeenCalled()
    expect(calls.idbSet).not.toHaveBeenCalled()
    expect(calls.handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        context: 'Storage:SafetyGuard',
        mode: 'toast'
      })
    )
  })

  it('allows intentional destructive saves when explicitly enabled', async () => {
    const { controller, calls } = createController({
      snapshotAppData: vi.fn(() => ({
        snapshot: {
          contacts: [
            { id: 'c1', msgCount: 0 },
            { id: 'c2', msgCount: 0 },
            { id: 'c3', msgCount: 1 }
          ]
        },
        mediaEntries: new Map(),
        messagePartitions: new Map([['c3', [{ id: 'm-last' }]]])
      }))
    })

    controller.setPersistedSnapshotSummary({
      contacts: [
        { id: 'c1', msgCount: 20 },
        { id: 'c2', msgCount: 18 },
        { id: 'c3', msgCount: 15 }
      ]
    })

    const result = await controller.flushSaveNow({ allowSignificantDataLoss: true, reason: 'import' })

    expect(result).not.toBeNull()
    expect(calls.idbMessagesSetMany).toHaveBeenCalledTimes(1)
    expect(calls.idbSet).toHaveBeenCalledTimes(1)
  })

  it('schedules delayed saves using the configured policy', async () => {
    const { controller, calls } = createController()

    controller.scheduleSave()
    await vi.advanceTimersByTimeAsync(24)
    expect(calls.idbSet).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(calls.idbSet).toHaveBeenCalledTimes(1)
  })

  it('falls back to compact local backups for large snapshots', async () => {
    const { controller, calls } = createController({
      localBackupFullMaxBytes: 1,
      snapshotAppData: vi.fn(() => ({
        snapshot: {
          contacts: [{ id: 'c1' }],
          vnProjects: [{ id: 'vn_1' }]
        },
        mediaEntries: new Map(),
        messagePartitions: new Map([['c1', [{ id: 'm1', text: 'hello' }]]])
      }))
    })

    await controller.flushSaveNow({ backupFirst: true })

    expect(calls.saveBackupToLocalStorage).toHaveBeenCalledWith(expect.objectContaining({
      backupMeta: expect.objectContaining({
        kind: 'local-compact',
        isPartial: true
      }),
      vnProjects: []
    }))
  })
})
