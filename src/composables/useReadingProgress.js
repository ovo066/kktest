/**
 * useReadingProgress — manages reading progress and book content storage.
 * Book content is stored in separate IndexedDB keys to avoid bloating the main app data.
 */
import { idbDelete, idbGet, idbSet } from './storage/idbKv'

function bookContentKey(bookId) {
  return `reader_book_${bookId}`
}

/**
 * Save book chapters to IndexedDB (separate from main app data).
 */
export async function saveBookContent(bookId, chapters) {
  await idbSet(bookContentKey(bookId), chapters)
}

/**
 * Load book chapters from IndexedDB.
 */
export async function loadBookContent(bookId) {
  return await idbGet(bookContentKey(bookId)) || null
}

/**
 * Delete book content from IndexedDB.
 */
export async function deleteBookContent(bookId) {
  await idbDelete(bookContentKey(bookId))
}

export function useReadingProgress() {
  return {
    saveBookContent,
    loadBookContent,
    deleteBookContent
  }
}
