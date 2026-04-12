import { ref } from 'vue'

export function useChatReaderIntegration({
  closePlusMenu,
  deleteBookContent,
  parseFile,
  readerStore,
  saveBookContent,
  scheduleSave,
  showConfirm,
  showToast,
  store
}) {
  const readerFileInput = ref(null)

  function openReaderBookshelf() {
    closePlusMenu()
    readerStore.openBookshelf()
  }

  async function handleReaderFileInput(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    let importedBookId = null
    try {
      showToast('正在解析...')
      const result = await parseFile(file)
      if (!result.chapters || result.chapters.length === 0) {
        showToast('未能解析出内容')
        return
      }

      // Save metadata to store
      const bookId = readerStore.addBook({
        title: result.title,
        author: result.author,
        cover: result.cover,
        format: result.format,
        chapterCount: result.chapters.length,
        chapterTitles: result.chapters.map(c => c.title),
        totalChars: result.chapters.reduce((sum, c) => sum + (c.content?.length || 0), 0)
      })
      importedBookId = bookId

      // Save content to IndexedDB
      await saveBookContent(bookId, result.chapters)
      scheduleSave()
      showToast(`《${result.title}》导入成功`)

      // Open in reader
      openBookInReader(bookId)
    } catch (err) {
      if (importedBookId) {
        // Keep metadata/content consistent: if content save fails, rollback the metadata entry.
        readerStore.removeBook(importedBookId)
        scheduleSave()
      }
      console.error('Failed to parse book:', err)
      showToast('解析失败: ' + (err.message || '未知错误'))
    }
  }

  function openBookInReader(bookId) {
    readerStore.openReader(bookId, 'window', store.activeChat?.id || null)
    scheduleSave()
  }

  async function handleDeleteBook(bookId) {
    const book = readerStore.books.find(b => b.id === bookId)
    const title = book?.title || '此书'
    const ok = await showConfirm({
      title: '删除书籍',
      message: `确定删除《${title}》吗？`,
      confirmText: '删除',
      confirmColor: '#FF3B30'
    })
    if (!ok) return

    readerStore.removeBook(bookId)
    try {
      await deleteBookContent(bookId)
    } catch (err) {
      console.warn('Failed to delete reader book content from IndexedDB:', err)
    }
    scheduleSave()
    showToast('已删除')
  }

  return {
    handleDeleteBook,
    handleReaderFileInput,
    openBookInReader,
    openReaderBookshelf,
    readerFileInput
  }
}
