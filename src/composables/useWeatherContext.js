const DEFAULT_REFRESH_MINUTES = 60
const MIN_REFRESH_MINUTES = 10
const MAX_REFRESH_MINUTES = 360
const WEATHER_TIMEOUT_MS = 10000
const GEOLOCATION_TIMEOUT_MS = 8000

const weatherCache = new Map()
const weatherInflight = new Map()

function normalizeRefreshMinutes(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_REFRESH_MINUTES
  return Math.max(MIN_REFRESH_MINUTES, Math.min(MAX_REFRESH_MINUTES, Math.round(n)))
}

function normalizeWeatherSettings(store) {
  return {
    enabled: !!store?.enableWeatherContext,
    locationMode: store?.weatherLocationMode === 'manual' ? 'manual' : 'auto',
    manualCity: String(store?.weatherManualCity || '').trim(),
    refreshMinutes: normalizeRefreshMinutes(store?.weatherRefreshMinutes)
  }
}

function getCacheKey(settings) {
  if (settings.locationMode === 'manual') {
    return `manual:${settings.manualCity.toLowerCase()}`
  }
  return 'auto'
}

function buildError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function isFresh(snapshot, refreshMinutes) {
  if (!snapshot || !Number.isFinite(snapshot.fetchedAt)) return false
  return Date.now() - snapshot.fetchedAt <= normalizeRefreshMinutes(refreshMinutes) * 60 * 1000
}

function normalizeNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function classifyWeather(code, isDay) {
  const n = Number(code)
  if (!Number.isFinite(n)) return '未知'
  if (n === 0) return isDay ? '晴' : '晴夜'
  if (n === 1) return isDay ? '晴间多云' : '多云'
  if (n === 2) return '多云'
  if (n === 3) return '阴'
  if (n === 45 || n === 48) return '雾'
  if ([51, 53, 55, 56, 57].includes(n)) return '毛毛雨'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return '雨'
  if ([71, 73, 75, 77, 85, 86].includes(n)) return '雪'
  if ([95, 96, 99].includes(n)) return '雷雨'
  return '天气变化'
}

async function fetchJson(url, timeoutMs = WEATHER_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw buildError('weather_http_error', `HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function getCurrentPosition() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(buildError('geolocation_unsupported', 'Geolocation unsupported'))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const code = err?.code === 1
          ? 'geolocation_denied'
          : err?.code === 2
            ? 'geolocation_unavailable'
            : 'geolocation_timeout'
        reject(buildError(code, err?.message || 'Geolocation failed'))
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: GEOLOCATION_TIMEOUT_MS
      }
    )
  })
}

async function geocodeCity(city) {
  const q = encodeURIComponent(city)
  const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=zh&format=json`)
  const first = Array.isArray(data?.results) ? data.results[0] : null
  if (!first) throw buildError('city_not_found', 'City not found')
  return {
    latitude: Number(first.latitude),
    longitude: Number(first.longitude),
    cityName: String(first.name || city).trim()
  }
}

async function fetchCurrentWeather(latitude, longitude) {
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${latitude}`,
    `&longitude=${longitude}`,
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    '&timezone=auto'
  ].join('')
  const data = await fetchJson(url)
  if (!data?.current) throw buildError('weather_missing_current', 'Missing current weather')
  return data
}

function formatClock(rawTime) {
  const text = String(rawTime || '')
  const match = text.match(/(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

function inferCityFromTimezone(timezone) {
  const raw = String(timezone || '').trim()
  if (!raw) return ''
  const slash = raw.lastIndexOf('/')
  if (slash === -1 || slash >= raw.length - 1) return ''
  return raw.slice(slash + 1).replace(/_/g, ' ').trim()
}

export async function getGeolocationPermissionState() {
  if (typeof navigator === 'undefined') return 'unknown'
  if (!navigator.geolocation) return 'unsupported'
  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result?.state || 'unknown'
    }
  } catch {
    // ignore
  }
  return 'unknown'
}

export function toGeolocationPermissionLabel(state) {
  if (state === 'granted') return '已授权'
  if (state === 'prompt') return '待授权'
  if (state === 'denied') return '已拒绝'
  if (state === 'unsupported') return '不支持'
  return '未知'
}

async function resolveLocation(settings, options = {}) {
  if (settings.locationMode === 'manual') {
    if (!settings.manualCity) throw buildError('manual_city_required', 'Manual city is empty')
    return geocodeCity(settings.manualCity)
  }

  const permissionState = await getGeolocationPermissionState()
  if (permissionState === 'denied') throw buildError('geolocation_denied', 'Location permission denied')
  if (permissionState === 'prompt' && !options.allowPrompt) {
    throw buildError('geolocation_prompt_required', 'Location permission prompt required')
  }

  const pos = await getCurrentPosition()
  const latitude = Number(pos?.coords?.latitude)
  const longitude = Number(pos?.coords?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw buildError('geolocation_invalid', 'Invalid geolocation coordinates')
  }
  return { latitude, longitude, cityName: '' }
}

async function fetchWeatherSnapshot(settings, options = {}) {
  const location = await resolveLocation(settings, options)
  const weather = await fetchCurrentWeather(location.latitude, location.longitude)
  const current = weather.current || {}
  const isDay = Number(current.is_day) === 1
  const weatherCode = normalizeNumber(current.weather_code)
  const timezone = String(weather.timezone || '')
  const inferredCity = inferCityFromTimezone(timezone)

  return {
    sourceMode: settings.locationMode,
    city: location.cityName || (settings.locationMode === 'manual' ? settings.manualCity : (inferredCity || '当前位置')),
    latitude: location.latitude,
    longitude: location.longitude,
    condition: classifyWeather(weatherCode, isDay),
    weatherCode,
    isDay,
    temperatureC: normalizeNumber(current.temperature_2m),
    apparentTemperatureC: normalizeNumber(current.apparent_temperature),
    humidity: normalizeNumber(current.relative_humidity_2m),
    windSpeedKmh: normalizeNumber(current.wind_speed_10m),
    observedTime: String(current.time || ''),
    timezone,
    fetchedAt: Date.now()
  }
}

export async function getWeatherContextSnapshot(store, options = {}) {
  const settings = normalizeWeatherSettings(store)
  if (!settings.enabled && !options.ignoreEnableFlag) return null

  const key = getCacheKey(settings)
  const cached = weatherCache.get(key)
  if (!options.forceRefresh && isFresh(cached, settings.refreshMinutes)) {
    return cached
  }

  if (weatherInflight.has(key)) {
    return weatherInflight.get(key)
  }

  const task = (async () => {
    try {
      const snapshot = await fetchWeatherSnapshot(settings, {
        allowPrompt: !!options.allowPrompt
      })
      weatherCache.set(key, snapshot)
      return snapshot
    } catch (err) {
      if (cached && options.returnStaleOnError !== false) return cached
      if (options.throwOnError) throw err
      return null
    } finally {
      weatherInflight.delete(key)
    }
  })()

  weatherInflight.set(key, task)
  return task
}

export async function refreshWeatherContext(store, options = {}) {
  return getWeatherContextSnapshot(store, {
    ...options,
    forceRefresh: true
  })
}

export function buildWeatherSummaryText(snapshot) {
  if (!snapshot) return '天气不可用'
  const city = snapshot.city || '未知地点'
  const condition = snapshot.condition || '未知天气'
  const temp = Number.isFinite(snapshot.temperatureC) ? `${Math.round(snapshot.temperatureC)}°C` : '--'
  const feels = Number.isFinite(snapshot.apparentTemperatureC) ? `体感${Math.round(snapshot.apparentTemperatureC)}°C` : ''
  const clock = formatClock(snapshot.observedTime)
  const timePart = clock ? ` · ${clock}` : ''
  return `${city} · ${condition} ${temp}${feels ? ` (${feels})` : ''}${timePart}`
}

export async function buildWeatherContextPrompt(store, options = {}) {
  const snapshot = await getWeatherContextSnapshot(store, {
    allowPrompt: !!options.allowPrompt,
    returnStaleOnError: true,
    forceRefresh: !!options.forceRefresh,
    throwOnError: false
  })
  if (!snapshot) return ''

  const city = snapshot.city || '当前位置'
  const condition = snapshot.condition || '未知天气'
  const temp = Number.isFinite(snapshot.temperatureC) ? `${Math.round(snapshot.temperatureC)}°C` : '温度未知'
  const feels = Number.isFinite(snapshot.apparentTemperatureC) ? `体感${Math.round(snapshot.apparentTemperatureC)}°C` : ''
  const humidity = Number.isFinite(snapshot.humidity) ? `湿度${Math.round(snapshot.humidity)}%` : ''
  const wind = Number.isFinite(snapshot.windSpeedKmh) ? `风速${Math.round(snapshot.windSpeedKmh)}km/h` : ''
  const clock = formatClock(snapshot.observedTime)

  const parts = [`${city}`, condition, temp]
  if (feels) parts.push(feels)
  if (humidity) parts.push(humidity)
  if (wind) parts.push(wind)
  if (clock) parts.push(`更新于${clock}`)

  return `<weather_context>当前天气：${parts.join('，')}。仅在与对话相关时自然引用，不要每条都提天气。</weather_context>`
}

/**
 * 返回紧凑天气摘要行（供 <now> 块合并使用，不含 XML 标签和使用指令）
 * @returns {string} 如 "北京 晴 12°C 体感10°C"
 */
export async function buildWeatherSummaryLine(store, options = {}) {
  const snapshot = await getWeatherContextSnapshot(store, {
    allowPrompt: false,
    returnStaleOnError: true,
    forceRefresh: !!options.forceRefresh,
    throwOnError: false
  })
  if (!snapshot) return ''

  const city = snapshot.city || ''
  const condition = snapshot.condition || ''
  const temp = Number.isFinite(snapshot.temperatureC) ? `${Math.round(snapshot.temperatureC)}°C` : ''
  const feels = Number.isFinite(snapshot.apparentTemperatureC) ? `体感${Math.round(snapshot.apparentTemperatureC)}°C` : ''

  const parts = [city, condition, temp].filter(Boolean)
  if (feels) parts.push(feels)
  return parts.join(' ')
}
