<template>
  <div class="space-y-4">
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)] gap-3">
        <div class="flex flex-col min-w-0">
          <span class="text-[17px] text-[var(--text-primary)]">访问验证</span>
          <span class="text-[12px] text-[var(--text-secondary)]">{{ requirementLabel }}</span>
        </div>
        <span class="text-[15px]" :class="statusColor">{{ statusText }}</span>
      </div>

      <div v-if="accessStore.lastError" class="px-4 py-3 border-b border-[var(--border-color)]">
        <p class="text-[13px] text-red-500 leading-relaxed">{{ accessStore.lastError }}</p>
      </div>

      <div v-if="accessStore.deviceBindingEnabled" class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
        <span class="text-[15px] text-[var(--text-secondary)]">设备席位</span>
        <span class="text-[15px] text-[var(--text-primary)] text-right">{{ accessStore.deviceSlotLimit }} 台设备</span>
      </div>

      <template v-if="accessStore.isEnabled && accessStore.isAuthenticated && accessStore.session">
        <div class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
          <span class="text-[15px] text-[var(--text-secondary)]">已绑定账号</span>
          <span class="text-[15px] text-[var(--text-primary)] text-right break-all">{{ accessStore.accountLabel }}</span>
        </div>
        <div
          v-if="accessStore.session.provider !== 'admin' && accessStore.session.deviceName"
          class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]"
        >
          <span class="text-[15px] text-[var(--text-secondary)]">当前设备</span>
          <span class="text-[15px] text-[var(--text-primary)] text-right break-all">{{ accessStore.session.deviceName }}</span>
        </div>
        <div
          v-if="accessStore.session.provider !== 'admin' && accessStore.session.deviceSlotLimit"
          class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]"
        >
          <span class="text-[15px] text-[var(--text-secondary)]">席位占用</span>
          <span class="text-[15px] text-[var(--text-primary)] text-right">
            {{ accessStore.session.deviceSlotCount || 0 }} / {{ accessStore.session.deviceSlotLimit }}
          </span>
        </div>
        <div v-if="accessStore.session.authenticatedAt" class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
          <span class="text-[15px] text-[var(--text-secondary)]">验证时间</span>
          <span class="text-[15px] text-[var(--text-primary)] text-right">{{ formatAccessTimestamp(accessStore.session.authenticatedAt) }}</span>
        </div>
        <div v-if="accessStore.session.expiresAt" class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
          <span class="text-[15px] text-[var(--text-secondary)]">会话到期</span>
          <span class="text-[15px] text-[var(--text-primary)] text-right">{{ formatAccessTimestamp(accessStore.session.expiresAt) }}</span>
        </div>
      </template>

      <div v-if="isAdminSession" class="px-4 py-3 border-b border-[var(--border-color)] space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col min-w-0">
            <span class="text-[15px] text-[var(--text-primary)]">设备统计</span>
            <span class="text-[12px] text-[var(--text-secondary)]">仅管理员可见，数据来自 Redis 设备登记</span>
          </div>
          <button
            class="shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[var(--border-color)] text-[var(--text-primary)] disabled:opacity-40"
            :disabled="adminStatsLoading"
            @click="handleRefreshAdminStats"
          >
            {{ adminStatsLoading ? '刷新中...' : '刷新统计' }}
          </button>
        </div>

        <p v-if="adminStatsError" class="text-[13px] text-red-500 leading-relaxed">{{ adminStatsError }}</p>

        <template v-else-if="adminStats">
          <div class="rounded-[12px] border border-[var(--border-color)] overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
              <span class="text-[14px] text-[var(--text-secondary)]">已登记用户</span>
              <span class="text-[15px] text-[var(--text-primary)]">{{ adminStats.summary?.totalUsers || 0 }}</span>
            </div>
            <div class="px-3 py-2 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
              <span class="text-[14px] text-[var(--text-secondary)]">已登记设备</span>
              <span class="text-[15px] text-[var(--text-primary)]">{{ adminStats.summary?.totalDevices || 0 }}</span>
            </div>
            <div class="px-3 py-2 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
              <span class="text-[14px] text-[var(--text-secondary)]">满席用户</span>
              <span class="text-[15px] text-[var(--text-primary)]">{{ adminStats.summary?.usersAtLimit || 0 }}</span>
            </div>
            <div class="px-3 py-2 flex items-center justify-between gap-3">
              <span class="text-[14px] text-[var(--text-secondary)]">统计生成</span>
              <span class="text-[15px] text-[var(--text-primary)] text-right">{{ formatAccessTimestamp(adminStats.generatedAt) }}</span>
            </div>
          </div>

          <div v-if="!adminStats.deviceBindingEnabled" class="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            当前部署未启用设备席位，暂无可统计的设备数据。
          </div>

          <div v-else-if="!(adminStats.users?.length)" class="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            还没有用户设备登记记录。
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="user in adminStats.users"
              :key="`${user.provider}:${user.userId}`"
              class="rounded-[12px] border border-[var(--border-color)] overflow-hidden"
            >
              <div class="px-3 py-2 flex items-start justify-between gap-3 border-b border-[var(--border-color)]">
                <div class="min-w-0">
                  <div class="text-[15px] text-[var(--text-primary)] break-all">{{ user.accountLabel || user.userId }}</div>
                  <div class="text-[12px] text-[var(--text-secondary)] break-all">{{ user.userId }}</div>
                  <div v-if="user.ruleLabel" class="text-[12px] text-[var(--text-secondary)] break-all">{{ user.ruleLabel }}</div>
                </div>
                <div class="text-[13px] text-[var(--text-primary)] shrink-0">{{ user.deviceCount }} 台设备</div>
              </div>

              <div
                v-for="device in user.devices"
                :key="device.deviceId"
                class="px-3 py-2 border-b last:border-b-0 border-[var(--border-color)]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[14px] text-[var(--text-primary)] break-all">{{ device.deviceName || device.deviceId }}</div>
                    <div class="text-[12px] text-[var(--text-secondary)] break-all">{{ device.deviceId }}</div>
                  </div>
                  <div class="text-[12px] text-[var(--text-secondary)] text-right shrink-0">
                    {{ formatAccessTimestamp(device.claimedAt) || '未知时间' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {{ adminStatsLoading ? '正在读取设备统计...' : '还没有统计数据。' }}
        </div>
      </div>

      <div v-if="showAdminCodeForm" class="px-4 py-3 border-b border-[var(--border-color)] space-y-3">
        <div class="text-[13px] text-[var(--text-secondary)]">管理员可以直接输入验证码进入，不占设备席位。</div>
        <input
          v-model="adminCode"
          type="password"
          inputmode="text"
          autocomplete="one-time-code"
          class="w-full min-h-[42px] rounded-[12px] px-3 border border-[var(--border-color)] bg-transparent text-[15px] text-[var(--text-primary)]"
          placeholder="输入管理员验证码"
          :disabled="accessStore.isChecking"
          @keyup.enter="handleAdminSubmit"
        >
        <button
          class="w-full py-2 rounded-lg text-[15px] font-medium border border-[var(--border-color)] text-[var(--text-primary)] disabled:opacity-40"
          :disabled="accessStore.isChecking"
          @click="handleAdminSubmit"
        >
          {{ accessStore.isChecking ? '验证中...' : '提交管理员验证码' }}
        </button>
      </div>

      <div class="px-4 py-3 grid gap-3">
        <button
          v-if="accessStore.discordConfigured"
          class="w-full py-2 rounded-lg text-[15px] font-medium text-white bg-[#5865F2] disabled:opacity-40"
          :disabled="accessStore.isChecking || !accessStore.isEnabled"
          @click="handleLogin"
        >
          {{ primaryButtonText }}
        </button>
        <button
          class="w-full py-2 rounded-lg text-[15px] font-medium border border-[var(--border-color)] text-[var(--text-primary)] disabled:opacity-40"
          :disabled="accessStore.isChecking"
          @click="handleRefresh"
        >
          刷新状态
        </button>
      </div>

      <div v-if="accessStore.isEnabled && accessStore.isAuthenticated" class="px-4 py-3 border-t border-[var(--border-color)]">
        <button
          class="w-full py-2 rounded-lg text-[15px] font-medium border border-red-400/50 text-red-500 disabled:opacity-40"
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

const accessStore = useAccessControlStore()
const {
  beginDiscordLogin,
  fetchAdminStats,
  logoutAccessControl,
  refreshAccessSession,
  submitAdminCode
} = useAccessControl()
const adminCode = ref('')
const adminStats = ref(null)
const adminStatsError = ref('')
const adminStatsLoading = ref(false)
let adminStatsRequestId = 0

const requirementLabel = computed(() => buildAccessRequirementLabel({
  provider: accessStore.provider,
  guildId: accessStore.requiredGuildId,
  ruleCount: accessStore.ruleCount,
  hasRoleRules: accessStore.hasRoleRules
}))

const isAdminSession = computed(() => (
  accessStore.isAuthenticated && accessStore.session?.provider === 'admin'
))

const showAdminCodeForm = computed(() => (
  accessStore.adminCodeEnabled && accessStore.session?.provider !== 'admin'
))

const statusText = computed(() => {
  if (accessStore.isChecking) return '检查中...'
  if (!accessStore.isEnabled) return '未启用'
  if (!accessStore.isConfigured) return '待配置'
  if (accessStore.isAuthenticated) {
    return accessStore.deviceClaimRequired ? '待绑定设备' : '已验证'
  }
  return '待验证'
})

const statusColor = computed(() => {
  if (!accessStore.isEnabled) return 'text-[var(--text-secondary)]'
  if (!accessStore.isConfigured) return 'text-amber-500'
  if (accessStore.isAuthenticated && !accessStore.deviceClaimRequired) return 'text-green-500'
  return 'text-[var(--primary-color)]'
})

const primaryButtonText = computed(() => {
  if (!accessStore.isEnabled) return '等待启用'
  if (!accessStore.discordConfigured) return '等待 Discord 配置'
  if (accessStore.isAuthenticated && accessStore.session?.provider === 'discord') return '重新验证 Discord'
  return '使用 Discord 验证'
})

function formatAdminStatsErrorMessage(code = '') {
  if (code === 'forbidden') return '只有管理员身份可以查看设备统计'
  if (code === 'device_binding_unavailable') return '设备统计服务暂不可用，请稍后重试'
  return mapAccessErrorCode(code)
}

async function loadAdminStats() {
  if (!isAdminSession.value) {
    adminStats.value = null
    adminStatsError.value = ''
    adminStatsLoading.value = false
    return
  }

  const requestId = ++adminStatsRequestId
  adminStatsLoading.value = true
  adminStatsError.value = ''

  try {
    const payload = await fetchAdminStats()
    if (requestId !== adminStatsRequestId) return
    adminStats.value = payload
  } catch (error) {
    if (requestId !== adminStatsRequestId) return
    adminStats.value = null
    adminStatsError.value = formatAdminStatsErrorMessage(error?.code)
  } finally {
    if (requestId === adminStatsRequestId) {
      adminStatsLoading.value = false
    }
  }
}

watch(
  () => [accessStore.checkedAt, isAdminSession.value],
  () => {
    void loadAdminStats()
  },
  { immediate: true }
)

function handleLogin() {
  if (!accessStore.isEnabled || !accessStore.discordConfigured) return
  beginDiscordLogin({ force: true })
}

async function handleAdminSubmit() {
  const success = await submitAdminCode(adminCode.value)
  if (success) {
    adminCode.value = ''
  }
}

async function handleRefresh() {
  await refreshAccessSession()
}

async function handleRefreshAdminStats() {
  await loadAdminStats()
}

async function handleLogout() {
  await logoutAccessControl({ reload: false })
  adminCode.value = ''
  await refreshAccessSession({ consumeRedirectError: false })
}
</script>
