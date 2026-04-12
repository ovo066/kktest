<template>
  <div class="chat-view absolute inset-0 z-30 bg-[var(--chat-bg)] flex flex-col overflow-hidden">
    <!-- Header -->
    <ChatHeader
      :contact="store.activeChat"
      :badge-count="store.contacts.length"
      :is-group="isGroupChat"
      @back="goBack"
      @edit-contact="isGroupChat ? openEditGroup() : openEditContact()"
      @toggle-narrations="handleAvatarToggleNarrations"
      @start-call="handleStartCall"
    />

    <!-- Search Overlay -->
    <ChatSearchOverlay
      :visible="searchVisible"
      :results="searchResults"
      :query="searchQuery"
      :top-offset="searchOverlayTop"
      @close="closeSearch"
      @update:query="performSearch"
      @jump="(msgId, partKey) => { jumpToMessage(msgId, partKey); closeSearch() }"
    />

    <!-- Token Stats Capsule -->
    <TokenCapsule
      v-if="!isLeavingToMessages && store.showTokenCapsule && store.activeChat"
      :contact="store.activeChat"
      class="absolute right-3 z-20"
      :style="{ top: isGroupChat ? 'calc(var(--app-pt) + 72px)' : 'calc(var(--app-pt) + 68px)' }"
      @hide="hideTokenCapsule"
    />

    <ChatMessageList
      v-show="!isLeavingToMessages"
      ref="messageListRef"
      :blocks="blocks"
      :chat-background-style="chatBackgroundStyle"
      :can-load-older="hasOlderMessages"
      :multi-select-mode="multiSelectMode"
      :selected-block-keys="selectedBlockKeys"
      :show-chat-avatars="store.showChatAvatars"
      :is-typing="store.ui.isTyping"
      :is-thinking="store.ui.isThinking"
      :show-watermark="showWatermark"
      :watermark-text="watermarkText"
      @load-older="loadOlderMessages"
      @toggle-select="toggleBlockSelection"
      @context-menu="showContextMenu"
      @narration-menu="showNarrationMenu"
      @open-call-history="openCallHistoryFromBubble"
      @delete-offline-card="handleDeleteOfflineCard"
      @accept-transfer="handleAcceptTransfer"
      @reject-transfer="handleRejectTransfer"
      @accept-gift="handleAcceptGift"
      @reject-gift="handleRejectGift"
      @accept-meet="handleAcceptMeet"
      @reject-meet="handleRejectMeet"
      @open-transfer-detail="openTransferDetail"
    />

    <!-- Image Preview -->
    <ImagePreview v-if="!isLeavingToMessages" :images="store.pendingImages" @remove="removePendingImage" />

    <!-- Reply Bar -->
    <ReplyBar v-if="!isLeavingToMessages" :visible="!!store.replyingToId" :text="store.replyingToText" @cancel="cancelReply" />

    <!-- Edit Bar -->
    <EditBar v-if="!isLeavingToMessages" :visible="!!store.editingMsgId" :text="editPreview" @cancel="cancelEdit" />

    <!-- 多选模式工具栏 -->
    <ChatMultiSelectToolbar
      :visible="multiSelectMode"
      v-if="!isLeavingToMessages"
      :selected-count="selectedBlockKeys.size"
      :favorite-disabled="selectedBlockKeys.size < 2"
      :delete-disabled="selectedBlockKeys.size === 0"
      @cancel="exitMultiSelect"
      @favorite="handleFavoriteSelectedBlocks"
      @delete="deleteSelectedBlocks"
    />

    <!-- 群聊多API模式成员选择器 -->
    <ChatGroupMemberSelector
      :visible="!multiSelectMode && isGroupChat && store.activeChat?.groupMode === 'multi'"
      v-if="!isLeavingToMessages"
      :members="groupMembers"
      v-model:selectedMemberId="store.selectedMemberId"
    />

    <!-- Input Area -->
    <ChatInput
      v-if="!isLeavingToMessages && !multiSelectMode"
      ref="chatInputRef"
      v-model="inputText"
      :allow-snoop="canOpenSnoop"
      @send="sendMessage"
      @send-sticker="sendSticker"
      @open-photo="openPhotoPicker"
      @open-camera="openMockCameraModal"
      @open-sticker="openStickerPanel"
      @open-memory="openMemoryPanel"
      @open-transfer="openTransferModal"
      @open-gift="openGiftPanel"
      @open-voice="openVoiceModal"
      @open-reader="openReaderBookshelf"
      @open-music="openMusicLibrary"
      @open-search="openSearch"
      @open-meet="openMeetModal"
      @open-snoop="handleOpenSnoop"
    />

    <input
      ref="readerFileInput"
      type="file"
      class="hidden"
      accept=".txt,.epub"
      @change="handleReaderFileInput"
    >

    <input
      ref="photoInput"
      type="file"
      class="hidden"
      accept="image/*"
      multiple
      @change="handlePhotoInput"
    >

    <ChatStickerLayers
      :show-sticker-panel="store.showStickerPanel"
      :show-sticker-manager="store.showStickerManager"
      :stickers="store.stickers"
      :sticker-groups="store.stickerGroups"
      :sticker-selection-mode="stickerSelectionMode"
      :selected-sticker-ids="selectedStickerIds"
      :sticker-batch-visible="stickerBatchVisible"
      :sticker-batch-text="stickerBatchText"
      :sticker-import-options-visible="stickerImportOptionsVisible"
      :sticker-import-options-summary="stickerImportOptionsSummary"
      :sticker-editor-visible="stickerEditorVisible"
      :sticker-editor-draft="stickerEditorDraft"
      :sticker-group-visible="stickerGroupVisible"
      @select-sticker="sendSticker"
      @open-manager="openStickerManager"
      @close-panel="closeStickerPanel"
      @close-manager="closeStickerManager"
      @open-batch-modal="openStickerBatchModal"
      @open-group-modal="openStickerGroupModal"
      @toggle-selection-mode="toggleStickerSelectionMode"
      @toggle-select="toggleStickerSelection"
      @toggle-select-all="toggleSelectAllStickers"
      @delete-selected="deleteSelectedStickers"
      @move-selected-to-group="moveSelectedStickersToGroup"
      @open-editor="openStickerEditor"
      @delete-sticker="deleteSticker"
      @local-input="handleStickerLocalInput"
      @update:sticker-batch-text="stickerBatchText = $event"
      @close-batch-modal="closeStickerBatchModal"
      @confirm-batch="confirmStickerBatch"
      @batch-file="handleStickerBatchFile"
      @close-import-options="closeStickerImportOptionsModal"
      @confirm-import-options="confirmStickerImportOptions"
      @close-editor="closeStickerEditor"
      @confirm-editor="confirmStickerEditor"
      @close-group-modal="closeStickerGroupModal"
      @save-group="saveStickerGroup"
      @delete-group="deleteStickerGroup"
    />

    <ChatMemoryIntegration
      v-if="showMemoryPanel || showMemorySettings"
      :panel-visible="showMemoryPanel"
      :settings-visible="showMemorySettings"
      @close-panel="closeMemoryPanel"
      @open-settings="openMemorySettings"
      @back-from-settings="backFromMemorySettings"
    />

    <!-- Transfer Modal -->
    <TransferModal
      v-if="showTransferModal"
      :visible="showTransferModal"
      @cancel="showTransferModal = false"
      @send="handleSendTransfer"
    />

    <!-- Snoop Phone Consent Dialog -->
    <SnoopConsentDialog
      v-if="showSnoopConsent"
      :visible="showSnoopConsent"
      :contact="store.activeChat"
      @close="showSnoopConsent = false"
      @confirm="handleSnoopConfirm"
    />

    <!-- Gift Picker Panel -->
    <GiftPickerPanel
      v-if="showGiftPanel"
      :visible="showGiftPanel"
      @close="showGiftPanel = false"
      @send="handleSendGift"
    />

    <!-- Transfer/Gift Detail Panel -->
    <TransferDetailPanel
      v-if="showTransferDetail"
      :visible="showTransferDetail"
      :block="transferDetailBlock"
      :contact-name="store.activeChat?.name || ''"
      @close="closeTransferDetail"
      @accept="transferDetailBlock?.type === 'gift' ? handleAcceptGift($event) : handleAcceptTransfer($event)"
      @reject="transferDetailBlock?.type === 'gift' ? handleRejectGift($event) : handleRejectTransfer($event)"
    />

    <!-- Voice Modal -->
    <VoiceModal
      v-if="showVoiceModal"
      :visible="showVoiceModal"
      @cancel="showVoiceModal = false"
      @send="handleSendVoice"
    />

    <!-- Meet Invite Modal -->
    <MeetInviteModal
      v-if="showMeetModal"
      :visible="showMeetModal"
      @cancel="showMeetModal = false"
      @send="handleSendMeet"
    />

    <MockImageModal
      v-if="showMockImageModal"
      :visible="showMockImageModal"
      :placeholder-url="store.theme.mockImagePlaceholder"
      @cancel="showMockImageModal = false"
      @send="handleSendMockImage"
    />

    <ChatReaderIntegration
      v-if="readerStore.bookshelfOpen || (!isLeavingToMessages && readerStore.readerOpen)"
      :bookshelf-visible="readerStore.bookshelfOpen"
      :books="readerStore.books"
      :reader-visible="!isLeavingToMessages && readerStore.readerOpen"
      :mode="readerStore.readerViewMode"
      @close-bookshelf="readerStore.closeBookshelf()"
      @import-file="readerFileInput?.click()"
      @open-book="openBookInReader"
      @delete-book="handleDeleteBook"
      @close-reader="readerStore.closeReader()"
      @toggle-mode="readerStore.toggleReaderViewMode()"
    />

    <ChatContextMenuLayer
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :max-height="contextMenuMaxHeight"
      :anchor="contextMenuAnchor"
      :is-user="contextMenuIsUser"
      :favorited="contextMenuFavorited"
      :focused-bubble="focusedBubble"
      @hide="hideContextMenu"
      @reply="handleReply"
      @copy="handleCopy"
      @edit="handleEdit"
      @regen="handleRegen"
      @delete="handleDelete"
      @multi-select="handleEnterMultiSelect"
      @favorite="handleFavorite"
    />

    <ChatNarrationMenuLayer
      :visible="narrationMenuVisible"
      :x="narrationMenuX"
      :y="narrationMenuY"
      :show-narrations="store.showNarrations"
      @hide="hideNarrationMenu"
      @toggle-narrations="handleToggleNarrations"
      @copy="handleCopyNarration"
      @multi-select="handleNarrationEnterMultiSelect"
    />

    <ChatCallLayers
      ref="callOverlayRef"
      :call-mode-visible="showCallModeSheet"
      :incoming-visible="incomingCallVisible"
      :incoming-info="incomingCallInfo"
      :call-history-visible="showCallHistoryModal"
      :call-history-records="callHistoryRecords"
      :contact="store.activeChat"
      :is-leaving-to-messages="isLeavingToMessages"
      @close-call-mode-sheet="closeCallModeSheet"
      @start-call="startCallWithMode"
      @start-offline="handleStartOffline"
      @accept-call="handleAcceptCall"
      @decline-call="handleDeclineCall"
      @close-call-history="closeCallHistoryModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ChatMemoryIntegration,
  ChatReaderIntegration,
  GiftPickerPanel,
  MeetInviteModal,
  MockImageModal,
  SnoopConsentDialog,
  TransferDetailPanel,
  TransferModal,
  VoiceModal
} from '../chatAsyncComponents'
import { CHAT_TIMESTAMP_GAP_MS, useChatViewStore } from '../composables/useChatViewStore'
import { useStorage } from '../../../composables/useStorage'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import { compressImage } from '../../../composables/useImage'
import { useImageGen } from '../../../composables/useImageGen'
import { showConfirm } from '../../../composables/useConfirm'
import { parseMessageContent, rebuildMessageContent } from '../composables/useMessageParser'
import { useChatImageTokens } from '../composables/useChatImageTokens'
import { useChatCalls } from '../composables/useChatCalls'
import { useChatInteractiveFeatures } from '../composables/useChatInteractiveFeatures'
import { useChatMessageActions } from '../composables/useChatMessageActions'
import { useChatPanels } from '../composables/useChatPanels'
import { useChatReaderIntegration } from '../composables/useChatReaderIntegration'
import { useChatStickerManager } from '../composables/useChatStickerManager'
import { useChatPlannerActions } from '../composables/useChatPlannerActions'
import { useChatSearch } from '../composables/useChatSearch'
import { useChatFavorites } from '../composables/useChatFavorites'
import { useChatInteractionSurface } from '../composables/useChatInteractionSurface'
import { useChatParserBlocks } from '../composables/useChatParserBlocks'
import { useStickerImport } from '../composables/useStickerImport'
import { useChatShellState } from '../composables/useChatShellState'
import { useChatSnoopConsent } from '../composables/useChatSnoopConsent'
import { useChatTimelineShell } from '../composables/useChatTimelineShell'
import { useChatViewLifecycle } from '../composables/useChatViewLifecycle'
import { useMemory } from '../../../composables/useMemory'
import { removeOfflineArtifactsByRemovedChatMessages } from '../../../utils/offlineSessionLinkage'
import { makeId } from '../../../utils/id'
import { useCharacterResourcesStore } from '../../../stores/characterResources'
import { useAlbumStore } from '../../../stores/album'
import { usePlannerStore } from '../../../stores/planner'

// 组件导入
import ChatHeader from '../components/ChatHeader.vue'
import ChatMessageList from '../components/ChatMessageList.vue'
import ChatInput from '../components/ChatInput.vue'
import ImagePreview from '../components/ImagePreview.vue'
import ReplyBar from '../components/ReplyBar.vue'
import EditBar from '../components/EditBar.vue'
import ChatMultiSelectToolbar from '../components/ChatMultiSelectToolbar.vue'
import ChatGroupMemberSelector from '../components/ChatGroupMemberSelector.vue'
import ChatContextMenuLayer from '../components/ChatContextMenuLayer.vue'
import ChatNarrationMenuLayer from '../components/ChatNarrationMenuLayer.vue'
import ChatSearchOverlay from '../components/ChatSearchOverlay.vue'
import ChatCallLayers from '../components/ChatCallLayers.vue'
import ChatStickerLayers from '../components/ChatStickerLayers.vue'
import TokenCapsule from '../components/TokenCapsule.vue'
import { useReaderStore } from '../../../stores/reader'
import { useMusicStore } from '../../../stores/music'
import { useBookParser } from '../../../composables/useBookParser'
import { saveBookContent, deleteBookContent } from '../../../composables/useReadingProgress'
import { resolveMockImagePlaceholder } from '../composables/mockImage'

const router = useRouter()
const route = useRoute()
const store = useChatViewStore()
const { scheduleSave: persistScheduleSave } = useStorage()
const { callAPI, callGroupAPI } = useApi()
const { showToast } = useToast()
const { onMessageSent, onAssistantReplied, invalidateRoundVectors } = useMemory()
const { generateImage } = useImageGen()
const charResStore = useCharacterResourcesStore()
const albumStore = useAlbumStore()
const plannerStore = usePlannerStore()
const {
  showSnoopConsent,
  canOpenSnoop,
  openSnoopConsent: handleOpenSnoop,
  confirmSnoopConsent: handleSnoopConfirm
} = useChatSnoopConsent({
  activeChat: computed(() => store.activeChat),
  router
})
const chatInputRef = ref(null)
const messageListRef = ref(null)

function closePlusMenu() {
  chatInputRef.value?.closeMenu?.()
}

const {
  chatBackgroundStyle,
  groupMembers,
  hideTokenCapsule,
  isGroupChat,
  isLeavingToMessages,
  scheduleSave,
  showWatermark,
  syncActiveChatSummary,
  watermarkText
} = useChatShellState({
  route,
  store,
  persistScheduleSave
})
const readerStore = useReaderStore()
const musicStore = useMusicStore()
const { parseFile } = useBookParser()
const {
  guessStickerNameFromFile: guessImportedStickerNameFromFile,
  importLocalStickerFiles: importStickerFiles,
  runStickerBatchImport: runStickerBatchImportHelper,
  readStickerBatchFileText
} = useStickerImport({
  store,
  makeId,
  compressImage,
  showToast,
  scheduleSave
})
const {
  backFromMemorySettings,
  closeMemoryPanel,
  handlePhotoInput,
  openMemoryPanel,
  openMemorySettings,
  openMusicLibrary,
  openPhotoPicker,
  photoInput,
  removePendingImage,
  showMemoryPanel,
  showMemorySettings
} = useChatPanels({
  closePlusMenu,
  compressImage,
  musicStore,
  store
})
const {
  closeStickerBatchModal,
  closeStickerEditor,
  closeStickerGroupModal,
  closeStickerImportOptionsModal,
  closeStickerManager,
  closeStickerPanel,
  confirmStickerBatch,
  confirmStickerEditor,
  confirmStickerImportOptions,
  deleteSelectedStickers,
  deleteSticker,
  deleteStickerGroup,
  handleStickerBatchFile,
  handleStickerLocalInput,
  moveSelectedStickersToGroup,
  openStickerBatchModal,
  openStickerEditor,
  openStickerGroupModal,
  openStickerManager,
  openStickerPanel,
  saveStickerGroup,
  selectedStickerIds,
  sendSticker,
  stickerBatchText,
  stickerBatchVisible,
  stickerEditorDraft,
  stickerEditorVisible,
  stickerGroupVisible,
  stickerImportOptionsSummary,
  stickerImportOptionsVisible,
  stickerSelectionMode,
  toggleSelectAllStickers,
  toggleStickerSelection,
  toggleStickerSelectionMode
} = useChatStickerManager({
  closePlusMenu,
  compressImage,
  guessImportedStickerNameFromFile,
  importStickerFiles,
  makeId,
  runStickerBatchImport: runStickerBatchImportHelper,
  readStickerBatchFileText,
  scheduleSave,
  showConfirm,
  showToast,
  store
})
const {
  closeTransferDetail,
  handleAcceptGift,
  handleAcceptMeet,
  handleAcceptTransfer,
  handleRejectGift,
  handleRejectMeet,
  handleRejectTransfer,
  handleSendGift,
  handleSendMeet,
  handleSendMockImage,
  handleSendTransfer,
  handleSendVoice,
  openGiftPanel,
  openMeetModal,
  openMockCameraModal,
  openTransferDetail,
  openTransferModal,
  openVoiceModal,
  showGiftPanel,
  showMeetModal,
  showMockImageModal,
  showTransferDetail,
  showTransferModal,
  showVoiceModal,
  transferDetailBlock
} = useChatInteractiveFeatures({
  closePlusMenu,
  makeId,
  resolveMockImagePlaceholder,
  router,
  scheduleSave,
  store
})
const {
  handleDeleteBook,
  handleReaderFileInput,
  openBookInReader,
  openReaderBookshelf,
  readerFileInput
} = useChatReaderIntegration({
  closePlusMenu,
  deleteBookContent,
  parseFile,
  readerStore,
  saveBookContent,
  scheduleSave,
  showConfirm,
  showToast,
  store
})

// Refs
const {
  showCallModeSheet,
  showCallHistoryModal,
  callOverlayRef,
  incomingCallVisible,
  incomingCallInfo,
  closeCallHistoryModal,
  closeCallModeSheet,
  startCallWithMode,
  handleStartCall,
  checkAssistantCallInvite,
  handleAcceptCall,
  handleDeclineCall
} = useChatCalls({
  store,
  scheduleSave,
  parseMessageContent,
  makeId
})

const {
  messageWindowLimit,
  visibleMessages,
  hasOlderMessages,
  searchOverlayTop,
  callHistoryRecords,
  loadOlderMessages,
  goBack
} = useChatTimelineShell({
  router,
  store,
  isGroupChat,
  isLeavingToMessages,
  syncActiveChatSummary,
  showCallHistoryModal
})

const {
  searchVisible,
  searchQuery,
  searchResults,
  performSearch,
  jumpToMessage,
  openSearch,
  closeSearch
} = useChatSearch({ store, messageWindowLimit, messageListRef })

const {
  toggleFavorite,
  favoriteSelectedBlocks,
  processAssistantFavoriteTokens
} = useChatFavorites({ store, scheduleSave, showToast, makeId })

// 从 App.vue 注入的方法
const openEditContact = inject('openEditContact')
const openEditGroup = inject('openEditGroup')

function handleStartOffline() {
  closeCallModeSheet()
  if (store.activeChat?.id) {
    router.push('/offline/' + store.activeChat.id)
  }
}

function handleAcceptedMeet(contact) {
  if (!contact?.id) return
  router.push('/offline/' + contact.id)
}

// 右键菜单
function cleanupOfflineLinksForRemovedMessages(removedMessages) {
  if (!store.activeChat) return
  removeOfflineArtifactsByRemovedChatMessages(store.activeChat, removedMessages)
}

const { blocks } = useChatParserBlocks({
  visibleMessages,
  store,
  isGroupChat,
  groupMembers,
  timestampGapMs: CHAT_TIMESTAMP_GAP_MS
})

const {
  contextMenuVisible,
  contextMenuX,
  contextMenuY,
  contextMenuMaxHeight,
  contextMenuAnchor,
  contextMenuMsgId,
  contextMenuPartIndex,
  contextMenuContent,
  contextMenuIsUser,
  focusedBubble,
  hideContextMenu,
  multiSelectMode,
  selectedBlockKeys,
  exitMultiSelect,
  toggleBlockSelection,
  deleteSelectedBlocks,
  handleAvatarToggleNarrations,
  handleCopyNarration,
  handleNarrationEnterMultiSelect,
  handleToggleNarrations,
  hideNarrationMenu,
  narrationMenuVisible,
  narrationMenuX,
  narrationMenuY,
  showNarrationMenu,
  showContextMenu,
  openCallHistoryFromBubble,
  handleEnterMultiSelect,
  contextMenuFavorited,
  handleFavorite,
  handleFavoriteSelectedBlocks
} = useChatInteractionSurface({
  store,
  blocks,
  parseMessageContent,
  rebuildMessageContent,
  onChatMutated: invalidateRoundVectors,
  showConfirm,
  showToast,
  scheduleSave,
  showCallHistoryModal,
  onDeleteWholeMessages: cleanupOfflineLinksForRemovedMessages,
  toggleFavorite,
  favoriteSelectedBlocks
})

const { scrollToBottom } = useChatViewLifecycle({
  route,
  store,
  messageListRef,
  messageWindowLimit,
  initialMessageWindow: 100,
  jumpToMessage,
  contextMenuVisible,
  hideContextMenu,
  narrationMenuVisible,
  hideNarrationMenu
})

const { processAssistantImageTokens } = useChatImageTokens({
  store,
  charResStore,
  albumStore,
  generateImage,
  makeId,
  showToast,
  scrollToBottom
})

const { processAssistantPlannerActions } = useChatPlannerActions({
  store,
  plannerStore,
  showToast
})

const {
  cancelEdit,
  cancelReply,
  editPreview,
  handleCopy,
  handleDelete,
  handleDeleteOfflineCard,
  handleEdit,
  handleRegen,
  handleReply,
  inputText,
  sendMessage
} = useChatMessageActions({
  albumStore,
  callAPI,
  callGroupAPI,
  checkAssistantCallInvite,
  cleanupOfflineLinksForRemovedMessages,
  closePlusMenu,
  contextMenuContent,
  contextMenuMsgId,
  contextMenuPartIndex,
  hideContextMenu,
  invalidateRoundVectors,
  isGroupChat,
  makeId,
  onAcceptedMeet: handleAcceptedMeet,
  onAssistantReplied,
  onMessageSent,
  parseMessageContent,
  processAssistantFavoriteTokens,
  processAssistantPlannerActions,
  processAssistantImageTokens,
  rebuildMessageContent,
  scheduleSave,
  scrollToBottom,
  showConfirm,
  showToast,
  store
})

</script>
