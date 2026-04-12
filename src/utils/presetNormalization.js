export function clampNumber(value, fallback, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  const next = integer ? Math.round(num) : num
  return Math.min(max, Math.max(min, next))
}

export function parseOptionalInteger(value, { min = 1, max = 65535, clamp = false } = {}) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const intVal = Math.round(num)
  if (clamp) return Math.min(max, Math.max(min, intVal))
  if (intVal < min || intVal > max) return null
  return intVal
}

function normalizePromptRole(role) {
  const raw = String(role || '').trim().toLowerCase()
  return ['system', 'user', 'assistant'].includes(raw) ? raw : 'system'
}

export function normalizePromptEntries(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry, idx) => {
      if (!entry || typeof entry !== 'object') return null
      const content = typeof entry.content === 'string' ? entry.content.trim() : ''
      if (!content) return null
      const identifier = String(entry.identifier || entry.id || entry.name || `entry_${idx + 1}`).trim()
      return {
        id: String(entry.id || `entry_${idx + 1}`),
        identifier,
        name: String(entry.name || identifier || `条目 ${idx + 1}`),
        role: normalizePromptRole(entry.role),
        content,
        enabled: entry.enabled !== false,
        injectionDepth: clampNumber(
          entry.injectionDepth ?? entry.injection_depth ?? entry.depth,
          0,
          { min: -50, max: 50, integer: true }
        ),
        injectionPosition: String(entry.injectionPosition || entry.injection_position || entry.position || 'in_chat'),
        order: clampNumber(entry.order, idx, { min: -999, max: 999, integer: true })
      }
    })
    .filter(Boolean)
}
