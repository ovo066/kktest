<template>
  <div class="access-gate">
    <div class="access-card">
      <div class="access-badge">
        <i class="ph ph-shield-check text-[22px]"></i>
      </div>

      <div class="space-y-2">
        <p class="access-eyebrow">Access Guard</p>
        <h1 class="access-title">{{ titleText }}</h1>
        <p class="access-copy">{{ descriptionText }}</p>
      </div>

      <div v-if="accessStore.isEnabled" class="access-meta">
        <div class="access-meta-row">
          <span>验证方式</span>
          <span>{{ methodLabel }}</span>
        </div>
        <div v-if="accessStore.discordConfigured" class="access-meta-row">
          <span>访问规则</span>
          <span>{{ requirementLabel }}</span>
        </div>
        <div v-if="accessStore.deviceBindingEnabled" class="access-meta-row">
          <span>设备席位</span>
          <span>{{ accessStore.deviceSlotLimit }} 台设备</span>
        </div>
      </div>

      <div v-if="accessStore.session" class="access-meta access-session-meta">
        <div class="access-meta-row">
          <span>当前账号</span>
          <span>{{ accessStore.accountLabel }}</span>
        </div>
        <div v-if="accessStore.session.provider !== 'admin' && accessStore.session.deviceName" class="access-meta-row">
          <span>当前设备</span>
          <span>{{ accessStore.session.deviceName }}</span>
        </div>
        <div
          v-if="accessStore.session.provider !== 'admin' && accessStore.session.deviceSlotLimit"
          class="access-meta-row"
        >
          <span>席位占用</span>
          <span>{{ accessStore.session.deviceSlotCount || 0 }} / {{ accessStore.session.deviceSlotLimit }}</span>
        </div>
      </div>

      <p v-if="accessStore.lastError" class="access-error">{{ accessStore.lastError }}</p>

      <div v-if="showSeatManager" class="access-device-manager">
        <div class="access-device-manager-head">
          <div class="space-y-1">
            <p class="access-device-manager-title">已登录设备</p>
            <p class="access-device-manager-copy">{{ seatManagerSummary }}</p>
            <p v-if="currentDevice.deviceName" class="access-device-manager-copy">
              当前浏览器：{{ currentDevice.deviceName }}
            </p>
          </div>
          <button
            class="access-inline-button"
            :disabled="accessStore.isChecking || deviceListLoading || !!releasingDeviceId"
            @click="handleRefreshDevices"
          >
            {{ deviceListLoading ? '刷新中...' : '刷新设备' }}
          </button>
        </div>

        <p v-if="deviceListError" class="access-device-manager-error">{{ deviceListError }}</p>

        <p v-else-if="deviceListLoading && !deviceList.length" class="access-device-manager-empty">
          正在读取已登录设备...
        </p>

        <div v-else-if="deviceList.length" class="access-device-list">
          <div
            v-for="device in deviceList"
            :key="device.deviceId"
            class="access-device-item"
          >
            <div class="access-device-copy">
              <div class="access-device-name">{{ device.deviceName || '已登录设备' }}</div>
              <div class="access-device-time">
                登录时间 {{ formatAccessTimestamp(device.claimedAt) || '未知' }}
              </div>
            </div>
            <button
              class="access-danger"
              :disabled="accessStore.isChecking || !!releasingDeviceId"
              @click="handleReleaseDevice(device.deviceId)"
            >
              {{ releasingDeviceId === device.deviceId ? '处理中...' : '弹出设备' }}
            </button>
          </div>
        </div>

        <p v-else class="access-device-manager-empty">
          暂时还没读取到已登录设备，请刷新后重试。
        </p>
      </div>

      <div v-if="accessStore.adminCodeEnabled" class="access-admin-panel">
        <label class="access-input-label" for="access-admin-code">管理员验证码</label>
        <input
          id="access-admin-code"
          v-model="adminCode"
          class="access-input"
          type="password"
          inputmode="text"
          autocomplete="one-time-code"
          placeholder="输入管理员验证码"
          :disabled="accessStore.isChecking"
          @keyup.enter="handleAdminSubmit"
        >
        <button
          class="access-secondary"
          :disabled="accessStore.isChecking"
          @click="handleAdminSubmit"
        >
          {{ accessStore.isChecking ? '验证中...' : '提交管理员验证码' }}
        </button>
      </div>

      <div class="access-actions">
        <button
          v-if="accessStore.discordConfigured"
          class="access-primary"
          :disabled="accessStore.isChecking"
          @click="handleLogin"
        >
          {{ primaryButtonText }}
        </button>
        <button
          class="access-secondary"
          :disabled="accessStore.isChecking"
          @click="handleRefresh"
        >
          {{ accessStore.isChecking ? '检查中...' : '刷新状态' }}
        </button>
        <button
          v-if="accessStore.session"
          class="access-ghost"
          :disabled="accessStore.isChecking"
          @click="handleLogout"
        >
          退出当前验证账号
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useAccessControl } from '../../composables/useAccessControl'
import { useAccessControlStore } from '../../stores/accessControl'
import { buildAccessRequirementLabel, formatAccessTimestamp, mapAccessErrorCode } from '../../utils/accessControl'
import { buildAccessDevicePayload } from '../../utils/accessDeviceClient'

const accessStore = useAccessControlStore()
const {
  beginDiscordLogin,
  fetchAccessDevices,
  logoutAccessControl,
  refreshAccessSession,
  releaseAccessDevice,
  submitAdminCode
} = useAccessControl()
const adminCode = ref('')
const currentDevice = buildAccessDevicePayload()
const deviceList = ref([])
const deviceListLoading = ref(false)
const deviceListError = ref('')
const deviceListSlotCount = ref(0)
const deviceListSlotLimit = ref(0)
const releasingDeviceId = ref('')
let deviceListRequestId = 0

const requirementLabel = computed(() => buildAccessRequirementLabel({
  provider: accessStore.provider,
  guildId: accessStore.requiredGuildId,
  ruleCount: accessStore.ruleCount,
  hasRoleRules: accessStore.hasRoleRules
}))

const methodLabel = computed(() => {
  if (accessStore.discordConfigured && accessStore.adminCodeEnabled) return 'Discord / 管理员验证码'
  if (accessStore.adminCodeEnabled) return '管理员验证码'
  return 'Discord'
})

const isSeatLimitReached = computed(() => (
  accessStore.lastErrorCode === 'device_limit_reached'
))

const showSeatManager = computed(() => (
  accessStore.isEnabled
  && accessStore.deviceBindingEnabled
  && accessStore.isAuthenticated
  && accessStore.session?.provider !== 'admin'
  && accessStore.deviceClaimRequired
))

const seatManagerSummary = computed(() => {
  const slotLimit = Math.max(0, Number(deviceListSlotLimit.value || accessStore.deviceSlotLimit || 0) || 0)
  const slotCount = Math.max(0, Number(deviceListSlotCount.value || 0) || 0)
  if (slotLimit <= 0) {
    return '弹出一台已登录设备后，当前浏览器会自动继续验证。'
  }
  if (!isSeatLimitReached.value) {
    return `当前账号已登记 ${slotCount} / ${slotLimit} 台设备，如需挪位可先弹出一台。`
  }
  return `已占用 ${slotCount} / ${slotLimit}，弹出一台设备后，当前浏览器会自动继续验证。`
})

const titleText = computed(() => {
  if (showSeatManager.value) {
    return isSeatLimitReached.value ? '设备席位已满' : '需要确认设备登录'
  }
  if (accessStore.adminCodeEnabled && accessStore.discordConfigured) return '需要完成访问验证'
  if (accessStore.adminCodeEnabled) return '需要输入管理员验证码'
  return '需要社区账号验证'
})

const descriptionText = computed(() => {
  if (accessStore.isChecking) return '正在检查当前设备的访问验证状态。'
  if (!accessStore.isEnabled) return '当前部署未启用访问验证，可以直接继续使用。'
  if (!accessStore.isConfigured) return '服务端已经要求验证，但访问验证环境变量还没配完整。'
  if (showSeatManager.value) {
    if (!isSeatLimitReached.value) {
      return '当前浏览器还没有通过设备绑定，你可以查看并弹出已登录设备后，再让当前浏览器继续验证。'
    }
    return '这个账号已经占满设备席位，弹出一台已登录设备后，当前浏览器会自动继续验证。'
  }
  if (accessStore.adminCodeEnabled && accessStore.discordConfigured) {
    return '普通访客需要走 Discord 验证，管理员可以直接输入管理员验证码进入。'
  }
  if (accessStore.adminCodeEnabled) {
    return '这是管理员入口，输入管理员验证码后可直接进入，不受设备席位限制。'
  }
  return '这个分享链接已经切到 Discord 身份验证模式，只有通过社区账号验证后才能进入。'
})

const primaryButtonText = computed(() => {
  if (accessStore.isChecking) return '检查中...'
  if (!accessStore.discordConfigured) return '等待 Discord 配置'
  return accessStore.isAuthenticated ? '重新验证 Discord' : '使用 Discord 验证'
})

function handleLogin() {
  if (!accessStore.discordConfigured) return
  beginDiscordLogin({ force: true })
}

function formatDeviceManagerError(code = '') {
  if (code === 'forbidden') return '当前账号不能管理设备席位'
  if (code === 'device_binding_unavailable') return '设备管理服务暂不可用，请稍后重试'
  if (code === 'bad_request') return '请选择要弹出的设备'
  return mapAccessErrorCode(code)
}

function resetDeviceList() {
  deviceListRequestId += 1
  deviceList.value = []
  deviceListLoading.value = false
  deviceListError.value = ''
  deviceListSlotCount.value = 0
  deviceListSlotLimit.value = 0
  releasingDeviceId.value = ''
}

async function loadDeviceList() {
  if (!showSeatManager.value) {
    resetDeviceList()
    return
  }

  const requestId = ++deviceListRequestId
  deviceListLoading.value = true
  deviceListError.value = ''

  try {
    const payload = await fetchAccessDevices()
    if (requestId !== deviceListRequestId) return

    deviceList.value = Array.isArray(payload.devices) ? payload.devices : []
    deviceListSlotCount.value = Math.max(
      0,
      Number(payload.slotCount ?? deviceList.value.length) || 0
    )
    deviceListSlotLimit.value = Math.max(
      0,
      Number(payload.slotLimit ?? accessStore.deviceSlotLimit ?? 0) || 0
    )
  } catch (error) {
    if (requestId !== deviceListRequestId) return

    deviceList.value = []
    deviceListSlotCount.value = 0
    deviceListSlotLimit.value = Math.max(0, Number(accessStore.deviceSlotLimit || 0) || 0)
    deviceListError.value = formatDeviceManagerError(error?.code)
  } finally {
    if (requestId === deviceListRequestId) {
      deviceListLoading.value = false
    }
  }
}

watch(
  () => [showSeatManager.value, accessStore.checkedAt],
  ([visible]) => {
    if (!visible) {
      resetDeviceList()
      return
    }
    void loadDeviceList()
  },
  { immediate: true }
)

async function handleAdminSubmit() {
  if (!accessStore.adminCodeEnabled) return
  const success = await submitAdminCode(adminCode.value)
  if (success) {
    adminCode.value = ''
  }
}

async function handleRefresh() {
  await refreshAccessSession()
}

async function handleRefreshDevices() {
  await loadDeviceList()
}

async function handleReleaseDevice(deviceId = '') {
  const normalizedDeviceId = String(deviceId || '').trim()
  if (!normalizedDeviceId || releasingDeviceId.value) return

  releasingDeviceId.value = normalizedDeviceId
  deviceListError.value = ''

  try {
    await releaseAccessDevice(normalizedDeviceId)
    const canAccess = await refreshAccessSession()
    if (!canAccess && showSeatManager.value) {
      await loadDeviceList()
    }
  } catch (error) {
    deviceListError.value = formatDeviceManagerError(error?.code)
    if (showSeatManager.value) {
      await loadDeviceList()
    }
  } finally {
    if (releasingDeviceId.value === normalizedDeviceId) {
      releasingDeviceId.value = ''
    }
  }
}

async function handleLogout() {
  await logoutAccessControl({ reload: false })
  adminCode.value = ''
  resetDeviceList()
  await refreshAccessSession({ consumeRedirectError: false })
}
</script>

<style scoped>
.access-gate {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding:
    max(22px, calc(env(safe-area-inset-top) + 18px))
    max(18px, calc(env(safe-area-inset-right) + 18px))
    max(22px, calc(env(safe-area-inset-bottom) + 18px))
    max(18px, calc(env(safe-area-inset-left) + 18px));
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.92), rgba(244, 247, 250, 0.88) 42%, rgba(232, 237, 242, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(233, 239, 244, 0.96));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.dark .access-gate {
  background:
    radial-gradient(circle at top, rgba(33, 38, 45, 0.92), rgba(17, 21, 27, 0.92) 42%, rgba(10, 12, 15, 0.98)),
    linear-gradient(180deg, rgba(23, 27, 33, 0.9), rgba(9, 11, 14, 0.98));
}

.access-card {
  width: min(100%, 340px);
  margin: auto 0;
  padding: 22px 18px 18px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.14);
  color: var(--text-primary);
  max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 36px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dark .access-card {
  background: rgba(24, 28, 33, 0.82);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.38);
}

.access-badge {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  margin-bottom: 16px;
  color: white;
  background: linear-gradient(135deg, #5865f2, #2d88ff);
  box-shadow: 0 12px 28px rgba(88, 101, 242, 0.28);
}

.access-eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.access-title {
  font-size: 24px;
  line-height: 1.15;
  font-weight: 800;
}

.access-copy {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.access-meta {
  margin-top: 16px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.access-session-meta {
  margin-top: 12px;
}

.access-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 14px;
  font-size: 13px;
}

.access-meta-row + .access-meta-row {
  border-top: 1px solid var(--border-color);
}

.access-meta-row span:last-child {
  text-align: right;
  color: var(--text-secondary);
}

.access-error {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 59, 48, 0.08);
  color: #d93025;
  font-size: 13px;
  line-height: 1.5;
}

.dark .access-error {
  background: rgba(255, 69, 58, 0.14);
  color: #ff8e86;
}

.access-device-manager {
  margin-top: 14px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(88, 101, 242, 0.04);
}

.dark .access-device-manager {
  background: rgba(88, 101, 242, 0.08);
}

.access-device-manager-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.access-device-manager-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.access-device-manager-copy,
.access-device-manager-empty,
.access-device-manager-error {
  font-size: 12px;
  line-height: 1.6;
}

.access-device-manager-copy,
.access-device-manager-empty {
  color: var(--text-secondary);
}

.access-device-manager-error {
  margin-top: 10px;
  color: #d93025;
}

.dark .access-device-manager-error {
  color: #ff8e86;
}

.access-inline-button {
  min-width: 88px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  background: transparent;
}

.access-device-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.access-device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.dark .access-device-item {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.access-device-copy {
  min-width: 0;
}

.access-device-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  word-break: break-word;
}

.access-device-time {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.access-danger {
  flex-shrink: 0;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 59, 48, 0.22);
  font-size: 13px;
  font-weight: 700;
  color: #d93025;
  background: rgba(255, 59, 48, 0.06);
}

.dark .access-danger {
  color: #ff8e86;
  background: rgba(255, 69, 58, 0.12);
}

.access-admin-panel {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.access-input-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.access-input {
  min-height: 46px;
  border-radius: 16px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--border-color);
}

.dark .access-input {
  background: rgba(255, 255, 255, 0.04);
}

.access-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 18px;
}

.access-primary,
.access-secondary,
.access-ghost {
  min-height: 46px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.18s ease;
}

.access-primary {
  color: white;
  background: linear-gradient(135deg, #5865f2, #2d88ff);
}

.access-secondary {
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  background: transparent;
}

.access-ghost {
  border: 1px solid rgba(255, 59, 48, 0.2);
  color: #d93025;
  background: rgba(255, 59, 48, 0.04);
}

.dark .access-ghost {
  color: #ff8e86;
  background: rgba(255, 69, 58, 0.1);
}

.access-primary:disabled,
.access-secondary:disabled,
.access-ghost:disabled,
.access-danger:disabled,
.access-inline-button:disabled,
.access-input:disabled {
  opacity: 0.45;
}

@media (max-width: 520px) {
  .access-card {
    width: 100%;
    border-radius: 24px;
  }

  .access-device-manager-head,
  .access-device-item {
    flex-direction: column;
  }

  .access-inline-button,
  .access-danger {
    width: 100%;
  }
}
</style>
