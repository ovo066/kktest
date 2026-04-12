// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StorageCompactBackupSnapshot} StorageCompactBackupSnapshot */
/** @typedef {import('./storageContracts').StorageMediaEntryMap} StorageMediaEntryMap */
/** @typedef {import('./storageContracts').StorageMessagePartitions} StorageMessagePartitions */
/** @typedef {import('./storageContracts').StorageOfflinePresetsSnapshot} StorageOfflinePresetsSnapshot */

import { defaultAppData } from './appData'
import { buildContactMessageSummary } from '../../utils/contactMessageSummary'

const COMPACT_BACKUP_OMITTED_KEYS = Object.freeze([
  'forum',
  'albumPhotos',
  'vnProjects',
  'meetMeetings',
  'meetPresets',
  'callResources',
  'characterResources',
  'liveness',
  'music',
  'offlinePresets'
])

export function getPartitionMessagesForContact(contact, messagePartitions) {
  const contactId = typeof contact?.id === 'string' ? contact.id : ''
  if (contactId && messagePartitions instanceof Map && messagePartitions.has(contactId)) {
    return messagePartitions.get(contactId)
  }
  return Array.isArray(contact?.msgs) ? contact.msgs : []
}

/**
 * @param {StorageAppData} snapshot
 * @param {object} [options]
 * @param {StorageMediaEntryMap} [options.mediaEntries]
 * @param {StorageMessagePartitions} [options.messagePartitions]
 * @param {number} [options.msgLimit]
 * @param {StorageOfflinePresetsSnapshot} [options.offlineFallback]
 * @param {(snapshot: Record<string, unknown>, mediaEntries?: StorageMediaEntryMap) => void} [options.restoreInlineMediaFromMap]
 * @returns {StorageCompactBackupSnapshot}
 */
export function buildCompactBackupSnapshot(snapshot, options = {}) {
  const {
    mediaEntries,
    messagePartitions,
    msgLimit = 30,
    offlineFallback = defaultAppData().offlinePresets,
    restoreInlineMediaFromMap = () => {}
  } = options

  const contacts = Array.isArray(snapshot?.contacts)
    ? snapshot.contacts.map((contact) => {
        const next = { ...contact }
        const msgs = getPartitionMessagesForContact(contact, messagePartitions)
        const msgList = Array.isArray(msgs) ? msgs : []
        const summary = buildContactMessageSummary({ ...contact, msgs: msgList })

        next.msgs = msgList.slice(-msgLimit)
        next.lastMsgId = summary.lastMsgId
        next.lastMsgPreview = summary.lastMsgPreview
        next.lastMsgSenderName = summary.lastMsgSenderName
        next.lastMsgTime = summary.lastMsgTime
        next.msgCount = msgList.length
        if (Array.isArray(contact?.callHistory)) {
          next.callHistory = contact.callHistory.slice(-8).map((item) => {
            const row = { ...item }
            if (Array.isArray(item?.transcript)) {
              row.transcript = item.transcript.slice(-20)
            }
            return row
          })
        }
        if (Array.isArray(next.offlineMsgs)) next.offlineMsgs = next.offlineMsgs.slice(-msgLimit)
        if (Array.isArray(next.offlineSessions)) next.offlineSessions = []
        if (Array.isArray(next.offlineSnapshots)) next.offlineSnapshots = []
        return next
      })
    : []

  const compact = {
    version: Number(snapshot?.version || 1),
    backupMeta: {
      kind: 'local-compact',
      isPartial: true,
      omittedKeys: [...COMPACT_BACKUP_OMITTED_KEYS]
    },
    contacts,
    configs: Array.isArray(snapshot?.configs) ? snapshot.configs : [],
    activeConfigId: snapshot?.activeConfigId || null,
    settings: snapshot?.settings || {},
    wallpaper: snapshot?.wallpaper || null,
    lockScreenWallpaper: snapshot?.lockScreenWallpaper || null,
    theme: snapshot?.theme || null,
    lorebook: Array.isArray(snapshot?.lorebook) ? snapshot.lorebook : [],
    personas: Array.isArray(snapshot?.personas) ? snapshot.personas : [],
    defaultPersonaId: snapshot?.defaultPersonaId || null,
    stickers: Array.isArray(snapshot?.stickers) ? snapshot.stickers : [],
    stickerGroups: Array.isArray(snapshot?.stickerGroups) ? snapshot.stickerGroups : [],
    widgets: Array.isArray(snapshot?.widgets) ? snapshot.widgets : [],
    savedThemes: Array.isArray(snapshot?.savedThemes) ? snapshot.savedThemes : [],
    activeThemeId: snapshot?.activeThemeId || '',
    readerBooks: Array.isArray(snapshot?.readerBooks) ? snapshot.readerBooks : [],
    readerSettings: snapshot?.readerSettings || null,
    readerAISettings: snapshot?.readerAISettings || null,
    readerWindowSize: snapshot?.readerWindowSize || null,
    readerAIChat: snapshot?.readerAIChat || null,
    readerAIChatSessions: snapshot?.readerAIChatSessions || null,
    readerSelectionChatSessions: snapshot?.readerSelectionChatSessions || null,
    readerCurrentChatSessionKey: snapshot?.readerCurrentChatSessionKey || '',
    planner: snapshot?.planner || defaultAppData().planner,
    forum: [],
    albumPhotos: [],
    vnProjects: [],
    meetMeetings: [],
    meetPresets: [],
    callResources: {},
    characterResources: {},
    liveness: null,
    music: null,
    offlinePresets: { ...offlineFallback, presets: [] }
  }

  restoreInlineMediaFromMap(compact, mediaEntries)
  return compact
}
