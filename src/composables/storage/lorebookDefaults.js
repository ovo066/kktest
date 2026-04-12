import {
  createChatFormatPresetBook,
  createImageGenerationPresetBook,
  isLegacyChatFormatTemplate,
  isLegacyImageGenerationTemplate,
  PRESET_CHAT_FORMAT_BOOK_ID,
  PRESET_CHAT_FORMAT_KEY,
  PRESET_IMAGE_GEN_BOOK_ID,
  PRESET_IMAGE_GEN_KEY
} from '../../utils/presetPromptBooks'

function upgradeChatFormatPresetBook(book) {
  if (!book || typeof book !== 'object') return book
  const entries = Array.isArray(book.entries) ? book.entries : []
  if (entries.length === 0) return createChatFormatPresetBook()
  const defaultEntry = createChatFormatPresetBook().entries[0]
  const nextEntries = entries.map(entry => {
    if (!entry || typeof entry !== 'object') return entry
    if (entry.id !== 'preset_entry_chat_format_v1') return entry
    const currentContent = typeof entry.content === 'string' ? entry.content.trim() : ''
    const shouldUpgradeLegacyContent = isLegacyChatFormatTemplate(currentContent)
    return {
      ...entry,
      content: (!currentContent || shouldUpgradeLegacyContent) ? defaultEntry.content : currentContent,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
      insertDepth: Number.isFinite(entry.insertDepth) ? entry.insertDepth : 0,
      alwaysActive: entry.alwaysActive !== false,
      enabled: entry.enabled !== false,
      order: Number.isFinite(entry.order) ? entry.order : 0,
      updatedAt: Date.now()
    }
  })
  return {
    ...book,
    entries: nextEntries,
    updatedAt: Date.now()
  }
}

function upgradeImageGenerationPresetBook(book) {
  if (!book || typeof book !== 'object') return book
  const entries = Array.isArray(book.entries) ? book.entries : []
  if (entries.length === 0) return createImageGenerationPresetBook()
  const defaultEntry = createImageGenerationPresetBook().entries[0]
  const nextEntries = entries.map(entry => {
    if (!entry || typeof entry !== 'object') return entry
    if (entry.id !== 'preset_entry_image_generation_v1') return entry
    const currentContent = typeof entry.content === 'string' ? entry.content.trim() : ''
    const shouldUpgradeLegacyContent = isLegacyImageGenerationTemplate(currentContent)
    return {
      ...entry,
      content: (!currentContent || shouldUpgradeLegacyContent) ? defaultEntry.content : currentContent,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
      insertDepth: Number.isFinite(entry.insertDepth) ? entry.insertDepth : 0,
      alwaysActive: entry.alwaysActive !== false,
      enabled: entry.enabled !== false,
      order: Number.isFinite(entry.order) ? entry.order : 0,
      updatedAt: Date.now()
    }
  })
  return {
    ...book,
    entries: nextEntries,
    updatedAt: Date.now()
  }
}

export function ensureLorebookDefaults(books) {
  const list = Array.isArray(books) ? books : []
  let hasChatFormatPreset = false
  let hasImageGenerationPreset = false
  const nextList = list.map(book => {
    if (book && (book.presetKey === PRESET_CHAT_FORMAT_KEY || book.id === PRESET_CHAT_FORMAT_BOOK_ID)) {
      hasChatFormatPreset = true
      return upgradeChatFormatPresetBook(book)
    }
    if (book && (book.presetKey === PRESET_IMAGE_GEN_KEY || book.id === PRESET_IMAGE_GEN_BOOK_ID)) {
      hasImageGenerationPreset = true
      return upgradeImageGenerationPresetBook(book)
    }
    return book
  })
  if (!hasChatFormatPreset) {
    nextList.push(createChatFormatPresetBook())
  }
  if (!hasImageGenerationPreset) {
    nextList.push(createImageGenerationPresetBook())
  }
  return nextList
}
