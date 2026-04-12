// @ts-check

let deferredSaveAfterHydration = false
let sharedStorageComposableApi = null

export function deferStorageSaveAfterHydration() {
  deferredSaveAfterHydration = true
}

export function clearDeferredStorageSaveAfterHydration() {
  deferredSaveAfterHydration = false
}

export function consumeDeferredStorageSaveAfterHydration() {
  if (!deferredSaveAfterHydration) return false
  deferredSaveAfterHydration = false
  return true
}

export function getSharedStorageComposableApi() {
  return sharedStorageComposableApi
}

export function setSharedStorageComposableApi(api) {
  sharedStorageComposableApi = api
  return sharedStorageComposableApi
}

export function resetStorageSessionStateForTests() {
  deferredSaveAfterHydration = false
  sharedStorageComposableApi = null
}
