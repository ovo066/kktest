import { describe, expect, it } from 'vitest'
import {
  clearDeferredStorageSaveAfterHydration,
  consumeDeferredStorageSaveAfterHydration,
  deferStorageSaveAfterHydration,
  getSharedStorageComposableApi,
  resetStorageSessionStateForTests,
  setSharedStorageComposableApi
} from './storageSessionState'

describe('storageSessionState', () => {
  it('tracks deferred save intent as a one-shot flag', () => {
    resetStorageSessionStateForTests()

    expect(consumeDeferredStorageSaveAfterHydration()).toBe(false)

    deferStorageSaveAfterHydration()
    expect(consumeDeferredStorageSaveAfterHydration()).toBe(true)
    expect(consumeDeferredStorageSaveAfterHydration()).toBe(false)

    deferStorageSaveAfterHydration()
    clearDeferredStorageSaveAfterHydration()
    expect(consumeDeferredStorageSaveAfterHydration()).toBe(false)
  })

  it('stores the shared composable api explicitly', () => {
    resetStorageSessionStateForTests()
    const api = { scheduleSave() {} }

    expect(getSharedStorageComposableApi()).toBeNull()
    expect(setSharedStorageComposableApi(api)).toBe(api)
    expect(getSharedStorageComposableApi()).toBe(api)
  })
})
