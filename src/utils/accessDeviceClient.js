const ACCESS_INSTALL_ID_KEY = 'aichat_access_install_id'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function createRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function detectPlatformLabel() {
  if (typeof navigator === 'undefined') return '未知设备'

  const userAgent = String(navigator.userAgent || '')
  const platform = normalizeText(navigator.userAgentData?.platform || navigator.platform)

  if (/iPhone/i.test(userAgent)) return 'iPhone'
  if (/iPad/i.test(userAgent)) return 'iPad'
  if (/Android/i.test(userAgent)) return 'Android 设备'
  if (/Mac/i.test(platform)) return 'Mac'
  if (/Win/i.test(platform)) return 'Windows'
  if (/Linux/i.test(platform)) return 'Linux'
  return '浏览器设备'
}

export function getOrCreateAccessInstallId() {
  if (typeof window === 'undefined') return ''

  try {
    const existing = normalizeText(window.localStorage.getItem(ACCESS_INSTALL_ID_KEY))
    if (existing) return existing

    const nextId = createRandomId()
    window.localStorage.setItem(ACCESS_INSTALL_ID_KEY, nextId)
    return nextId
  } catch {
    return createRandomId()
  }
}

export function getAccessDeviceName() {
  if (typeof navigator === 'undefined') return '未知设备'

  const label = detectPlatformLabel()
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(String(navigator.userAgent || ''))
  return isMobile ? `${label} 浏览器` : `${label} 桌面浏览器`
}

export function buildAccessDevicePayload() {
  return {
    deviceId: getOrCreateAccessInstallId(),
    deviceName: getAccessDeviceName()
  }
}
