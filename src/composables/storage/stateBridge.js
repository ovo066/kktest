// @ts-check

/** @typedef {import('./storageContracts').ExternalizedMediaSnapshot} ExternalizedMediaSnapshot */
/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StorageApplyDeps} StorageApplyDeps */
/** @typedef {import('./storageContracts').StorageBuildDeps} StorageBuildDeps */
/** @typedef {import('./storageContracts').StorageMediaEntryMap} StorageMediaEntryMap */
/** @typedef {import('./storageContracts').StorageRootMediaRefs} StorageRootMediaRefs */
/** @typedef {import('./storageContracts').StorageStoreLike} StorageStoreLike */
/** @typedef {import('./storageContracts').StorageSnapshotEnvelope} StorageSnapshotEnvelope */

import { defaultAppData, prepareLoadedAppData } from './appData'
import {
  applySettingsToStore,
  buildSnapshotSettings,
  finalizeAppliedSnapshot,
  STORAGE_APPLY_MODULES,
  STORAGE_SNAPSHOT_MODULES
} from './storageModules'

/**
 * @param {StorageAppData} payload
 * @param {StorageMediaEntryMap} mediaEntries
 * @returns {StorageSnapshotEnvelope}
 */
function cloneSnapshotPayload(payload, mediaEntries) {
  try {
    return {
      snapshot: JSON.parse(JSON.stringify(payload)),
      mediaEntries
    }
  } catch {
    return {
      snapshot: payload,
      mediaEntries
    }
  }
}

/**
 * @param {StorageStoreLike} store
 * @param {StorageRootMediaRefs} rootMedia
 */
function syncRootMediaRefs(store, rootMedia) {
  if (store.wallpaperRef !== rootMedia.wallpaperRef) {
    store.wallpaperRef = rootMedia.wallpaperRef || ''
  }

  if (store.lockScreenWallpaperRef !== rootMedia.lockScreenWallpaperRef) {
    store.lockScreenWallpaperRef = rootMedia.lockScreenWallpaperRef || ''
  }
}

/**
 * @param {StorageBuildDeps} deps
 * @returns {ExternalizedMediaSnapshot}
 */
function createExternalizedSnapshot(deps) {
  const {
    store,
    momentsStore,
    albumStore,
    plannerStore,
    charResStore,
    externalizeStateMedia,
    exportCallResources
  } = deps

  const externalized = externalizeStateMedia({
    contacts: store.contacts || [],
    albumPhotos: albumStore.photos || [],
    forum: momentsStore.moments || [],
    forumUser: momentsStore.forumUser || null,
    personas: store.personas || [],
    stickers: store.stickers || [],
    theme: store.theme,
    widgets: store.widgets || [],
    readerBooks: store.readerBooks || [],
    savedThemes: store.savedThemes || [],
    vnProjects: store.vnProjects || [],
    meetMeetings: store.meetMeetings || [],
    planner: plannerStore.exportData(),
    callResources: exportCallResources(),
    characterResources: charResStore.exportData(),
    wallpaper: store.wallpaper || null,
    wallpaperRef: store.wallpaperRef || '',
    lockScreenWallpaper: store.lockScreenWallpaper || null,
    lockScreenWallpaperRef: store.lockScreenWallpaperRef || ''
  })

  syncRootMediaRefs(store, externalized.rootMedia)
  return externalized
}

export { applySettingsToStore, buildSnapshotSettings }

/**
 * @param {StorageBuildDeps} deps
 * @returns {StorageSnapshotEnvelope}
 */
export function buildStorageSnapshot(deps) {
  const externalized = createExternalizedSnapshot(deps)
  const context = { ...deps, externalized }
  const payload = defaultAppData()

  STORAGE_SNAPSHOT_MODULES.forEach((module) => {
    Object.assign(payload, module.snapshot(context))
  })

  return cloneSnapshotPayload(payload, externalized.mediaEntries)
}

/**
 * @param {unknown} appData
 * @param {StorageApplyDeps} deps
 * @returns {StorageAppData}
 */
export function applyStorageSnapshot(appData, deps) {
  const prepared = prepareLoadedAppData(appData)
  const data = prepared.data
  const context = { needsSave: prepared.needsSave }

  STORAGE_APPLY_MODULES.forEach((module) => {
    module.apply(data, deps, context)
  })

  finalizeAppliedSnapshot(deps)

  if (context.needsSave && typeof deps.scheduleSave === 'function') {
    deps.scheduleSave()
  }

  return data
}
