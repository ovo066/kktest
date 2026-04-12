import sprite01 from 'snd-lib/dist/json/01.json'
import sprite02 from 'snd-lib/dist/json/02.json'
import sprite03 from 'snd-lib/dist/json/03.json'

export const MAX_CUSTOM_SOUND_SIZE_BYTES = 1024 * 1024
export const MAX_CUSTOM_SOUND_COUNT = 24

// ---------------------------------------------------------------------------
// snd-lib sound kits
// ---------------------------------------------------------------------------

const SND_CDN_BASE = 'https://cdn.jsdelivr.net/gh/snd-lib/snd-lib@v1.2.4/assets/sounds/sprite'

const KIT_DEFINITIONS = [
  {
    id: 'snd01',
    label: '清脆数字',
    description: '简洁清晰的现代数字音效',
    spriteUrl: `${SND_CDN_BASE}/01/audioSprite.mp3`,
    spritemap: sprite01.spritemap
  },
  {
    id: 'snd02',
    label: '温暖质感',
    description: '柔和有层次的质感音效',
    spriteUrl: `${SND_CDN_BASE}/02/audioSprite.mp3`,
    spritemap: sprite02.spritemap
  },
  {
    id: 'snd03',
    label: '轻柔自然',
    description: '轻盈自然的有机音效',
    spriteUrl: `${SND_CDN_BASE}/03/audioSprite.mp3`,
    spritemap: sprite03.spritemap
  }
]

const KIT_MAP = Object.freeze(
  Object.fromEntries(KIT_DEFINITIONS.map((k) => [k.id, k]))
)

const DEFAULT_KIT_ID = 'snd01'

// ---------------------------------------------------------------------------
// Built-in sound definitions (common across all kits)
// ---------------------------------------------------------------------------

const BUILTIN_SOUND_DEFINITIONS = [
  { id: 'tap_01', label: '轻触 1', description: '极短的触感反馈' },
  { id: 'tap_02', label: '轻触 2', description: '清脆的点击' },
  { id: 'tap_03', label: '轻触 3', description: '柔和的点击' },
  { id: 'tap_04', label: '轻触 4', description: '轻快的触感' },
  { id: 'tap_05', label: '轻触 5', description: '圆润的点击' },
  { id: 'button', label: '按钮', description: '明确的操作反馈' },
  { id: 'select', label: '选中', description: '轻微的选择提示' },
  { id: 'notification', label: '通知铃', description: '清晰的提示音' },
  { id: 'caution', label: '警示', description: '带有提醒感的提示' },
  { id: 'celebration', label: '庆祝', description: '愉悦的成就音效' },
  { id: 'disabled', label: '禁用提示', description: '操作不可用的反馈' },
  { id: 'toggle_on', label: '开启', description: '开关打开的轻响' },
  { id: 'toggle_off', label: '关闭', description: '开关关闭的轻响' },
  { id: 'transition_up', label: '上扬过渡', description: '向上的转场音' },
  { id: 'transition_down', label: '下沉过渡', description: '向下的转场音' },
  { id: 'swipe_01', label: '滑动 1', description: '轻快的滑动声' },
  { id: 'swipe_02', label: '滑动 2', description: '流畅的划过声' },
  { id: 'swipe_03', label: '滑动 3', description: '柔和的滑动' },
  { id: 'swipe_04', label: '滑动 4', description: '干净的划过' },
  { id: 'swipe_05', label: '滑动 5', description: '轻盈的滑动声' },
  { id: 'type_01', label: '键入 1', description: '极短的打字声' },
  { id: 'type_02', label: '键入 2', description: '清脆的键入' },
  { id: 'type_03', label: '键入 3', description: '柔和的键入' },
  { id: 'type_04', label: '键入 4', description: '轻快的键入' },
  { id: 'type_05', label: '键入 5', description: '圆润的键入声' }
]

const BUILTIN_SOUND_ID_SET = new Set(BUILTIN_SOUND_DEFINITIONS.map((s) => s.id))

// ---------------------------------------------------------------------------
// Legacy migration (old synthesised preset IDs → snd-lib sound IDs)
// ---------------------------------------------------------------------------

const LEGACY_SOUND_ID_MAP = {
  'builtin:send-soft': 'tap_01',
  'builtin:glass': 'select',
  'builtin:bubble': 'notification',
  'builtin:double': 'transition_up',
  'builtin:soft-bell': 'notification',
  'builtin:glint': 'toggle_on',
  'builtin:typing': 'type_01'
}

function migrateSoundId(id) {
  const raw = String(id || '').trim()
  return LEGACY_SOUND_ID_MAP[raw] || raw
}

// ---------------------------------------------------------------------------
// Sound event definitions
// ---------------------------------------------------------------------------

export const SOUND_EVENT_DEFINITIONS = [
  {
    key: 'messageSend',
    label: '发送消息',
    description: '你发出消息时播放',
    defaultEnabled: true,
    defaultSoundId: 'tap_01',
    cooldownMs: 80
  },
  {
    key: 'messageReceive',
    label: '收到回复',
    description: '当前聊天里收到新回复时播放',
    defaultEnabled: true,
    defaultSoundId: 'notification',
    cooldownMs: 180
  },
  {
    key: 'notification',
    label: '后台通知',
    description: '不在当前聊天时收到新消息播放',
    defaultEnabled: true,
    defaultSoundId: 'notification',
    cooldownMs: 500
  },
  {
    key: 'typing',
    label: '对方输入中',
    description: '对方开始输入时播放一次',
    defaultEnabled: false,
    defaultSoundId: 'type_01',
    cooldownMs: 2000
  },
  {
    key: 'readReceipt',
    label: '已读状态',
    description: '消息被标记已读时播放',
    defaultEnabled: false,
    defaultSoundId: 'select',
    cooldownMs: 1200
  }
]

const SOUND_EVENT_DEFINITION_MAP = Object.freeze(
  Object.fromEntries(SOUND_EVENT_DEFINITIONS.map((item) => [item.key, item]))
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toFiniteNumber(value, fallback) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function isBuiltinSoundId(soundId) {
  return BUILTIN_SOUND_ID_SET.has(String(soundId || '').trim())
}

// ---------------------------------------------------------------------------
// Kit accessors
// ---------------------------------------------------------------------------

export function getKitDefinitions() {
  return KIT_DEFINITIONS.map(({ id, label, description }) => ({ id, label, description }))
}

export function getKitDefinition(kitId) {
  return KIT_MAP[kitId] || KIT_MAP[DEFAULT_KIT_ID]
}

export function getKitSprite(kitId) {
  const kit = getKitDefinition(kitId)
  const sprite = {}
  for (const [key, { start, end }] of Object.entries(kit.spritemap)) {
    sprite[key] = [Math.round(start * 1000), Math.round((end - start) * 1000)]
  }
  return sprite
}

export function normalizeKitId(kitId) {
  const raw = String(kitId || '').trim()
  return KIT_MAP[raw] ? raw : DEFAULT_KIT_ID
}

// ---------------------------------------------------------------------------
// Built-in sound catalog
// ---------------------------------------------------------------------------

export function getBuiltinSoundOptions() {
  return BUILTIN_SOUND_DEFINITIONS.map(({ id, label, description }) => ({
    id,
    label,
    description,
    builtin: true
  }))
}

export function listSoundOptions(customSounds = []) {
  const builtin = getBuiltinSoundOptions()
  const custom = Array.isArray(customSounds)
    ? customSounds
      .map((item, index) => normalizeCustomSoundEntry(item, index))
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        label: item.name,
        description: item.size > 0 ? `${Math.round(item.size / 1024)} KB` : '自定义音效',
        builtin: false
      }))
    : []

  return { builtin, custom }
}

// ---------------------------------------------------------------------------
// Custom sound helpers
// ---------------------------------------------------------------------------

function cloneCustomSoundEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source,
    mimeType: entry.mimeType || '',
    size: entry.size,
    createdAt: entry.createdAt
  }
}

function normalizeCustomSoundEntry(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== 'object') return null

  const idRaw = String(entry.id || '').trim()
  const id = idRaw || `custom_${Date.now()}_${fallbackIndex}`
  const nameRaw = String(entry.name || '').trim()
  const source = String(entry.source || entry.url || '').trim()
  const mimeType = String(entry.mimeType || '').trim()
  const size = Math.max(0, Math.round(toFiniteNumber(entry.size, 0)))
  const createdAt = Math.max(0, Math.round(toFiniteNumber(entry.createdAt, Date.now())))

  const isInlineAudio = /^data:audio\/[a-z0-9.+-]+;base64,/i.test(source)
  const isRemoteAudio = /^https?:\/\//i.test(source)
  if (!isInlineAudio && !isRemoteAudio) return null

  return {
    id,
    name: nameRaw || `自定义音效 ${fallbackIndex + 1}`,
    source,
    mimeType,
    size,
    createdAt
  }
}

export function findCustomSoundById(soundId, customSounds = []) {
  const target = String(soundId || '').trim()
  if (!target) return null
  const entry = Array.isArray(customSounds)
    ? customSounds.find((item) => String(item?.id || '').trim() === target)
    : null
  if (!entry) return null
  return normalizeCustomSoundEntry(entry)
}

// ---------------------------------------------------------------------------
// Config normalization
// ---------------------------------------------------------------------------

function buildAvailableSoundIdSet(customSounds = []) {
  const ids = new Set(BUILTIN_SOUND_ID_SET)
  customSounds.forEach((item) => {
    if (item?.id) ids.add(item.id)
  })
  return ids
}

function normalizeEventConfig(eventKey, rawEvent, fallbackEvent, availableSoundIds) {
  const definition = SOUND_EVENT_DEFINITION_MAP[eventKey]
  const source = rawEvent && typeof rawEvent === 'object' ? rawEvent : {}
  const fallback = fallbackEvent && typeof fallbackEvent === 'object' ? fallbackEvent : {}

  const fallbackSoundId = migrateSoundId(fallback.soundId || definition?.defaultSoundId)
    || definition?.defaultSoundId || ''

  let soundId = migrateSoundId(source.soundId || fallbackSoundId)
  if (!availableSoundIds.has(soundId)) soundId = fallbackSoundId

  const enabled = typeof source.enabled === 'boolean'
    ? source.enabled
    : (typeof fallback.enabled === 'boolean' ? fallback.enabled : definition?.defaultEnabled !== false)

  return { enabled, soundId }
}

export function createDefaultSoundConfig() {
  return {
    enabled: false,
    volume: 0.65,
    kit: DEFAULT_KIT_ID,
    customSounds: [],
    events: Object.fromEntries(SOUND_EVENT_DEFINITIONS.map((item) => [
      item.key,
      { enabled: item.defaultEnabled !== false, soundId: item.defaultSoundId }
    ]))
  }
}

export function normalizeSoundConfig(rawConfig, fallbackConfig = createDefaultSoundConfig()) {
  const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {}
  const fallback = fallbackConfig && typeof fallbackConfig === 'object'
    ? fallbackConfig
    : createDefaultSoundConfig()

  const customSounds = Array.isArray(source.customSounds)
    ? source.customSounds
      .map((entry, index) => normalizeCustomSoundEntry(entry, index))
      .filter(Boolean)
      .slice(0, MAX_CUSTOM_SOUND_COUNT)
    : Array.isArray(fallback.customSounds)
      ? fallback.customSounds.map(cloneCustomSoundEntry)
      : []

  const dedupedCustomSounds = []
  const customIds = new Set()
  customSounds.forEach((entry) => {
    if (!entry || customIds.has(entry.id)) return
    customIds.add(entry.id)
    dedupedCustomSounds.push(cloneCustomSoundEntry(entry))
  })

  const availableSoundIds = buildAvailableSoundIdSet(dedupedCustomSounds)
  const fallbackEvents = fallback.events && typeof fallback.events === 'object' ? fallback.events : {}
  const sourceEvents = source.events && typeof source.events === 'object' ? source.events : {}

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : !!fallback.enabled,
    volume: clamp(toFiniteNumber(source.volume, fallback.volume ?? 0.65), 0, 1),
    kit: normalizeKitId(source.kit || fallback.kit),
    customSounds: dedupedCustomSounds,
    events: Object.fromEntries(SOUND_EVENT_DEFINITIONS.map((item) => [
      item.key,
      normalizeEventConfig(item.key, sourceEvents[item.key], fallbackEvents[item.key], availableSoundIds)
    ]))
  }
}

export function getSoundEventDefinition(eventKey) {
  return SOUND_EVENT_DEFINITION_MAP[eventKey] || null
}
