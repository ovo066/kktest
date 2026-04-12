<template>
  <div class="space-y-4">
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] gap-3">
        <div class="flex flex-col min-w-0">
          <span class="text-[17px] text-[var(--text-primary)]">启用云同步</span>
          <span class="text-[12px] text-[var(--text-secondary)]">通过 Firebase 将数据同步到云端</span>
        </div>
        <IosToggle :modelValue="settingsStore.cloudSyncEnabled" @update:modelValue="handleToggleEnabled" />
      </div>
      <div v-if="settingsStore.cloudSyncEnabled" class="px-4 py-3 flex justify-between items-center gap-3">
        <div class="flex flex-col min-w-0">
          <span class="text-[17px] text-[var(--text-primary)]">自动同步</span>
          <span class="text-[12px] text-[var(--text-secondary)]">本地保存后自动上传到云端</span>
        </div>
        <IosToggle :modelValue="settingsStore.cloudSyncAutoSync" @update:modelValue="handleAutoSyncToggle" />
      </div>
      <div v-if="settingsStore.cloudSyncEnabled && settingsStore.cloudSyncAutoSync" class="px-4 py-3 border-t border-[var(--border-color)] space-y-3">
        <div class="flex flex-col min-w-0">
          <span class="text-[15px] text-[var(--text-primary)]">自动同步策略</span>
          <span class="text-[12px] text-[var(--text-secondary)] leading-relaxed">{{ autoSyncPolicySummary }}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="option in autoSyncPolicyOptions"
            :key="option.key"
            class="rounded-xl border px-3 py-2.5 text-left transition-colors"
            :class="settingsStore.cloudSyncAutoSyncPolicy === option.key
              ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 text-[var(--primary-color)]'
              : 'border-[var(--border-color)] text-[var(--text-primary)]'"
            @click="handleAutoSyncPolicyChange(option.key)"
          >
            <div class="text-[14px] font-medium">{{ option.label }}</div>
            <div class="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{{ option.description }}</div>
          </button>
        </div>
        <div v-if="isCustomAutoSyncPolicy" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="rounded-xl border border-[var(--border-color)] px-3 py-3 space-y-1.5">
            <span class="text-[13px] text-[var(--text-primary)]">至少等待</span>
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                :value="customIntervalMinutes"
                @change="handleCustomIntervalChange($event.target.value)"
                class="w-full min-w-0 bg-transparent text-[16px] text-[var(--text-primary)] outline-none"
              >
              <span class="text-[13px] text-[var(--text-secondary)]">分钟</span>
            </div>
            <p class="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              自动上传后，至少过这么久才允许下一次自动上传。
            </p>
          </label>
          <label class="rounded-xl border border-[var(--border-color)] px-3 py-3 space-y-1.5">
            <span class="text-[13px] text-[var(--text-primary)]">累计变化</span>
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                inputmode="decimal"
                :value="customDeltaMb"
                @change="handleCustomDeltaChange($event.target.value)"
                class="w-full min-w-0 bg-transparent text-[16px] text-[var(--text-primary)] outline-none"
              >
              <span class="text-[13px] text-[var(--text-secondary)]">MB</span>
            </div>
            <p class="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              冷却结束后，本地备份累计变化至少达到这个大小才会自动上传。
            </p>
          </label>
        </div>
      </div>
      <div v-if="settingsStore.cloudSyncEnabled" class="px-4 py-3 border-t border-[var(--border-color)] flex justify-between items-center gap-3">
        <div class="flex flex-col min-w-0">
          <span class="text-[17px] text-[var(--text-primary)]">媒体文件同步</span>
          <span class="text-[12px] text-[var(--text-secondary)] leading-relaxed">{{ mediaSyncDescription }}</span>
        </div>
        <IosToggle :modelValue="settingsStore.cloudSyncIncludeMedia" @update:modelValue="handleIncludeMediaToggle" />
      </div>
    </div>

    <div v-if="settingsStore.cloudSyncEnabled" class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
        <span class="text-[15px] text-[var(--text-secondary)]">状态</span>
        <span class="text-[15px]" :class="statusColor">{{ statusText }}</span>
      </div>
      <div v-if="syncStore.lastError" class="px-4 py-3 border-b border-[var(--border-color)]">
        <p class="text-[13px] text-red-500 leading-relaxed break-all">{{ syncStore.lastError }}</p>
      </div>
      <div v-if="syncStore.lastPushedAt" class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
        <span class="text-[15px] text-[var(--text-secondary)]">上次上传</span>
        <span class="text-[15px] text-[var(--text-primary)] text-right">{{ formatTime(syncStore.lastPushedAt) }}</span>
      </div>
      <div v-if="syncStore.lastPulledAt" class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
        <span class="text-[15px] text-[var(--text-secondary)]">上次拉取</span>
        <span class="text-[15px] text-[var(--text-primary)] text-right">{{ formatTime(syncStore.lastPulledAt) }}</span>
      </div>
      <div v-if="syncStore.currentUid" class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
        <span class="text-[15px] text-[var(--text-secondary)]">账号</span>
        <span class="text-[15px] text-[var(--text-primary)] text-right break-all">{{ accountLabel }}</span>
      </div>
      <div class="px-4 py-3 flex gap-3">
        <button
          class="flex-1 py-2 rounded-lg text-[15px] font-medium text-white bg-[var(--primary-color)] disabled:opacity-40"
          :disabled="!canSync"
          @click="handlePush"
        >
          {{ syncStore.pendingAction === 'push' ? '上传中...' : '上传到云端' }}
        </button>
        <button
          class="flex-1 py-2 rounded-lg text-[15px] font-medium text-[var(--primary-color)] border border-[var(--primary-color)] disabled:opacity-40"
          :disabled="!canSync"
          @click="handlePull"
        >
          {{ syncStore.pendingAction === 'pull' ? '拉取中...' : '从云端拉取' }}
        </button>
      </div>
      <div v-if="syncStore.isAnonymous && syncStore.currentUid" class="px-4 py-3 border-t border-[var(--border-color)]">
        <button
          class="w-full py-2 rounded-lg text-[15px] font-medium text-white bg-[#4285F4] disabled:opacity-40"
          :disabled="syncStore.isBusy"
          @click="handleLinkGoogle"
        >
          {{ syncStore.pendingAction === 'link-google' ? '绑定中...' : '绑定 Google 账号' }}
        </button>
        <p class="text-[12px] text-[var(--text-secondary)] mt-1.5">绑定后可在其他设备登录同一账号访问数据</p>
      </div>
    </div>

    <div v-if="settingsStore.cloudSyncEnabled" class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex items-start justify-between gap-3 border-b border-[var(--border-color)]">
        <div class="flex flex-col min-w-0">
          <span class="text-[15px] font-medium text-[var(--text-primary)]">配置方式</span>
          <p class="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{{ configModeDescription }}</p>
        </div>
        <span
          class="shrink-0 px-2.5 py-1 rounded-full text-[12px] font-medium"
          :class="configBadgeClass"
        >
          {{ configBadgeText }}
        </span>
      </div>
      <div class="px-4 py-3 space-y-3">
        <p
          v-if="showCustomOverrideHint"
          class="text-[12px] leading-relaxed text-amber-600"
        >
          你正在填写自己的配置，但还不完整，所以目前仍使用默认配置。请把下方带 * 的字段都填好即可切换。
        </p>
        <p
          v-else-if="missingRequiredFieldLabels.length"
          class="text-[12px] leading-relaxed text-amber-600"
        >
          还缺：{{ missingRequiredFieldLabels.join(' / ') }}
        </p>
        <div class="flex gap-2">
          <button
            class="flex-1 py-2 rounded-lg text-[14px] font-medium border border-[var(--border-color)] text-[var(--text-primary)]"
            @click="manualConfigExpanded = !manualConfigExpanded"
          >
            {{ manualConfigExpanded ? '收起高级配置' : advancedConfigButtonText }}
          </button>
          <button
            v-if="hasAnyCustomConfig"
            class="px-4 py-2 rounded-lg text-[14px] font-medium border border-[var(--border-color)] text-[var(--text-secondary)]"
            @click="handleResetCustomConfig"
          >
            {{ resetConfigButtonText }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="settingsStore.cloudSyncEnabled && manualConfigExpanded" class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)]">
        <span class="text-[15px] font-medium text-[var(--text-primary)]">快速导入</span>
        <p class="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
          把从 Firebase 控制台复制的配置直接粘贴到这里，会自动识别并填好。
        </p>
      </div>
      <div class="px-4 py-3 space-y-3 border-b border-[var(--border-color)]">
        <textarea
          v-model="quickConfigText"
          rows="5"
          class="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2.5 text-[14px] text-[var(--text-primary)] outline-none resize-none"
          placeholder="例如：const firebaseConfig = { apiKey: &quot;...&quot;, ... }"
          spellcheck="false"
        ></textarea>
        <div class="flex gap-2">
          <button
            class="flex-1 py-2 rounded-lg text-[14px] font-medium text-white bg-[var(--primary-color)] disabled:opacity-40"
            :disabled="!quickConfigText.trim()"
            @click="handleQuickImport"
          >
            解析并填入
          </button>
          <button
            class="px-4 py-2 rounded-lg text-[14px] font-medium border border-[var(--border-color)] text-[var(--text-secondary)] disabled:opacity-40"
            :disabled="!quickConfigText"
            @click="quickConfigText = ''"
          >
            清空
          </button>
        </div>
      </div>

      <div class="px-4 py-3 border-b border-[var(--border-color)]">
        <span class="text-[15px] font-medium text-[var(--text-primary)]">手动编辑</span>
        <p class="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
          也可以逐项填写或修改单个字段。
        </p>
      </div>

      <div
        v-for="field in configFields"
        :key="field.key"
        class="px-4 py-3 border-b border-[var(--border-color)]"
      >
        <label :for="`cloud-sync-${field.key}`" class="block space-y-1.5">
          <span class="text-[14px] text-[var(--text-primary)]">
            {{ field.label }}
            <span v-if="!field.optional" class="text-red-500">*</span>
          </span>
          <input
            :id="`cloud-sync-${field.key}`"
            :value="settingsStore.cloudSyncConfig[field.key]"
            @input="updateConfigField(field.key, $event.target.value)"
            @blur="handleConfigBlur"
            type="text"
            :placeholder="field.placeholder"
            class="w-full min-w-0 text-[14px] text-[var(--text-primary)] bg-transparent outline-none"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          >
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed break-all">示例：{{ field.example }}</p>
        </label>
      </div>
    </div>

    <div v-if="settingsStore.cloudSyncEnabled" class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3">
        <p class="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          不确定怎么填？直接用默认配置就好，或者把拿到的完整配置粘贴到上方「快速导入」即可。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useCloudSyncStore, CLOUD_SYNC_STATUS } from '../../stores/cloudSync'
import {
  CLOUD_SYNC_AUTO_SYNC_POLICIES,
  getCloudSyncAutoSyncPolicy,
  formatCloudSyncBytes,
  formatCloudSyncInterval,
  normalizeCloudSyncCustomDeltaBytes,
  normalizeCloudSyncCustomIntervalMs
} from '../../composables/cloudSync/policy'
import { useStorage } from '../../composables/useStorage'
import { useCloudSync } from '../../composables/useCloudSync'
import { useToast } from '../../composables/useToast'
import {
  extractCloudSyncConfigFromText,
  getCloudSyncMissingFields,
  getEnvCloudSyncConfig,
  hasCloudSyncConfigValues,
  isCloudSyncConfigComplete,
  resolveCloudSyncFirebaseConfig
} from '../../utils/cloudSyncConfig'
import IosToggle from '../../components/common/IosToggle.vue'

const settingsStore = useSettingsStore()
const syncStore = useCloudSyncStore()
const { scheduleSave } = useStorage()
const storageApi = useStorage()
const { showToast } = useToast()
const { pushCloudSyncNow, pullCloudSyncNow, linkCloudSyncWithGoogle, reconnectCloudSync } = useCloudSync(storageApi)
const MINUTE = 60 * 1000
const MB = 1024 * 1024

const configFields = [
  { key: 'apiKey', label: 'API Key', placeholder: '粘贴对应值', example: 'AIzaSy...', optional: false },
  { key: 'authDomain', label: 'Auth Domain', placeholder: '粘贴对应值', example: 'demo-app.firebaseapp.com', optional: false },
  { key: 'projectId', label: 'Project ID', placeholder: '粘贴对应值', example: 'demo-app', optional: false },
  { key: 'storageBucket', label: 'Storage Bucket', placeholder: '粘贴对应值', example: 'demo-app.firebasestorage.app', optional: false },
  { key: 'messagingSenderId', label: 'Sender ID', placeholder: '粘贴对应值', example: '1234567890', optional: false },
  { key: 'appId', label: 'App ID', placeholder: '粘贴对应值', example: '1:1234567890:web:abc123def456', optional: false },
  { key: 'measurementId', label: 'Measurement ID', placeholder: '可选', example: 'G-ABC123XYZ', optional: true }
]

const fieldLabelMap = Object.fromEntries(configFields.map((field) => [field.key, field.label]))
const envConfig = getEnvCloudSyncConfig()
const quickConfigText = ref('')
const autoSyncPolicyOptions = Object.values(CLOUD_SYNC_AUTO_SYNC_POLICIES)

const hasBuiltInConfig = computed(() => isCloudSyncConfigComplete(envConfig))
const hasAnyCustomConfig = computed(() => hasCloudSyncConfigValues(settingsStore.cloudSyncConfig))
const hasCompleteCustomConfig = computed(() => isCloudSyncConfigComplete(settingsStore.cloudSyncConfig))
const manualConfigExpanded = ref(!hasBuiltInConfig.value || hasAnyCustomConfig.value)
const selectedAutoSyncPolicy = computed(() => getCloudSyncAutoSyncPolicy(
  settingsStore.cloudSyncAutoSyncPolicy,
  {
    minIntervalMs: settingsStore.cloudSyncCustomMinIntervalMs,
    minDeltaBytes: settingsStore.cloudSyncCustomMinDeltaBytes
  }
))
const isCustomAutoSyncPolicy = computed(() => settingsStore.cloudSyncAutoSyncPolicy === 'custom')
const customIntervalMinutes = computed(() => (
  Math.max(1, Math.round(Number(settingsStore.cloudSyncCustomMinIntervalMs || 0) / MINUTE) || 1)
))
const customDeltaMb = computed(() => (
  Math.max(0.1, Math.round(((Number(settingsStore.cloudSyncCustomMinDeltaBytes || 0) / MB) || 0) * 10) / 10)
))

const statusText = computed(() => {
  const map = {
    [CLOUD_SYNC_STATUS.disabled]: '已关闭',
    [CLOUD_SYNC_STATUS.needsConfig]: '需要配置',
    [CLOUD_SYNC_STATUS.initializing]: '初始化中...',
    [CLOUD_SYNC_STATUS.signingIn]: '登录中...',
    [CLOUD_SYNC_STATUS.ready]: '已就绪',
    [CLOUD_SYNC_STATUS.syncing]: '同步中...',
    [CLOUD_SYNC_STATUS.error]: '出错'
  }
  return map[syncStore.status] || syncStore.status
})

const statusColor = computed(() => {
  if (syncStore.status === CLOUD_SYNC_STATUS.ready) return 'text-green-500'
  if (syncStore.status === CLOUD_SYNC_STATUS.error) return 'text-red-500'
  if (syncStore.status === CLOUD_SYNC_STATUS.syncing) return 'text-[var(--primary-color)]'
  return 'text-[var(--text-secondary)]'
})

const canSync = computed(() => syncStore.isReady && !syncStore.isBusy)

const accountLabel = computed(() => {
  if (syncStore.accountEmail) return syncStore.accountEmail
  if (syncStore.isAnonymous) return '匿名账号'
  return syncStore.currentUid.slice(0, 8) + '...'
})

const missingRequiredFieldLabels = computed(() => {
  const targetConfig = hasBuiltInConfig.value && hasAnyCustomConfig.value && !hasCompleteCustomConfig.value
    ? settingsStore.cloudSyncConfig
    : resolveCloudSyncFirebaseConfig(settingsStore.cloudSyncConfig)
  return getCloudSyncMissingFields(targetConfig).map((key) => fieldLabelMap[key] || key)
})

const showCustomOverrideHint = computed(() => {
  return hasBuiltInConfig.value && hasAnyCustomConfig.value && !hasCompleteCustomConfig.value
})

const configBadgeText = computed(() => {
  if (showCustomOverrideHint.value) return '内置生效中'
  if (hasCompleteCustomConfig.value) return '自定义项目'
  if (hasBuiltInConfig.value) return '免手填'
  return '需配置'
})

const configBadgeClass = computed(() => {
  if (showCustomOverrideHint.value) return 'bg-amber-100 text-amber-700'
  if (hasCompleteCustomConfig.value || hasBuiltInConfig.value) return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-600'
})

const advancedConfigButtonText = computed(() => {
  if (hasBuiltInConfig.value) return '其他配置（高级）'
  return '填写配置'
})

const resetConfigButtonText = computed(() => {
  if (hasBuiltInConfig.value) return '恢复默认'
  return '清空填写'
})

const configModeDescription = computed(() => {
  if (showCustomOverrideHint.value) {
    return '你正在切换到自己的配置，但还没填完整，目前仍使用默认配置。'
  }
  if (hasCompleteCustomConfig.value) {
    return '正在使用你自己的 Firebase 配置。'
  }
  if (hasBuiltInConfig.value) {
    return '已内置默认配置，开启即可使用，无需额外设置。'
  }
  return '需要填写 Firebase 配置才能使用云同步。可以直接粘贴完整配置，也可以逐项填写。'
})

const autoSyncPolicySummary = computed(() => {
  const policy = selectedAutoSyncPolicy.value
  return `自动同步每次上传后至少等待 ${formatCloudSyncInterval(policy.minIntervalMs)}，冷却结束且累计变化达到 ${formatCloudSyncBytes(policy.minDeltaBytes)} 后才会再次触发。手动上传不受影响。`
})

const mediaSyncDescription = computed(() => {
  if (settingsStore.cloudSyncIncludeMedia) {
    return '本地图片、壁纸、贴图等会一起上传，跨设备恢复更完整，但会更占 Firebase 流量和存储。'
  }
  return '只同步文本、设置和结构化数据，不上传本地图片、壁纸、贴图等媒体，更省免费额度。换设备拉取时，这些媒体不会跟过去。'
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function updateConfigField(key, value) {
  settingsStore.cloudSyncConfig = {
    ...settingsStore.cloudSyncConfig,
    [key]: value
  }
}

async function maybeReconnectCloudSync() {
  if (!settingsStore.cloudSyncEnabled) return
  try {
    await reconnectCloudSync()
  } catch {
    // error shown in sync status
  }
}

async function handleConfigBlur() {
  scheduleSave()
  await maybeReconnectCloudSync()
}

async function handleQuickImport() {
  const rawText = quickConfigText.value.trim()
  if (!rawText) return

  const result = extractCloudSyncConfigFromText(rawText, settingsStore.cloudSyncConfig)
  if (!result.matchedCount) {
    manualConfigExpanded.value = true
    showToast('没有识别到 Firebase 配置字段', 2800)
    return
  }

  settingsStore.cloudSyncConfig = result.config
  scheduleSave()
  quickConfigText.value = ''

  const customMissing = getCloudSyncMissingFields(result.config).map((key) => fieldLabelMap[key] || key)
  manualConfigExpanded.value = customMissing.length > 0

  if (customMissing.length) {
    showToast(`已识别 ${result.matchedCount} 项，还缺 ${customMissing.join(' / ')}`, 3200)
  } else {
    showToast('Firebase 配置已导入', 2400)
  }

  await maybeReconnectCloudSync()
}

async function handleResetCustomConfig() {
  settingsStore.cloudSyncConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    appId: '',
    messagingSenderId: '',
    measurementId: ''
  }
  scheduleSave()
  if (!hasBuiltInConfig.value) {
    manualConfigExpanded.value = true
  }
  showToast(hasBuiltInConfig.value ? '已恢复为内置配置' : '已清空 Firebase 配置', 2400)
  await maybeReconnectCloudSync()
}

async function handleToggleEnabled(val) {
  settingsStore.cloudSyncEnabled = val
  scheduleSave()
  if (val) {
    await maybeReconnectCloudSync()
  }
}

function handleAutoSyncToggle(val) {
  settingsStore.cloudSyncAutoSync = val
  scheduleSave()
}

function handleAutoSyncPolicyChange(policyKey) {
  if (settingsStore.cloudSyncAutoSyncPolicy === policyKey) return
  settingsStore.cloudSyncAutoSyncPolicy = policyKey
  scheduleSave()
}

function handleCustomIntervalChange(rawValue) {
  settingsStore.cloudSyncCustomMinIntervalMs = normalizeCloudSyncCustomIntervalMs(
    Number(rawValue) * MINUTE,
    settingsStore.cloudSyncCustomMinIntervalMs
  )
  scheduleSave()
}

function handleCustomDeltaChange(rawValue) {
  settingsStore.cloudSyncCustomMinDeltaBytes = normalizeCloudSyncCustomDeltaBytes(
    Number(rawValue) * MB,
    settingsStore.cloudSyncCustomMinDeltaBytes
  )
  scheduleSave()
}

function handleIncludeMediaToggle(val) {
  settingsStore.cloudSyncIncludeMedia = val
  scheduleSave()
}

async function handlePush() {
  try {
    await pushCloudSyncNow()
  } catch {
    // error shown in status
  }
}

async function handlePull() {
  try {
    await pullCloudSyncNow()
  } catch {
    // error shown in status
  }
}

async function handleLinkGoogle() {
  try {
    await linkCloudSyncWithGoogle()
  } catch {
    // error shown in status
  }
}
</script>
