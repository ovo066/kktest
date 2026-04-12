export function getAdaptiveSaveDelayMs(approxBytes, policy = {}) {
  const {
    mediumBytes = 25 * 1024 * 1024,
    largeBytes = 80 * 1024 * 1024,
    hugeBytes = 120 * 1024 * 1024,
    smallDelayMs = 200,
    mediumDelayMs = 900,
    largeDelayMs = 2000,
    hugeDelayMs = 4500
  } = policy

  if (approxBytes >= hugeBytes) return hugeDelayMs
  if (approxBytes >= largeBytes) return largeDelayMs
  if (approxBytes >= mediumBytes) return mediumDelayMs
  return smallDelayMs
}

export function getAdaptiveMinSaveIntervalMs(approxBytes, policy = {}) {
  const {
    largeBytes = 80 * 1024 * 1024,
    hugeBytes = 120 * 1024 * 1024,
    largeMinIntervalMs = 3500,
    hugeMinIntervalMs = 12000
  } = policy

  if (approxBytes >= hugeBytes) return hugeMinIntervalMs
  if (approxBytes >= largeBytes) return largeMinIntervalMs
  return 0
}

export function shouldReestimateSnapshotSize({ approxBytes = 0, saveCount = 0, largeBytes = 80 * 1024 * 1024, hugeBytes = 120 * 1024 * 1024 } = {}) {
  if (approxBytes <= 0 || saveCount <= 2) return true
  if (approxBytes >= hugeBytes) return saveCount % 30 === 0
  if (approxBytes >= largeBytes) return saveCount % 16 === 0
  return saveCount % 6 === 0
}

export function computeFinalSaveDelay({ approxBytes = 0, lastSaveFinishedAt = 0, now = Date.now(), policy = {} } = {}) {
  const delay = getAdaptiveSaveDelayMs(approxBytes, policy)
  const minInterval = getAdaptiveMinSaveIntervalMs(approxBytes, policy)
  const sinceLastSave = lastSaveFinishedAt > 0 ? (now - lastSaveFinishedAt) : Number.POSITIVE_INFINITY
  const intervalDelay = minInterval > 0 && Number.isFinite(sinceLastSave) && sinceLastSave < minInterval
    ? (minInterval - sinceLastSave)
    : 0
  return Math.max(delay, intervalDelay)
}
