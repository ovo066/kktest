<template>
  <StickerPanel
    v-if="showStickerPanel"
    :visible="showStickerPanel"
    :stickers="stickers"
    :sticker-groups="stickerGroups"
    @select="$emit('select-sticker', $event)"
    @manage="$emit('open-manager')"
    @close="$emit('close-panel')"
  />

  <StickerManager
    v-if="showStickerManager"
    :visible="showStickerManager"
    :stickers="stickers"
    :sticker-groups="stickerGroups"
    :selection-mode="stickerSelectionMode"
    :selected-sticker-ids="selectedStickerIds"
    @back="$emit('close-manager')"
    @upload-local="stickerLocalInput?.click()"
    @batch-import="$emit('open-batch-modal')"
    @manage-groups="$emit('open-group-modal')"
    @toggle-selection-mode="$emit('toggle-selection-mode')"
    @toggle-select="$emit('toggle-select', $event)"
    @toggle-select-all="$emit('toggle-select-all')"
    @batch-delete="$emit('delete-selected')"
    @batch-move-group="$emit('move-selected-to-group', $event)"
    @edit="$emit('open-editor', $event)"
    @delete="$emit('delete-sticker', $event)"
  />
  <input ref="stickerLocalInput" type="file" class="hidden" accept="image/*" multiple @change="$emit('local-input', $event)">

  <StickerBatchModal
    :model-value="stickerBatchText"
    :visible="stickerBatchVisible"
    :sticker-groups="stickerGroups"
    @update:model-value="$emit('update:stickerBatchText', $event)"
    @cancel="$emit('close-batch-modal')"
    @confirm="$emit('confirm-batch', $event)"
    @import-file="$emit('batch-file', $event)"
    @manage-groups="$emit('open-group-modal')"
  />

  <StickerImportOptionsModal
    :visible="stickerImportOptionsVisible"
    :groups="stickerGroups"
    :summary="stickerImportOptionsSummary"
    @cancel="$emit('close-import-options')"
    @confirm="$emit('confirm-import-options', $event)"
    @manage-groups="$emit('open-group-modal')"
  />

  <StickerEditorModal
    :visible="stickerEditorVisible"
    :sticker="stickerEditorDraft"
    :sticker-groups="stickerGroups"
    @cancel="$emit('close-editor')"
    @confirm="$emit('confirm-editor', $event)"
    @manage-groups="$emit('open-group-modal')"
  />

  <StickerGroupModal
    :visible="stickerGroupVisible"
    :groups="stickerGroups"
    :stickers="stickers"
    @close="$emit('close-group-modal')"
    @save="$emit('save-group', $event)"
    @delete="$emit('delete-group', $event)"
  />
</template>

<script setup>
import { ref } from 'vue'
import {
  StickerBatchModal,
  StickerEditorModal,
  StickerGroupModal,
  StickerImportOptionsModal,
  StickerManager,
  StickerPanel
} from '../chatAsyncComponents'

defineProps({
  showStickerPanel: { type: Boolean, default: false },
  showStickerManager: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
  stickerGroups: { type: Array, default: () => [] },
  stickerSelectionMode: { type: Boolean, default: false },
  selectedStickerIds: { type: Array, default: () => [] },
  stickerBatchVisible: { type: Boolean, default: false },
  stickerBatchText: { type: String, default: '' },
  stickerImportOptionsVisible: { type: Boolean, default: false },
  stickerImportOptionsSummary: { type: String, default: '' },
  stickerEditorVisible: { type: Boolean, default: false },
  stickerEditorDraft: { type: Object, default: null },
  stickerGroupVisible: { type: Boolean, default: false }
})

defineEmits([
  'select-sticker',
  'open-manager',
  'close-panel',
  'close-manager',
  'open-batch-modal',
  'open-group-modal',
  'toggle-selection-mode',
  'toggle-select',
  'toggle-select-all',
  'delete-selected',
  'move-selected-to-group',
  'open-editor',
  'delete-sticker',
  'local-input',
  'update:stickerBatchText',
  'close-batch-modal',
  'confirm-batch',
  'batch-file',
  'close-import-options',
  'confirm-import-options',
  'close-editor',
  'confirm-editor',
  'close-group-modal',
  'save-group',
  'delete-group'
])

const stickerLocalInput = ref(null)
</script>
