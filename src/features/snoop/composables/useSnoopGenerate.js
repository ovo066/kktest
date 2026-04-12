import { getTemplateVars, applyTemplateVars } from '../../../composables/api/prompts'
import {
  buildSnoopRolePrompt,
  createSnoopError,
  createSnoopPromptContext,
  getResolvedSnoopConfig,
  normalizeSnoopApiError,
  requestSnoopChatCompletion
} from '../../../composables/snoop/shared'

const CATEGORY_PROMPTS = {
  browser: {
    label: '浏览器历史和搜索记录',
    userPrompt: `现在请你模拟{{char}}手机里的浏览器历史和搜索记录。
根据{{char}}的性格、身份、爱好、最近的对话内容，生成10-15条浏览记录和3-5条搜索记录。
其中应有1-2条比较隐私或意想不到的内容（不需要太夸张）。

请严格以JSON数组输出，不要加任何其他文字：
[{"type":"history"或"search","title":"网页/搜索标题","url":"简短URL","time":"x小时前/昨天/x天前"}]`
  },
  notes: {
    label: '备忘录/便签',
    userPrompt: `现在请你模拟{{char}}手机里的备忘录/便签内容。
生成5-8条，包括：待办事项、随手想法、购物清单、日记片段、密码备忘等。
其中应有1-2条比较私密或有趣的内容。

请严格以JSON数组输出，不要加任何其他文字：
[{"title":"标题","content":"正文内容（可以多行）","time":"日期","pinned":true或false}]`
  },
  chats: {
    label: '和朋友的聊天记录',
    userPrompt: `现在请你模拟{{char}}手机里和朋友的聊天记录。
生成2-3段和不同朋友的对话。每段对话5-8条消息。
朋友的名字和关系由你根据{{char}}的身份设定。聊天中可能提到{{user}}。

请严格以JSON数组输出，不要加任何其他文字：
[{"friend":"朋友名","relationship":"关系简述","msgs":[{"from":"friend"或"self","content":"消息内容","time":"时间"}]}]`
  },
  album: {
    label: '相册',
    userPrompt: `现在请你模拟{{char}}手机相册里最近的8-12张照片。
用文字描述每张照片的内容（自拍、风景、食物、截图、合照等）。
其中可能有1-2张比较有故事或有趣的照片。

请严格以JSON数组输出，不要加任何其他文字：
[{"desc":"照片内容描述","time":"日期","tag":"自拍"或"风景"或"美食"或"截图"或"合照"或"其他"}]`
  },
  forum: {
    label: '论坛/社交平台发言',
    userPrompt: `现在请你模拟{{char}}在各种网络论坛/社交平台上的发言历史。
生成6-10条，包括发帖和回帖，涉及不同话题和平台。
内容要符合{{char}}的性格、兴趣和说话风格。

请严格以JSON数组输出，不要加任何其他文字：
[{"platform":"平台名","type":"post"或"reply","title":"帖子标题","content":"{{char}}的发言内容","time":"日期","likes":数字}]`
  }
}

function stripMarkdownCodeFence(text) {
  const raw = String(text || '').trim()
  const match = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match?.[1]?.trim() || raw
}

function parseJsonValue(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function extractArrayFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const preferredKeys = ['items', 'data', 'list', 'results', 'records', 'history', 'notes', 'chats', 'messages', 'photos', 'posts']
  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) return value[key]
    if (value[key] && typeof value[key] === 'object' && Array.isArray(value[key].items)) return value[key].items
  }

  const arrayValues = Object.values(value).filter(Array.isArray)
  if (arrayValues.length === 1) return arrayValues[0]
  return null
}

function sanitizeBrowserItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      type: item.type === 'search' ? 'search' : 'history',
      title: String(item.title || item.content || item.name || '').trim(),
      url: String(item.url || item.link || '').trim(),
      time: String(item.time || item.date || '').trim()
    }))
}

function sanitizeNoteItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      title: String(item.title || item.name || '').trim(),
      content: String(item.content || item.text || item.body || '').trim(),
      time: String(item.time || item.date || '').trim(),
      pinned: item.pinned === true
    }))
}

function sanitizeChatItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      friend: String(item.friend || item.name || item.contact || '联系人').trim(),
      relationship: String(item.relationship || item.remark || '').trim(),
      msgs: Array.isArray(item.msgs || item.messages)
        ? (item.msgs || item.messages)
          .filter(msg => msg && typeof msg === 'object')
          .map(msg => ({
            from: msg.from === 'self' ? 'self' : 'friend',
            content: String(msg.content || msg.text || '').trim(),
            time: String(msg.time || msg.date || '').trim()
          }))
        : []
    }))
}

function sanitizeAlbumItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      desc: String(item.desc || item.description || item.content || '').trim(),
      time: String(item.time || item.date || '').trim(),
      tag: String(item.tag || item.type || '其他').trim() || '其他'
    }))
}

function sanitizeForumItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      platform: String(item.platform || item.app || '').trim(),
      type: item.type === 'reply' ? 'reply' : 'post',
      title: String(item.title || '').trim(),
      content: String(item.content || item.text || '').trim(),
      time: String(item.time || item.date || '').trim(),
      likes: Number.isFinite(Number(item.likes)) ? Number(item.likes) : 0
    }))
}

function normalizeCategoryItems(category, items) {
  if (!Array.isArray(items)) return null
  if (category === 'browser') return sanitizeBrowserItems(items)
  if (category === 'notes') return sanitizeNoteItems(items)
  if (category === 'chats') return sanitizeChatItems(items)
  if (category === 'album') return sanitizeAlbumItems(items)
  if (category === 'forum') return sanitizeForumItems(items)
  return items
}

function extractJsonArray(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const candidates = [
    raw,
    stripMarkdownCodeFence(raw)
  ]

  const arrayMatch = raw.match(/\[[\s\S]*\]/)
  if (arrayMatch?.[0]) candidates.push(arrayMatch[0])

  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch?.[0]) candidates.push(objectMatch[0])

  for (const candidate of candidates) {
    const parsed = parseJsonValue(candidate)
    if (Array.isArray(parsed)) return parsed
    const extracted = extractArrayFromObject(parsed)
    if (Array.isArray(extracted)) return extracted
  }

  return null
}

/**
 * Generate phone content for a specific category
 */
export async function generateSnoopContent(contact, category) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const categoryDef = CATEGORY_PROMPTS[category]
  if (!categoryDef) throw new Error('未知分类: ' + category)

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你现在需要模拟你手机中${categoryDef.label}的内容。请根据你的性格、身份、爱好、日常生活和最近的对话内容来生成真实可信的内容。`)

  const systemPrompt = systemParts.join('\n\n')
  const userPrompt = applyTemplateVars(categoryDef.userPrompt, vars)

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsedItems = extractJsonArray(raw)
  const items = normalizeCategoryItems(category, parsedItems)

  if (!items || !Array.isArray(items)) {
    throw createSnoopError('AI 返回格式错误', `${categoryDef.label}没有按要求返回 JSON 数组`)
  }

  return items
}
