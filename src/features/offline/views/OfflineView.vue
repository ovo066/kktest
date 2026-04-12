<template>
  <div
    class="offline-view offline-theme-custom"
    :class="'theme-' + offlineTheme"
  >
    <!-- Drawer -->
    <OfflineDrawer
      :open="drawerOpen"
      :keep-history="settingsStore.offlineKeepHistory"
      :inject-to-chat="settingsStore.offlineInjectToChat"
      :retrieve-main-memory="settingsStore.offlineRetrieveMainMemory"
      @close="drawerOpen = false"
      @back="handleBack"
      @end-session="handleEndSession"
      @open-presets="drawerOpen = false; showPresetPanel = true"
      @open-regex="drawerOpen = false; showRegexPanel = true"
      @open-themes="drawerOpen = false; showThemePanel = true"
      @open-archives="drawerOpen = false; showArchivePanel = true"
      @update:keep-history="v => { settingsStore.offlineKeepHistory = v; scheduleSave() }"
      @update:inject-to-chat="v => { settingsStore.offlineInjectToChat = v; scheduleSave() }"
      @update:retrieve-main-memory="v => { settingsStore.offlineRetrieveMainMemory = v; scheduleSave() }"
    />

    <!-- Header -->
    <OfflineHeader
      :contact-name="contact?.name || ''"
      :exit-armed="exitConfirming"
      @toggle-drawer="drawerOpen = !drawerOpen"
      @exit-offline="handleExitOffline"
    />

    <!-- Story Area -->
    <StoryRenderer
      ref="storyRendererRef"
      :segments="segments"
      :layout-mode="offlineLayout"
      :avatar-mode="offlineAvatarMode"
      :user-name="userName"
      :user-avatar="userAvatar"
      :user-avatar-type="userAvatarType"
      :char-name="contact?.name || ''"
      :char-avatar="charAvatar"
      :char-avatar-type="charAvatarType"
      class="flex-1"
      @reroll="handleRegenerate"
      @edit="handleEditSegment"
      @delete="handleDeleteSegment"
      @copy="handleCopy"
    />

    <!-- Input -->
    <OfflineInput
      ref="inputRef"
      :is-generating="isGenerating"
      @send="handleSend"
      @cancel="cancelGeneration"
      @ai-help="handleAIHelp"
    />

    <!-- Edit Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="editModalVisible" class="edit-modal-overlay" @click.self="editModalVisible = false">
          <div class="edit-modal">
            <div class="edit-modal-toolbar">
              <button class="edit-modal-save" @click="confirmEdit">
                <i class="ph ph-floppy-disk"></i>
              </button>
              <button class="edit-modal-close" @click="editModalVisible = false">
                <i class="ph ph-x"></i>
              </button>
            </div>
            <textarea
              v-model="editContent"
              class="edit-textarea"
            ></textarea>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Preset Panel -->
    <PresetPanel
      :visible="showPresetPanel"
      :presets="offlinePresets"
      :active-preset-id="offlineStore.activePresetId || null"
      @close="showPresetPanel = false"
      @select="handleSelectPreset"
      @create="handleCreatePreset"
      @delete="handleDeletePreset"
      @import="handleImportPreset"
      @update-preset="handleUpdatePreset"
      @add-entry="handleAddPresetEntry"
      @delete-entry="handleDeletePresetEntry"
      @toggle-entry="handleTogglePresetEntry"
      @update-entry="handleUpdateEntry"
    />

    <!-- Regex Panel -->
    <RegexPanel
      :visible="showRegexPanel"
      :global-rules="effectiveRegexBindings.globalRules"
      :preset-rules="effectiveRegexBindings.presetRules"
      :character-rules="effectiveRegexBindings.characterRules"
      :preset-name="activeOfflinePreset?.name || ''"
      :character-name="contact?.name || ''"
      :editing-rule="editingRegexRule"
      :editing-scope="editingRegexScope"
      @close="showRegexPanel = false"
      @add="handleAddRegex"
      @toggle="handleToggleRegex"
      @edit="handleEditRegex"
      @delete="handleDeleteRegex"
      @save-edit="handleSaveRegex"
      @cancel-edit="handleCancelRegexEdit"
      @import="handleImportRegex"
    />

    <!-- Theme Panel -->
    <OfflineThemePanel
      :visible="showThemePanel"
      :current-theme="offlineTheme"
      :current-layout="offlineLayout"
      :current-avatar-mode="offlineAvatarMode"
      :current-theme-config="offlineThemeConfig"
      @close="showThemePanel = false"
      @select="handleSelectTheme"
      @select-layout="handleSelectLayout"
      @select-avatar-mode="handleSelectAvatarMode"
      @save-theme-config="handleSaveThemeConfig"
      @reset-theme-config="handleResetThemeConfig"
    />

    <OfflineArchivePanel
      :visible="showArchivePanel"
      :snapshots="offlineSnapshots"
      @close="showArchivePanel = false"
      @save="handleSaveArchive"
      @new-branch="handleCreateNewArchiveBranch"
      @load="handleLoadArchive"
      @delete="handleDeleteArchive"
      @rename="handleRenameArchive"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { usePersonasStore } from '../../../stores/personas'
import { useSettingsStore } from '../../../stores/settings'
import { useOfflineStore } from '../../../stores/offline'
import { useStorage } from '../../../composables/useStorage'
import { useToast } from '../../../composables/useToast'
import { useMemory } from '../../../composables/useMemory'
import { useOfflineApi } from '../composables/useOfflineApi'
import { useOfflineRenderer } from '../composables/useOfflineRenderer'
import { useOfflinePresets } from '../composables/useOfflinePresets'
import { normalizeThemeConfig, useOfflineTheme } from '../composables/useOfflineTheme'
import { useOfflineArchives } from '../composables/useOfflineArchives'
import { useOfflineRegexRules } from '../composables/useOfflineRegexRules'
import { normalizeOfflineRegexRules, resolveOfflineRegexBindings } from '../../../utils/offlineRegex'
import {
  ensureOfflineContactFields,
  removeOfflineArtifactsByDeletedOfflineMessage
} from '../../../utils/offlineSessionLinkage'
import OfflineHeader from '../components/OfflineHeader.vue'
import OfflineDrawer from '../components/OfflineDrawer.vue'
import StoryRenderer from '../components/StoryRenderer.vue'
import OfflineInput from '../components/OfflineInput.vue'
import PresetPanel from '../components/PresetPanel.vue'
import RegexPanel from '../components/RegexPanel.vue'
import OfflineThemePanel from '../components/OfflineThemePanel.vue'
import OfflineArchivePanel from '../components/OfflineArchivePanel.vue'

const router = useRouter()
const route = useRoute()
const contactsStore = useContactsStore()
const personasStore = usePersonasStore()
const settingsStore = useSettingsStore()
const offlineStore = useOfflineStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()
const { initContactMemory, addCoreMemory, callSummaryAPI } = useMemory()
const { isGenerating, streamingText, sendMessage, generateOpening, regenerate, cancelGeneration } = useOfflineApi()
const { importFromJson } = useOfflinePresets()

const contactId = computed(() => route.params.contactId)
const contact = computed(() => contactsStore.contacts.find(c => c.id === contactId.value) || null)

const userPersona = computed(() => (
  contact.value ? personasStore.getPersonaForContact(contact.value.id) : null
))
const userName = computed(() => userPersona.value?.name || '你')
const userAvatar = computed(() => userPersona.value?.avatar || '😊')
const userAvatarType = computed(() => userPersona.value?.avatarType || 'emoji')
const charAvatar = computed(() => contact.value?.avatar || '')
const charAvatarType = computed(() => contact.value?.avatarType || 'emoji')

const offlinePresets = computed(() => offlineStore.presets)
const activeOfflinePreset = computed(() => {
  const presetId = String(offlineStore.activePresetId || '').trim()
  return presetId ? offlineStore.getPreset(presetId) : null
})
const effectiveRegexBindings = computed(() => resolveOfflineRegexBindings({
  globalRules: offlineStore.regexRules || [],
  presetRules: activeOfflinePreset.value?.regexRules || [],
  characterRules: contact.value?.offlineRegexRules || []
}))

const {
  offlineTheme,
  offlineLayout,
  offlineAvatarMode,
  offlineThemeConfig,
  handleSelectTheme,
  handleSelectLayout,
  handleSelectAvatarMode,
  handleSaveThemeConfig,
  handleResetThemeConfig
} = useOfflineTheme({ offlineStore, scheduleSave, showToast })

function applyContactOfflineConfig(contactRecord, { force = false } = {}) {
  if (!contactRecord) return false

  let changed = false
  const meetOfflineConfig = contactRecord.meetSceneContext?.offlineConfig || null
  const presetId = String(meetOfflineConfig?.presetId || contactRecord.offlinePresetId || '').trim()
  if (presetId && offlineStore.getPreset(presetId) && (force || offlineStore.activePresetId !== presetId)) {
    offlineStore.setActivePreset(presetId)
    changed = true
  }

  const nextRegexRules = Array.isArray(meetOfflineConfig?.regexRules) && meetOfflineConfig.regexRules.length > 0
    ? normalizeOfflineRegexRules(meetOfflineConfig.regexRules)
    : normalizeOfflineRegexRules(contactRecord.offlineRegexRules)
  if (nextRegexRules.length > 0 && (force || (contactRecord.offlineRegexRules || []).length === 0)) {
    contactRecord.offlineRegexRules = nextRegexRules.map(rule => ({ ...rule }))
    changed = true
  }

  const nextLayout = String(meetOfflineConfig?.layout || contactRecord.offlineLayout || '').trim()
  if (nextLayout && (force || !offlineStore.layout || offlineStore.layout === 'classic')) {
    offlineStore.setLayout(nextLayout)
    changed = true
  }

  const nextAvatarMode = String(meetOfflineConfig?.avatarMode || contactRecord.offlineAvatarMode || '').trim()
  if (nextAvatarMode && (force || !offlineStore.avatarMode || offlineStore.avatarMode === 'side')) {
    offlineStore.setAvatarMode(nextAvatarMode)
    changed = true
  }

  const nextThemeConfig = meetOfflineConfig?.themeConfig || contactRecord.offlineThemeConfig || null
  const currentThemeConfig = normalizeThemeConfig(offlineStore.themeConfig)
  const isCurrentThemeConfigEmpty = (
    !currentThemeConfig.customCss &&
    !currentThemeConfig.fontFamily &&
    !currentThemeConfig.fontImport
  )
  if (nextThemeConfig && (force || isCurrentThemeConfigEmpty)) {
    offlineStore.setThemeConfig(nextThemeConfig)
    changed = true
  }

  return changed
}

// Ensure contact offline fields
onMounted(() => {
  if (contact.value) {
    ensureOfflineContactFields(contact.value)

    if (!settingsStore.offlineKeepHistory) {
      contact.value.offlineMsgs = []
      contact.value.offlineArchiveCursor = 0
    }

    // Legacy migration: old versions stored these fields per contact.
    const migrated = applyContactOfflineConfig(contact.value, {
      force: !!contact.value.meetSceneContext?.offlineConfig
    })
    if (migrated) scheduleSave()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
  scrollStoryToBottom()
  void maybeGenerateOpening()
})

// Renderer
const offlineMsgs = computed(() => contact.value?.offlineMsgs || [])
const regexRules = computed(() => effectiveRegexBindings.value.combinedRules || [])
const { segments } = useOfflineRenderer(offlineMsgs, regexRules, streamingText, isGenerating)

// Refs
const storyRendererRef = ref(null)
const inputRef = ref(null)

function scrollStoryToBottom(options = {}) {
  const smooth = options?.smooth === true
  nextTick(() => {
    storyRendererRef.value?.scrollToBottom?.({ smooth })
  })
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible') {
    scrollStoryToBottom()
  }
}

// Panels
const drawerOpen = ref(false)
const showPresetPanel = ref(false)
const showRegexPanel = ref(false)
const showThemePanel = ref(false)
const showArchivePanel = ref(false)
const exitConfirming = ref(false)
let exitConfirmTimer = null
let openingRequested = false

async function maybeGenerateOpening() {
  if (openingRequested) return
  if (!contact.value?.meetSceneContext) return
  if ((contact.value.offlineMsgs || []).length > 0) return

  openingRequested = true
  const result = await generateOpening(contactId.value)
  if (!result.success && result.error) {
    showToast(result.error, 3000)
    openingRequested = false
    return
  }
  scheduleSave()
  scrollStoryToBottom({ smooth: true })
}

// Edit modal
const editModalVisible = ref(false)
const editContent = ref('')
const editingMsgId = ref(null)

const {
  offlineSnapshots,
  handleSaveArchive,
  handleCreateNewArchiveBranch,
  handleLoadArchive,
  handleDeleteArchive,
  handleRenameArchive,
  quickReturnToChat,
  finalizeOfflineSessionAndReturn
} = useOfflineArchives({
  contact,
  contactId,
  offlineStore,
  effectiveRegexRules: regexRules,
  settingsStore,
  scheduleSave,
  showToast,
  initContactMemory,
  addCoreMemory,
  callSummaryAPI,
  router,
  scrollStoryToBottom,
  closeArchivePanel: () => { showArchivePanel.value = false }
})

const {
  editingRegexRule,
  editingRegexScope,
  handleAddRegex,
  handleToggleRegex,
  handleEditRegex,
  handleDeleteRegex,
  handleSaveRegex,
  handleCancelRegexEdit,
  handleImportRegex
} = useOfflineRegexRules({
  offlineStore,
  contact,
  scheduleSave,
  showToast
})

// === Actions ===

async function handleSend(content) {
  const result = await sendMessage(contactId.value, content)
  if (!result.success && result.error) {
    showToast(result.error, 3000)
  } else if (result.truncated) {
    showToast('回复达到输出上限，已截断')
  }
  scheduleSave()
}

function clearExitConfirmState() {
  if (exitConfirmTimer) {
    clearTimeout(exitConfirmTimer)
    exitConfirmTimer = null
  }
  exitConfirming.value = false
}

function handleExitOffline() {
  drawerOpen.value = false
  if (exitConfirming.value) {
    // Header exit confirmed → LLM summary path
    clearExitConfirmState()
    finalizeOfflineSessionAndReturn({ forceToast: true })
    return
  }
  exitConfirming.value = true
  showToast('再点一次生成总结并返回聊天')
  if (exitConfirmTimer) clearTimeout(exitConfirmTimer)
  exitConfirmTimer = setTimeout(() => {
    exitConfirming.value = false
    exitConfirmTimer = null
  }, 2000)
}

function handleBack() {
  // Drawer "返回聊天" → quick return, no summary, no card
  quickReturnToChat()
}

function handleEndSession() {
  // Drawer "结束会话" → LLM summary path
  finalizeOfflineSessionAndReturn({ forceToast: true })
}

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  clearExitConfirmState()
})

// Message actions (now driven by emit from StorySegment, not context menu)
function handleCopy(segment) {
  if (segment?.content) {
    navigator.clipboard?.writeText(segment.content).catch(() => {})
    showToast('已复制')
  }
}

async function handleRegenerate(_segment) {
  const result = await regenerate(contactId.value)
  if (!result.success && result.error) {
    showToast(result.error, 3000)
  } else if (result.truncated) {
    showToast('回复达到输出上限，已截断')
  }
  scheduleSave()
}

function handleEditSegment(segment) {
  if (!segment) return
  editingMsgId.value = segment.id
  editContent.value = segment.content
  editModalVisible.value = true
}

function confirmEdit() {
  if (!contact.value || !editingMsgId.value) return
  const msg = contact.value.offlineMsgs.find(m => m.id === editingMsgId.value)
  if (msg) {
    msg.content = editContent.value
    scheduleSave()
  }
  editModalVisible.value = false
  editingMsgId.value = null
}

function handleDeleteSegment(segment) {
  if (!segment || !contact.value) return
  ensureOfflineContactFields(contact.value)
  const prevCursor = Number(contact.value.offlineArchiveCursor || 0)
  const idx = contact.value.offlineMsgs.findIndex(m => m.id === segment.id)
  if (idx !== -1) {
    const deletedWasArchived = idx < prevCursor
    contact.value.offlineMsgs.splice(idx, 1)
    contact.value.offlineArchiveCursor = Math.max(
      0,
      Math.min(
        deletedWasArchived ? prevCursor - 1 : prevCursor,
        contact.value.offlineMsgs.length
      )
    )

    const cleanup = removeOfflineArtifactsByDeletedOfflineMessage(contact.value, segment.id, {
      deletedWasArchived
    })
    if (cleanup.removedSessions > 0) {
      showToast(`已同步移除 ${cleanup.removedSessions} 条线下预览`)
    }

    scheduleSave()
  }
}

// AI Help
function handleAIHelp() {
  if (isGenerating.value) return
  // Trigger a send with empty content, the API composable will handle AI-help mode
  // For now, just auto-send the last context as continuation
  handleSend('[继续]')
}

// Preset handlers
function handleSelectPreset(id) {
  offlineStore.setActivePreset(id)
  scheduleSave()
}

function handleCreatePreset() {
  const preset = offlineStore.createPreset({ name: '新预设' })
  offlineStore.setActivePreset(preset.id)
  scheduleSave()
}

function handleDeletePreset(id) {
  offlineStore.deletePreset(id)
  scheduleSave()
}

function handleUpdatePreset(id, patch = {}) {
  const preset = offlineStore.getPreset(id)
  if (!preset) {
    showToast('未找到预设')
    return
  }

  const nextPatch = { ...patch }
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'name')) {
    const nextName = String(nextPatch.name || '').trim()
    if (!nextName) {
      showToast('预设名称不能为空')
      return
    }
    nextPatch.name = nextName
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'maxTokens')) {
    const rawValue = String(nextPatch.maxTokens ?? '').trim()
    if (!rawValue) {
      nextPatch.maxTokens = null
    } else {
      const parsed = Number(rawValue)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        showToast('输出上限需为 1-65535 的整数，留空不限制输出')
        return
      }
      nextPatch.maxTokens = parsed
    }
  }

  const ok = offlineStore.updatePreset(id, nextPatch)
  if (!ok) {
    showToast('未找到预设')
    return
  }
  scheduleSave()
}

async function handleImportPreset(file) {
  try {
    const text = await file.text()
    const result = importFromJson(text)
    const imported = Array.isArray(result?.presets) ? result.presets : []
    const regexCount = Number(result?.regexCount || 0)
    if (imported.length > 0) {
      offlineStore.setActivePreset(imported[0]?.id || null)
      showToast(regexCount > 0
        ? `已导入 ${imported.length} 个预设，并绑定 ${regexCount} 条预设正则`
        : `已导入 ${imported.length} 个预设`)
      scheduleSave()
    } else {
      showToast('未找到有效预设')
    }
  } catch {
    showToast('导入失败')
  }
}

function handleAddPresetEntry(presetId) {
  const preset = offlineStore.getPreset(presetId)
  if (!preset) return

  const nextEntries = Array.isArray(preset.promptEntries) ? [...preset.promptEntries] : []
  const nextIndex = nextEntries.length
  const entryId = `entry_${Date.now()}_${nextIndex + 1}`
  nextEntries.push({
    id: entryId,
    identifier: entryId,
    name: `条目 ${nextIndex + 1}`,
    role: 'system',
    content: '',
    enabled: true,
    injectionDepth: 0,
    injectionPosition: 'in_chat',
    order: nextIndex
  })

  offlineStore.updatePreset(presetId, { promptEntries: nextEntries })
  scheduleSave()
}

function handleDeletePresetEntry(presetId, entryId) {
  const preset = offlineStore.getPreset(presetId)
  if (!preset) return
  offlineStore.updatePreset(presetId, {
    promptEntries: (preset.promptEntries || []).filter(entry => entry.id !== entryId)
  })
  scheduleSave()
}

function handleTogglePresetEntry(presetId, entryId) {
  const preset = offlineStore.getPreset(presetId)
  if (!preset) return
  const entry = preset.promptEntries?.find(e => e.id === entryId)
  if (entry) {
    entry.enabled = !entry.enabled
    scheduleSave()
  }
}

function handleUpdateEntry(presetId, entryId, patch = {}) {
  const preset = offlineStore.getPreset(presetId)
  if (!preset) return
  const entry = preset.promptEntries?.find(e => e.id === entryId)
  if (entry) {
    Object.assign(entry, patch)
    scheduleSave()
  }
}

</script>

<style scoped>
/* === Base offline view + TTK CSS Variables === */
.offline-view {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--off-font, 'Nunito', 'Microsoft YaHei', sans-serif);

  /* Default TTK theme variables */
  --off-bg: #f4f4f4;
  --off-surface: #ffffff;
  --off-text: #111111;
  --off-text-sec: #888888;
  --off-border: #111111;
  --off-border-w: 2px;
  --off-shadow: 4px 4px 0px var(--off-border);
  --off-shadow-sm: 2px 2px 0px var(--off-border);
  --off-radius: 14px;
  --off-user-bg: #111111;
  --off-user-text: #ffffff;
  --off-char-bg: #ffffff;
  --off-char-text: #111111;
  --off-accent: #111111;
  --off-danger: #d32f2f;
  --off-speaker-color: #111111;
  --off-speaker-bg: rgba(255, 255, 255, 0.8);
  --off-speaker-border: rgba(17, 17, 17, 0.25);
  --off-action-color: #333333;
  --off-action-bg: rgba(17, 17, 17, 0.06);
  --off-action-border: rgba(17, 17, 17, 0.2);
  --off-action-shadow: none;
  --off-user-speaker-color: #ffffff;
  --off-user-speaker-bg: rgba(255, 255, 255, 0.14);
  --off-user-speaker-border: rgba(255, 255, 255, 0.25);
  --off-user-action-color: rgba(255, 255, 255, 0.92);
  --off-user-action-bg: rgba(255, 255, 255, 0.12);
  --off-user-action-border: rgba(255, 255, 255, 0.25);

  background: var(--off-bg);
  color: var(--off-text);
}

/* Edit modal */
.edit-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 850;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.edit-modal {
  background: var(--off-surface, #fff);
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: calc(var(--off-radius, 14px) + 4px);
  box-shadow: var(--off-shadow, 4px 4px 0 var(--off-border, #111));
  width: 100%;
  max-width: 520px;
  min-height: min(56vh, 520px);
  max-height: min(78vh, 720px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-modal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edit-modal-save,
.edit-modal-close {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  background: var(--off-surface, #fff);
  color: var(--off-text, #111);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--off-shadow-sm, 2px 2px 0 var(--off-border, #111));
}

.edit-modal-save {
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.edit-modal-close {
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.edit-modal-save:active,
.edit-modal-close:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.edit-textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  max-height: none;
  background: var(--off-bg, #f4f4f4);
  color: var(--off-text, #111);
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: 10px;
  padding: 16px 18px;
  font-size: 16px;
  font-family: inherit;
  line-height: 1.8;
  outline: none;
  resize: none;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
