export const CLOUD_SYNC_PROVIDER_FIREBASE = 'firebase'

export const CLOUD_SYNC_FIREBASE_FIELD_DEFS = [
  { key: 'apiKey', envKey: 'VITE_FIREBASE_API_KEY', required: true },
  { key: 'authDomain', envKey: 'VITE_FIREBASE_AUTH_DOMAIN', required: true },
  { key: 'projectId', envKey: 'VITE_FIREBASE_PROJECT_ID', required: true },
  { key: 'storageBucket', envKey: 'VITE_FIREBASE_STORAGE_BUCKET', required: true },
  { key: 'appId', envKey: 'VITE_FIREBASE_APP_ID', required: true },
  { key: 'messagingSenderId', envKey: 'VITE_FIREBASE_MESSAGING_SENDER_ID', required: true },
  { key: 'measurementId', envKey: 'VITE_FIREBASE_MEASUREMENT_ID', required: false }
]
const REQUIRED_FIREBASE_FIELDS = CLOUD_SYNC_FIREBASE_FIELD_DEFS
  .filter((field) => field.required)
  .map((field) => field.key)

function normalizeText(value) {
  return String(value || '').trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanExtractedValue(value) {
  let next = String(value || '').trim()
  if (!next) return ''

  next = next.replace(/,$/, '').trim()
  if (!next) return ''

  const first = next[0]
  const last = next[next.length - 1]
  const isQuoted = first && last && first === last && ['"', "'", '`'].includes(first)

  if (isQuoted) {
    return next.slice(1, -1).trim()
  }

  return next.replace(/\s+#.*$/, '').trim()
}

function extractConfigValue(text, aliases = []) {
  for (const alias of aliases) {
    if (!alias) continue
    const pattern = new RegExp(
      `(?:^|[\\s,{])["'\`]?${escapeRegExp(alias)}["'\`]?\\s*[:=]\\s*("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\\\\\`]|\\\\.)*\`|[^,\\r\\n}]+)`,
      'm'
    )
    const match = text.match(pattern)
    const value = cleanExtractedValue(match?.[1] || '')
    if (value) return value
  }
  return ''
}

export function createDefaultCloudSyncConfig() {
  return {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    appId: '',
    messagingSenderId: '',
    measurementId: ''
  }
}

export function normalizeCloudSyncProvider(value) {
  return value === CLOUD_SYNC_PROVIDER_FIREBASE
    ? CLOUD_SYNC_PROVIDER_FIREBASE
    : CLOUD_SYNC_PROVIDER_FIREBASE
}

export function normalizeCloudSyncConfig(rawConfig, fallbackConfig = {}) {
  const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {}
  const fallback = fallbackConfig && typeof fallbackConfig === 'object' ? fallbackConfig : {}
  const defaults = createDefaultCloudSyncConfig()

  return {
    apiKey: normalizeText(raw.apiKey ?? fallback.apiKey ?? defaults.apiKey),
    authDomain: normalizeText(raw.authDomain ?? fallback.authDomain ?? defaults.authDomain),
    projectId: normalizeText(raw.projectId ?? fallback.projectId ?? defaults.projectId),
    storageBucket: normalizeText(raw.storageBucket ?? fallback.storageBucket ?? defaults.storageBucket),
    appId: normalizeText(raw.appId ?? fallback.appId ?? defaults.appId),
    messagingSenderId: normalizeText(raw.messagingSenderId ?? fallback.messagingSenderId ?? defaults.messagingSenderId),
    measurementId: normalizeText(raw.measurementId ?? fallback.measurementId ?? defaults.measurementId)
  }
}

export function hasCloudSyncConfigValues(config) {
  const normalized = normalizeCloudSyncConfig(config)
  return CLOUD_SYNC_FIREBASE_FIELD_DEFS.some((field) => !!normalized[field.key])
}

export function extractCloudSyncConfigFromText(rawText, fallbackConfig = {}) {
  const text = String(rawText || '')
  const extracted = {}

  for (const field of CLOUD_SYNC_FIREBASE_FIELD_DEFS) {
    const value = extractConfigValue(text, [field.key, field.envKey])
    if (value) {
      extracted[field.key] = value
    }
  }

  const matchedKeys = Object.keys(extracted)

  return {
    config: normalizeCloudSyncConfig(extracted, fallbackConfig),
    matchedKeys,
    matchedCount: matchedKeys.length
  }
}

export function getEnvCloudSyncConfig() {
  return normalizeCloudSyncConfig({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  })
}

export function resolveCloudSyncFirebaseConfig(rawConfig = {}) {
  const normalizedRaw = normalizeCloudSyncConfig(rawConfig)
  const envConfig = getEnvCloudSyncConfig()

  if (!hasCloudSyncConfigValues(normalizedRaw)) {
    return envConfig
  }

  if (!isCloudSyncConfigComplete(envConfig) || isCloudSyncConfigComplete(normalizedRaw)) {
    return normalizedRaw
  }

  return envConfig
}

export function isCloudSyncConfigComplete(config) {
  const normalized = normalizeCloudSyncConfig(config)
  return REQUIRED_FIREBASE_FIELDS.every((key) => !!normalized[key])
}

export function getCloudSyncMissingFields(config) {
  const normalized = normalizeCloudSyncConfig(config)
  return REQUIRED_FIREBASE_FIELDS.filter((key) => !normalized[key])
}

export function getCloudSyncConfigSignature(config) {
  const normalized = normalizeCloudSyncConfig(config)
  return JSON.stringify(normalized)
}
