import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { makeId } from '../utils/id'

// Transient quick-action state (not persisted)
function createQuickActionState() {
  return {
    visible: false,
    action: '',      // 'explain' | 'summarize' | 'translate'
    selectedText: '',
    result: '',
    loading: false
  }
}

export const useReaderStore = defineStore('reader', () => {
  const NO_BOOK_SESSION = '__no_book__'
  const NO_ROLE_SESSION = '__no_role__'
  const DEFAULT_SESSION_KEY = `${NO_BOOK_SESSION}::${NO_ROLE_SESSION}`

  function createChatState() {
    return {
      visible: false,
      messages: [],
      contextText: '',
      selectedText: ''
    }
  }

  function normalizeSessionPart(value, fallback) {
    const text = String(value ?? '').trim()
    return text ? encodeURIComponent(text) : fallback
  }

  function buildChatSessionKey(bookId, roleId) {
    return `${normalizeSessionPart(bookId, NO_BOOK_SESSION)}::${normalizeSessionPart(roleId, NO_ROLE_SESSION)}`
  }

  function normalizeChatMessage(msg, fallbackPrefix) {
    if (!msg || typeof msg !== 'object') return null
    const role = msg.role === 'assistant' ? 'assistant' : 'user'
    const content = typeof msg.content === 'string' ? msg.content : ''
    const time = Number(msg.time)
    return {
      id: typeof msg.id === 'string' ? msg.id : makeId(fallbackPrefix),
      role,
      content,
      time: Number.isFinite(time) ? time : Date.now()
    }
  }

  function normalizeChatState(raw, fallbackPrefix) {
    const state = createChatState()
    if (!raw || typeof raw !== 'object') return state
    state.visible = !!raw.visible
    state.contextText = typeof raw.contextText === 'string' ? raw.contextText : ''
    state.selectedText = typeof raw.selectedText === 'string' ? raw.selectedText : ''
    state.messages = Array.isArray(raw.messages)
      ? raw.messages
          .map(m => normalizeChatMessage(m, fallbackPrefix))
          .filter(Boolean)
      : []
    return state
  }

  function normalizeChatSessionMap(raw, fallbackPrefix) {
    if (!raw || typeof raw !== 'object') return {}
    const next = {}
    Object.entries(raw).forEach(([key, value]) => {
      if (!key || typeof key !== 'string') return
      next[key] = normalizeChatState(value, fallbackPrefix)
    })
    return next
  }

  function replaceSessionMap(target, nextMap) {
    Object.keys(target).forEach((key) => {
      delete target[key]
    })
    Object.entries(nextMap).forEach(([key, value]) => {
      target[key] = value
    })
  }

  function removeSessionsByBook(bookId) {
    const keyPrefix = `${normalizeSessionPart(bookId, NO_BOOK_SESSION)}::`
    Object.keys(aiChatSessions).forEach((key) => {
      if (key.startsWith(keyPrefix)) delete aiChatSessions[key]
    })
    Object.keys(selectionChatSessions).forEach((key) => {
      if (key.startsWith(keyPrefix)) delete selectionChatSessions[key]
    })
  }

  function ensureSession(map, key) {
    if (!map[key] || typeof map[key] !== 'object') {
      map[key] = createChatState()
    }
    return map[key]
  }

  // 书架
  const books = ref([])
  // 当前阅读的书 ID
  const activeBookId = ref(null)
  // 阅读器是否打开
  const readerOpen = ref(false)
  // 书架是否打开
  const bookshelfOpen = ref(false)
  // 阅读器展示模式：window / fullscreen
  const readerViewMode = ref('window')
  // 小窗尺寸
  const readerWindowSize = reactive({
    width: 420,
    height: 620
  })

  // 阅读设置
  const readerSettings = reactive({
    fontSize: 17,
    lineHeight: 1.8,
    theme: 'light',       // light / sepia / dark
    pageMode: 'scroll'    // scroll / paginate
  })

  // AI 伴读设置（持久化）
  const readerAISettings = reactive({
    shareMemory: true,           // 共享主聊天核心记忆
    shareChatHistoryCount: 0,    // 注入主聊天最近N条消息（0=不注入，需 shareMemory 开启）
    chatWindowMemoryKeepCount: 20, // 伴读窗口保留记忆条数（0=全部，不压缩删除）
    autoChapterSummary: true,    // 章节切换时自动生成摘要
    maxSummaryChapters: 5,       // 注入最近 N 章摘要
    translateTarget: 'auto',     // 翻译目标语言：auto / zh / en / ja
    quickActionConfigId: null,   // 快捷操作使用的 API（null=跟随角色/默认）
    customSystemPrompt: '',      // 仅用于一起读的自定义系统提示词（覆盖角色提示词段落）
    shareLorebook: false          // 共享主聊天绑定的世界书
  })

  // 会话分桶：按 书籍 + 角色 独立保存
  const currentChatSessionKey = ref(DEFAULT_SESSION_KEY)
  const aiChatSessions = reactive({
    [DEFAULT_SESSION_KEY]: createChatState()
  })
  const selectionChatSessions = reactive({
    [DEFAULT_SESSION_KEY]: createChatState()
  })

  const aiChat = computed(() => ensureSession(aiChatSessions, currentChatSessionKey.value))
  const selectionChat = computed(() => ensureSession(selectionChatSessions, currentChatSessionKey.value))

  // 当前阅读的书
  const activeBook = computed(() => {
    if (!activeBookId.value) return null
    return books.value.find(b => b.id === activeBookId.value) || null
  })

  // 添加书籍（metadata only，内容存 IndexedDB 单独 key）
  function addBook(bookMeta) {
    const id = makeId('book')
    const now = Date.now()
    const book = {
      id,
      title: bookMeta.title || '未知书名',
      author: bookMeta.author || '',
      cover: bookMeta.cover || null,
      format: bookMeta.format || 'txt',
      chapterCount: bookMeta.chapterCount || 0,
      chapterTitles: bookMeta.chapterTitles || [],
      totalChars: bookMeta.totalChars || 0,
      chapterSummaries: [],   // Array<{ chapterIndex, summary, generatedAt }>
      notes: [],              // Array<{ id, chapterIndex, selectedText, note, createdAt }>
      addedAt: now,
      lastReadAt: now,
      progress: {
        chapterIndex: 0,
        scrollPosition: 0,
        percentage: 0
      }
    }
    books.value.unshift(book)
    return id
  }

  function removeBook(bookId) {
    books.value = books.value.filter(b => b.id !== bookId)
    removeSessionsByBook(bookId)
    if (activeBookId.value === bookId) {
      activeBookId.value = null
      setChatSession(null, null)
    }
  }

  function updateProgress(bookId, progress) {
    const book = books.value.find(b => b.id === bookId)
    if (!book) return
    Object.assign(book.progress, progress)
    book.lastReadAt = Date.now()
  }

  function openReader(bookId, mode = readerViewMode.value, roleId = null) {
    activeBookId.value = bookId
    setReaderViewMode(mode)
    setChatSession(bookId, roleId)
    readerOpen.value = true
    bookshelfOpen.value = false
  }

  function closeReader() {
    const main = aiChat.value
    const selection = selectionChat.value
    readerOpen.value = false
    main.visible = false
    main.selectedText = ''
    main.contextText = ''
    selection.visible = false
    selection.selectedText = ''
    selection.contextText = ''
  }

  function openBookshelf() {
    bookshelfOpen.value = true
  }

  function closeBookshelf() {
    bookshelfOpen.value = false
  }

  function setReaderViewMode(mode) {
    readerViewMode.value = mode === 'fullscreen' ? 'fullscreen' : 'window'
  }

  function toggleReaderViewMode() {
    readerViewMode.value = readerViewMode.value === 'fullscreen' ? 'window' : 'fullscreen'
  }

  function setReaderWindowSize(size = {}) {
    const width = Number(size.width)
    const height = Number(size.height)
    if (Number.isFinite(width)) {
      readerWindowSize.width = Math.max(280, Math.min(980, Math.round(width)))
    }
    if (Number.isFinite(height)) {
      readerWindowSize.height = Math.max(360, Math.min(1200, Math.round(height)))
    }
  }

  function setChatSession(bookId = activeBookId.value, roleId = null) {
    currentChatSessionKey.value = buildChatSessionKey(bookId, roleId)
    ensureSession(aiChatSessions, currentChatSessionKey.value)
    ensureSession(selectionChatSessions, currentChatSessionKey.value)
  }

  // AI 共读对话（角色对话）
  function toggleAIChat() {
    aiChat.value.visible = !aiChat.value.visible
  }

  function sendAIChatMessage(role, content) {
    aiChat.value.messages.push({
      id: makeId('rmsg'),
      role,
      content,
      time: Date.now()
    })
  }

  function deleteAIChatMessage(msgId) {
    const msgs = aiChat.value.messages
    const idx = msgs.findIndex(m => m.id === msgId)
    if (idx !== -1) msgs.splice(idx, 1)
  }

  function editAIChatMessage(msgId, newContent) {
    const msg = aiChat.value.messages.find(m => m.id === msgId)
    if (msg) msg.content = newContent
  }

  function clearAIChat() {
    aiChat.value.messages = []
    aiChat.value.selectedText = ''
    aiChat.value.contextText = ''
  }

  function setSelectedText(text) {
    aiChat.value.selectedText = text
  }

  function setContextText(text) {
    aiChat.value.contextText = text
  }

  function setSelectionSelectedText(text) {
    selectionChat.value.selectedText = text || ''
  }

  function setSelectionContextText(text) {
    selectionChat.value.contextText = text || ''
  }

  // 选文胶囊对话
  function openSelectionChat(selectedText, contextText) {
    selectionChat.value.selectedText = selectedText || ''
    selectionChat.value.contextText = contextText || ''
    selectionChat.value.visible = true
  }

  function closeSelectionChat() {
    selectionChat.value.visible = false
  }

  function sendSelectionChatMessage(role, content) {
    selectionChat.value.messages.push({
      id: makeId('smsg'),
      role,
      content,
      time: Date.now()
    })
  }

  function deleteSelectionChatMessage(msgId) {
    const msgs = selectionChat.value.messages
    const idx = msgs.findIndex(m => m.id === msgId)
    if (idx !== -1) msgs.splice(idx, 1)
  }

  function editSelectionChatMessage(msgId, newContent) {
    const msg = selectionChat.value.messages.find(m => m.id === msgId)
    if (msg) msg.content = newContent
  }

  function clearSelectionChat() {
    selectionChat.value.messages = []
    selectionChat.value.selectedText = ''
    selectionChat.value.contextText = ''
    selectionChat.value.visible = false
  }

  // Transient quick-action state
  const quickAction = reactive(createQuickActionState())

  // Chapter summaries
  function addChapterSummary(bookId, chapterIndex, summary) {
    const book = books.value.find(b => b.id === bookId)
    if (!book) return
    if (!Array.isArray(book.chapterSummaries)) book.chapterSummaries = []
    const existing = book.chapterSummaries.find(s => s.chapterIndex === chapterIndex)
    if (existing) {
      existing.summary = summary
      existing.generatedAt = Date.now()
    } else {
      book.chapterSummaries.push({ chapterIndex, summary, generatedAt: Date.now() })
    }
  }

  function getChapterSummariesUpTo(bookId, chapterIndex) {
    const book = books.value.find(b => b.id === bookId)
    if (!book || !Array.isArray(book.chapterSummaries)) return []
    return book.chapterSummaries
      .filter(s => s.chapterIndex < chapterIndex)
      .sort((a, b) => a.chapterIndex - b.chapterIndex)
      .slice(-5)
  }

  // Notes
  function addNote(bookId, { chapterIndex, selectedText, note }) {
    const book = books.value.find(b => b.id === bookId)
    if (!book) return null
    if (!Array.isArray(book.notes)) book.notes = []
    const entry = {
      id: makeId('note'),
      chapterIndex,
      selectedText: selectedText || '',
      note: note || '',
      createdAt: Date.now()
    }
    book.notes.push(entry)
    return entry
  }

  function updateNote(bookId, noteId, updates) {
    const book = books.value.find(b => b.id === bookId)
    if (!book || !Array.isArray(book.notes)) return
    const n = book.notes.find(e => e.id === noteId)
    if (n) Object.assign(n, updates)
  }

  function deleteNote(bookId, noteId) {
    const book = books.value.find(b => b.id === bookId)
    if (!book || !Array.isArray(book.notes)) return
    book.notes = book.notes.filter(e => e.id !== noteId)
  }

  function exportReaderChatSessions() {
    return {
      currentSessionKey: currentChatSessionKey.value,
      aiSessions: JSON.parse(JSON.stringify(aiChatSessions)),
      selectionSessions: JSON.parse(JSON.stringify(selectionChatSessions))
    }
  }

  function importReaderChatSessions(aiSessions, selectionSessions, legacyAIChat = null, preferredSessionKey = '') {
    const normalizedAISessions = normalizeChatSessionMap(aiSessions, 'rmsg')
    const normalizedSelectionSessions = normalizeChatSessionMap(selectionSessions, 'smsg')

    if (Object.keys(normalizedAISessions).length === 0 && legacyAIChat && typeof legacyAIChat === 'object') {
      normalizedAISessions[DEFAULT_SESSION_KEY] = normalizeChatState(legacyAIChat, 'rmsg')
    }

    if (Object.keys(normalizedAISessions).length === 0) {
      normalizedAISessions[DEFAULT_SESSION_KEY] = createChatState()
    }
    if (Object.keys(normalizedSelectionSessions).length === 0) {
      normalizedSelectionSessions[DEFAULT_SESSION_KEY] = createChatState()
    }

    replaceSessionMap(aiChatSessions, normalizedAISessions)
    replaceSessionMap(selectionChatSessions, normalizedSelectionSessions)

    const preferredKey = typeof preferredSessionKey === 'string' ? preferredSessionKey : ''
    if (preferredKey && aiChatSessions[preferredKey]) {
      currentChatSessionKey.value = preferredKey
    } else if (!aiChatSessions[currentChatSessionKey.value]) {
      currentChatSessionKey.value = Object.keys(aiChatSessions)[0] || DEFAULT_SESSION_KEY
    }

    ensureSession(aiChatSessions, currentChatSessionKey.value)
    ensureSession(selectionChatSessions, currentChatSessionKey.value)
  }

  return {
    books,
    activeBookId,
    readerOpen,
    bookshelfOpen,
    readerViewMode,
    readerWindowSize,
    readerSettings,
    readerAISettings,
    aiChat,
    selectionChat,
    currentChatSessionKey,
    aiChatSessions,
    selectionChatSessions,
    activeBook,
    addBook,
    removeBook,
    updateProgress,
    openReader,
    closeReader,
    openBookshelf,
    closeBookshelf,
    setReaderViewMode,
    toggleReaderViewMode,
    setReaderWindowSize,
    setChatSession,
    toggleAIChat,
    sendAIChatMessage,
    deleteAIChatMessage,
    editAIChatMessage,
    clearAIChat,
    setSelectedText,
    setContextText,
    setSelectionSelectedText,
    setSelectionContextText,
    openSelectionChat,
    closeSelectionChat,
    sendSelectionChatMessage,
    deleteSelectionChatMessage,
    editSelectionChatMessage,
    clearSelectionChat,
    quickAction,
    addChapterSummary,
    getChapterSummariesUpTo,
    addNote,
    updateNote,
    deleteNote,
    exportReaderChatSessions,
    importReaderChatSessions
  }
})
