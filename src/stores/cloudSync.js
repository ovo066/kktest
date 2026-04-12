import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const CLOUD_SYNC_STATUS = {
  disabled: 'disabled',
  needsConfig: 'needs-config',
  initializing: 'initializing',
  signingIn: 'signing-in',
  ready: 'ready',
  syncing: 'syncing',
  error: 'error'
}

export const useCloudSyncStore = defineStore('cloud-sync', () => {
  const status = ref(CLOUD_SYNC_STATUS.disabled)
  const pendingAction = ref('')
  const lastError = ref('')
  const hasRemoteBackup = ref(false)
  const currentUid = ref('')
  const accountEmail = ref('')
  const accountName = ref('')
  const providerId = ref('')
  const isAnonymous = ref(true)
  const lastPushedAt = ref(0)
  const lastPulledAt = ref(0)
  const lastRemoteUpdatedAt = ref(0)
  const lastKnownLocalUpdatedAt = ref(0)

  const isReady = computed(() => status.value === CLOUD_SYNC_STATUS.ready)
  const isBusy = computed(() => status.value === CLOUD_SYNC_STATUS.syncing || !!pendingAction.value)

  function setStatus(nextStatus) {
    status.value = nextStatus || CLOUD_SYNC_STATUS.disabled
  }

  function setPendingAction(action = '') {
    pendingAction.value = action || ''
  }

  function setError(message = '') {
    lastError.value = String(message || '')
    if (lastError.value) {
      status.value = CLOUD_SYNC_STATUS.error
    }
  }

  function clearError() {
    lastError.value = ''
  }

  function setAccount(user = null) {
    currentUid.value = String(user?.uid || '')
    isAnonymous.value = !!user?.isAnonymous

    const provider = Array.isArray(user?.providerData)
      ? user.providerData.find((item) => item?.providerId && item.providerId !== 'firebase')
      : null
    providerId.value = String(provider?.providerId || '')

    // After linking, email/displayName may only exist in providerData
    accountEmail.value = String(user?.email || provider?.email || '')
    accountName.value = String(user?.displayName || provider?.displayName || '')
  }

  function setRemoteState(payload = {}) {
    hasRemoteBackup.value = !!payload.hasRemoteBackup
    lastRemoteUpdatedAt.value = Math.max(0, Number(payload.lastRemoteUpdatedAt || 0) || 0)
  }

  function setTimestamps(payload = {}) {
    if (Object.prototype.hasOwnProperty.call(payload, 'lastPushedAt')) {
      lastPushedAt.value = Math.max(0, Number(payload.lastPushedAt || 0) || 0)
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'lastPulledAt')) {
      lastPulledAt.value = Math.max(0, Number(payload.lastPulledAt || 0) || 0)
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'lastKnownLocalUpdatedAt')) {
      lastKnownLocalUpdatedAt.value = Math.max(0, Number(payload.lastKnownLocalUpdatedAt || 0) || 0)
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'lastRemoteUpdatedAt')) {
      lastRemoteUpdatedAt.value = Math.max(0, Number(payload.lastRemoteUpdatedAt || 0) || 0)
    }
  }

  function resetRuntime() {
    status.value = CLOUD_SYNC_STATUS.disabled
    pendingAction.value = ''
    lastError.value = ''
    hasRemoteBackup.value = false
    currentUid.value = ''
    accountEmail.value = ''
    accountName.value = ''
    providerId.value = ''
    isAnonymous.value = true
    lastPushedAt.value = 0
    lastPulledAt.value = 0
    lastRemoteUpdatedAt.value = 0
    lastKnownLocalUpdatedAt.value = 0
  }

  return {
    status,
    pendingAction,
    lastError,
    hasRemoteBackup,
    currentUid,
    accountEmail,
    accountName,
    providerId,
    isAnonymous,
    lastPushedAt,
    lastPulledAt,
    lastRemoteUpdatedAt,
    lastKnownLocalUpdatedAt,
    isReady,
    isBusy,
    setStatus,
    setPendingAction,
    setError,
    clearError,
    setAccount,
    setRemoteState,
    setTimestamps,
    resetRuntime
  }
})
