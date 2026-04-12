// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */

/**
 * @typedef {{
 *   id: string
 *   migrate: (normalized: StorageAppData, context: AppDataMigrationContext) => boolean
 * }} AppDataMigration
 */

/**
 * @typedef {{
 *   source: Record<string, unknown> | null
 *   rawSettings: Record<string, unknown> | null
 * }} AppDataMigrationContext
 */

function createDefaultForumUser() {
  return {
    id: 'forum_user',
    name: '匿名用户',
    avatar: null,
    bio: ''
  }
}

function getMigrationContext(data) {
  const source = (data && typeof data === 'object' && !Array.isArray(data))
    ? /** @type {Record<string, unknown>} */ (data)
    : null
  const rawSettings = (source?.settings && typeof source.settings === 'object' && !Array.isArray(source.settings))
    ? /** @type {Record<string, unknown>} */ (source.settings)
    : null

  return {
    source,
    rawSettings
  }
}

function migrateLegacyForumSnapshot(normalized) {
  if (!Array.isArray(normalized.forum)) return false

  let migrated = false
  let forumUser = (normalized.forumUser && typeof normalized.forumUser === 'object' && !Array.isArray(normalized.forumUser))
    ? normalized.forumUser
    : null

  const needsUserRewrite = normalized.forum.some((moment) => {
    if (!moment || typeof moment !== 'object' || Array.isArray(moment)) return false
    if (moment.authorId === 'user') return true
    if (!Array.isArray(moment.replies)) return false
    return moment.replies.some((reply) => reply && typeof reply === 'object' && !Array.isArray(reply) && reply.authorId === 'user')
  })

  if (needsUserRewrite && !forumUser) {
    forumUser = createDefaultForumUser()
    normalized.forumUser = forumUser
    migrated = true
  }

  const forumAuthor = forumUser || createDefaultForumUser()

  normalized.forum = normalized.forum.map((moment) => {
    if (!moment || typeof moment !== 'object' || Array.isArray(moment)) return moment
    const nextMoment = { ...moment }

    if (!nextMoment._momentVersion) {
      const title = String(nextMoment.title || '').trim()
      const oldContent = String(nextMoment.content || '').trim()
      if (title && oldContent) {
        nextMoment.content = title + '\n' + oldContent
      } else if (title) {
        nextMoment.content = title
      }
      delete nextMoment.title
      delete nextMoment.boardId
      if (!Array.isArray(nextMoment.images)) nextMoment.images = []
      if (!('mood' in nextMoment)) nextMoment.mood = null
      if (!('linkedChatId' in nextMoment)) nextMoment.linkedChatId = null
      nextMoment._momentVersion = 1
      migrated = true
    }

    if (nextMoment.authorId === 'user') {
      nextMoment.authorId = forumAuthor.id
      nextMoment.authorName = forumAuthor.name
      nextMoment.authorAvatar = forumAuthor.avatar
      migrated = true
    }

    if (Array.isArray(nextMoment.replies)) {
      nextMoment.replies = nextMoment.replies.map((reply) => {
        if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return reply
        if (reply.authorId !== 'user') return reply
        migrated = true
        return {
          ...reply,
          authorId: forumAuthor.id,
          authorName: forumAuthor.name,
          authorAvatar: forumAuthor.avatar
        }
      })
    }

    return nextMoment
  })

  return migrated
}

/** @type {AppDataMigration[]} */
export const APP_DATA_MIGRATIONS = [
  {
    id: 'legacy-planner-auto-capture',
    migrate(normalized, context) {
      if (!context.rawSettings) return false
      const hasLegacyPlannerToggle = Object.prototype.hasOwnProperty.call(context.rawSettings, 'allowPlannerAI')
      const hasNewPlannerCapture = Object.prototype.hasOwnProperty.call(context.rawSettings, 'allowAIPlannerCapture')
      if (!hasLegacyPlannerToggle || hasNewPlannerCapture) return false
      normalized.settings.allowAIPlannerCapture = !!normalized.settings.allowPlannerAI
      return true
    }
  },
  {
    id: 'legacy-whisper-stt-settings',
    migrate(_normalized, context) {
      if (!context.rawSettings) return false
      return [
        'whisperApiUrl',
        'whisperApiKey',
        'whisperApiModel'
      ].some((key) => Object.prototype.hasOwnProperty.call(context.rawSettings, key))
        || String(context.rawSettings.sttEngine || '').trim() === 'whisper-api'
    }
  },
  {
    id: 'legacy-edge-tts-mode',
    migrate(normalized, context) {
      if (!context.rawSettings) return false
      const legacyMode = String(context.rawSettings.voiceTtsMode || '').trim()
      const legacyConfig = (context.rawSettings.voiceTtsConfig && typeof context.rawSettings.voiceTtsConfig === 'object' && !Array.isArray(context.rawSettings.voiceTtsConfig))
        ? context.rawSettings.voiceTtsConfig
        : null
      const hasLegacyEndpoint = !!String(legacyConfig?.edgeEndpoint || '').trim()
      return legacyMode === 'edge' && !hasLegacyEndpoint && normalized.settings.voiceTtsMode === 'browser'
    }
  },
  {
    id: 'legacy-offline-presets-array',
    migrate(_normalized, context) {
      return Array.isArray(context.source?.offlinePresets)
    }
  },
  {
    id: 'legacy-forum-snapshot',
    migrate(normalized) {
      return migrateLegacyForumSnapshot(normalized)
    }
  }
]

/**
 * @param {unknown} data
 * @returns {AppDataMigrationContext}
 */
export function createAppDataMigrationContext(data) {
  return getMigrationContext(data)
}

/**
 * @param {StorageAppData} normalized
 * @param {AppDataMigrationContext} context
 * @returns {{ data: StorageAppData, needsSave: boolean, appliedMigrations: string[] }}
 */
export function runAppDataMigrations(normalized, context) {
  const appliedMigrations = APP_DATA_MIGRATIONS
    .filter((migration) => migration.migrate(normalized, context))
    .map((migration) => migration.id)

  return {
    data: normalized,
    needsSave: appliedMigrations.length > 0,
    appliedMigrations
  }
}
