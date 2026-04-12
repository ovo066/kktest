import { computed, onMounted, ref, watch } from 'vue'
import {
  getGeolocationPermissionState,
  toGeolocationPermissionLabel,
  getWeatherContextSnapshot,
  refreshWeatherContext,
  buildWeatherSummaryText
} from '../../../composables/useWeatherContext'
import {
  BEIJING_TIME_ZONE,
  getDeviceTimeZone,
  normalizeTimeZoneMode,
  sanitizeIanaTimeZone,
  TIME_ZONE_MODE_BEIJING,
  TIME_ZONE_MODE_CUSTOM,
  TIME_ZONE_MODE_DEVICE
} from '../../../utils/beijingTime'

export function useWeatherSettings({ scheduleSave, showToast, store }) {
  const WEATHER_REFRESH_OPTIONS = [
    { label: '15分钟', value: 15 },
    { label: '30分钟', value: 30 },
    { label: '60分钟', value: 60 },
    { label: '120分钟', value: 120 },
    { label: '180分钟', value: 180 }
  ]
  const TIME_ZONE_MODE_OPTIONS = [
    { label: '默认北京', value: TIME_ZONE_MODE_BEIJING },
    { label: '跟随设备', value: TIME_ZONE_MODE_DEVICE },
    { label: '自定义', value: TIME_ZONE_MODE_CUSTOM }
  ]

  const weatherBusy = ref(false)
  const weatherStatus = ref('天气上下文未启用')
  const weatherError = ref('')
  const geolocationPermissionState = ref('unknown')

  const geolocationPermissionLabel = computed(() => toGeolocationPermissionLabel(geolocationPermissionState.value))
  const activeTimeZoneLabel = computed(() => {
    const mode = normalizeTimeZoneMode(store.timeZoneMode)
    if (mode === TIME_ZONE_MODE_DEVICE) return getDeviceTimeZone()
    if (mode === TIME_ZONE_MODE_CUSTOM) return sanitizeIanaTimeZone(store.customTimeZone, BEIJING_TIME_ZONE)
    return BEIJING_TIME_ZONE
  })
  const weatherRefreshButtonLabel = computed(() => {
    if (weatherBusy.value) return '刷新中...'
    return store.weatherLocationMode === 'auto' ? '定位并刷新' : '刷新天气'
  })

  function normalizeTimeZoneSettings() {
    const nextMode = normalizeTimeZoneMode(store.timeZoneMode)
    const nextCustomZone = sanitizeIanaTimeZone(store.customTimeZone, BEIJING_TIME_ZONE)
    const changed = nextMode !== store.timeZoneMode || nextCustomZone !== store.customTimeZone
    store.timeZoneMode = nextMode
    store.customTimeZone = nextCustomZone
    return changed
  }

  function handleTimeZoneModeChange() {
    normalizeTimeZoneSettings()
    scheduleSave()
  }

  function handleCustomTimeZoneChange() {
    const rawInput = String(store.customTimeZone || '').trim()
    const sanitized = sanitizeIanaTimeZone(rawInput, BEIJING_TIME_ZONE)
    store.customTimeZone = sanitized
    scheduleSave()
    if (rawInput && sanitized !== rawInput) {
      showToast('时区无效，已回退为 Asia/Shanghai')
    }
  }

  function normalizeWeatherSettings() {
    if (store.weatherLocationMode !== 'manual') store.weatherLocationMode = 'auto'
    const refresh = Number(store.weatherRefreshMinutes)
    if (Number.isFinite(refresh)) {
      store.weatherRefreshMinutes = Math.max(10, Math.min(360, Math.round(refresh)))
    } else {
      store.weatherRefreshMinutes = 60
    }
    store.weatherManualCity = String(store.weatherManualCity || '').trim()
  }

  function getWeatherErrorMessage(error) {
    const code = String(error?.code || '')
    if (code === 'manual_city_required') return '请先填写城市'
    if (code === 'city_not_found') return '未找到该城市'
    if (code === 'geolocation_denied') return '定位权限已拒绝'
    if (code === 'geolocation_prompt_required') return '请点击“定位并刷新”授权定位'
    if (code === 'geolocation_unsupported') return '当前环境不支持定位'
    if (code === 'geolocation_timeout') return '定位超时，请重试'
    return '天气获取失败'
  }

  async function refreshWeatherPermissionState() {
    if (store.weatherLocationMode !== 'auto') {
      geolocationPermissionState.value = 'unknown'
      return
    }
    geolocationPermissionState.value = await getGeolocationPermissionState()
  }

  async function refreshWeatherPanel({ force = false, allowPrompt = false, showErrorToast = false } = {}) {
    normalizeWeatherSettings()
    if (!store.enableWeatherContext) {
      weatherStatus.value = '天气上下文未启用'
      weatherError.value = ''
      return
    }

    weatherBusy.value = true
    weatherError.value = ''
    try {
      await refreshWeatherPermissionState()
      const snapshot = force
        ? await refreshWeatherContext(store, { allowPrompt, throwOnError: true })
        : await getWeatherContextSnapshot(store, { allowPrompt, returnStaleOnError: true })
      if (snapshot) {
        weatherStatus.value = buildWeatherSummaryText(snapshot)
        weatherError.value = ''
      } else {
        weatherStatus.value = '天气暂不可用'
        weatherError.value = store.weatherLocationMode === 'manual' && !store.weatherManualCity ? '请先填写城市' : ''
      }
    } catch (error) {
      const message = getWeatherErrorMessage(error)
      weatherError.value = message
      weatherStatus.value = '天气暂不可用'
      if (showErrorToast) showToast(message)
    } finally {
      await refreshWeatherPermissionState()
      weatherBusy.value = false
    }
  }

  function handleWeatherContextToggle() {
    normalizeWeatherSettings()
    scheduleSave()
    void refreshWeatherPanel({ force: false, allowPrompt: false })
  }

  function handleWeatherModeChange() {
    normalizeWeatherSettings()
    scheduleSave()
    void refreshWeatherPanel({ force: true, allowPrompt: false })
  }

  function handleWeatherManualCityChange() {
    normalizeWeatherSettings()
    scheduleSave()
    if (store.weatherLocationMode === 'manual') {
      void refreshWeatherPanel({ force: true, allowPrompt: false })
    }
  }

  function handleWeatherRefreshIntervalChange() {
    normalizeWeatherSettings()
    scheduleSave()
    void refreshWeatherPanel({ force: false, allowPrompt: false })
  }

  async function handleRefreshWeatherNow() {
    await refreshWeatherPanel({ force: true, allowPrompt: store.weatherLocationMode === 'auto', showErrorToast: true })
  }

  onMounted(() => {
    if (normalizeTimeZoneSettings()) scheduleSave()
    void refreshWeatherPanel({ force: false, allowPrompt: false })
  })

  watch(
    () => [store.enableWeatherContext, store.weatherLocationMode, store.weatherRefreshMinutes],
    () => {
      void refreshWeatherPanel({ force: false, allowPrompt: false })
    }
  )

  return {
    activeTimeZoneLabel,
    geolocationPermissionLabel,
    handleCustomTimeZoneChange,
    handleRefreshWeatherNow,
    handleTimeZoneModeChange,
    handleWeatherContextToggle,
    handleWeatherManualCityChange,
    handleWeatherModeChange,
    handleWeatherRefreshIntervalChange,
    TIME_ZONE_MODE_CUSTOM,
    TIME_ZONE_MODE_OPTIONS,
    weatherBusy,
    weatherError,
    WEATHER_REFRESH_OPTIONS,
    weatherRefreshButtonLabel,
    weatherStatus
  }
}
