<template>
  <Transition name="fade-slide">
    <div v-if="visible" :class="wrapperClass">
      <div :class="panelClass" :style="panelStyle">
        <!-- Top Navigation Bar -->
        <Transition name="reader-chrome-top">
          <header v-show="showReaderChrome" :class="headerClass">
          <button @click="handleBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors">
            <i class="ph ph-caret-left text-[20px] text-[var(--text-primary)]"></i>
          </button>

          <div class="flex-1 flex flex-col items-center justify-center gap-0.5 sm:gap-1 overflow-hidden px-3 sm:px-4 cursor-pointer" @click="tocVisible = true">
            <h1 class="text-[13px] sm:text-[14px] leading-tight font-semibold text-[var(--text-primary)] truncate max-w-[62vw] sm:max-w-[320px]">{{ activeBook?.title }}</h1>
            <div class="flex items-center gap-1 text-[10px] leading-tight text-[var(--text-secondary)]">
              <span class="truncate max-w-[56vw] sm:max-w-[280px]">{{ currentChapter?.title }}</span>
              <i class="ph ph-caret-down text-[9px]"></i>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              class="w-9 h-9 flex items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
              :title="isWindowMode ? '全屏阅读' : '小窗阅读'"
              @click="handleToggleMode"
            >
              <i class="ph text-[18px] text-[var(--text-primary)]" :class="isWindowMode ? 'ph-arrows-out-simple' : 'ph-arrows-in-simple'"></i>
            </button>
            <button @click="settingsVisible = true" class="w-9 h-9 flex items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors">
              <i class="ph ph-dots-three text-[20px] text-[var(--text-primary)]"></i>
            </button>
          </div>
          </header>
        </Transition>

        <!-- Main Reading Content -->
        <main :class="contentClass" :style="contentAreaStyle">
          <ReaderContent
            v-if="currentChapter"
            :chapter="currentChapter"
            :fontSize="readerSettings.fontSize"
            :lineHeight="readerSettings.lineHeight"
            :theme="readerSettings.theme"
            :pageMode="readerSettings.pageMode"
            :prevChapterTitle="prevChapterTitle"
            :nextChapterTitle="nextChapterTitle"
            @text-selected="handleTextSelection"
            @scroll-progress="handleScrollProgress"
            @visible-text="handleVisibleTextUpdate"
            @content-tap="handleContentTap"
            @page-next="handleNextPage"
            @page-prev="handlePrevPage"
          />

          <div v-else-if="loading" class="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <i class="ph ph-circle-notch animate-spin text-[26px] sm:text-[28px] text-[var(--primary-color)]"></i>
            <span class="text-[12px] sm:text-[13px] text-[var(--text-secondary)]">正在打开书本...</span>
          </div>

          <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-50">
            <i class="ph ph-book-open text-[44px] sm:text-[48px] text-[var(--text-secondary)]"></i>
            <span class="text-[12px] sm:text-[13px] text-[var(--text-secondary)]">暂无内容</span>
          </div>
        </main>

        <!-- Bottom Toolbar -->
        <Transition name="reader-chrome-bottom">
          <ReaderToolbar
            v-show="showReaderChrome"
            :class="toolbarClass"
            :progress="activeBook?.progress?.percentage || 0"
            :chapterTitle="currentChapter?.title || ''"
            :chapterIndex="activeBook?.progress?.chapterIndex || 0"
            :totalChapters="chapters.length"
            :aiName="readerRoleName"
            @open-toc="tocVisible = true"
            @open-notes="notesVisible = true"
            @open-ai-settings="aiSettingsVisible = true"
            @open-settings="settingsVisible = true"
            @open-chat="toggleAIIsland()"
            @seek="handleSeek"
            @prev-chapter="handlePrevPage"
            @next-chapter="handleNextPage"
          />
        </Transition>

        <button
          v-if="isWindowMode"
          class="reader-window-resizer absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-black/10 dark:bg-white/12 backdrop-blur-sm border border-white/25 dark:border-white/10 text-[var(--text-secondary)] flex items-center justify-center active:scale-90 transition-transform"
          title="调整小窗大小"
          @pointerdown.stop.prevent="startWindowResize"
        >
          <i class="ph ph-corners-out text-[13px]"></i>
        </button>
      </div>

      <!-- Selection Bar -->
      <ReaderSelectionBar
        :visible="!!selectionRect"
        :rect="selectionRect"
        :selected-text="aiChat.selectedText"
        @copy="handleCopy"
        @chat="handleDiscussWithAI"
        @close="selectionRect = null"
        @quick-action="handleQuickAction"
      />

      <!-- AI Island -->
      <div class="pointer-events-auto">
        <ReaderAIIsland
          v-if="activeChat"
          :avatar="activeChat.avatar"
          :avatarType="activeChat.avatarType || 'emoji'"
          :name="readerRoleName"
          :expanded="aiIslandExpanded"
          :messages="aiChat.messages"
          :selectedText="aiChat.selectedText"
          :isStreaming="isStreaming"
          @toggle="toggleAIIsland()"
          @send="handleAIIslandSend"
          @stop="stopStreaming"
          @regenerate="regenerateMessage"
          @edit="({ msgId, content }) => { readerStore.editAIChatMessage(msgId, content); scheduleSave() }"
          @delete="(msgId) => { readerStore.deleteAIChatMessage(msgId); scheduleSave() }"
        />
      </div>

      <ReaderSelectionChatWindow
        :visible="selectionChatVisible"
        :selectedText="selectionChat.selectedText"
        :pageText="selectionChat.contextText"
        :messages="selectionChat.messages"
        :isStreaming="selectionIsStreaming"
        :roleName="readerRoleName"
        @close="selectionChatVisible = false; readerStore.closeSelectionChat()"
        @send="handleSelectionChatSend"
        @stop="stopSelectionStreaming"
        @regenerate="regenerateSelectionMessage"
        @edit="({ msgId, content }) => { readerStore.editSelectionChatMessage(msgId, content); scheduleSave() }"
        @delete="(msgId) => { readerStore.deleteSelectionChatMessage(msgId); scheduleSave() }"
      />

      <!-- TOC -->
      <ReaderTOC
        :visible="tocVisible"
        :chapters="chapters"
        :currentIndex="activeBook?.progress?.chapterIndex || 0"
        @close="tocVisible = false"
        @select="handleChapterChange"
      />

      <!-- Settings -->
      <ReaderSettings
        :visible="settingsVisible"
        :fontSize="readerSettings.fontSize"
        :lineHeight="readerSettings.lineHeight"
        :theme="readerSettings.theme"
        :pageMode="readerSettings.pageMode"
        @close="settingsVisible = false"
        @update:fontSize="v => { readerSettings.fontSize = v; scheduleSave() }"
        @update:lineHeight="v => { readerSettings.lineHeight = v; scheduleSave() }"
        @update:theme="v => { readerSettings.theme = v; scheduleSave() }"
        @update:pageMode="v => { readerSettings.pageMode = v; scheduleSave() }"
      />

      <!-- AI Settings -->
      <ReaderAISettings
        :visible="aiSettingsVisible"
        :roleName="readerRoleName"
        @close="aiSettingsVisible = false"
        @clear-summaries="handleClearSummaries"
      />

      <!-- Quick Action Popup -->
      <ReaderQuickActionPopup
        :visible="quickAction.visible"
        :action="quickAction.action"
        :selectedText="quickAction.selectedText"
        :result="quickAction.result"
        :loading="quickAction.loading"
        @close="closeQuickAction"
        @save-note="handleSaveQuickActionAsNote"
      />

      <!-- Notes Panel -->
      <ReaderNotesPanel
        :visible="notesVisible"
        :notes="activeBook?.notes || []"
        :chapterTitles="activeBook?.chapterTitles || []"
        @close="notesVisible = false"
        @delete-note="handleDeleteNote"
      />
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useContactsStore } from '../../../stores/contacts'
import { useReaderStore } from '../../../stores/reader'
import { useReaderAI, generateChapterSummary } from '../composables/useReaderAI'
import { useReaderQuickAction } from '../composables/useReaderQuickAction'
import { loadBookContent } from '../../../composables/useReadingProgress'
import { useStorage } from '../../../composables/useStorage'

import ReaderContent from '../components/ReaderContent.vue'
import ReaderAIIsland from '../components/ReaderAIIsland.vue'
import ReaderToolbar from '../components/ReaderToolbar.vue'
import ReaderSettings from '../components/ReaderSettings.vue'
import ReaderSelectionBar from '../components/ReaderSelectionBar.vue'
import ReaderSelectionChatWindow from '../components/ReaderSelectionChatWindow.vue'
import ReaderTOC from '../components/ReaderTOC.vue'
import ReaderQuickActionPopup from '../components/ReaderQuickActionPopup.vue'
import ReaderNotesPanel from '../components/ReaderNotesPanel.vue'
import ReaderAISettings from '../components/ReaderAISettings.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'window' }
})

const emit = defineEmits(['close', 'toggle-mode'])

const contactsStore = useContactsStore()
const readerStore = useReaderStore()
const { scheduleSave } = useStorage()
const {
  isStreaming, sendMessage, stopStreaming, regenerateMessage,
  selectionIsStreaming, sendSelectionMessage, stopSelectionStreaming, regenerateSelectionMessage
} = useReaderAI({ onChatUpdated: scheduleSave })

const {
  quickAction,
  executeAction: executeQuickAction,
  close: closeQuickAction
} = useReaderQuickAction()

// Local state
const chapters = ref([])
const loading = ref(false)
const tocVisible = ref(false)
const settingsVisible = ref(false)
const aiSettingsVisible = ref(false)
const notesVisible = ref(false)
const selectionRect = ref(null)
const selectionChatVisible = ref(false)
const aiIslandExpanded = ref(false)
const immersiveMode = ref(false)
const windowResizeState = ref({
  active: false,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0
})

// Computed
const activeBook = computed(() => readerStore.activeBook)
const readerSettings = computed(() => readerStore.readerSettings)
const aiChat = computed(() => readerStore.aiChat)
const selectionChat = computed(() => readerStore.selectionChat)
const activeChat = computed(() => contactsStore.activeChat)
const readerRoleName = computed(() => activeChat.value?.name || '伴读')
const isWindowMode = computed(() => props.mode !== 'fullscreen')
const showReaderChrome = computed(() => isWindowMode.value || !immersiveMode.value)

const viewportMaxWindowWidth = computed(() => {
  if (typeof window === 'undefined') return 460
  return Math.max(300, window.innerWidth - 24)
})

const viewportMaxWindowHeight = computed(() => {
  if (typeof window === 'undefined') return 640
  return Math.max(420, window.innerHeight - 110)
})

const clampedWindowWidth = computed(() => Math.max(280, Math.min(viewportMaxWindowWidth.value, readerStore.readerWindowSize.width)))
const clampedWindowHeight = computed(() => Math.max(360, Math.min(viewportMaxWindowHeight.value, readerStore.readerWindowSize.height)))

const panelStyle = computed(() => {
  if (!isWindowMode.value) return undefined
  return {
    width: `${clampedWindowWidth.value}px`,
    height: `${clampedWindowHeight.value}px`
  }
})

const wrapperClass = computed(() => {
  if (isWindowMode.value) {
    return 'fixed inset-0 z-[900] pointer-events-none flex items-end justify-end p-2 sm:p-4 pb-[calc(env(safe-area-inset-bottom,0px)+70px)]'
  }
  return 'fixed inset-0 z-[900] bg-[var(--bg-color)] flex flex-col overflow-hidden'
})

const panelClass = computed(() => {
  if (isWindowMode.value) {
    return 'pointer-events-auto relative rounded-[24px] border border-black/10 dark:border-white/10 bg-[var(--bg-color)] flex flex-col overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.24)]'
  }
  return 'w-full h-full bg-[var(--bg-color)] flex flex-col overflow-hidden'
})

const headerClass = computed(() => {
  if (isWindowMode.value) {
    return 'shrink-0 w-full px-2.5 sm:px-3 pt-2 pb-1 flex items-center justify-between min-h-[52px] bg-white/82 dark:bg-[#1c1c1e]/82 backdrop-blur-xl border-b border-black/5 dark:border-white/5'
  }
  return 'shrink-0 w-full sm:max-w-[860px] sm:mx-auto px-3 sm:px-4 pt-[max(8px,env(safe-area-inset-top,0px))] pb-1 flex items-center justify-between min-h-[56px] sm:min-h-[60px] bg-white/75 dark:bg-[#1c1c1e]/75 backdrop-blur-xl border-b border-black/5 dark:border-white/5 z-50'
})

const contentClass = computed(() => {
  if (isWindowMode.value) {
    return 'flex-1 relative overflow-hidden w-full'
  }
  return 'flex-1 relative overflow-hidden w-full sm:max-w-[860px] sm:mx-auto'
})

const contentAreaStyle = computed(() => {
  if (!isWindowMode.value && immersiveMode.value) {
    return { paddingTop: 'env(safe-area-inset-top, 0px)' }
  }
  return undefined
})

const toolbarClass = computed(() => {
  if (isWindowMode.value) return 'w-full'
  return 'w-full sm:max-w-[860px] sm:mx-auto'
})

const currentChapter = computed(() => {
  const index = activeBook.value?.progress?.chapterIndex || 0
  return chapters.value[index] || null
})

const prevChapterTitle = computed(() => {
  const index = activeBook.value?.progress?.chapterIndex || 0
  return chapters.value[index - 1]?.title || ''
})

const nextChapterTitle = computed(() => {
  const index = activeBook.value?.progress?.chapterIndex || 0
  return chapters.value[index + 1]?.title || ''
})

watch(
  [() => readerStore.activeBookId, () => activeChat.value?.id || null],
  ([bookId, roleId], oldPair) => {
    const [prevBookId, prevRoleId] = Array.isArray(oldPair) ? oldPair : [null, null]
    readerStore.setChatSession(bookId || null, roleId || null)
    if (bookId !== prevBookId || roleId !== prevRoleId) {
      selectionChatVisible.value = false
    }
  },
  { immediate: true }
)

// Load book content
async function initReader() {
  if (!activeBook.value?.id) return

  loading.value = true
  try {
    const data = await loadBookContent(activeBook.value.id)
    chapters.value = data || []
  } catch (err) {
    console.error('Failed to load book content:', err)
  } finally {
    loading.value = false
  }
}

function handleBack() {
  readerStore.closeReader()
  emit('close')
}

function clampWindowSize(width, height) {
  return {
    width: Math.max(280, Math.min(viewportMaxWindowWidth.value, Math.round(width))),
    height: Math.max(360, Math.min(viewportMaxWindowHeight.value, Math.round(height)))
  }
}

function syncWindowSizeToViewport() {
  if (!isWindowMode.value) return
  const next = clampWindowSize(readerStore.readerWindowSize.width, readerStore.readerWindowSize.height)
  readerStore.setReaderWindowSize(next)
}

function onWindowResizeMove(event) {
  if (!windowResizeState.value.active || !isWindowMode.value) return
  const dx = event.clientX - windowResizeState.value.startX
  const dy = event.clientY - windowResizeState.value.startY
  const next = clampWindowSize(
    windowResizeState.value.startWidth + dx,
    windowResizeState.value.startHeight + dy
  )
  readerStore.setReaderWindowSize(next)
}

function stopWindowResize() {
  if (!windowResizeState.value.active) return
  windowResizeState.value.active = false
  window.removeEventListener('pointermove', onWindowResizeMove)
  window.removeEventListener('pointerup', stopWindowResize)
  window.removeEventListener('pointercancel', stopWindowResize)
  scheduleSave()
}

function startWindowResize(event) {
  if (!isWindowMode.value) return
  windowResizeState.value = {
    active: true,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: clampedWindowWidth.value,
    startHeight: clampedWindowHeight.value
  }
  window.addEventListener('pointermove', onWindowResizeMove)
  window.addEventListener('pointerup', stopWindowResize)
  window.addEventListener('pointercancel', stopWindowResize)
}

function handleToggleMode() {
  immersiveMode.value = false
  emit('toggle-mode')
  scheduleSave()
}

function openSelectionChatWindow() {
  const selected = readerStore.aiChat.selectedText || ''
  const context = readerStore.aiChat.contextText || ''
  readerStore.openSelectionChat(selected, context)
  selectionChatVisible.value = true
}

function toggleAIIsland() {
  aiIslandExpanded.value = !aiIslandExpanded.value
}

function handleSelectionChatSend(payload) {
  const text = (payload?.text || '').trim()
  if (!text) return
  const selectedText = (payload?.selectedText ?? selectionChat.value.selectedText ?? aiChat.value.selectedText ?? '').trim()
  const pageText = (payload?.pageText ?? selectionChat.value.contextText ?? aiChat.value.contextText ?? '').trim()
  readerStore.setSelectionSelectedText(selectedText)
  readerStore.setSelectionContextText(pageText)
  sendSelectionMessage(text)
}

function handleAIIslandSend(text) {
  const normalizedText = (text || '').trim()
  if (!normalizedText) return
  sendMessage(normalizedText)
}

function handleChapterChange(index) {
  if (!activeBook.value) return
  readerStore.updateProgress(activeBook.value.id, {
    chapterIndex: index,
    scrollPosition: 0,
    percentage: Math.round((index / Math.max(chapters.value.length, 1)) * 100)
  })
  scheduleSave()
}

function handleScrollProgress(percentage) {
  if (!activeBook.value) return
  const totalChapters = Math.max(chapters.value.length, 1)
  const currentIndex = activeBook.value.progress?.chapterIndex || 0
  const overall = Math.round(((currentIndex + percentage / 100) / totalChapters) * 100)

  readerStore.updateProgress(activeBook.value.id, {
    scrollPosition: percentage,
    percentage: Math.min(100, overall)
  })
}

function handleSeek(percentage) {
  if (!activeBook.value) return
  const totalChapters = Math.max(chapters.value.length, 1)
  const target = (percentage / 100) * totalChapters
  const chapterIndex = Math.min(Math.floor(target), totalChapters - 1)

  readerStore.updateProgress(activeBook.value.id, {
    chapterIndex,
    scrollPosition: 0,
    percentage
  })
  scheduleSave()
}

function handleNextPage() {
  if (!activeBook.value) return
  const index = activeBook.value.progress?.chapterIndex || 0
  if (index >= chapters.value.length - 1) return
  handleChapterChange(index + 1)
}

function handlePrevPage() {
  if (!activeBook.value) return
  const index = activeBook.value.progress?.chapterIndex || 0
  if (index <= 0) return
  handleChapterChange(index - 1)
}

function handleContentTap() {
  const selected = window.getSelection?.()?.toString().trim()
  if (selected) return
  if (isWindowMode.value) return
  if (tocVisible.value || settingsVisible.value) return
  immersiveMode.value = !immersiveMode.value
}

function handleTextSelection({ text, rect, contextText }) {
  if (!text || !rect) {
    selectionRect.value = null
    readerStore.setSelectedText('')
    return
  }
  selectionRect.value = rect
  readerStore.setSelectedText(text)
  if (contextText) {
    readerStore.setContextText(contextText)
    if (selectionChatVisible.value) {
      readerStore.setSelectionContextText(contextText)
    }
  }
  if (selectionChatVisible.value) {
    readerStore.setSelectionSelectedText(text)
  }
}

function handleDiscussWithAI() {
  selectionRect.value = null
  openSelectionChatWindow()
}

function handleCopy() {
  const text = aiChat.value.selectedText || readerStore.aiChat.selectedText
  if (text) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  selectionRect.value = null
}

function handleQuickAction(action) {
  const selectedText = readerStore.aiChat.selectedText || ''
  const contextText = readerStore.aiChat.contextText || ''
  if (!selectedText) return
  selectionRect.value = null
  executeQuickAction(action, selectedText, contextText)
}

function handleSaveQuickActionAsNote() {
  if (!quickAction.result || !activeBook.value) return
  const chapterIndex = activeBook.value.progress?.chapterIndex ?? 0
  readerStore.addNote(activeBook.value.id, {
    chapterIndex,
    selectedText: quickAction.selectedText,
    note: quickAction.result
  })
  scheduleSave()
  closeQuickAction()
}

function handleClearSummaries() {
  if (!activeBook.value) return
  activeBook.value.chapterSummaries = []
  scheduleSave()
}

function handleDeleteNote(noteId) {
  if (!activeBook.value) return
  readerStore.deleteNote(activeBook.value.id, noteId)
  scheduleSave()
}

function handleVisibleTextUpdate(text) {
  readerStore.setContextText(text)
  if (selectionChatVisible.value) {
    readerStore.setSelectionContextText(text)
  }
}

// Lifecycle
onMounted(() => {
  if (props.visible) {
    initReader()
    nextTick(syncWindowSizeToViewport)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncWindowSizeToViewport)
  }
})

onBeforeUnmount(() => {
  stopWindowResize()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncWindowSizeToViewport)
  }
})

watch(() => props.visible, (val) => {
  if (val) {
    initReader()
    immersiveMode.value = false
    nextTick(syncWindowSizeToViewport)
  } else {
    chapters.value = []
    selectionChatVisible.value = false
    aiIslandExpanded.value = false
    immersiveMode.value = false
  }
})

watch(() => activeBook.value?.id, (newId) => {
  if (newId && props.visible) initReader()
})

watch(() => props.mode, () => {
  immersiveMode.value = false
  nextTick(syncWindowSizeToViewport)
})

// Auto-generate chapter summary when switching chapters
watch(
  () => activeBook.value?.progress?.chapterIndex,
  (newIndex, oldIndex) => {
    if (oldIndex == null || newIndex == null) return
    if (oldIndex === newIndex) return
    if (!activeBook.value) return
    if (readerStore.readerAISettings.autoChapterSummary === false) return
    const book = activeBook.value
    const existing = (book.chapterSummaries || []).find(s => s.chapterIndex === oldIndex)
    if (existing) return
    const prevChapter = chapters.value[oldIndex]
    if (!prevChapter?.content) return
    generateChapterSummary(prevChapter.content, book.id, oldIndex).then(() => {
      scheduleSave()
    }).catch(() => {})
  }
)
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.reader-chrome-top-enter-active,
.reader-chrome-top-leave-active {
  transition: all 0.22s ease;
}

.reader-chrome-top-enter-from,
.reader-chrome-top-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}

.reader-chrome-bottom-enter-active,
.reader-chrome-bottom-leave-active {
  transition: all 0.22s ease;
}

.reader-chrome-bottom-enter-from,
.reader-chrome-bottom-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

.reader-window-resizer {
  touch-action: none;
}
</style>

