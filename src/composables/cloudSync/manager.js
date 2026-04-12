import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getRedirectResult,
  getAuth,
  GoogleAuthProvider,
  linkWithRedirect,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously
} from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { getBlob, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import { CLOUD_SYNC_STATUS, useCloudSyncStore } from '../../stores/cloudSync'
import { useSettingsStore } from '../../stores/settings'
import { shouldDeferAutoUpload } from './policy'
import {
  getCloudSyncConfigSignature,
  isCloudSyncConfigComplete,
  resolveCloudSyncFirebaseConfig
} from '../../utils/cloudSyncConfig'
import { makeId } from '../../utils/id'
import { useToast } from '../useToast'

const FIREBASE_APP_NAME = 'aichat-cloud-sync'
const CLOUD_SYNC_FILE_NAME = 'aichat_cloud_backup.zip'
const GOOGLE_LINK_REDIRECT_MARKER = 'aichat:cloud-sync:google-link-redirect'
const GOOGLE_LINK_REDIRECT_RETURN_HASH = 'aichat:cloud-sync:google-link-return-hash'
const GOOGLE_LINK_BROWSER_HANDOFF_QUERY = 'googleLinkInBrowser'
const GOOGLE_LINK_REDIRECT_MARKER_MS = 10 * 60 * 1000
const LOCKSCREEN_UNLOCK_GRACE_KEY = 'aichat_lockscreen_unlock_grace_until'
const LOCKSCREEN_UNLOCK_GRACE_MS = 20 * 1000
const DISPLAY_MODE_FULLSCREEN = '(display-mode: fullscreen)'
const DISPLAY_MODE_STANDALONE = '(display-mode: standalone)'
const DISPLAY_MODE_MINIMAL_UI = '(display-mode: minimal-ui)'
const POPUP_REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
])

let activeClient = null
let activeConfigSignature = ''
let activeStorageApi = null
let clientPromise = null
let authUnsubscribe = null
let pushInFlight = false
let queuedPush = false
let lastUploadedSnapshotUpdatedAt = 0
let lastUploadedBackupSize = 0
let lastUploadedAtMs = 0

function toPositiveNumber(value) {
  return Math.max(0, Number(value || 0) || 0)
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false
  try {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia(DISPLAY_MODE_FULLSCREEN).matches) return true
      if (window.matchMedia(DISPLAY_MODE_STANDALONE).matches) return true
      if (window.matchMedia(DISPLAY_MODE_MINIMAL_UI).matches) return true
    }
    return !!window.navigator?.standalone
  } catch {
    return false
  }
}

function shouldFallbackPopupToRedirect(error) {
  const code = String(error?.code || '')
  if (POPUP_REDIRECT_FALLBACK_CODES.has(code)) return true
  const message = String(error?.message || '').toLowerCase()
  return message.includes('popup') && (message.includes('blocked') || message.includes('not supported'))
}

function getWindowStorageList() {
  if (typeof window === 'undefined') return []
  return [window.sessionStorage, window.localStorage]
}

function removeExpiringMarker(key) {
  getWindowStorageList().forEach((storage) => {
    try {
      storage?.removeItem(key)
    } catch {
      // ignore storage failures
    }
  })
}

function hasExpiringMarker(key) {
  for (const storage of getWindowStorageList()) {
    try {
      const raw = storage?.getItem(key)
      if (!raw) continue
      const expiresAt = Number(raw)
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        return true
      }
      if (raw === '1') {
        return true
      }
    } catch {
      // ignore storage failures
    }
  }
  removeExpiringMarker(key)
  return false
}

function setExpiringMarker(key, ttlMs) {
  const expiresAt = Date.now() + ttlMs
  getWindowStorageList().forEach((storage) => {
    try {
      storage?.setItem(key, String(expiresAt))
    } catch {
      // ignore storage failures
    }
  })
}

function consumeExpiringMarker(key) {
  const hasMarker = hasExpiringMarker(key)
  if (hasMarker) {
    removeExpiringMarker(key)
  }
  return hasMarker
}

function setSharedStorageValue(key, value) {
  getWindowStorageList().forEach((storage) => {
    try {
      if (!value) storage?.removeItem(key)
      else storage?.setItem(key, value)
    } catch {
      // ignore storage failures
    }
  })
}

function consumeSharedStorageValue(key) {
  for (const storage of getWindowStorageList()) {
    try {
      const raw = String(storage?.getItem(key) || '')
      if (raw) {
        setSharedStorageValue(key, '')
        return raw
      }
    } catch {
      // ignore storage failures
    }
  }
  setSharedStorageValue(key, '')
  return ''
}

function restoreRedirectReturnHash() {
  if (typeof window === 'undefined') return
  const savedHash = consumeSharedStorageValue(GOOGLE_LINK_REDIRECT_RETURN_HASH)
  if (!savedHash) return
  const currentHash = String(window.location.hash || '')
  if (currentHash === savedHash) return
  window.location.hash = savedHash
}

function rememberGoogleLinkReturnHash() {
  if (typeof window === 'undefined') return
  setSharedStorageValue(GOOGLE_LINK_REDIRECT_RETURN_HASH, String(window.location.hash || '#/settings'))
}

function markLockscreenUnlockGrace() {
  if (typeof window === 'undefined') return
  setExpiringMarker(LOCKSCREEN_UNLOCK_GRACE_KEY, LOCKSCREEN_UNLOCK_GRACE_MS)
}

function buildBrowserHandoffUrl() {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(window.location.href)
    url.searchParams.set(GOOGLE_LINK_BROWSER_HANDOFF_QUERY, '1')
    return url.toString()
  } catch {
    return ''
  }
}

function consumeGoogleLinkBrowserHandoff() {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    const hasFlag = url.searchParams.get(GOOGLE_LINK_BROWSER_HANDOFF_QUERY) === '1'
    if (!hasFlag) return false
    url.searchParams.delete(GOOGLE_LINK_BROWSER_HANDOFF_QUERY)
    window.history.replaceState({}, '', url.toString())
    return true
  } catch {
    return false
  }
}

function openGoogleLinkInBrowser() {
  const handoffUrl = buildBrowserHandoffUrl()
  if (!handoffUrl || typeof window === 'undefined') {
    throw new Error('无法打开浏览器，请稍后重试')
  }
  markLockscreenUnlockGrace()
  rememberGoogleLinkReturnHash()
  const opened = window.open(handoffUrl, '_blank', 'noopener,noreferrer')
  if (opened) return
  // Chrome installed PWAs may refuse opening a separate browser tab. Falling
  // back to the current window still lets the redirect flow continue.
  window.location.assign(handoffUrl)
}

function markGoogleLinkRedirectPending() {
  if (typeof window === 'undefined') return
  try {
    setExpiringMarker(GOOGLE_LINK_REDIRECT_MARKER, GOOGLE_LINK_REDIRECT_MARKER_MS)
    markLockscreenUnlockGrace()
    rememberGoogleLinkReturnHash()
  } catch {
    // ignore storage failures
  }
}

function consumeGoogleLinkRedirectPending() {
  return consumeExpiringMarker(GOOGLE_LINK_REDIRECT_MARKER)
}

async function maybeStartGoogleLinkBrowserHandoff(auth) {
  if (!consumeGoogleLinkBrowserHandoff()) return false
  if (!auth.currentUser?.isAnonymous) return false
  const provider = new GoogleAuthProvider()
  markGoogleLinkRedirectPending()
  await linkWithRedirect(auth.currentUser, provider)
  return true
}

function resolveErrorMessage(error) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const code = typeof error.code === 'string' ? error.code : ''
    const message = typeof error.message === 'string' ? error.message : ''
    if (code && message) return `${code}: ${message}`
    if (message) return message
  }
  return '云端同步失败'
}

function getRegisteredStorageApi(storageApi) {
  if (storageApi && typeof storageApi === 'object') {
    activeStorageApi = storageApi
  }
  return activeStorageApi
}

function getMetaDoc(db, uid) {
  return doc(db, 'users', uid, 'sync', 'latest')
}

function getBackupRef(storage, uid) {
  return storageRef(storage, `users/${uid}/latest/${CLOUD_SYNC_FILE_NAME}`)
}

function updateRuntimeUser(user) {
  const syncStore = useCloudSyncStore()
  syncStore.setAccount(user)
}

async function resolvePendingGoogleLinkRedirect(auth) {
  const hadPendingRedirect = consumeGoogleLinkRedirectPending()
  if (!hadPendingRedirect && !isStandaloneDisplayMode()) return
  const syncStore = useCloudSyncStore()
  const { showToast } = useToast()
  try {
    const result = await getRedirectResult(auth)
    if (!result?.user) {
      if (hadPendingRedirect) {
        restoreRedirectReturnHash()
      }
      return
    }
    try {
      await auth.currentUser?.reload()
    } catch {
      // ignore profile refresh failures
    }
    updateRuntimeUser(auth.currentUser || result.user)
    syncStore.clearError()
    syncStore.setPendingAction('')
    showToast('已绑定 Google 账号', 2400)
    restoreRedirectReturnHash()
  } catch (error) {
    applyCloudSyncError(error, { toast: true })
    if (hadPendingRedirect) {
      restoreRedirectReturnHash()
    }
  }
}

async function resetClient() {
  if (authUnsubscribe) {
    authUnsubscribe()
    authUnsubscribe = null
  }

  const app = activeClient?.app || getApps().find((item) => item.name === FIREBASE_APP_NAME) || null
  activeClient = null
  activeConfigSignature = ''
  clientPromise = null
  lastUploadedSnapshotUpdatedAt = 0
  lastUploadedBackupSize = 0
  lastUploadedAtMs = 0

  if (app) {
    try {
      await deleteApp(app)
    } catch {
      // ignore
    }
  }
}

function applyCloudSyncError(error, options = {}) {
  const { toast = false } = options
  const syncStore = useCloudSyncStore()
  const { showToast } = useToast()
  const message = resolveErrorMessage(error)

  syncStore.setPendingAction('')
  syncStore.setError(message)

  if (toast) {
    showToast(message, 3600)
  }

  return message
}

async function ensureDeviceId(storageApi) {
  const settingsStore = useSettingsStore()
  if (settingsStore.cloudSyncDeviceId) return settingsStore.cloudSyncDeviceId
  settingsStore.cloudSyncDeviceId = makeId('device')
  storageApi?.scheduleSave?.()
  return settingsStore.cloudSyncDeviceId
}

async function ensureClient(storageApi) {
  const syncStore = useCloudSyncStore()
  const settingsStore = useSettingsStore()
  const resolvedStorageApi = getRegisteredStorageApi(storageApi)

  if (!settingsStore.cloudSyncEnabled) {
    await resetClient()
    syncStore.resetRuntime()
    syncStore.setStatus(CLOUD_SYNC_STATUS.disabled)
    return null
  }

  const firebaseConfig = resolveCloudSyncFirebaseConfig(settingsStore.cloudSyncConfig)
  if (!isCloudSyncConfigComplete(firebaseConfig)) {
    await resetClient()
    syncStore.resetRuntime()
    syncStore.setStatus(CLOUD_SYNC_STATUS.needsConfig)
    return null
  }

  await ensureDeviceId(resolvedStorageApi)

  const nextSignature = getCloudSyncConfigSignature(firebaseConfig)
  if (activeClient && activeConfigSignature === nextSignature) {
    return activeClient
  }

  if (clientPromise && activeConfigSignature === nextSignature) {
    return clientPromise
  }

  if (activeClient && activeConfigSignature !== nextSignature) {
    await resetClient()
  }

  activeConfigSignature = nextSignature
  syncStore.clearError()
  syncStore.setStatus(CLOUD_SYNC_STATUS.initializing)

  clientPromise = (async () => {
    const app = getApps().some((item) => item.name === FIREBASE_APP_NAME)
      ? getApp(FIREBASE_APP_NAME)
      : initializeApp(firebaseConfig, FIREBASE_APP_NAME)
    const auth = getAuth(app)
    const db = getFirestore(app)
    const storage = getStorage(app)

    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch {
      // ignore persistence failures and continue
    }

    await resolvePendingGoogleLinkRedirect(auth)

    if (!authUnsubscribe) {
      authUnsubscribe = onAuthStateChanged(auth, (user) => {
        updateRuntimeUser(user)
      })
    }

    if (!auth.currentUser) {
      syncStore.setStatus(CLOUD_SYNC_STATUS.signingIn)
      await signInAnonymously(auth)
    } else {
      updateRuntimeUser(auth.currentUser)
    }

    const startedBrowserHandoff = await maybeStartGoogleLinkBrowserHandoff(auth)
    if (startedBrowserHandoff) return null

    activeClient = { app, auth, db, storage }
    syncStore.clearError()
    syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
    return activeClient
  })().catch(async (error) => {
    applyCloudSyncError(error, { toast: false })
    await resetClient()
    throw error
  }).finally(() => {
    clientPromise = null
  })

  return clientPromise
}

async function fetchRemoteMetadata(client) {
  const syncStore = useCloudSyncStore()
  const uid = String(client?.auth?.currentUser?.uid || '')
  if (!uid) return null

  const snapshot = await getDoc(getMetaDoc(client.db, uid))
  if (!snapshot.exists()) {
    syncStore.setRemoteState({
      hasRemoteBackup: false,
      lastRemoteUpdatedAt: 0
    })
    return null
  }

  const data = snapshot.data() || {}
  const metadata = {
    backupPath: String(data.backupPath || ''),
    snapshotUpdatedAt: toPositiveNumber(data.snapshotUpdatedAt),
    uploadedAtMs: toPositiveNumber(data.uploadedAtMs),
    size: toPositiveNumber(data.size),
    includesMedia: data.includesMedia === true
  }

  syncStore.setRemoteState({
    hasRemoteBackup: !!metadata.backupPath,
    lastRemoteUpdatedAt: metadata.snapshotUpdatedAt
  })
  lastUploadedSnapshotUpdatedAt = Math.max(lastUploadedSnapshotUpdatedAt, metadata.snapshotUpdatedAt)
  if (metadata.size > 0) {
    lastUploadedBackupSize = metadata.size
  }
  if (metadata.uploadedAtMs > 0) {
    lastUploadedAtMs = metadata.uploadedAtMs
  }

  return metadata
}

async function uploadLatestBackup(storageApi, options = {}) {
  const syncStore = useCloudSyncStore()
  const settingsStore = useSettingsStore()
  const { showToast } = useToast()
  const {
    reason = 'auto',
    toastOnSuccess = false,
    toastOnError = false
  } = options

  const resolvedStorageApi = getRegisteredStorageApi(storageApi)
  if (!resolvedStorageApi) {
    throw new Error('Storage API unavailable for cloud sync')
  }

  const client = await ensureClient(resolvedStorageApi)
  if (!client) return false

  const currentMeta = resolvedStorageApi.getCurrentSnapshotMeta?.() || {}
  const localUpdatedAt = toPositiveNumber(currentMeta.localUpdatedAt)
  const hasLocalData = !!currentMeta.hasUserData
  const includeMedia = settingsStore.cloudSyncIncludeMedia === true

  if (!localUpdatedAt) return false
  if (reason === 'auto' && !hasLocalData) return false
  if (localUpdatedAt <= lastUploadedSnapshotUpdatedAt) return false

  syncStore.clearError()
  syncStore.setStatus(CLOUD_SYNC_STATUS.syncing)
  syncStore.setPendingAction('push')

  try {
    const backup = await resolvedStorageApi.buildBackupBlob({
      format: 'zip',
      includeSecrets: true,
      excludeMedia: !includeMedia
    })
    const snapshotUpdatedAt = toPositiveNumber(backup?.snapshot?.localUpdatedAt)
    if (!snapshotUpdatedAt) {
      throw new Error('本地快照无效，无法上传')
    }

    if (snapshotUpdatedAt <= lastUploadedSnapshotUpdatedAt) {
      syncStore.setPendingAction('')
      syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
      return false
    }

    const blobSize = backup.blob?.size || 0
    if (shouldDeferAutoUpload({
      reason,
      policy: settingsStore.cloudSyncAutoSyncPolicy,
      customPolicy: {
        minIntervalMs: settingsStore.cloudSyncCustomMinIntervalMs,
        minDeltaBytes: settingsStore.cloudSyncCustomMinDeltaBytes
      },
      backupSize: blobSize,
      lastUploadedSize: lastUploadedBackupSize,
      lastUploadedAtMs
    })) {
      syncStore.setPendingAction('')
      syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
      return false
    }

    const uid = String(client.auth.currentUser?.uid || '')
    const path = `users/${uid}/latest/${CLOUD_SYNC_FILE_NAME}`

    await uploadBytes(
      getBackupRef(client.storage, uid),
      backup.blob,
      {
        contentType: 'application/zip',
        customMetadata: {
          snapshotUpdatedAt: String(snapshotUpdatedAt),
          deviceId: String(settingsStore.cloudSyncDeviceId || ''),
          includesMedia: includeMedia ? 'true' : 'false'
        }
      }
    )

    await setDoc(getMetaDoc(client.db, uid), {
      backupPath: path,
      snapshotUpdatedAt,
      uploadedAtMs: Date.now(),
      size: Number(backup.blob?.size || 0) || 0,
      format: 'zip',
      includesMedia: includeMedia,
      deviceId: String(settingsStore.cloudSyncDeviceId || ''),
      updatedAt: serverTimestamp()
    }, { merge: true })

    lastUploadedSnapshotUpdatedAt = snapshotUpdatedAt
    lastUploadedBackupSize = Number(blobSize || 0) || 0
    lastUploadedAtMs = Date.now()
    syncStore.setTimestamps({
      lastPushedAt: lastUploadedAtMs,
      lastRemoteUpdatedAt: snapshotUpdatedAt
    })
    syncStore.setRemoteState({
      hasRemoteBackup: true,
      lastRemoteUpdatedAt: snapshotUpdatedAt
    })
    syncStore.setPendingAction('')
    syncStore.setStatus(CLOUD_SYNC_STATUS.ready)

    if (toastOnSuccess) {
      showToast('已上传到云端', 2400)
    }

    return true
  } catch (error) {
    applyCloudSyncError(error, { toast: toastOnError })
    throw error
  }
}

export async function bootstrapCloudSync(options = {}) {
  const syncStore = useCloudSyncStore()
  const settingsStore = useSettingsStore()
  const { showToast } = useToast()
  const {
    storageApi,
    initialSnapshot = null
  } = options

  const resolvedStorageApi = getRegisteredStorageApi(storageApi)
  const initialUpdatedAt = toPositiveNumber(initialSnapshot?.localUpdatedAt)
  if (initialUpdatedAt > 0) {
    syncStore.setTimestamps({ lastKnownLocalUpdatedAt: initialUpdatedAt })
  }

  const client = await ensureClient(resolvedStorageApi)
  if (!client) return false

  try {
    const remoteMeta = await fetchRemoteMetadata(client)
    const localMeta = resolvedStorageApi?.getCurrentSnapshotMeta?.() || {}
    // Only auto-pull from cloud if local data is empty/missing.
    // If user already has local data, don't overwrite it — they can
    // manually pull via the UI button if needed.
    const localHasData = !!localMeta.hasUserData
    if (remoteMeta?.backupPath && !localHasData) {
      const pulled = await pullCloudSyncNow({
        storageApi: resolvedStorageApi,
        remoteMeta,
        force: true,
        toastOnSuccess: false,
        toastOnError: false
      })
      if (pulled) {
        showToast('已加载云端较新的数据', 2800)
      }
      return pulled
    }

    if (!remoteMeta?.backupPath && settingsStore.cloudSyncAutoSync && localMeta.hasUserData) {
      await uploadLatestBackup(resolvedStorageApi, {
        reason: 'bootstrap',
        toastOnSuccess: false,
        toastOnError: false
      })
    }

    syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
    return true
  } catch (error) {
    applyCloudSyncError(error, { toast: false })
    return false
  }
}

export async function notifyCloudSyncLocalSave(options = {}) {
  const syncStore = useCloudSyncStore()
  const settingsStore = useSettingsStore()
  const {
    snapshot = null,
    storageApi,
    reason = 'auto'
  } = options

  const resolvedStorageApi = getRegisteredStorageApi(storageApi)
  const snapshotUpdatedAt = toPositiveNumber(snapshot?.localUpdatedAt)
  if (snapshotUpdatedAt > 0) {
    syncStore.setTimestamps({ lastKnownLocalUpdatedAt: snapshotUpdatedAt })
  }

  if (!settingsStore.cloudSyncEnabled || !settingsStore.cloudSyncAutoSync) {
    return false
  }

  if (!resolvedStorageApi) return false
  if (!snapshotUpdatedAt) return false
  if (snapshotUpdatedAt <= lastUploadedSnapshotUpdatedAt) return false

  if (pushInFlight) {
    queuedPush = true
    return true
  }

  pushInFlight = true
  try {
    await uploadLatestBackup(resolvedStorageApi, {
      reason,
      toastOnSuccess: false,
      toastOnError: false
    })
  } catch {
    // keep status in runtime store and allow later retries
  } finally {
    pushInFlight = false
  }

  if (queuedPush) {
    queuedPush = false
    const currentMeta = resolvedStorageApi.getCurrentSnapshotMeta?.() || {}
    if (toPositiveNumber(currentMeta.localUpdatedAt) > lastUploadedSnapshotUpdatedAt) {
      void notifyCloudSyncLocalSave({
        storageApi: resolvedStorageApi,
        snapshot: { localUpdatedAt: currentMeta.localUpdatedAt },
        reason
      })
    }
  }

  return true
}

export async function pushCloudSyncNow(options = {}) {
  const resolvedStorageApi = getRegisteredStorageApi(options.storageApi)
  if (!resolvedStorageApi) {
    throw new Error('Storage API unavailable for cloud sync')
  }

  await resolvedStorageApi.flushSaveNow({
    suppressCloudSync: true,
    reason: 'cloud-sync-manual-push'
  })

  return uploadLatestBackup(resolvedStorageApi, {
    reason: 'manual',
    toastOnSuccess: options.toastOnSuccess !== false,
    toastOnError: options.toastOnError !== false
  })
}

export async function pullCloudSyncNow(options = {}) {
  const syncStore = useCloudSyncStore()
  const { showToast } = useToast()
  const {
    storageApi,
    force = false,
    remoteMeta = null,
    toastOnSuccess = true,
    toastOnError = true
  } = options
  const resolvedStorageApi = getRegisteredStorageApi(storageApi)
  if (!resolvedStorageApi) {
    throw new Error('Storage API unavailable for cloud sync')
  }

  const client = await ensureClient(resolvedStorageApi)
  if (!client) return false

  syncStore.clearError()
  syncStore.setStatus(CLOUD_SYNC_STATUS.syncing)
  syncStore.setPendingAction('pull')

  try {
    const metadata = remoteMeta || await fetchRemoteMetadata(client)
    if (!metadata?.backupPath) {
      throw new Error('云端还没有可用备份')
    }

    const currentMeta = resolvedStorageApi.getCurrentSnapshotMeta?.() || {}
    const localUpdatedAt = toPositiveNumber(currentMeta.localUpdatedAt)
    if (!force && metadata.snapshotUpdatedAt <= localUpdatedAt) {
      syncStore.setPendingAction('')
      syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
      return false
    }

    const blob = await getBlob(storageRef(client.storage, metadata.backupPath))
    const imported = await resolvedStorageApi.importBackupBlob(blob, {
      fileName: CLOUD_SYNC_FILE_NAME,
      suppressCloudSync: true,
      reason: 'cloud-sync-pull'
    })

    if (!imported) {
      throw new Error('云端备份导入失败')
    }

    const nextMeta = resolvedStorageApi.getCurrentSnapshotMeta?.() || {}
    syncStore.setTimestamps({
      lastPulledAt: Date.now(),
      lastKnownLocalUpdatedAt: nextMeta.localUpdatedAt
    })
    syncStore.setRemoteState({
      hasRemoteBackup: true,
      lastRemoteUpdatedAt: metadata.snapshotUpdatedAt
    })
    syncStore.setPendingAction('')
    syncStore.setStatus(CLOUD_SYNC_STATUS.ready)

    if (toastOnSuccess) {
      showToast(metadata.includesMedia ? '已从云端拉取数据' : '已从云端拉取数据（未包含媒体文件）', 2600)
    }

    return true
  } catch (error) {
    applyCloudSyncError(error, { toast: toastOnError })
    throw error
  }
}

export async function linkCloudSyncWithGoogle(options = {}) {
  const syncStore = useCloudSyncStore()
  const { showToast } = useToast()
  const resolvedStorageApi = getRegisteredStorageApi(options.storageApi)
  const client = await ensureClient(resolvedStorageApi)
  if (!client) return false

  const currentUser = client.auth.currentUser
  if (!currentUser) {
    throw new Error('当前没有可用登录会话')
  }
  if (!currentUser.isAnonymous) {
    showToast('当前账号已绑定登录提供商', 2400)
    return true
  }

  syncStore.clearError()
  syncStore.setStatus(CLOUD_SYNC_STATUS.syncing)
  syncStore.setPendingAction('link-google')

  try {
    const provider = new GoogleAuthProvider()
    const useRedirectFirst = isStandaloneDisplayMode()
    if (useRedirectFirst) {
      markGoogleLinkRedirectPending()
      await linkWithRedirect(currentUser, provider)
      return false
    }

    try {
      await linkWithPopup(currentUser, provider)
    } catch (popupError) {
      if (!shouldFallbackPopupToRedirect(popupError)) throw popupError
      markGoogleLinkRedirectPending()
      await linkWithRedirect(currentUser, provider)
      syncStore.setPendingAction('')
      syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
      return false
    }

    // Refresh user profile so email/displayName are populated
    await client.auth.currentUser.reload()
    updateRuntimeUser(client.auth.currentUser)
    syncStore.setPendingAction('')
    syncStore.setStatus(CLOUD_SYNC_STATUS.ready)
    showToast('已绑定 Google 账号', 2400)
    return true
  } catch (error) {
    applyCloudSyncError(error, { toast: true })
    throw error
  }
}

export async function reconnectCloudSync(options = {}) {
  await resetClient()
  return bootstrapCloudSync(options)
}
