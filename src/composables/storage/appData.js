// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */

import { buildDefaultAppData, normalizeAppData } from './appDataModules'
import { createAppDataMigrationContext, runAppDataMigrations } from './appDataMigrations'

export { ensureLorebookDefaults } from './lorebookDefaults'

/**
 * @returns {StorageAppData}
 */
export function defaultAppData() {
  return buildDefaultAppData()
}

/**
 * @param {unknown} data
 * @returns {{ data: StorageAppData, needsSave: boolean, appliedMigrations: string[] }}
 */
export function prepareLoadedAppData(data) {
  const normalized = normalizeAppData(
    Object.assign(defaultAppData(), data || {}),
    data
  )
  return runAppDataMigrations(
    normalized,
    createAppDataMigrationContext(data)
  )
}

/**
 * @param {unknown} data
 * @returns {StorageAppData}
 */
export function normalizeLoadedAppData(data) {
  return prepareLoadedAppData(data).data
}

function hasMeaningfulContacts(data) {
  const contacts = Array.isArray(data?.contacts) ? data.contacts : []
  if (contacts.length === 0) return false

  return contacts.some((contact) => {
    if (!contact || typeof contact !== 'object') return false
    const id = String(contact.id || '').trim()
    const msgs = Array.isArray(contact.msgs) ? contact.msgs : []
    const msgCount = Array.isArray(contact.msgs)
      ? contact.msgs.length
      : Math.max(0, Number(contact.msgCount || 0))
    if (id && id !== 'demo') return true
    if (msgCount > 1) return true
    if (msgCount === 0) return !!(contact.name || contact.avatar || contact.prompt)

    const first = msgs[0] || {}
    const firstRole = String(first.role || '').trim()
    const firstContent = String(first.content || '').trim()
    const isDefaultGreeting =
      firstRole === 'assistant' &&
      (firstContent === '你好！有什么我可以帮你的？' || firstContent === '你好！有什么我可以帮你的吗？')
    return !isDefaultGreeting
  })
}

export function hasUserData(data) {
  if (!data) return false
  const configs = Array.isArray(data.configs) ? data.configs.length : 0
  const stickers = Array.isArray(data.stickers) ? data.stickers.length : 0
  const stickerGroups = Array.isArray(data.stickerGroups) ? data.stickerGroups.length : 0
  const customGifts = Array.isArray(data.customGifts) ? data.customGifts.length : 0
  const lorebook = Array.isArray(data.lorebook) ? data.lorebook.length : 0
  const personas = Array.isArray(data.personas) ? data.personas.length : 0
  const forum = Array.isArray(data.forum) ? data.forum.length : 0
  const forumFollowing = Array.isArray(data.forumFollowing) ? data.forumFollowing.length : 0
  const widgets = Array.isArray(data.widgets) ? data.widgets.length : 0
  const vnProjects = Array.isArray(data.vnProjects) ? data.vnProjects.length : 0
  const albumPhotos = Array.isArray(data.albumPhotos) ? data.albumPhotos.length : 0
  const meetMeetings = Array.isArray(data.meetMeetings) ? data.meetMeetings.length : 0
  const readerBooks = Array.isArray(data.readerBooks) ? data.readerBooks.length : 0
  const plannerEvents = Array.isArray(data.planner?.events) ? data.planner.events.length : 0
  const plannerDiaryEntries = Array.isArray(data.planner?.diaryEntries) ? data.planner.diaryEntries.length : 0
  const plannerSchedules = data.planner?.characterSchedules && typeof data.planner.characterSchedules === 'object'
    ? Object.keys(data.planner.characterSchedules).length
    : 0
  const offlinePresets = Array.isArray(data.offlinePresets?.presets) ? data.offlinePresets.presets.length : 0
  const callResources = data.callResources && typeof data.callResources === 'object'
    ? Object.keys(data.callResources).length
    : 0
  const characterResources = data.characterResources && typeof data.characterResources === 'object'
    ? Object.keys(data.characterResources).length
    : 0
  const hasReaderAIChat = !!(data.readerAIChat && Array.isArray(data.readerAIChat.messages) && data.readerAIChat.messages.length)
  const hasReaderChatSessions = !!(
    data.readerAIChatSessions &&
    typeof data.readerAIChatSessions === 'object' &&
    Object.keys(data.readerAIChatSessions).length
  )

  return (
    hasMeaningfulContacts(data) ||
    configs > 1 ||
    stickers > 0 ||
    stickerGroups > 0 ||
    customGifts > 0 ||
    lorebook > 2 ||
    personas > 0 ||
    forum > 0 ||
    forumFollowing > 0 ||
    widgets > 0 ||
    vnProjects > 0 ||
    albumPhotos > 0 ||
    meetMeetings > 0 ||
    readerBooks > 0 ||
    plannerEvents > 0 ||
    plannerDiaryEntries > 0 ||
    plannerSchedules > 0 ||
    offlinePresets > 0 ||
    callResources > 0 ||
    characterResources > 0 ||
    hasReaderAIChat ||
    hasReaderChatSessions
  )
}

export function redactSecretsForExport(data) {
  if (!data || typeof data !== 'object') return data

  if (Array.isArray(data.configs)) {
    data.configs = data.configs.map(cfg => {
      if (!cfg || typeof cfg !== 'object') return cfg
      return { ...cfg, key: '' }
    })
  }

  if (data.settings && typeof data.settings === 'object') {
    if (typeof data.settings.sttApiKey === 'string') data.settings.sttApiKey = ''
    if (typeof data.settings.whisperApiKey === 'string') data.settings.whisperApiKey = ''

    const voiceConfig = data.settings.voiceTtsConfig
    if (voiceConfig && typeof voiceConfig === 'object') {
      if (typeof voiceConfig.minimaxApiKey === 'string') voiceConfig.minimaxApiKey = ''
    }

    const livenessConfig = data.settings.livenessConfig
    if (livenessConfig && typeof livenessConfig === 'object') {
      if (typeof livenessConfig.pushAuthToken === 'string') livenessConfig.pushAuthToken = ''
    }
  }

  if (data.vnImageGenConfig && typeof data.vnImageGenConfig === 'object') {
    const config = data.vnImageGenConfig
    if (config.novelai && typeof config.novelai === 'object') {
      if (typeof config.novelai.apiKey === 'string') config.novelai.apiKey = ''
    }
    if (config.nanobanana && typeof config.nanobanana === 'object') {
      if (typeof config.nanobanana.apiKey === 'string') config.nanobanana.apiKey = ''
    }
    if (config.custom && typeof config.custom === 'object') {
      if (typeof config.custom.apiKey === 'string') config.custom.apiKey = ''
    }
  }

  return data
}
