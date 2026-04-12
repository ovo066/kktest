import { describe, expect, it, vi } from 'vitest'
import { loadStoredSnapshot } from './loadController'

function createLoader(overrides = {}) {
  const calls = {
    idbGet: vi.fn(async () => null),
    idbSet: vi.fn(async () => {}),
    getLocalStorageBackup: vi.fn(() => null),
    getLegacyLocalStorageData: vi.fn(() => null),
    hasUserData: vi.fn((data) => Array.isArray(data?.contacts) && data.contacts.length > 0),
    normalizeLoadedAppData: vi.fn((data) => ({ ...data, normalized: true })),
    prepareLoadedAppData: vi.fn((data) => ({ data: { ...data, prepared: true }, needsSave: false, appliedMigrations: [] })),
    defaultAppData: vi.fn(() => ({ contacts: [], fromDefault: true })),
    hydrateStoredContactMessages: vi.fn(async (data) => ({
      snapshot: { ...data, hydrated: true },
      persistedContactIds: new Set(['c1']),
      shouldMigrateInlineMessages: false
    })),
    getMessageKeys: vi.fn(async () => []),
    getMessages: vi.fn(async () => []),
    showToast: vi.fn(),
    handleError: vi.fn()
  }

  const run = () => loadStoredSnapshot({
    keyAppData: 'appData',
    ...calls,
    ...overrides
  })

  return { calls, run }
}

describe('loadController', () => {
  it('recovers from local backup when IndexedDB is empty', async () => {
    const backup = { contacts: [{ id: 'c1' }] }
    const { calls, run } = createLoader({
      getLocalStorageBackup: vi.fn(() => backup)
    })

    const result = await run()

    expect(calls.showToast).toHaveBeenCalledWith('已从备份恢复数据', 3000)
    expect(calls.idbSet).toHaveBeenCalledWith('appData', { contacts: [{ id: 'c1' }], prepared: true })
    expect(result.snapshot).toEqual({
      contacts: [{ id: 'c1' }],
      hydrated: true,
      prepared: true
    })
    expect(result.persistedContactIds).toEqual(new Set(['c1']))
  })

  it('does not persist partial local backups back into IndexedDB', async () => {
    const backup = {
      contacts: [{ id: 'c1' }],
      backupMeta: {
        kind: 'local-compact',
        isPartial: true,
        omittedKeys: ['vnProjects']
      }
    }
    const { calls, run } = createLoader({
      getLocalStorageBackup: vi.fn(() => backup)
    })

    const result = await run()

    expect(calls.showToast).toHaveBeenCalledWith('已从精简备份恢复部分数据，部分模块可能缺失', 4200)
    expect(calls.idbSet).not.toHaveBeenCalled()
    expect(result.snapshot).toEqual({
      contacts: [{ id: 'c1' }],
      backupMeta: {
        kind: 'local-compact',
        isPartial: true,
        omittedKeys: ['vnProjects']
      },
      hydrated: true,
      prepared: true
    })
  })

  it('replaces empty IndexedDB data with legacy data and reports migration errors', async () => {
    const migrationError = new Error('set failed')
    const { calls, run } = createLoader({
      idbGet: vi.fn(async () => ({ contacts: [] })),
      idbSet: vi.fn(async () => {
        throw migrationError
      }),
      getLegacyLocalStorageData: vi.fn(() => ({ contacts: [{ id: 'legacy' }] }))
    })

    const result = await run()

    expect(calls.handleError).toHaveBeenCalledWith(migrationError, expect.objectContaining({
      context: 'Storage:Migration',
      mode: 'warn'
    }))
    expect(result.snapshot.contacts).toEqual([{ id: 'legacy' }])
  })

  it('recovers contacts from persisted message partitions when the snapshot is empty', async () => {
    const persistedMsgs = [
      { id: 'm1', role: 'user', content: 'hello', time: 1 },
      { id: 'm2', role: 'assistant', content: 'world', time: 2 }
    ]
    const { calls, run } = createLoader({
      idbGet: vi.fn(async () => ({ contacts: [] })),
      getMessageKeys: vi.fn(async () => ['contact_abc123']),
      getMessages: vi.fn(async () => [['contact_abc123', persistedMsgs]])
    })

    const result = await run()

    expect(calls.showToast).toHaveBeenCalledWith('已从本地消息记录恢复聊天数据', 4200)
    expect(calls.idbSet).toHaveBeenCalledWith('appData', expect.objectContaining({
      contacts: [
        expect.objectContaining({
          id: 'contact_abc123',
          name: '已恢复会话 abc123',
          msgCount: 2,
          msgs: persistedMsgs,
          recoveredFromMessages: true
        })
      ],
      prepared: true
    }))
    expect(result.snapshot.contacts).toEqual([
      expect.objectContaining({
        id: 'contact_abc123',
        name: '已恢复会话 abc123',
        msgs: persistedMsgs,
        recoveredFromMessages: true
      })
    ])
    expect(result.shouldMigrateInlineMessages).toBe(true)
  })

  it('falls back to default data when no persisted source exists', async () => {
    const { calls, run } = createLoader()

    const result = await run()

    expect(calls.defaultAppData).toHaveBeenCalledTimes(1)
    expect(calls.hydrateStoredContactMessages).toHaveBeenCalledWith(
      { contacts: [], fromDefault: true, prepared: true },
      {
        getAllKeys: calls.getMessageKeys,
        getMany: calls.getMessages
      }
    )
    expect(result.snapshot).toEqual({
      contacts: [],
      fromDefault: true,
      hydrated: true,
      prepared: true
    })
  })

  it('uses the prepared snapshot pipeline when migrating recovered data', async () => {
    const { calls, run } = createLoader({
      idbGet: vi.fn(async () => ({
        contacts: [{ id: 'c1' }],
        forum: [{ id: 'moment_1', title: '旧标题' }]
      }))
    })

    const result = await run()

    expect(calls.prepareLoadedAppData).toHaveBeenCalledTimes(2)
    expect(calls.normalizeLoadedAppData).not.toHaveBeenCalled()
    expect(result.snapshot.forum).toEqual([{ id: 'moment_1', title: '旧标题' }])
    expect(result.snapshot.prepared).toBe(true)
  })
})
