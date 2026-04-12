import { makeId } from '../../utils/id'
import {
  CATEGORY_LABELS,
  DEFAULT_MEMORY_SETTINGS,
  escapeRegExp,
  initContactMemory,
  normalizeMemoryContent,
  PRIORITY_ORDER
} from './shared'

// 检查关键词触发
export function checkKeywordTrigger(content, contact) {
  const settings = contact?.memorySettings || DEFAULT_MEMORY_SETTINGS
  if (!settings.keywordTrigger || !settings.keywords?.length) return null
  if (typeof content !== 'string') return null

  const lowerContent = content.toLowerCase()
  for (const keyword of settings.keywords) {
    const kw = String(keyword || '').trim()
    if (!kw) continue
    if (!lowerContent.includes(kw.toLowerCase())) continue

    // 1) 关键词在行首：允许紧跟内容（兼容 “记住我喜欢猫” 这种写法），支持多行内容。
    const startRegex = new RegExp('^\\s*' + escapeRegExp(kw) + '(?:[：:,，]\\s*|\\s*)?([\\s\\S]+)$', 'i')
    const startMatch = content.match(startRegex)
    if (startMatch && startMatch[1]?.trim()) return startMatch[1].trim()

    // 2) 关键词在句中：要求至少有一个分隔符（标点或空格），避免 “我记得你...” 误触发。
    const midRegex = new RegExp(escapeRegExp(kw) + '(?:[：:,，]\\s*|\\s+)([\\s\\S]+)$', 'i')
    const midMatch = content.match(midRegex)
    if (midMatch && midMatch[1]?.trim()) return midMatch[1].trim()
  }
  return null
}

// 添加核心记忆（自动去重：同内容只更新时间/优先级）
export function addCoreMemory(contact, content, source = 'manual', extra = {}) {
  initContactMemory(contact)

  const normalized = normalizeMemoryContent(content)
  if (!normalized) return null

  const existing = contact.memory.core.find(m => normalizeMemoryContent(m?.content) === normalized)
  if (existing) {
    existing.content = String(content || '').trim()
    existing.time = Date.now()

    const forceEnableSource = source === 'manual' || source === 'keyword' || source === 'manager'
    const canDisableExisting = (existing.source === 'extracted' || !existing.source) && existing.enabled !== true
    if (forceEnableSource) {
      existing.enabled = true
    } else if (source === 'extracted') {
      if (extra && typeof extra === 'object' && typeof extra.enabled === 'boolean') {
        if (extra.enabled) {
          existing.enabled = true
        } else if (canDisableExisting) {
          existing.enabled = false
        }
      }
    } else if (typeof existing.enabled !== 'boolean') {
      existing.enabled = true
    }

    if (source === 'manual') existing.source = 'manual'
    else if (source === 'manager') existing.source = 'manager'
    else if (!existing.source) existing.source = source

    if (extra && typeof extra === 'object') {
      if (extra.priority && PRIORITY_ORDER[extra.priority] != null) {
        const cur = PRIORITY_ORDER[existing.priority] ?? 1
        const next = PRIORITY_ORDER[extra.priority] ?? 1
        if (next < cur) existing.priority = extra.priority
      }
      if (extra.category && CATEGORY_LABELS[extra.category]) {
        existing.category = extra.category
      }
    }

    return existing
  }

  const memory = {
    id: makeId('mem'),
    content: String(content || '').trim(),
    time: Date.now(),
    source,
    enabled: source !== 'extracted',
    priority: 'normal',
    category: null
  }

  if (extra && typeof extra === 'object') {
    if (extra.priority && PRIORITY_ORDER[extra.priority] != null) memory.priority = extra.priority
    if (extra.category && CATEGORY_LABELS[extra.category]) memory.category = extra.category
    if (typeof extra.enabled === 'boolean') memory.enabled = extra.enabled
  }

  contact.memory.core.push(memory)
  return memory
}

// 更新核心记忆
export function updateCoreMemory(contact, memoryId, updates) {
  const mem = contact?.memory?.core?.find(m => m.id === memoryId)
  if (mem) {
    Object.assign(mem, updates, { time: Date.now() })
  }
  return mem
}

// 删除核心记忆
export function deleteCoreMemory(contact, memoryId) {
  if (!contact?.memory?.core) return
  contact.memory.core = contact.memory.core.filter(m => m.id !== memoryId)
}
