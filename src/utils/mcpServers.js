function normalizeId(value) {
  return String(value || '').trim()
}

export function normalizeMcpServerIds(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const normalized = []

  value.forEach((item) => {
    const id = normalizeId(item)
    if (!id || seen.has(id)) return
    seen.add(id)
    normalized.push(id)
  })

  return normalized
}

export function describeMcpServerSelection(serverIds, servers, options = {}) {
  const ids = normalizeMcpServerIds(serverIds)
  const fallbackLabel = options.emptyLabel || '全部已启用服务器'
  if (ids.length === 0) return fallbackLabel

  const serverMap = new Map(
    (Array.isArray(servers) ? servers : [])
      .map((server) => [normalizeId(server?.id), normalizeId(server?.name) || normalizeId(server?.id)])
      .filter(([id]) => !!id)
  )

  const names = ids.map((id) => serverMap.get(id) || id)
  return names.join('、') || fallbackLabel
}

export function resolveDirectMcpServerIds(contact) {
  const ids = normalizeMcpServerIds(contact?.mcpServerIds)
  return ids.length > 0 ? ids : undefined
}

export function resolveGroupMultiMcpServerIds(group, member) {
  const memberIds = normalizeMcpServerIds(member?.mcpServerIds)
  if (memberIds.length > 0) return memberIds

  const groupIds = normalizeMcpServerIds(group?.mcpServerIds)
  return groupIds.length > 0 ? groupIds : undefined
}

export function resolveGroupSingleMcpServerIds(group) {
  const mergedIds = new Set(normalizeMcpServerIds(group?.mcpServerIds))
  let hasExplicitSelection = mergedIds.size > 0

  ;(Array.isArray(group?.members) ? group.members : []).forEach((member) => {
    const memberIds = normalizeMcpServerIds(member?.mcpServerIds)
    if (memberIds.length === 0) return
    hasExplicitSelection = true
    memberIds.forEach((id) => mergedIds.add(id))
  })

  return hasExplicitSelection ? [...mergedIds] : undefined
}
