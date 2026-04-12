// Vercel serverless proxy — forwards requests to external APIs to bypass CORS.
// GET/POST /api/proxy
// Header: x-target-url — the actual API endpoint to call
// All other headers (Authorization, Content-Type, etc.) are forwarded as-is.

import { resolveAccessFailureStatus, verifyAccessRequestStrict } from '../src/utils/accessControlServer.js'

const DEFAULT_ALLOWED_HOSTS = [
  'api.minimax.io',
  'api-uw.minimax.io',
  'api.minimaxi.com',
  'api-bj.minimaxi.com',
  'api.mortis.edu.kg'
]
const DEFAULT_ALLOWED_HOST_SUFFIXES = ['.minimax.io', '.minimaxi.com']

function readEnvAllowlist() {
  return String(process.env.API_PROXY_ALLOWED_HOSTS || '')
    .split(/[,\s]+/)
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean)
}

const ENV_ALLOWLIST = readEnvAllowlist()
const ALLOWED_HOSTS = new Set(DEFAULT_ALLOWED_HOSTS)
const ALLOWED_HOST_SUFFIXES = [...DEFAULT_ALLOWED_HOST_SUFFIXES]

ENV_ALLOWLIST.forEach((entry) => {
  if (entry.startsWith('*.')) {
    ALLOWED_HOST_SUFFIXES.push('.' + entry.slice(2))
    return
  }
  if (entry.startsWith('.')) {
    ALLOWED_HOST_SUFFIXES.push(entry)
    return
  }
  ALLOWED_HOSTS.add(entry)
})

function isAllowedHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return false
  if (ALLOWED_HOSTS.has(host)) return true
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

function isAllowedUrl(url) {
  try {
    const u = new URL(url)
    const protocol = String(u.protocol || '').toLowerCase()
    if (protocol !== 'https:' && protocol !== 'http:') return false
    return isAllowedHost(u.hostname)
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const access = await verifyAccessRequestStrict(req)
  if (!access.ok) {
    return res.status(resolveAccessFailureStatus(access.reason)).json({ error: access.reason })
  }

  const targetUrl = req.headers['x-target-url']
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing x-target-url header' })
  }

  if (!isAllowedUrl(targetUrl)) {
    return res.status(403).json({ error: 'Target host not in allowlist', host: String(targetUrl) })
  }

  // Forward headers (skip hop-by-hop and internal ones)
  const skipHeaders = new Set([
    'host', 'connection', 'x-target-url', 'x-forwarded-for',
    'x-forwarded-host', 'x-forwarded-proto', 'x-vercel-id',
    'x-real-ip', 'transfer-encoding', 'content-length',
    'origin', 'referer'
  ])

  const forwardHeaders = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (!skipHeaders.has(key.toLowerCase())) {
      forwardHeaders[key] = value
    }
  }

  try {
    const method = req.method === 'GET' ? 'GET' : 'POST'
    const fetchOptions = {
      method,
      headers: forwardHeaders
    }
    if (method === 'POST') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const upstream = await fetch(targetUrl, {
      ...fetchOptions
    })

    // Forward status and response headers
    res.status(upstream.status)

    const passthroughHeaders = ['content-type', 'x-request-id', 'trace-id']
    const cacheControl = upstream.headers.get('cache-control')
    if (cacheControl) res.setHeader('cache-control', cacheControl)
    for (const h of passthroughHeaders) {
      const v = upstream.headers.get(h)
      if (v) res.setHeader(h, v)
    }

    if (!upstream.body?.getReader) {
      const buffer = Buffer.from(await upstream.arrayBuffer())
      return res.send(buffer)
    }

    const reader = upstream.body.getReader()
    res.flushHeaders?.()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.length === 0) continue
      res.write(Buffer.from(value))
      res.flush?.()
    }

    res.end()
    return
  } catch (err) {
    return res.status(502).json({
      error: 'Proxy request failed',
      message: err instanceof Error ? err.message : String(err)
    })
  }
}
