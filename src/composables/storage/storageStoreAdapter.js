import { defineAliasedProxyMap, defineProxyMap } from '../../utils/objectProxy'
import { STORAGE_SETTINGS_PROXY_FIELDS } from '../../stores/settingsSchema'

const VN_PROXY_FIELDS = {
  vnProjects: 'projects',
  vnCurrentProjectId: 'currentProjectId',
  vnImageGenConfig: 'imageGenConfig',
  vnTtsConfig: 'ttsConfig'
}

const READER_PROXY_FIELDS = {
  readerBooks: 'books',
  readerSettings: 'readerSettings',
  readerWindowSize: 'readerWindowSize',
  readerAIChat: 'aiChat'
}

const MEET_PROXY_FIELDS = {
  meetMeetings: 'meetings',
  meetPresets: 'presets',
  meetCurrentMeetingId: 'currentMeetingId',
  meetAssetSources: 'assetSources'
}

export function createStorageStoreAdapter({
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
}) {
  const adapter = {}

  defineProxyMap(adapter, contactsStore, ['contacts'])
  defineProxyMap(adapter, configsStore, ['configs', 'activeConfigId'])
  defineProxyMap(adapter, settingsStore, STORAGE_SETTINGS_PROXY_FIELDS)
  defineProxyMap(adapter, personasStore, ['personas', 'defaultPersonaId'])
  defineProxyMap(adapter, stickersStore, ['stickers', 'stickerGroups'])
  defineProxyMap(adapter, giftsStore, ['customGifts'])
  defineProxyMap(adapter, widgetsStore, ['widgets'])
  defineAliasedProxyMap(adapter, vnStore, VN_PROXY_FIELDS)
  defineAliasedProxyMap(adapter, readerStore, READER_PROXY_FIELDS)
  defineAliasedProxyMap(adapter, meetStore, MEET_PROXY_FIELDS)

  Object.defineProperty(adapter, 'lorebook', {
    enumerable: true,
    configurable: true,
    get() {
      return lorebookStore.lorebook
    }
  })

  adapter.setWidgets = widgetsStore.setWidgets
  adapter.applyTheme = settingsStore.applyTheme
  adapter.setDarkMode = settingsStore.setDarkMode

  return adapter
}
