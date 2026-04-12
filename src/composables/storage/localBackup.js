const BACKUP_KEY = 'aichat_backup'

function safeJsonParse(text, fallback) {
  try { return JSON.parse(text) } catch { return fallback }
}

function normalizeOmittedKeys(keys) {
  if (!Array.isArray(keys)) return []
  return Array.from(new Set(
    keys
      .map(key => String(key || '').trim())
      .filter(Boolean)
  ))
}

function markPartialBackup(snapshot, omittedKeys, kind = 'local-fallback') {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot

  const existingMeta = (snapshot.backupMeta && typeof snapshot.backupMeta === 'object' && !Array.isArray(snapshot.backupMeta))
    ? snapshot.backupMeta
    : {}
  snapshot.backupMeta = {
    ...existingMeta,
    kind,
    isPartial: true,
    omittedKeys: normalizeOmittedKeys([
      ...(Array.isArray(existingMeta.omittedKeys) ? existingMeta.omittedKeys : []),
      ...omittedKeys
    ])
  }
  return snapshot
}

export function saveBackupToLocalStorage(snapshot) {
  // Try full save first
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot))
    return
  } catch { /* quota exceeded */ }

  // Strip: keep only last 50 messages per contact
  try {
    const stripped = JSON.parse(JSON.stringify(snapshot))
    if (Array.isArray(stripped.contacts)) {
      stripped.contacts.forEach(c => {
        if (Array.isArray(c.msgs) && c.msgs.length > 50) {
          c.msgs = c.msgs.slice(-50)
        }
      })
    }
    stripped.forum = []
    stripped.albumPhotos = []
    markPartialBackup(stripped, ['forum', 'albumPhotos'], 'local-storage-quota-strip')
    localStorage.setItem(BACKUP_KEY, JSON.stringify(stripped))
    return
  } catch { /* still too big */ }

  // Last resort: keep only 10 messages per contact, strip all extras
  try {
    const minimal = JSON.parse(JSON.stringify(snapshot))
    if (Array.isArray(minimal.contacts)) {
      minimal.contacts.forEach(c => {
        if (Array.isArray(c.msgs)) c.msgs = c.msgs.slice(-10)
      })
    }
    minimal.forum = []
    minimal.albumPhotos = []
    minimal.vnProjects = []
    markPartialBackup(minimal, ['forum', 'albumPhotos', 'vnProjects'], 'local-storage-quota-minimal')
    localStorage.setItem(BACKUP_KEY, JSON.stringify(minimal))
  } catch {
    // Give up - localStorage too small
  }
}

export function getLocalStorageBackup() {
  try {
    const str = localStorage.getItem(BACKUP_KEY)
    if (!str) return null
    return JSON.parse(str)
  } catch {
    return null
  }
}

export function getLegacyLocalStorageData() {
  try {
    const contacts = safeJsonParse(localStorage.getItem('ai_data') || 'null', null)
    const configs = safeJsonParse(localStorage.getItem('ai_configs') || 'null', null)
    const activeConfigId = localStorage.getItem('ai_active_config')
    const dark = localStorage.getItem('ai_dark')
    const showAvatars = localStorage.getItem('ai_show_avatars')
    const showTimestamps = localStorage.getItem('ai_show_timestamps')
    const sendTimestamps = localStorage.getItem('ai_send_timestamps')
    const allowAIStickers = localStorage.getItem('ai_allow_ai_stickers')
    const allowAICall = localStorage.getItem('ai_allow_ai_call')
    const wallpaper = localStorage.getItem('ai_wallpaper')
    const lockScreenWallpaper = localStorage.getItem('ai_lock_screen_wallpaper')
    const lorebook = safeJsonParse(localStorage.getItem('ai_lorebook_v2') || 'null', null)
    const personas = safeJsonParse(localStorage.getItem('ai_personas') || 'null', null)
    const defaultPersonaId = localStorage.getItem('ai_default_persona')
    const stickers = safeJsonParse(localStorage.getItem('ai_stickers') || 'null', null)

    const hasAny = (
      contacts || configs || activeConfigId || wallpaper || lockScreenWallpaper || lorebook || personas || defaultPersonaId || stickers ||
      dark != null || showAvatars != null || showTimestamps != null || sendTimestamps != null || allowAIStickers != null || allowAICall != null
    )
    if (!hasAny) return null

    return {
      version: 1,
      migratedFrom: 'localStorage',
      migratedAt: Date.now(),
      contacts: Array.isArray(contacts) ? contacts : [],
      configs: Array.isArray(configs) ? configs : [],
      activeConfigId: activeConfigId || null,
      settings: {
        isDark: dark === 'true',
        showChatAvatars: showAvatars === 'true',
        showChatTimestamps: showTimestamps === null ? true : showTimestamps === 'true',
        sendTimestampsToAI: sendTimestamps === 'true',
        allowAIStickers: allowAIStickers === null ? true : allowAIStickers === 'true',
        allowAICall: allowAICall === null ? true : allowAICall === 'true',
        globalPresetLorebookEnabled: true
      },
      wallpaper: typeof wallpaper === 'string' ? wallpaper : null,
      lockScreenWallpaper: typeof lockScreenWallpaper === 'string' ? lockScreenWallpaper : null,
      lorebook: Array.isArray(lorebook) ? lorebook : [],
      personas: Array.isArray(personas) ? personas : [],
      defaultPersonaId: defaultPersonaId || null,
      stickers: Array.isArray(stickers) ? stickers : []
    }
  } catch {
    return null
  }
}
