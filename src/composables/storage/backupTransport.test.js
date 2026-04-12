import { describe, expect, it, vi } from 'vitest'
import { createBackupTransport } from './backupTransport'

describe('backupTransport', () => {
  it('builds a json backup with inlined media and secret redaction', async () => {
    const redactSecretsForExport = vi.fn((snapshot) => {
      snapshot.redacted = true
    })
    const applyMediaMapToSnapshot = vi.fn((snapshot, resolveMedia) => {
      snapshot.inlineMedia = resolveMedia('media://1')
    })

    const transport = createBackupTransport({
      snapshotAppData: () => ({
        snapshot: { contacts: [], apiKey: 'secret' },
        mediaEntries: new Map([['media://1', { type: 'image/png', size: 12 }]])
      }),
      getLocalUpdatedAt: () => 123,
      redactSecretsForExport,
      collectMediaRefsFromSnapshot: () => new Set(['media://1']),
      collectMediaEntriesForExport: async () => new Map([['media://1', { type: 'image/png', size: 12 }]]),
      mediaBinaryToDataUrl: async () => 'data:image/png;base64,abc',
      applyMediaMapToSnapshot,
      stripSnapshotMedia: (snapshot) => snapshot,
      normalizeMediaBinary: () => null,
      guessMediaExtensionFromMimeType: () => 'png',
      idbMediaSetMany: async () => {},
      normalizeLoadedAppData: (data) => data,
      hydrateSnapshotMedia: async () => {},
      applyAppDataToState: () => {},
      flushSaveNow: async () => {},
      handleError: () => {}
    })

    const result = await transport.buildBackupBlob({ format: 'json' })
    const payload = JSON.parse(await result.blob.text())

    expect(redactSecretsForExport).toHaveBeenCalledTimes(1)
    expect(applyMediaMapToSnapshot).toHaveBeenCalledTimes(1)
    expect(payload.data.redacted).toBe(true)
    expect(payload.data.inlineMedia).toBe('data:image/png;base64,abc')
  })

  it('imports a json backup and persists normalized state through flushSaveNow', async () => {
    const applyAppDataToState = vi.fn()
    const hydrateSnapshotMedia = vi.fn(async () => {})
    const flushSaveNow = vi.fn(async () => true)
    const handleError = vi.fn()

    const transport = createBackupTransport({
      snapshotAppData: () => ({ snapshot: {}, mediaEntries: new Map() }),
      getLocalUpdatedAt: () => 0,
      redactSecretsForExport: () => {},
      collectMediaRefsFromSnapshot: () => new Set(),
      collectMediaEntriesForExport: async () => new Map(),
      mediaBinaryToDataUrl: async () => '',
      applyMediaMapToSnapshot: () => {},
      stripSnapshotMedia: (snapshot) => snapshot,
      normalizeMediaBinary: () => null,
      guessMediaExtensionFromMimeType: () => 'bin',
      idbMediaSetMany: async () => {},
      normalizeLoadedAppData: (data) => ({ ...data, normalized: true }),
      hydrateSnapshotMedia,
      applyAppDataToState,
      flushSaveNow,
      handleError
    })

    const blob = new Blob([JSON.stringify({ data: { contacts: [{ id: 'c1' }] } })], {
      type: 'application/json'
    })

    const ok = await transport.importBackupBlob(blob, { reason: 'test-import' })

    expect(ok).toBe(true)
    expect(hydrateSnapshotMedia).toHaveBeenCalledWith({ contacts: [{ id: 'c1' }], normalized: true })
    expect(applyAppDataToState).toHaveBeenCalledWith({ contacts: [{ id: 'c1' }], normalized: true })
    expect(flushSaveNow).toHaveBeenCalledWith({
      allowSignificantDataLoss: true,
      backupFirst: true,
      suppressCloudSync: false,
      reason: 'test-import'
    })
    expect(handleError).not.toHaveBeenCalled()
  })

  it('strips local media references when excludeMedia is enabled', async () => {
    const stripSnapshotMedia = vi.fn((snapshot) => {
      snapshot.contacts[0].avatar = ''
      delete snapshot.contacts[0].avatarRef
      return snapshot
    })

    const transport = createBackupTransport({
      snapshotAppData: () => ({
        snapshot: {
          contacts: [{ id: 'c1', avatarType: 'image', avatarRef: 'media://1' }],
          theme: {}
        },
        mediaEntries: new Map([['media://1', { type: 'image/png', size: 12 }]])
      }),
      getLocalUpdatedAt: () => 456,
      redactSecretsForExport: () => {},
      collectMediaRefsFromSnapshot: () => new Set(['media://1']),
      collectMediaEntriesForExport: async () => new Map([['media://1', { type: 'image/png', size: 12 }]]),
      mediaBinaryToDataUrl: async () => 'data:image/png;base64,abc',
      applyMediaMapToSnapshot: () => {},
      stripSnapshotMedia,
      normalizeMediaBinary: () => null,
      guessMediaExtensionFromMimeType: () => 'png',
      idbMediaSetMany: async () => {},
      normalizeLoadedAppData: (data) => data,
      hydrateSnapshotMedia: async () => {},
      applyAppDataToState: () => {},
      flushSaveNow: async () => {},
      handleError: () => {}
    })

    const result = await transport.buildBackupBlob({ format: 'json', excludeMedia: true })
    const payload = JSON.parse(await result.blob.text())

    expect(stripSnapshotMedia).toHaveBeenCalledTimes(1)
    expect(payload.data.contacts[0].avatarRef).toBeUndefined()
  })
})
