import {
  DEFAULT_CHAT_FORMAT_TEMPLATE,
  DEFAULT_IMAGE_GENERATION_TEMPLATE,
  DEFAULT_IMAGE_GENERATION_TEMPLATE_NL,
  isPresetChatFormatBook,
  isPresetImageGenerationBook
} from '../../../utils/presetPromptBooks'
import { applyTemplateVars } from './templateVars'

function getPresetChatFormatTemplate(store) {
  if (!store || store.globalPresetLorebookEnabled === false) return ''

  const books = Array.isArray(store.lorebook?.books) ? store.lorebook.books : []
  const presetBook = books.find(isPresetChatFormatBook)
  if (!presetBook) return DEFAULT_CHAT_FORMAT_TEMPLATE

  const entries = Array.isArray(presetBook.entries) ? presetBook.entries : []
  const enabledEntries = entries.filter(entry => entry && entry.enabled !== false)
  if (enabledEntries.length === 0) return DEFAULT_CHAT_FORMAT_TEMPLATE

  const preferredEntry =
    enabledEntries.find(entry => entry.id === 'preset_entry_chat_format_v1') ||
    enabledEntries.find(entry => entry.alwaysActive) ||
    enabledEntries[0]

  const template = typeof preferredEntry?.content === 'string' ? preferredEntry.content.trim() : ''
  return template || DEFAULT_CHAT_FORMAT_TEMPLATE
}

function getPresetImageGenerationTemplate(store) {
  if (!store || !store.allowAIImageGeneration) return ''
  if (store.globalPresetLorebookEnabled === false) return ''

  const provider = String(store.vnImageGenConfig?.provider || '').trim().toLowerCase()
  const defaultTemplate = provider === 'nanobanana'
    ? DEFAULT_IMAGE_GENERATION_TEMPLATE_NL
    : DEFAULT_IMAGE_GENERATION_TEMPLATE

  const books = Array.isArray(store.lorebook?.books) ? store.lorebook.books : []
  const presetBook = books.find(isPresetImageGenerationBook)
  if (!presetBook) return defaultTemplate

  const entries = Array.isArray(presetBook.entries) ? presetBook.entries : []
  const enabledEntries = entries.filter(entry => entry && entry.enabled !== false)
  if (enabledEntries.length === 0) return defaultTemplate

  const preferredEntry =
    enabledEntries.find(entry => entry.id === 'preset_entry_image_generation_v1') ||
    enabledEntries.find(entry => entry.alwaysActive) ||
    enabledEntries[0]

  const template = typeof preferredEntry?.content === 'string' ? preferredEntry.content.trim() : ''
  return template || defaultTemplate
}

export function buildChatFormatSystemPrompt(store, templateVars = {}) {
  const template = getPresetChatFormatTemplate(store)
  if (!template) return ''
  const rendered = applyTemplateVars(template, templateVars)

  const lines = rendered.split(/\r?\n/)
  const filtered = lines.filter(line => !/时间戳|timestamp/i.test(line))
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 构建独立的生图行为指令（从可编辑预设读取）。
 * 应在 postParts 末尾注入，利用末尾高注意力位置确保格式遵从。
 */
export function buildImageGenerationPrompt(store) {
  const template = getPresetImageGenerationTemplate(store)
  if (!template) return ''
  return '<image_generation>\n' + template + '\n</image_generation>'
}
