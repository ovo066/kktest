// Vercel serverless proxy — MCP 直连专用代理
// POST /api/mcp-proxy
// Header: x-mcp-url  — 目标 MCP server 的 HTTPS URL
// Header: x-mcp-headers — JSON 字符串，额外 headers（如 Authorization）
// Body: JSON-RPC 消息体
//
// 与 /api/proxy 的区别：不限制 host，只要求目标是 HTTPS。
// 用户填写自己的 MCP URL，本代理负责透明转发。

import { resolveAccessFailureStatus, verifyAccessRequestStrict } from '../src/utils/accessControlServer.js'

function isSafeTargetUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  if (!forwardedHost) return ''

  const protocol = forwardedProto || (forwardedHost.startsWith('localhost') || forwardedHost.startsWith('127.0.0.1')
    ? 'http'
    : 'https')
  return `${protocol}://${forwardedHost}`
}

function isAllowedBrowserOrigin(req) {
  const expectedOrigin = getRequestOrigin(req)
  if (!expectedOrigin) return false

  const origin = String(req.headers.origin || '').trim()
  if (origin) return origin === expectedOrigin

  const referer = String(req.headers.referer || '').trim()
  if (!referer) return false
  return referer === expectedOrigin || referer.startsWith(expectedOrigin + '/')
}

export default async function handler(req, res) {
  const requestOrigin = getRequestOrigin(req)
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-url, x-mcp-headers')

  if (req.method === 'OPTIONS') {
    if (!isAllowedBrowserOrigin(req)) {
      return res.status(403).json({ error: 'Origin not allowed' })
    }
    return res.status(204).end()
  }

  if (!isAllowedBrowserOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  const access = await verifyAccessRequestStrict(req)
  if (!access.ok) {
    return res.status(resolveAccessFailureStatus(access.reason)).json({ error: access.reason })
  }

  const targetUrl = String(req.headers['x-mcp-url'] || '').trim()
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing x-mcp-url header' })
  }

  if (!isSafeTargetUrl(targetUrl)) {
    return res.status(400).json({ error: 'x-mcp-url must be an HTTPS URL' })
  }

  // 解析用户自定义额外 headers（如 Authorization）
  let extraHeaders = {}
  const rawExtra = String(req.headers['x-mcp-headers'] || '').trim()
  if (rawExtra) {
    try {
      const parsed = JSON.parse(rawExtra)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        extraHeaders = parsed
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const forwardHeaders = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...extraHeaders
  }

  // 转发 Authorization（如果请求本身带了且 extraHeaders 没覆盖）
  if (req.headers['authorization'] && !extraHeaders['authorization'] && !extraHeaders['Authorization']) {
    forwardHeaders['authorization'] = req.headers['authorization']
  }

  try {
    const method = req.method === 'GET' ? 'GET' : 'POST'
    const fetchOptions = { method, headers: forwardHeaders }
    if (method === 'POST') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const upstream = await fetch(targetUrl, fetchOptions)

    res.status(upstream.status)
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    const cc = upstream.headers.get('cache-control')
    if (cc) res.setHeader('cache-control', cc)

    if (!upstream.body?.getReader) {
      const buffer = Buffer.from(await upstream.arrayBuffer())
      return res.send(buffer)
    }

    const reader = upstream.body.getReader()
    res.flushHeaders?.()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.length) res.write(Buffer.from(value))
      res.flush?.()
    }
    res.end()
  } catch (err) {
    return res.status(502).json({
      error: 'MCP proxy request failed',
      message: err instanceof Error ? err.message : String(err)
    })
  }
}
