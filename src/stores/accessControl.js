import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { formatAccessIdentity } from '../utils/accessControl'

export const useAccessControlStore = defineStore('access-control', () => {
  const isEnabled = ref(false)
  const isConfigured = ref(true)
  const isChecking = ref(true)
  const isAuthenticated = ref(false)
  const provider = ref('discord')
  const discordConfigured = ref(false)
  const adminCodeEnabled = ref(false)
  const requiredGuildId = ref('')
  const ruleCount = ref(0)
  const hasRoleRules = ref(false)
  const deviceBindingEnabled = ref(false)
  const deviceSlotLimit = ref(0)
  const deviceAuthenticated = ref(false)
  const deviceClaimRequired = ref(false)
  const session = ref(null)
  const lastError = ref('')
  const lastErrorCode = ref('')
  const checkedAt = ref(0)

  const accountLabel = computed(() => formatAccessIdentity(session.value))
  const canAccessApp = computed(() => {
    if (!isEnabled.value) return true
    return isConfigured.value && isAuthenticated.value && !deviceClaimRequired.value
  })

  function startCheck() {
    isChecking.value = true
  }

  function clearError() {
    lastError.value = ''
    lastErrorCode.value = ''
  }

  function setError(message = '', code = '') {
    lastError.value = String(message || '')
    lastErrorCode.value = String(code || '')
    isChecking.value = false
  }

  function applyStatus(payload = {}) {
    isEnabled.value = !!payload.enabled
    isConfigured.value = payload.configured !== false
    provider.value = String(payload.session?.provider || payload.provider || 'discord')
    discordConfigured.value = !!payload.discordConfigured
    adminCodeEnabled.value = !!payload.adminCodeEnabled
    requiredGuildId.value = String(payload.guildId || '')
    ruleCount.value = Math.max(0, Number(payload.ruleCount || 0) || 0)
    hasRoleRules.value = !!payload.hasRoleRules
    deviceBindingEnabled.value = !!payload.deviceBindingEnabled
    deviceSlotLimit.value = Math.max(0, Number(payload.deviceSlotLimit || 0) || 0)
    session.value = payload.session && typeof payload.session === 'object'
      ? { ...payload.session }
      : null
    isAuthenticated.value = !!payload.authenticated && !!session.value
    deviceAuthenticated.value = session.value?.provider === 'admin'
      ? true
      : !!payload.deviceAuthenticated
    deviceClaimRequired.value = !!payload.deviceClaimRequired
    checkedAt.value = Date.now()
    isChecking.value = false
    if (isAuthenticated.value && !deviceClaimRequired.value) {
      clearError()
    }
  }

  function blockAccess(message = '', options = {}) {
    isEnabled.value = options.enabled !== false
    isConfigured.value = options.configured === true
    discordConfigured.value = !!options.discordConfigured
    adminCodeEnabled.value = !!options.adminCodeEnabled
    deviceBindingEnabled.value = !!options.deviceBindingEnabled
    deviceSlotLimit.value = Math.max(0, Number(options.deviceSlotLimit || 0) || 0)
    session.value = options.session && typeof options.session === 'object'
      ? { ...options.session }
      : null
    isAuthenticated.value = !!options.authenticated && !!session.value
    deviceAuthenticated.value = !!options.deviceAuthenticated
    deviceClaimRequired.value = !!options.deviceClaimRequired
    checkedAt.value = Date.now()
    setError(message, options.errorCode)
  }

  function clearSession() {
    isAuthenticated.value = false
    deviceAuthenticated.value = false
    deviceClaimRequired.value = false
    session.value = null
    checkedAt.value = Date.now()
    isChecking.value = false
  }

  function reset() {
    isEnabled.value = false
    isConfigured.value = true
    isChecking.value = true
    isAuthenticated.value = false
    provider.value = 'discord'
    discordConfigured.value = false
    adminCodeEnabled.value = false
    requiredGuildId.value = ''
    ruleCount.value = 0
    hasRoleRules.value = false
    deviceBindingEnabled.value = false
    deviceSlotLimit.value = 0
    deviceAuthenticated.value = false
    deviceClaimRequired.value = false
    session.value = null
    lastError.value = ''
    lastErrorCode.value = ''
    checkedAt.value = 0
  }

  return {
    isEnabled,
    isConfigured,
    isChecking,
    isAuthenticated,
    provider,
    discordConfigured,
    adminCodeEnabled,
    requiredGuildId,
    ruleCount,
    hasRoleRules,
    deviceBindingEnabled,
    deviceSlotLimit,
    deviceAuthenticated,
    deviceClaimRequired,
    session,
    lastError,
    lastErrorCode,
    checkedAt,
    accountLabel,
    canAccessApp,
    startCheck,
    clearError,
    setError,
    applyStatus,
    blockAccess,
    clearSession,
    reset
  }
})
