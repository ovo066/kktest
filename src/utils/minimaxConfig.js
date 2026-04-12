function trimTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function looksLikeUrlPath(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (/^https?:\/\//i.test(raw)) return true
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\/.+$/i.test(raw)
}

export function sanitizeMiniMaxGroupId(groupId, endpoint = '') {
  const trimmedGroupId = String(groupId ?? '').trim()
  if (!trimmedGroupId) return ''

  const normalizedGroupId = trimTrailingSlashes(trimmedGroupId)
  const normalizedEndpoint = trimTrailingSlashes(endpoint)

  if (normalizedEndpoint && normalizedGroupId === normalizedEndpoint) return ''
  if (looksLikeUrlPath(trimmedGroupId)) return ''

  return trimmedGroupId
}
