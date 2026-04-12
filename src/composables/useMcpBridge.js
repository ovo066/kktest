import { adaptMcpToolResult, adaptMcpToolsToOpenAI } from './api/tools/mcpToolAdapter'
import { isLocalBrowserHostname } from './api/openaiCompat'
import { normalizeMcpServerIds } from '../utils/mcpServers'
import { useMcpDirectConnect } from './useMcpDirectConnect'

const DISCOVERY_CACHE_TTL_MS = 15000
const STATUS_CACHE_TTL_MS = 5000
const MAX_CACHED_DISCOVERIES = 12
const BRIDGE_FETCH_ERROR_RE = /failed to fetch|load failed|networkerror/i

function trimString(value) {
  return String(value || '').trim()
}

function getBrowserLocation(locationLike = null) {
  if (locationLike && typeof locationLike === 'object') return locationLike
  if (typeof window !== 'undefined' && window?.location) return window.location
  return null
}

function getLocationProtocol(locationLike = null) {
  const currentLocation = getBrowserLocation(locationLike)
  const raw = trimString(currentLocation?.protocol)
  if (raw) return raw.toLowerCase()

  try {
    return trimString(new URL(trimString(currentLocation?.origin)).protocol).toLowerCase()
  } catch {
    return ''
  }
}

export function resolveMcpBridgeTargetUrl(bridgeUrl, path = '/', locationLike = null) {
  const rawBridgeUrl = trimString(bridgeUrl)
  if (!rawBridgeUrl) return ''

  const normalizedPath = trimString(path).replace(/^\/+/, '')
  const currentLocation = getBrowserLocation(locationLike)

  try {
    const baseUrl = currentLocation
      ? new URL(rawBridgeUrl, currentLocation.origin)
      : new URL(rawBridgeUrl)
    const baseHref = baseUrl.toString().endsWith('/') ? baseUrl.toString() : `${baseUrl.toString()}/`
    return new URL(normalizedPath, baseHref).toString()
  } catch {
    return ''
  }
}

export function canProxyMcpBridgeTarget(targetUrl, locationLike = null) {
  const currentLocation = getBrowserLocation(locationLike)
  if (!currentLocation || isLocalBrowserHostname(currentLocation.hostname)) return false

  try {
    const resolvedTarget = new URL(trimString(targetUrl), currentLocation.origin)
    const protocol = trimString(resolvedTarget.protocol).toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') return false
    return resolvedTarget.origin !== currentLocation.origin
  } catch {
    return false
  }
}

export function shouldForceMcpBridgeProxy(targetUrl, locationLike = null) {
  if (!canProxyMcpBridgeTarget(targetUrl, locationLike)) return false

  const currentProtocol = getLocationProtocol(locationLike)
  if (currentProtocol !== 'https:') return false

  try {
    const currentLocation = getBrowserLocation(locationLike)
    const resolvedTarget = new URL(trimString(targetUrl), currentLocation?.origin)
    return trimString(resolvedTarget.protocol).toLowerCase() === 'http:'
  } catch {
    return false
  }
}

function isRetriableBridgeFetchError(error) {
  return BRIDGE_FETCH_ERROR_RE.test(trimString(error?.message || error))
}

function describeMcpBridgeError(error, { bridgeUrl = '', targetUrl = '', path = '', locationLike = null } = {}) {
  const message = trimString(error?.message || error)
  if (!message) return 'Unknown MCP bridge error'

  const sourceUrl = trimString(targetUrl) || resolveMcpBridgeTargetUrl(bridgeUrl, path, locationLike) || trimString(bridgeUrl)
  const currentLocation = getBrowserLocation(locationLike)

  if (/target host not in allowlist/i.test(message)) {
    try {
      const host = trimString(new URL(sourceUrl, currentLocation?.origin).host)
      if (host) {
        return `桥接主机 ${host} 未加入 API_PROXY_ALLOWED_HOSTS`
      }
    } catch {
      // ignore invalid URL details
    }
    return '桥接主机未加入 API_PROXY_ALLOWED_HOSTS'
  }

  if (/bridge request failed: 404/i.test(message) && trimString(path) === '/status') {
    return '桥接地址无效，未找到 /status。这里应填写 MCP 桥接服务地址，不是 MCP 服务器 URL。'
  }

  if (isRetriableBridgeFetchError(message)) {
    if (shouldForceMcpBridgeProxy(sourceUrl, locationLike)) {
      return '当前页面运行在 HTTPS/PWA，浏览器不能直接连接 HTTP 桥接地址。请改用 HTTPS 桥接地址，或在部署环境加入 API_PROXY_ALLOWED_HOSTS。'
    }

    if (canProxyMcpBridgeTarget(sourceUrl, locationLike)) {
      return '桥接请求失败，可能是跨域限制、代理未放行或目标服务不可达。请检查桥接地址，并确认 API_PROXY_ALLOWED_HOSTS 已包含该主机。'
    }
  }

  return message
}

function normalizeArgs(value) {
  return Array.isArray(value)
    ? value.map((item) => trimString(item)).filter(Boolean)
    : []
}

function normalizeEnv(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [trimString(key), trimString(item)])
      .filter(([key]) => !!key)
  )
}

function normalizeMcpServer(server) {
  if (!server || typeof server !== 'object' || Array.isArray(server)) return null

  const id = trimString(server.id)
  const name = trimString(server.name) || id
  const transport = trimString(server.transport).toLowerCase() || (trimString(server.url) ? 'http' : 'stdio')
  const enabled = server.enabled !== false
  const command = trimString(server.command)
  const url = trimString(server.url)
  const args = normalizeArgs(server.args)
  const env = normalizeEnv(server.env)

  if (!id || !name) return null
  if (transport === 'http') {
    if (!url) return null
  } else if (!command) {
    return null
  }

  return {
    id,
    name,
    transport,
    enabled,
    command,
    args,
    env,
    url
  }
}

function createEmptyDiscovery() {
  return {
    tools: [],
    externalExecutors: new Map()
  }
}

function cloneDiscovery(discovery) {
  return {
    tools: Array.isArray(discovery?.tools) ? [...discovery.tools] : [],
    externalExecutors: discovery?.externalExecutors instanceof Map
      ? new Map(discovery.externalExecutors)
      : new Map()
  }
}

function createEmptyBridgeStatus() {
  return {
    reachable: false,
    bridgeName: '',
    serverCount: 0,
    connectedCount: 0,
    toolsCount: 0,
    servers: [],
    lastError: '',
    updatedAt: 0
  }
}

function cloneBridgeStatus(status) {
  return {
    reachable: !!status?.reachable,
    bridgeName: trimString(status?.bridgeName),
    serverCount: Math.max(0, Number(status?.serverCount || 0) || 0),
    connectedCount: Math.max(0, Number(status?.connectedCount || 0) || 0),
    toolsCount: Math.max(0, Number(status?.toolsCount || 0) || 0),
    servers: Array.isArray(status?.servers)
      ? status.servers.map((server) => ({ ...server }))
      : [],
    lastError: trimString(status?.lastError),
    updatedAt: Math.max(0, Number(status?.updatedAt || 0) || 0)
  }
}

function buildStatusPayload(payload, toolsCount = 0, lastError = '') {
  return {
    reachable: true,
    bridgeName: trimString(payload?.name) || 'aichat-mcp-bridge',
    serverCount: Math.max(0, Number(payload?.serverCount || 0) || 0),
    connectedCount: Math.max(0, Number(payload?.connectedCount || 0) || 0),
    toolsCount: Math.max(0, Number(toolsCount || 0) || 0),
    servers: Array.isArray(payload?.servers)
      ? payload.servers.map((server) => ({ ...server }))
      : [],
    lastError: trimString(lastError),
    updatedAt: Date.now()
  }
}

export function useMcpBridge({ settingsStore, showToast } = {}) {
  const cachedDiscoveries = new Map()
  let lastSyncedKey = ''
  let lastSyncedAt = 0
  let lastErrorKey = ''
  let cachedStatusKey = ''
  let cachedStatusAt = 0
  let cachedStatus = createEmptyBridgeStatus()

  const directConnect = useMcpDirectConnect({ settingsStore, showToast })

  function getBridgeUrl() {
    return trimString(settingsStore?.toolCallingConfig?.mcpBridgeUrl)
  }

  function isBridgeEnabled() {
    return !!(settingsStore?.allowToolCalling && settingsStore?.toolCallingConfig?.mcpBridgeEnabled)
  }

  function getEnabledServers(serverIds) {
    const servers = Array.isArray(settingsStore?.toolCallingConfig?.mcpServers)
      ? settingsStore.toolCallingConfig.mcpServers
      : []

    const normalizedServers = servers
      .map((server) => normalizeMcpServer(server))
      .filter((server) => server && server.enabled)

    const selectedIds = normalizeMcpServerIds(serverIds)
    if (selectedIds.length === 0) return normalizedServers

    const selectedIdSet = new Set(selectedIds)
    return normalizedServers.filter((server) => selectedIdSet.has(server.id))
  }

  function buildCacheKey(bridgeUrl, enabledServers, selectedServerIds = []) {
    return JSON.stringify({
      bridgeUrl,
      enabledServers,
      selectedServerIds
    })
  }

  async function requestBridge(path, options = {}) {
    const bridgeUrl = getBridgeUrl()
    if (!bridgeUrl) throw new Error('MCP bridge URL is empty')

    const targetUrl = resolveMcpBridgeTargetUrl(bridgeUrl, path, options.locationLike)
    if (!targetUrl) {
      throw new Error('Invalid MCP bridge URL')
    }

    const init = {
      method: options.method || 'GET',
      headers: {},
      body: undefined
    }

    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    const fetchBridge = (proxied = false) => fetch(
      proxied ? '/api/proxy' : targetUrl,
      {
        ...init,
        headers: proxied
          ? {
              ...init.headers,
              'x-target-url': targetUrl
            }
          : init.headers
      }
    )

    let res
    try {
      if (shouldForceMcpBridgeProxy(targetUrl, options.locationLike)) {
        res = await fetchBridge(true)
      } else {
        try {
          res = await fetchBridge(false)
        } catch (error) {
          if (!canProxyMcpBridgeTarget(targetUrl, options.locationLike) || !isRetriableBridgeFetchError(error)) {
            throw error
          }
          res = await fetchBridge(true)
        }
      }
    } catch (error) {
      throw new Error(describeMcpBridgeError(error, {
        bridgeUrl,
        targetUrl,
        path,
        locationLike: options.locationLike
      }))
    }

    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }

    if (!res.ok || payload?.ok === false) {
      throw new Error(describeMcpBridgeError(
        payload?.error || `Bridge request failed: ${res.status}`,
        {
          bridgeUrl,
          targetUrl,
          path,
          locationLike: options.locationLike
        }
      ))
    }

    return payload
  }

  async function syncBridgeServers(enabledServers) {
    const serverPayload = await requestBridge('/servers')
    const activeServers = Array.isArray(serverPayload?.servers) ? serverPayload.servers : []
    const desiredIds = new Set(enabledServers.map((server) => server.id))

    for (const server of enabledServers) {
      await requestBridge('/servers/add', {
        method: 'POST',
        body: server
      })
    }

    for (const server of activeServers) {
      if (!desiredIds.has(server.id)) {
        await requestBridge('/servers/remove', {
          method: 'POST',
          body: { id: server.id }
        })
      }
    }
  }

  async function ensureBridgeServersSynced(enabledServers, { force = false } = {}) {
    const bridgeUrl = getBridgeUrl()
    const syncKey = buildCacheKey(bridgeUrl, enabledServers)
    if (!force && lastSyncedKey === syncKey && (Date.now() - lastSyncedAt) < DISCOVERY_CACHE_TTL_MS) {
      return
    }

    await syncBridgeServers(enabledServers)
    lastSyncedKey = syncKey
    lastSyncedAt = Date.now()
  }

  function rememberError(error) {
    const errorKey = trimString(error?.message || error)
    if (!errorKey || errorKey === lastErrorKey) return
    lastErrorKey = errorKey
    if (typeof showToast === 'function') {
      showToast(`MCP 桥接不可用：${errorKey}`, 2800)
    }
  }

  function pruneDiscoveryCache() {
    if (cachedDiscoveries.size <= MAX_CACHED_DISCOVERIES) return
    const oldestKey = [...cachedDiscoveries.entries()]
      .sort((a, b) => (a[1]?.at || 0) - (b[1]?.at || 0))[0]?.[0]
    if (oldestKey) {
      cachedDiscoveries.delete(oldestKey)
    }
  }

  async function discoverMcpTools({ force = false, serverIds } = {}) {
    const bridgeEnabled = isBridgeEnabled()
    const bridgeUrl = getBridgeUrl()
    const enabledServers = getEnabledServers()
    const selectedServerIds = normalizeMcpServerIds(serverIds)

    // Run bridge discovery and direct-connect discovery in parallel
    const [bridgeDiscovery, directDiscovery] = await Promise.all([
      // Bridge mode
      (async () => {
        if (!bridgeEnabled || !bridgeUrl || enabledServers.length === 0) {
          return createEmptyDiscovery()
        }

        if (selectedServerIds.length > 0) {
          const selectedIdSet = new Set(selectedServerIds)
          const hasMatchingServer = enabledServers.some((server) => selectedIdSet.has(server.id))
          if (!hasMatchingServer) return createEmptyDiscovery()
        }

        const cacheKey = buildCacheKey(bridgeUrl, enabledServers, selectedServerIds)
        const cachedEntry = cachedDiscoveries.get(cacheKey)
        if (!force && cachedEntry && (Date.now() - cachedEntry.at) < DISCOVERY_CACHE_TTL_MS) {
          return cloneDiscovery(cachedEntry.discovery)
        }

        try {
          await ensureBridgeServersSynced(enabledServers, { force })

          const toolsPayload = await requestBridge('/tools')
          const selectedIdSet = selectedServerIds.length > 0 ? new Set(selectedServerIds) : null
          const bridgeTools = Array.isArray(toolsPayload?.tools) ? toolsPayload.tools : []
          const adaptedTools = adaptMcpToolsToOpenAI(
            selectedIdSet
              ? bridgeTools.filter((tool) => selectedIdSet.has(trimString(tool?.serverId)))
              : bridgeTools
          )
          const executors = new Map()

          adaptedTools.forEach((tool) => {
            executors.set(tool.name, {
              execute: async (args = {}) => {
                const payload = await requestBridge('/call', {
                  method: 'POST',
                  body: {
                    server: tool.serverId,
                    tool: tool.originalName,
                    arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {}
                  }
                })
                return adaptMcpToolResult(payload?.result)
              },
              meta: {
                source: 'mcp',
                serverId: tool.serverId,
                serverName: tool.serverName,
                originalName: tool.originalName,
                displayName: tool.originalName
              }
            })
          })

          const discovery = {
            tools: adaptedTools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            })),
            externalExecutors: executors
          }

          cachedDiscoveries.set(cacheKey, { at: Date.now(), discovery })
          pruneDiscoveryCache()
          lastErrorKey = ''

          return cloneDiscovery(discovery)
        } catch (error) {
          console.warn('[MCPBridge] discovery failed:', error?.message || error)
          rememberError(error)
          return createEmptyDiscovery()
        }
      })(),

      // Direct-connect mode
      directConnect.discoverDirectTools({ force, serverIds: selectedServerIds })
    ])

    // Merge results: combine tools and executors from both sources
    const mergedTools = [...bridgeDiscovery.tools, ...directDiscovery.tools]
    const mergedExecutors = new Map([
      ...bridgeDiscovery.externalExecutors,
      ...directDiscovery.externalExecutors
    ])

    return {
      tools: mergedTools,
      externalExecutors: mergedExecutors
    }
  }

  async function getBridgeStatus({ force = false } = {}) {
    const bridgeUrl = getBridgeUrl()
    if (!bridgeUrl) {
      return createEmptyBridgeStatus()
    }

    const enabledServers = getEnabledServers()
    const shouldSync = isBridgeEnabled() && enabledServers.length > 0
    const cacheKey = buildCacheKey(bridgeUrl, enabledServers, [shouldSync ? 'enabled' : 'status-only'])
    if (!force && cachedStatusKey === cacheKey && (Date.now() - cachedStatusAt) < STATUS_CACHE_TTL_MS) {
      return cloneBridgeStatus(cachedStatus)
    }

    try {
      if (shouldSync) {
        await ensureBridgeServersSynced(enabledServers, { force })
      }

      const statusPayload = await requestBridge('/status')
      let toolsCount = 0
      let toolsError = ''

      if (shouldSync) {
        try {
          const toolsPayload = await requestBridge('/tools')
          toolsCount = Array.isArray(toolsPayload?.tools) ? toolsPayload.tools.length : 0
        } catch (error) {
          toolsError = trimString(error?.message || error)
        }
      }

      cachedStatus = buildStatusPayload(statusPayload, toolsCount, toolsError)
      cachedStatusKey = cacheKey
      cachedStatusAt = Date.now()
      if (!toolsError) {
        lastErrorKey = ''
      }

      return cloneBridgeStatus(cachedStatus)
    } catch (error) {
      console.warn('[MCPBridge] status failed:', error?.message || error)
      rememberError(error)
      return {
        ...createEmptyBridgeStatus(),
        lastError: trimString(error?.message || error),
        updatedAt: Date.now()
      }
    }
  }

  async function refreshMcpTools(options = {}) {
    return discoverMcpTools({
      ...options,
      force: true
    })
  }

  return {
    discoverMcpTools,
    getBridgeStatus,
    refreshMcpTools,
    getDirectServers: () => directConnect.getDirectServers(),
    testDirectServer: (serverId) => directConnect.testDirectServer(serverId),
    refreshDirectTools: (options) => directConnect.refreshDirectTools(options)
  }
}
