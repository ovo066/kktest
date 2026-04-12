// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StorageRuntimeResolvedDeps} StorageRuntimeResolvedDeps */
/** @typedef {import('./storageContracts').StorageRuntime} StorageRuntime */
/** @typedef {import('./storageContracts').StorageRuntimeStore} StorageRuntimeStore */
/** @typedef {import('./storageContracts').StorageRuntimeOptions} StorageRuntimeOptions */
/** @typedef {import('./storageContracts').StorageScheduleSave} StorageScheduleSave */

import { useContactsStore } from '../../stores/contacts'
import { useConfigsStore } from '../../stores/configs'
import { useMomentsStore } from '../../stores/moments'
import { useReaderStore } from '../../stores/reader'
import { useCharacterResourcesStore } from '../../stores/characterResources'
import { useAlbumStore } from '../../stores/album'
import { useSettingsStore } from '../../stores/settings'
import { usePersonasStore } from '../../stores/personas'
import { useLorebookStore } from '../../stores/lorebook'
import { useStickersStore } from '../../stores/stickers'
import { useGiftsStore } from '../../stores/gifts'
import { useWidgetsStore } from '../../stores/widgets'
import { useVNStore } from '../../stores/vn'
import { useMeetStore } from '../../stores/meet'
import { useLivenessStore } from '../../stores/liveness'
import { useMusicStore } from '../../stores/music'
import { useOfflineStore } from '../../stores/offline'
import { usePlannerStore } from '../../stores/planner'
import { useSnoopStore } from '../../stores/snoop'
import { useCallState } from '../../features/call'
import { createStorageStoreAdapter } from './storageStoreAdapter'
import { applyStorageSnapshot, buildStorageSnapshot } from './stateBridge'

/** @returns {StorageRuntimeResolvedDeps} */
export function resolveStorageRuntimeDeps() {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const momentsStore = useMomentsStore()
  const readerStore = useReaderStore()
  const charResStore = useCharacterResourcesStore()
  const albumStore = useAlbumStore()
  const settingsStore = useSettingsStore()
  const personasStore = usePersonasStore()
  const lorebookStore = useLorebookStore()
  const stickersStore = useStickersStore()
  const giftsStore = useGiftsStore()
  const widgetsStore = useWidgetsStore()
  const vnStore = useVNStore()
  const meetStore = useMeetStore()
  const livenessStore = useLivenessStore()
  const musicStore = useMusicStore()
  const offlineStore = useOfflineStore()
  const plannerStore = usePlannerStore()
  const snoopStore = useSnoopStore()
  const { exportResources, importResources } = useCallState()

  return {
    store: /** @type {StorageRuntimeStore} */ (createStorageStoreAdapter({
      contactsStore,
      configsStore,
      settingsStore,
      personasStore,
      lorebookStore,
      stickersStore,
      giftsStore,
      widgetsStore,
      vnStore,
      readerStore,
      meetStore
    })),
    momentsStore,
    readerStore,
    charResStore,
    albumStore,
    livenessStore,
    musicStore,
    offlineStore,
    plannerStore,
    snoopStore,
    exportResources,
    importResources
  }
}

/**
 * @param {StorageRuntimeOptions} options
 * @returns {StorageRuntime}
 */
export function createStorageRuntime(options) {
  const {
    store,
    momentsStore,
    readerStore,
    charResStore,
    albumStore,
    livenessStore,
    musicStore,
    offlineStore,
    plannerStore,
    snoopStore,
    exportResources,
    importResources,
    externalizeStateMedia
  } = options

  function createBridgeDeps() {
    return {
      store,
      momentsStore,
      readerStore,
      charResStore,
      albumStore,
      livenessStore,
      musicStore,
      offlineStore,
      plannerStore,
      snoopStore
    }
  }

  /** @returns {import('./storageContracts').StorageSnapshotEnvelope} */
  function buildBaseSnapshot() {
    return buildStorageSnapshot({
      ...createBridgeDeps(),
      externalizeStateMedia,
      exportCallResources: exportResources
    })
  }

  /** @param {unknown} appData @param {StorageScheduleSave} [scheduleSave] @returns {StorageAppData} */
  function applyAppDataToState(appData, scheduleSave) {
    return applyStorageSnapshot(appData, {
      ...createBridgeDeps(),
      importCallResources: importResources,
      scheduleSave
    })
  }

  function trimMessagesIfNeeded() {
    if (!Array.isArray(store.contacts)) return
    store.contacts.forEach((contact) => {
      const maxMessages = contact.maxMessages
      if (!maxMessages || maxMessages <= 0 || !Array.isArray(contact.msgs)) return
      if (contact.msgs.length > maxMessages) {
        contact.msgs = contact.msgs.slice(-maxMessages)
      }
    })
  }

  return {
    buildBaseSnapshot,
    applyAppDataToState,
    trimMessagesIfNeeded
  }
}
