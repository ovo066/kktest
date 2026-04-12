/**
 * Memory Manager — periodically reviews and refines the core memory pool.
 * Deduplicates, merges related entries, compresses verbose ones, and adjusts priorities.
 */

import { useConfigsStore } from '../../stores/configs'
import { applyOptionalMaxTokens } from '../api/chatCompletions'
import { makeId } from '../../utils/id'
import { estimateTokens } from '../../utils/tokens'
import {
  initContactMemory,
  isValidMemoryCategory,
  isValidMemoryPriority,
  normalizeMemoryContent,
  pickPreferredMemoryDuplicate,
  tryParseJsonObject
} from './shared'

// Module-level lock to prevent concurrent runs
let runningContactId = null

/**
 * Get the API config for the memory manager.
 * Falls back to summaryConfigId, then contact's configId, then default.
 */
function getManagerConfig(contact) {
  const configsStore = useConfigsStore()
  const settings = contact?.memorySettings || {}

  // First try memoryManagerConfigId
  if (settings.memoryManagerConfigId) {
    const cfg = configsStore.configs.find(c => c.id === settings.memoryManagerConfigId)
    if (cfg) return cfg
  }

  // Fall back to summaryConfigId
  if (settings.summaryConfigId) {
    const cfg = configsStore.configs.find(c => c.id === settings.summaryConfigId)
    if (cfg) return cfg
  }

  // Fall back to contact's configId or default
  if (contact?.configId) {
    const cfg = configsStore.configs.find(c => c.id === contact.configId)
    if (cfg) return cfg
  }

  return configsStore.getConfig
}

/**
 * Run the memory manager for a contact.
 * @param {Object} contact - the contact object
 * @param {Function} scheduleSave - persistence save scheduler
 * @param {Object} options
 * @param {boolean} options.force - bypass cooldown check (manual run)
 * @returns {Object} { success, merged, deleted, updated }
 */
export async function runMemoryManager(contact, scheduleSave, options = {}) {
  if (!contact?.memory?.core) {
    return { success: false, error: '无记忆数据' }
  }

  initContactMemory(contact)

  const contactId = contact.id || 'active'

  // Prevent concurrent runs
  if (runningContactId === contactId) {
    return { success: false, error: '记忆管家正在运行中' }
  }

  const force = !!options.force

  // Cooldown check (default 10 minutes)
  const lastRunAt = contact.memory.lastManagerRunAt || 0
  const settings = contact.memorySettings || {}
  const intervalMs = (settings.memoryManagerInterval || 10) * 60 * 1000
  if (!force && Date.now() - lastRunAt < intervalMs && lastRunAt > 0) {
    return { success: false, error: '冷却中：距上次运行间隔太短' }
  }

  let manageableMemories = contact.memory.core.filter(m => m && m.content)

  // Fast local dedup before calling the LLM (prevents prompt bloat + repeated memories).
  const toDeleteExact = new Set()
  const byNorm = new Map()
  for (const mem of manageableMemories) {
    const key = normalizeMemoryContent(mem.content).toLowerCase()
    if (!key) continue
    const existing = byNorm.get(key)
    if (!existing) {
      byNorm.set(key, mem)
      continue
    }
    const keep = pickPreferredMemoryDuplicate(existing, mem)
    const drop = keep === existing ? mem : existing
    byNorm.set(key, keep)
    if (drop?.id) toDeleteExact.add(drop.id)
  }

  let preDeletedCount = 0
  if (toDeleteExact.size > 0) {
    preDeletedCount = toDeleteExact.size
    contact.memory.core = (contact.memory.core || []).filter(m => !toDeleteExact.has(m?.id))
    manageableMemories = contact.memory.core.filter(m => m && m.content)
    if (scheduleSave) scheduleSave()
  }

  if (manageableMemories.length < 5) {
    if (preDeletedCount > 0) {
      contact.memory.lastManagerRunAt = Date.now()
      if (scheduleSave) scheduleSave()
      return { success: true, merged: 0, deleted: preDeletedCount, updated: 0 }
    }
    return { success: false, error: '核心记忆不足5条，无需整理' }
  }

  const currentTokenEstimate = manageableMemories.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0)
  const targetCount = Math.max(8, Math.min(16, Math.ceil(manageableMemories.length * 0.7)))
  const targetTokens = Math.max(420, Math.min(900, Math.ceil(currentTokenEstimate * 0.68)))

  const cfg = getManagerConfig(contact)
  if (!cfg?.key || !cfg?.url) {
    return { success: false, error: '未配置API' }
  }

  runningContactId = contactId

  try {
    // Build the memory list for the prompt
    const memoryList = manageableMemories.map((m, i) => {
      const priority = m.priority || 'normal'
      const source = m.source || 'manual'
      const category = m.category || ''
      const inject = m.enabled ? 'on' : 'off'
      const catStr = category ? `, 类别:${category}` : ''
      return `[${i}] ${m.content} (优先级:${priority}, 来源:${source}, 注入:${inject}${catStr})`
    }).join('\n')

    const prompt = [
      '你是"记忆管家"，负责把核心记忆整理成“连贯、沉浸、低token成本”的长期记忆池。',
      '用 {{user}} 指代用户，用 {{char}} 指代AI角色。禁止输出任何JSON以外的内容。',
      '',
      `当前规模：${manageableMemories.length} 条，估算 ${currentTokenEstimate} token`,
      `优化目标：尽量收敛到 <= ${targetCount} 条，注入成本尽量 <= ${targetTokens} token`,
      '',
      '当前记忆：',
      memoryList,
      '',
      '整理策略（按优先级执行）：',
      '1) 连贯性优先：必须保留能维持角色扮演连续性的状态信息：关系走向、情绪基线、稳定偏好、关键事实。',
      '2) 重复项强收敛：同义或高度重叠条目只保留1条“规范表述”，其余必须进入 merge 或 delete。',
      '3) 先合并再删除：重复/近义/可并列的条目优先 merge，避免碎片化；过时、矛盾、低信息密度条目应 delete。',
      '4) 极致压缩：content 使用短句，单条尽量 <= 28 汉字（或 <= 64 英文字符），不写解释、不写推理。',
      '5) 原子化：一条记忆只表达一个稳定事实或状态，不混合多个主题。',
      '6) 时效性处理：一次性请求、短期安排、会话噪音、寒暄内容优先 delete；仅在有复用价值时才 low + enabled:false。',
      '7) 冲突处理：若记忆冲突，保留更新且更稳定的版本，旧版本进入 delete。',
      '8) 注入开关：仅对“对当前对话决策有帮助”的条目 enabled:true，其余尽量 false 以节省 token。',
      '9) 分类与优先级：category ∈ preference/relationship/emotion/fact；priority ∈ high/normal/low。',
      '10) 风格约束：保持叙事沉浸，不出现“系统/提示词/模型/指令”等元话术。',
      '',
      '输出严格 JSON（不要Markdown、不要注释）：',
      '{"keep":[{"index":0,"content":"优化后内容","priority":"normal","category":"fact","enabled":true}],"delete":[1],"merge":[{"indices":[2,5],"content":"合并后内容","priority":"normal","category":"preference","enabled":true}]}',
      '没有要改的就输出：{"keep":[],"delete":[],"merge":[]}'
    ].join('\n')

    let url = cfg.url.replace(/\/$/, '')
    if (!url.endsWith('/chat/completions')) url += '/chat/completions'

    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: '请开始整理。' }
      ],
      temperature: 0.2
    }
    applyOptionalMaxTokens(body, cfg.maxTokens)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || 'HTTP ' + res.status)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return { success: false, error: 'API 返回为空' }
    }

    const result = tryParseJsonObject(content)
    if (!result) {
      return { success: false, error: 'JSON 解析失败' }
    }

    let mergedCount = 0
    let deletedCount = preDeletedCount
    let updatedCount = 0

    // Process keeps (updates)
    if (Array.isArray(result.keep)) {
      for (const item of result.keep) {
        if (item == null || typeof item !== 'object') continue
        const idx = Number(item.index)
        if (!Number.isFinite(idx) || idx < 0 || idx >= manageableMemories.length) continue

        const mem = manageableMemories[idx]
        if (!mem) continue

        let changed = false
        if (item.content && typeof item.content === 'string' && item.content.trim() !== mem.content) {
          mem.content = item.content.trim()
          changed = true
        }
        if (item.priority && isValidMemoryPriority(item.priority) && item.priority !== mem.priority) {
          mem.priority = item.priority
          changed = true
        }
        if (item.category && isValidMemoryCategory(item.category)) {
          mem.category = item.category
          changed = true
        }
        if (typeof item.enabled === 'boolean' && item.enabled !== mem.enabled) {
          mem.enabled = item.enabled
          changed = true
        }
        if (changed) {
          mem.time = Date.now()
          updatedCount++
        }
      }
    }

    // Process deletes
    if (Array.isArray(result.delete)) {
      const toDelete = new Set()
      for (const idx of result.delete) {
        const i = Number(idx)
        if (!Number.isFinite(i) || i < 0 || i >= manageableMemories.length) continue

        const mem = manageableMemories[i]
        if (!mem) continue

        // Don't delete high priority memories
        if (mem.priority === 'high') continue

        toDelete.add(mem.id)
      }

      if (toDelete.size > 0) {
        contact.memory.core = contact.memory.core.filter(m => !toDelete.has(m.id))
        deletedCount += toDelete.size
      }
    }

    // Process merges
    if (Array.isArray(result.merge)) {
      for (const mergeItem of result.merge) {
        if (!mergeItem || !Array.isArray(mergeItem.indices) || !mergeItem.content) continue
        if (mergeItem.indices.length < 2) continue

        const validIndices = [...new Set(
          mergeItem.indices
            .map(Number)
            .filter(i => Number.isFinite(i) && i >= 0 && i < manageableMemories.length)
        )]

        if (validIndices.length < 2) continue

        // Only merge entries that still exist after keep/delete processing.
        const activeById = new Map((contact.memory.core || []).map(m => [m?.id, m]))
        const sourceMemories = []
        const sourceIds = new Set()
        for (const idx of validIndices) {
          const base = manageableMemories[idx]
          const live = base?.id ? activeById.get(base.id) : null
          if (!live || !live.id || sourceIds.has(live.id)) continue
          sourceIds.add(live.id)
          sourceMemories.push(live)
        }

        // Require at least 2 distinct live memories, otherwise skip to avoid net growth.
        if (sourceMemories.length < 2) continue

        const mergedContent = String(mergeItem.content).trim()
        const normalizedMerged = normalizeMemoryContent(mergedContent)
        if (!normalizedMerged) continue

        const existingSame = (contact.memory.core || []).find(m => {
          if (!m?.id || sourceIds.has(m.id)) return false
          return normalizeMemoryContent(m.content) === normalizedMerged
        })

        // Prefer reusing an existing identical memory rather than creating a new duplicate.
        if (existingSame) {
          if (typeof mergeItem.enabled === 'boolean') existingSame.enabled = mergeItem.enabled
          if (mergeItem.priority && isValidMemoryPriority(mergeItem.priority)) existingSame.priority = mergeItem.priority
          if (mergeItem.category && isValidMemoryCategory(mergeItem.category)) existingSame.category = mergeItem.category
          existingSame.source = existingSame.source || 'manager'
          existingSame.time = Date.now()

          contact.memory.core = contact.memory.core.filter(m => !sourceIds.has(m.id))
          mergedCount++
          updatedCount++
          continue
        }

        // Create merged entry
        const newMem = {
          id: makeId('mem'),
          content: mergedContent,
          time: Date.now(),
          source: 'manager',
          enabled: typeof mergeItem.enabled === 'boolean' ? mergeItem.enabled : true,
          priority: mergeItem.priority && isValidMemoryPriority(mergeItem.priority)
            ? mergeItem.priority
            : 'normal',
          category: mergeItem.category && isValidMemoryCategory(mergeItem.category)
            ? mergeItem.category
            : null
        }

        // Remove old entries and add merged one
        contact.memory.core = contact.memory.core.filter(m => !sourceIds.has(m.id))
        contact.memory.core.push(newMem)
        mergedCount++
      }
    }

    contact.memory.lastManagerRunAt = Date.now()
    if (scheduleSave) scheduleSave()

    return {
      success: true,
      merged: mergedCount,
      deleted: deletedCount,
      updated: updatedCount
    }
  } catch (e) {
    return { success: false, error: e.message }
  } finally {
    runningContactId = null
  }
}
