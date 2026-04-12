import { ref } from 'vue'

const ACCESS_ANNOUNCEMENT_ENDPOINT = '/api/access-announcement'
const ACCESS_ANNOUNCEMENT_SEEN_KEY = 'aichat_access_announcement_seen'
const ACCESS_ANNOUNCEMENT_GUEST_KEY = 'guest'

const announcement = ref(null)
const isVisible = ref(false)
const isLoading = ref(false)
let lastIdentityKey = ''

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildSessionIdentityKey(session = null) {
  const provider = normalizeText(session?.provider)
  const userId = normalizeText(session?.userId)
  if (!provider || !userId) return ''
  return `${provider}:${userId}`
}

function buildIdentityKey(session = null) {
  return buildSessionIdentityKey(session) || ACCESS_ANNOUNCEMENT_GUEST_KEY
}

function buildSeenStorageKeys(session = null) {
  const keys = [`${ACCESS_ANNOUNCEMENT_SEEN_KEY}:${ACCESS_ANNOUNCEMENT_GUEST_KEY}`]
  const sessionIdentityKey = buildSessionIdentityKey(session)
  if (sessionIdentityKey) {
    keys.push(`${ACCESS_ANNOUNCEMENT_SEEN_KEY}:${sessionIdentityKey}`)
  }
  return keys
}

function hasSeenAnnouncement(session = null, announcementId = '') {
  if (typeof window === 'undefined') return false
  const normalizedId = normalizeText(announcementId)
  if (!normalizedId) return false

  return buildSeenStorageKeys(session).some((storageKey) => {
    try {
      return normalizeText(window.localStorage.getItem(storageKey)) === normalizedId
    } catch {
      return false
    }
  })
}

function writeSeenAnnouncementId(session = null, announcementId = '') {
  if (typeof window === 'undefined') return
  const normalizedId = normalizeText(announcementId)
  if (!normalizedId) return

  buildSeenStorageKeys(session).forEach((storageKey) => {
    try {
      window.localStorage.setItem(storageKey, normalizedId)
    } catch {
      // ignore storage failures
    }
  })
}

export function useAccessAnnouncement() {
  async function maybeLoadAnnouncement(session = null, options = {}) {
    const identityKey = buildIdentityKey(session)

    if (!options.force && identityKey === lastIdentityKey && announcement.value) {
      isVisible.value = !!announcement.value.id && !hasSeenAnnouncement(session, announcement.value.id)
      return announcement.value
    }

    isLoading.value = true
    lastIdentityKey = identityKey

    try {
      const response = await fetch(ACCESS_ANNOUNCEMENT_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      })
      if (!response.ok) {
        announcement.value = null
        isVisible.value = false
        return null
      }

      const payload = await response.json()
      const nextAnnouncement = payload.announcement && typeof payload.announcement === 'object'
        ? { ...payload.announcement }
        : null
      announcement.value = nextAnnouncement

      if (!nextAnnouncement?.id) {
        isVisible.value = false
        return null
      }

      isVisible.value = !hasSeenAnnouncement(session, nextAnnouncement.id)
      return nextAnnouncement
    } catch {
      announcement.value = null
      isVisible.value = false
      return null
    } finally {
      isLoading.value = false
    }
  }

  function acknowledgeAnnouncement(session = null) {
    if (announcement.value?.id) {
      writeSeenAnnouncementId(session, announcement.value.id)
    }
    isVisible.value = false
  }

  function resetAnnouncement() {
    announcement.value = null
    isVisible.value = false
    lastIdentityKey = ''
  }

  return {
    announcement,
    isVisible,
    isLoading,
    maybeLoadAnnouncement,
    acknowledgeAnnouncement,
    resetAnnouncement
  }
}
