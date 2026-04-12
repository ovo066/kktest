import webpush from 'web-push'
import {
  applyCors,
  extractProviderReason,
  isValidPushSubscription,
  normalizeApiError,
  readBearerOrToken,
  readJsonBody,
  readPushEnv,
  sanitizeNotificationPayload
} from '../src/utils/pushApiUtils.js'
import { resolveAccessFailureStatus, verifyAccessRequestStrict } from '../src/utils/accessControlServer.js'

function clampTtl(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 300
  return Math.max(60, Math.min(86400, Math.floor(n)))
}

function isEndpointPermanentlyRemoved(error, normalizedMessage = '', providerReason = '', subscription = null) {
  const endpoint = String(error?.endpoint || subscription?.endpoint || '').trim()
  const text = `${normalizedMessage} ${providerReason} ${endpoint}`.toLowerCase()
  if (!text) return false
  if (text.includes('permanently-removed.invalid')) return true
  if (text.includes('enotfound') && text.includes('invalid')) return true
  return false
}

export default async function handler(req, res) {
  applyCors(res, {
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  })

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const access = await verifyAccessRequestStrict(req)
  if (!access.ok) {
    return res.status(resolveAccessFailureStatus(access.reason)).json({ ok: false, error: access.reason })
  }

  const env = readPushEnv()
  if (!env.enabled) {
    return res.status(503).json({ ok: false, error: 'push_not_configured' })
  }

  if (env.authToken) {
    const incomingToken = readBearerOrToken(req)
    if (!incomingToken || incomingToken !== env.authToken) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
  }

  const body = readJsonBody(req)
  const subscription = body.subscription
  if (!isValidPushSubscription(subscription)) {
    return res.status(400).json({ ok: false, error: 'invalid_subscription' })
  }

  const notification = sanitizeNotificationPayload(body.notification || {})
  const payloadText = JSON.stringify(notification)
  const ttl = clampTtl(body.ttl)
  const urgencyRaw = String(body.urgency || 'normal').toLowerCase()
  const urgency = ['very-low', 'low', 'normal', 'high'].includes(urgencyRaw) ? urgencyRaw : 'normal'

  try {
    webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey)
    await webpush.sendNotification(subscription, payloadText, {
      TTL: ttl,
      urgency
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 502
    const providerReason = extractProviderReason(error)
    const normalizedMessage = normalizeApiError(error)
    const expired = (
      statusCode === 404 ||
      statusCode === 410 ||
      isEndpointPermanentlyRemoved(error, normalizedMessage, providerReason, subscription)
    )
    const safeStatus = expired ? 410 : (statusCode >= 400 && statusCode < 600 ? statusCode : 502)
    return res.status(safeStatus).json({
      ok: false,
      error: expired ? 'subscription_expired' : 'push_send_failed',
      message: normalizedMessage,
      providerReason,
      statusCode: safeStatus,
      expired
    })
  }
}
