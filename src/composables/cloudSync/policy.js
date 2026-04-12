const KB = 1024
const MB = 1024 * KB
const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

export const DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY = 'balanced'
export const DEFAULT_CLOUD_SYNC_CUSTOM_POLICY = {
  minDeltaBytes: 512 * KB,
  minIntervalMs: 15 * MINUTE
}
export const CLOUD_SYNC_CUSTOM_POLICY_LIMITS = {
  minDeltaBytes: 64 * KB,
  maxDeltaBytes: 512 * MB,
  minIntervalMs: MINUTE,
  maxIntervalMs: 7 * DAY
}

export const CLOUD_SYNC_AUTO_SYNC_POLICIES = {
  instant: {
    key: 'instant',
    label: '及时',
    description: '更快上传改动，适合多设备频繁切换。',
    minDeltaBytes: 64 * KB,
    minIntervalMs: 2 * MINUTE
  },
  balanced: {
    key: 'balanced',
    label: '平衡',
    description: '兼顾同步及时性和免费额度消耗。',
    minDeltaBytes: 512 * KB,
    minIntervalMs: 15 * MINUTE
  },
  economy: {
    key: 'economy',
    label: '省流量',
    description: '明显减少自动上传次数，优先节省免费额度。',
    minDeltaBytes: 2 * MB,
    minIntervalMs: 60 * MINUTE
  },
  custom: {
    key: 'custom',
    label: '自定义',
    description: '手动设置冷却时间和累计变化门槛。',
    ...DEFAULT_CLOUD_SYNC_CUSTOM_POLICY
  }
}

function toPositiveNumber(value) {
  return Math.max(0, Number(value || 0) || 0)
}

function clampPositiveNumber(value, min, max, fallback) {
  const normalizedFallback = Math.min(max, Math.max(min, toPositiveNumber(fallback)))
  const normalizedValue = toPositiveNumber(value)
  if (!normalizedValue) return normalizedFallback
  return Math.min(max, Math.max(min, normalizedValue))
}

export function normalizeCloudSyncCustomIntervalMs(value, fallback = DEFAULT_CLOUD_SYNC_CUSTOM_POLICY.minIntervalMs) {
  const normalized = clampPositiveNumber(
    value,
    CLOUD_SYNC_CUSTOM_POLICY_LIMITS.minIntervalMs,
    CLOUD_SYNC_CUSTOM_POLICY_LIMITS.maxIntervalMs,
    fallback
  )
  return Math.round(normalized / MINUTE) * MINUTE
}

export function normalizeCloudSyncCustomDeltaBytes(value, fallback = DEFAULT_CLOUD_SYNC_CUSTOM_POLICY.minDeltaBytes) {
  const normalized = clampPositiveNumber(
    value,
    CLOUD_SYNC_CUSTOM_POLICY_LIMITS.minDeltaBytes,
    CLOUD_SYNC_CUSTOM_POLICY_LIMITS.maxDeltaBytes,
    fallback
  )
  return Math.round(normalized / KB) * KB
}

export function normalizeCloudSyncCustomPolicy(value, fallback = DEFAULT_CLOUD_SYNC_CUSTOM_POLICY) {
  const raw = value && typeof value === 'object' ? value : {}
  return {
    minDeltaBytes: normalizeCloudSyncCustomDeltaBytes(raw.minDeltaBytes, fallback?.minDeltaBytes),
    minIntervalMs: normalizeCloudSyncCustomIntervalMs(raw.minIntervalMs, fallback?.minIntervalMs)
  }
}

export function normalizeCloudSyncAutoSyncPolicy(value) {
  const key = typeof value === 'string' ? value.trim() : ''
  return Object.prototype.hasOwnProperty.call(CLOUD_SYNC_AUTO_SYNC_POLICIES, key)
    ? key
    : DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY
}

export function getCloudSyncAutoSyncPolicy(value, customPolicy = null) {
  const key = normalizeCloudSyncAutoSyncPolicy(value)
  if (key === 'custom') {
    return {
      ...CLOUD_SYNC_AUTO_SYNC_POLICIES.custom,
      ...normalizeCloudSyncCustomPolicy(customPolicy),
      key
    }
  }
  return CLOUD_SYNC_AUTO_SYNC_POLICIES[key]
}

export function formatCloudSyncBytes(bytes) {
  const size = toPositiveNumber(bytes)
  if (size >= MB) {
    return `${Math.round((size / MB) * 10) / 10} MB`
  }
  return `${Math.round(size / KB)} KB`
}

export function formatCloudSyncInterval(ms) {
  const minutes = Math.max(1, Math.round(toPositiveNumber(ms) / 60000))
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} 小时`
  }
  return `${minutes} 分钟`
}

export function shouldDeferAutoUpload(options = {}) {
  const reason = typeof options.reason === 'string' ? options.reason : 'auto'
  if (reason !== 'auto') return false

  const policy = getCloudSyncAutoSyncPolicy(options.policy, options.customPolicy)
  const backupSize = toPositiveNumber(options.backupSize)
  const lastUploadedSize = toPositiveNumber(options.lastUploadedSize)
  const lastUploadedAtMs = toPositiveNumber(options.lastUploadedAtMs)
  const now = toPositiveNumber(options.now || Date.now())

  if (!backupSize || !lastUploadedSize || !lastUploadedAtMs) {
    return false
  }

  if ((now - lastUploadedAtMs) < policy.minIntervalMs) {
    return true
  }

  const delta = Math.abs(backupSize - lastUploadedSize)
  return delta < policy.minDeltaBytes
}
