import { useConfigsStore } from '../../stores/configs'
import { useContactsStore } from '../../stores/contacts'
import { usePersonasStore } from '../../stores/personas'
import { getTemplateVars, applyTemplateVars } from '../api/prompts'
import { buildMemoryPrompt } from '../memory/injection'
import { applyOptionalMaxTokens } from '../api/chatCompletions'
import { fetchOpenAICompat, readOpenAICompatError } from '../api/openaiCompat'

export function getResolvedSnoopConfig(contact) {
  const configsStore = useConfigsStore()
  return configsStore.configs?.find(c => c.id === contact.configId) || configsStore.getConfig || null
}

export function createSnoopError(prefix, detail = '') {
  const message = String(detail || '').trim()
  return new Error(message ? `${prefix}：${message}` : prefix)
}

export function isLikelySnoopNetworkError(error) {
  const text = String(error?.message || error || '')
  return /Failed to fetch|NetworkError|fetch failed|Load failed|timeout|timed out|ECONN|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|ERR_CONNECTION/i.test(text)
}

export function normalizeSnoopApiError(error) {
  const raw = String(error?.message || error || '').trim()
  if (!raw) return createSnoopError('API 请求失败')
  if (/^未配置\s*API/.test(raw)) return new Error('未配置 API：请先在角色配置里填写接口地址和密钥')
  if (/^API (连接失败|返回错误|请求失败|返回格式错误|超时)/.test(raw)) return new Error(raw)
  if (isLikelySnoopNetworkError(raw)) return createSnoopError('API 连接失败', '请检查接口地址、网络或代理设置')
  return createSnoopError('API 请求失败', raw)
}

export function createSnoopPromptContext(contact) {
  const contactsStore = useContactsStore()
  const personasStore = usePersonasStore()

  return {
    get activeChat() {
      return contact || contactsStore.activeChat
    },
    getPersonaForContact(contactId) {
      return personasStore.getPersonaForContact(contactId)
    }
  }
}

export function buildSnoopContextSummary(contact, vars) {
  const msgs = contact.msgs || []
  const recent = msgs.slice(-20)
  if (!recent.length) return ''

  return recent
    .filter(m => typeof m?.content === 'string' && m.content.trim())
    .map(m => {
      const speaker = m.role === 'user' ? vars.user : vars.char
      const text = m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content
      return `${speaker}: ${text}`
    })
    .join('\n')
}

export async function requestSnoopChatCompletion(cfg, systemPrompt, userPrompt, maxTokens = null) {
  let response = null
  try {
    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9
    }
    applyOptionalMaxTokens(body, cfg?.maxTokens, maxTokens)

    const result = await fetchOpenAICompat(cfg?.url, {
      apiKey: cfg?.key,
      body
    })
    response = result.response
  } catch (error) {
    if (isLikelySnoopNetworkError(error)) {
      throw createSnoopError('API 连接失败', '请检查接口地址、网络或代理设置')
    }
    throw normalizeSnoopApiError(error)
  }

  if (!response?.ok) {
    const detail = await readOpenAICompatError(response)
    throw createSnoopError('API 返回错误', detail || `HTTP ${response?.status || ''}`.trim())
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    throw createSnoopError('API 返回格式错误', '接口没有返回合法 JSON')
  }

  return data.choices?.[0]?.message?.content || ''
}

export function buildSnoopRolePrompt(contact) {
  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const characterPrompt = applyTemplateVars(contact.prompt || `你是${contact.name}。`, vars)
  const memoryPrompt = buildMemoryPrompt(contact, { store: promptStore })
  const contextSummary = buildSnoopContextSummary(contact, vars)

  const systemParts = [characterPrompt]
  if (memoryPrompt) {
    systemParts.push(`<memory>\n${memoryPrompt}\n</memory>`)
  }
  if (contextSummary) {
    systemParts.push(`<recent_context>\n以下是你和${vars.user}最近的对话摘要：\n${contextSummary}\n</recent_context>`)
  }

  return {
    vars,
    systemPrompt: systemParts.join('\n\n')
  }
}

export function inferSnoopConsentDecision(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  if (/\(\s*agree\s*\)/i.test(normalized)) return true
  if (/\(\s*refuse\s*\)/i.test(normalized)) return false

  const positivePattern = /(可以呀?|好呀|好啊|行呀|行啊|行吧|好吧|给你看|可以看|你看吧|随便看|没问题|当然可以|当然行)/i
  const negativePattern = /(不行|不可以|不给|不让|别看|不能看|不太方便|不方便|还是别|先不要|不愿意|拒绝|算了吧)/i

  const hasPositive = positivePattern.test(normalized)
  const hasNegative = negativePattern.test(normalized)

  if (hasPositive && !hasNegative) return true
  if (hasNegative && !hasPositive) return false
  return null
}
