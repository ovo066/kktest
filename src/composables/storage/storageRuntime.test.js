import { beforeEach, describe, expect, it, vi } from 'vitest'

const bridgeMocks = vi.hoisted(() => ({
  buildStorageSnapshot: vi.fn(),
  applyStorageSnapshot: vi.fn()
}))

vi.mock('./stateBridge', () => ({
  buildStorageSnapshot: bridgeMocks.buildStorageSnapshot,
  applyStorageSnapshot: bridgeMocks.applyStorageSnapshot
}))

import { createStorageRuntime } from './storageRuntime'

function createRuntimeOptions() {
  return {
    store: {
      contacts: [
        {
          id: 'c1',
          maxMessages: 2,
          msgs: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
        },
        {
          id: 'c2',
          maxMessages: 0,
          msgs: [{ id: 'm4' }]
        }
      ]
    },
    momentsStore: { moments: [] },
    readerStore: { readerAISettings: {} },
    charResStore: { exportData: () => ({}) },
    albumStore: { photos: [] },
    livenessStore: { exportData: () => ({}) },
    musicStore: { exportData: () => ({}) },
    offlineStore: { exportData: () => ({}) },
    plannerStore: { exportData: () => ({}) },
    snoopStore: { exportData: () => ({}) },
    exportResources: vi.fn(() => ({ resources: ['call'] })),
    importResources: vi.fn(),
    externalizeStateMedia: vi.fn(() => ({
      rootMedia: {
        wallpaper: null,
        wallpaperRef: '',
        lockScreenWallpaper: null,
        lockScreenWallpaperRef: ''
      },
      mediaEntries: new Map()
    }))
  }
}

describe('storageRuntime', () => {
  beforeEach(() => {
    bridgeMocks.buildStorageSnapshot.mockReset()
    bridgeMocks.applyStorageSnapshot.mockReset()
  })

  it('builds a snapshot with bridge deps and call export resources', () => {
    const options = createRuntimeOptions()
    const runtime = createStorageRuntime(options)
    const packed = { snapshot: { version: 1 }, mediaEntries: new Map() }
    bridgeMocks.buildStorageSnapshot.mockReturnValue(packed)

    const result = runtime.buildBaseSnapshot()

    expect(result).toBe(packed)
    expect(bridgeMocks.buildStorageSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      store: options.store,
      momentsStore: options.momentsStore,
      readerStore: options.readerStore,
      charResStore: options.charResStore,
      albumStore: options.albumStore,
      livenessStore: options.livenessStore,
      musicStore: options.musicStore,
      offlineStore: options.offlineStore,
      plannerStore: options.plannerStore,
      snoopStore: options.snoopStore,
      externalizeStateMedia: options.externalizeStateMedia,
      exportCallResources: options.exportResources
    }))
  })

  it('applies snapshots with import resources and scheduleSave bridge', () => {
    const options = createRuntimeOptions()
    const runtime = createStorageRuntime(options)
    const scheduleSave = vi.fn()
    const appData = { version: 1, contacts: [] }
    bridgeMocks.applyStorageSnapshot.mockReturnValue({ normalized: true })

    const result = runtime.applyAppDataToState(appData, scheduleSave)

    expect(result).toEqual({ normalized: true })
    expect(bridgeMocks.applyStorageSnapshot).toHaveBeenCalledWith(appData, expect.objectContaining({
      store: options.store,
      importCallResources: options.importResources,
      scheduleSave
    }))
  })

  it('trims oversized contact messages in place', () => {
    const options = createRuntimeOptions()
    const runtime = createStorageRuntime(options)

    runtime.trimMessagesIfNeeded()

    expect(options.store.contacts[0].msgs).toEqual([{ id: 'm2' }, { id: 'm3' }])
    expect(options.store.contacts[1].msgs).toEqual([{ id: 'm4' }])
  })
})
