import { estimateTokens, trimToMaxTokens } from '../../utils/tokens'
import {
  CATEGORY_LABELS,
  DEFAULT_MEMORY_SETTINGS,
  getNewTextMessages,
  initContactMemory,
  PRIORITY_ORDER,
  renderMemoryText
} from './shared'

function getDefaultRecentSummaries(memory) {
  const result = []
  const recentLong = (memory.longTerm || []).filter(s => s && s.content && s.status !== 'failed').slice(-1)
  result.push(...recentLong)
  const recentShort = (memory.shortTerm || []).filter(s => s && !s.merged && s.content && s.status !== 'failed').slice(-2)
  result.push(...recentShort)
  return result
}

// 检查是否需要自动总结
export function checkAutoSummaryTrigger(contact) {
  const settings = contact?.memorySettings
  if (!settings?.enabled || !settings?.autoSummary) return false

  initContactMemory(contact)
  const newTextMsgs = getNewTextMessages(contact, null)

  return newTextMsgs.length >= settings.summaryFrequency
}

// 构建摘要索引（AM编码 + 一行概要）
export function buildSummaryIndex(contact, deps = {}) {
  const { store } = deps
  if (!contact?.memory) return ''
  const render = (text) => renderMemoryText(text, contact, store)

  const allSummaries = [
    ...(contact.memory.longTerm || []),
    ...(contact.memory.shortTerm || [])
  ].filter(s => s && s.amCode && s.content && s.status !== 'failed' && !s.merged)
   .sort((a, b) => (a.time || 0) - (b.time || 0))

  if (!allSummaries.length) return ''

  const lines = allSummaries.map(s => {
    const text = render(s.content).trim()
    // Truncate to ~40 chars for index line
    const preview = text.length > 40 ? text.slice(0, 40).trimEnd() + '...' : text
    return `${s.amCode}: ${preview}`
  })

  return lines.join('\n')
}

// 构建记忆注入提示词（结构化分类输出，使用 {{char}}/{{user}} 模板变量）
export function buildMemoryPrompt(contact, deps = {}) {
  const { store } = deps
  if (!contact) return ''
  initContactMemory(contact)

  const memory = contact.memory
  const settings = contact.memorySettings || DEFAULT_MEMORY_SETTINGS
  if (!settings.enabled || !memory) return ''

  const maxTokens = settings.maxInjectTokens || DEFAULT_MEMORY_SETTINGS.maxInjectTokens
  const parts = []
  const render = (text) => renderMemoryText(text, contact, store)

  const coreMemories = (memory.core || []).filter(m => m && m.enabled && m.content)
  if (coreMemories.length) {
    const sorted = coreMemories
      .slice()
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))

    const important = sorted.filter(m => m.priority !== 'low')
    const low = sorted.filter(m => m.priority === 'low')

    // Group by category for structured output
    const categorized = {}
    const uncategorized = []
    for (const m of (important.length ? important : low)) {
      const cat = m.category
      const rendered = render(m.content).trim()
      if (!rendered) continue
      if (cat && CATEGORY_LABELS[cat]) {
        if (!categorized[cat]) categorized[cat] = []
        categorized[cat].push(rendered)
      } else {
        uncategorized.push(rendered)
      }
    }

    const coreLines = []
    // Output categorized memories grouped by label
    for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
      if (categorized[cat]?.length) {
        coreLines.push(label + ': ' + categorized[cat].join('、'))
      }
    }
    // Append uncategorized as bullet list
    for (const c of uncategorized) {
      coreLines.push('- ' + c)
    }

    if (coreLines.length) {
      parts.push('以下是你对这个人的了解，自然融入对话即可：\n' + coreLines.join('\n'))
    }

    // Summary index (compact AM-coded overview) + recent detailed summaries
    const summaryIndex = buildSummaryIndex(contact, deps)
    if (summaryIndex) {
      parts.push('[记忆摘要索引]\n' + summaryIndex)
    }

    const detailedSummaries = getDefaultRecentSummaries(memory)
    const summaryParts = detailedSummaries.map(m => {
      const prefix = m.amCode ? `${m.amCode}: ` : ''
      return prefix + render(m.content)
    }).filter(Boolean)
    if (summaryParts.length) {
      parts.push('[之前聊过的]\n' + summaryParts.join('\n'))
    }

    // Try to append low-priority lines if budget allows (only when important memories exist)
    if (important.length > 0 && low.length > 0) {
      for (const m of low) {
        const rendered = render(m.content).trim()
        if (!rendered) continue
        const line = '- ' + rendered
        const nextParts = parts.slice()
        const idx = nextParts.findIndex(p => p.startsWith('以下是你对这个人的了解'))
        if (idx === -1) break
        nextParts[idx] = nextParts[idx] + '\n' + line
        const renderedPrompt = nextParts.join('\n\n')
        if (estimateTokens(renderedPrompt) <= maxTokens) {
          parts[idx] = nextParts[idx]
        } else {
          break
        }
      }
    }

    return trimToMaxTokens(parts.join('\n\n'), maxTokens)
  }

  // No core memories; fallback to summaries only (if any).
  const summaryIndex = buildSummaryIndex(contact, deps)
  if (summaryIndex) {
    parts.push('[记忆摘要索引]\n' + summaryIndex)
  }

  const detailedSummaries = getDefaultRecentSummaries(memory)
  const summaryParts = detailedSummaries.map(m => {
    const prefix = m.amCode ? `${m.amCode}: ` : ''
    return prefix + render(m.content)
  }).filter(Boolean)
  if (summaryParts.length) {
    parts.push('[概要]\n' + summaryParts.join('\n'))
  }

  return trimToMaxTokens(parts.join('\n\n'), maxTokens)
}
