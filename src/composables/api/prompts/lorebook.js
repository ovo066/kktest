import { isReservedPromptPresetBook } from '../../../utils/presetPromptBooks'
import { applyTemplateVars } from './templateVars'

function getActiveLorebookEntries(store) {
  if (!store.activeChat) return []

  const recentMessages = store.activeChat.msgs.slice(-10).map(m => m.content).join(' ')
  const activeEntries = []
  const activeBookIds = new Set()
  const presetBookIds = new Set(
    (Array.isArray(store.lorebook?.books) ? store.lorebook.books : [])
      .filter(isReservedPromptPresetBook)
      .map(b => b.id)
  )

  if (Array.isArray(store.activeChat.boundLorebooks)) {
    store.activeChat.boundLorebooks.forEach(bookId => {
      if (!presetBookIds.has(bookId)) {
        activeBookIds.add(bookId)
      }
    })
  }

  activeBookIds.forEach(bookId => {
    const book = store.lorebook.books.find(b => b.id === bookId)
    if (!book || !book.entries) return
    if (isReservedPromptPresetBook(book)) return

    book.entries.forEach(entry => {
      if (!entry.enabled) return

      const keywords = Array.isArray(entry.keywords) ? entry.keywords : []

      if (entry.alwaysActive) {
        activeEntries.push(entry)
        return
      }

      if (keywords.length > 0) {
        const hasMatch = keywords.some(keyword =>
          recentMessages.toLowerCase().includes(keyword.toLowerCase())
        )
        if (hasMatch) {
          activeEntries.push(entry)
        }
      }
    })
  })

  return activeEntries.sort((a, b) => {
    const depthA = Number.isFinite(a?.insertDepth) ? a.insertDepth : 0
    const depthB = Number.isFinite(b?.insertDepth) ? b.insertDepth : 0
    if (depthA !== depthB) return depthA - depthB
    const orderA = Number.isFinite(a?.order) ? a.order : 0
    const orderB = Number.isFinite(b?.order) ? b.order : 0
    return orderA - orderB
  })
}

export function insertLorebookEntries(store, messages, templateVars = {}) {
  const activeEntries = getActiveLorebookEntries(store)
  if (activeEntries.length === 0) return messages

  const result = [...messages]
  const systemIndex = result.findIndex(m => m.role === 'system')

  activeEntries.forEach(entry => {
    let insertIndex
    if (entry.insertDepth === 0) {
      insertIndex = systemIndex + 1
    } else if (entry.insertDepth < 0) {
      insertIndex = result.length + entry.insertDepth + 1
    } else {
      insertIndex = systemIndex + 1 + entry.insertDepth
    }

    insertIndex = Math.max(systemIndex + 1, Math.min(insertIndex, result.length))
    result.splice(insertIndex, 0, {
      role: 'system',
      content: '<world_book name="' + entry.name + '">\n' + applyTemplateVars(entry.content, templateVars) + '\n</world_book>'
    })
  })

  return result
}
