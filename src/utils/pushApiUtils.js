const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-push-token'
}

export function applyCors(res, headers = {}) {
  const merged = { ...DEFAULT_CORS_HEADERS, ...headers }
  Object.entries(merged).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
}

export function extractProviderReason(error) {
  if (!error) return ''
  const body = (typeof error.body === 'string') ? error.body.trim() : ''
  if (!body) return ''
  try {
    const parsed = JSON.parse(body)
    if (parsed && typeof parsed.reason === 'string' && parsed.reason.trim()) {
      return parsed.reason.trim()
    }
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim()
    }
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim()
    }
  } catch {
    // keep raw text fallback
  }
  return body.slice(0, 140)
}

export function normalizeApiError(error, fallback = 'push_error') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  const parts = []
  const statusCode = Number(error?.statusCode)
  if (Number.isFinite(statusCode) && statusCode > 0) {
    parts.push(`status=${statusCode}`)
  }
  const providerReason = extractProviderReason(error)
  if (providerReason) {
    parts.push(`reason=${providerReason}`)
  }
  const message = (typeof error.message === 'string' && error.message.trim()) ? error.message.trim() : ''
  if (message && message !== 'Received unexpected response code') {
    parts.push(message)
  }
  if (parts.length > 0) return parts.join(' ')
  if (message) return message
  return fallback
}

export function readBearerOrToken(req) {
  const tokenHeader = req.headers['x-push-token']
  if (typeof tokenHeader === 'string' && tokenHeader.trim()) return tokenHeader.trim()

  const authHeader = req.headers.authorization || req.headers.Authorization
  if (typeof authHeader !== 'string') return ''
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return (m?.[1] || '').trim()
}

export function readJsonBody(req) {
  if (req.body == null) return {}
  if (typeof req.body === 'string') {
    const raw = req.body.trim()
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (typeof req.body === 'object') return req.body
  return {}
}

export function sanitizeNotificationPayload(input = {}) {
  const data = (input && typeof input === 'object') ? input : {}
  return {
    title: String(data.title || 'AI Chat'),
    body: String(data.body || ''),
    tag: data.tag ? String(data.tag) : undefined,
    data: (data.data && typeof data.data === 'object') ? data.data : {},
    silent: !!data.silent,
    requireInteraction: !!data.requireInteraction,
    renotify: !!data.renotify,
    icon: data.icon ? String(data.icon) : undefined,
    badge: data.badge ? String(data.badge) : undefined
  }
}

export function isValidPushSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return false
  if (!subscription.endpoint || typeof subscription.endpoint !== 'string') return false
  const keys = subscription.keys
  if (!keys || typeof keys !== 'object') return false
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return false
  if (!keys.p256dh.trim() || !keys.auth.trim()) return false
  return true
}

export function readPushEnv() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim()
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim()
  const subject = String(process.env.VAPID_SUBJECT || '').trim() || 'mailto:admin@example.com'
  const authToken = String(process.env.PUSH_SERVER_TOKEN || '').trim()
  const enabled = !!(publicKey && privateKey)
  return {
    publicKey,
    privateKey,
    subject,
    authToken,
    enabled
  }
}
