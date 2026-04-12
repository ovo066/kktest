<template>
  <div
    v-if="visible"
    class="absolute inset-0 bg-[var(--bg-color)] z-50 flex flex-col"
  >
    <div class="pt-app-lg pb-2 px-4 flex items-center justify-between">
      <button class="text-[var(--primary-color)] text-[17px] flex items-center" @click="$emit('back')">
        <i class="ph ph-caret-left"></i> 返回
      </button>
      <span class="font-semibold text-[17px] text-[var(--text-primary)]">管理贴纸</span>
      <button
        v-if="stickers.length > 0"
        type="button"
        class="text-[var(--primary-color)] text-[15px] w-16 text-right"
        @click="$emit('toggle-selection-mode')"
      >
        {{ selectionMode ? '取消' : '多选' }}
      </button>
      <div v-else class="w-16"></div>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
        <button class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2 border-b border-[var(--border-color)]" @click="$emit('uploadLocal')">
          <i class="ph ph-upload text-xl"></i>
          <span>上传本地图片（可多选）</span>
        </button>
        <button class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2 border-b border-[var(--border-color)]" @click="$emit('batchImport')">
          <i class="ph ph-list-plus text-xl"></i>
          <span>批量导入URL</span>
        </button>
        <button class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2" @click="$emit('manageGroups')">
          <i class="ph ph-folders text-xl"></i>
          <span>管理分组</span>
        </button>
      </div>
      <div v-if="stickerGroups.length > 0" class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">贴纸分组</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] p-3 flex flex-wrap gap-2">
          <span
            v-for="group in stickerGroups"
            :key="group.id"
            class="px-3 py-1.5 rounded-full bg-[var(--primary-color)]/10 text-[var(--text-primary)] text-[12px]"
          >
            {{ group.name }}
          </span>
        </div>
      </div>
      <div v-if="selectionMode" class="bg-[var(--card-bg)] rounded-[10px] p-3 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="text-[14px] text-[var(--text-primary)]">已选 {{ selectedCount }} 张</div>
          <button
            type="button"
            class="text-[13px] text-[var(--primary-color)]"
            @click="$emit('toggle-select-all')"
          >
            {{ allSelected ? '取消全选' : '全选' }}
          </button>
        </div>

        <div class="space-y-2">
          <div class="text-[12px] text-[var(--text-secondary)] uppercase">移动到分组</div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="moveTargetGroupId === UNGROUPED_GROUP_ID ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--bg-color)] text-[var(--text-secondary)]'"
              @click="moveTargetGroupId = UNGROUPED_GROUP_ID"
            >
              未分组
            </button>
            <button
              v-for="group in stickerGroups"
              :key="group.id"
              type="button"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="moveTargetGroupId === group.id ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--bg-color)] text-[var(--text-secondary)]'"
              @click="moveTargetGroupId = group.id"
            >
              {{ group.name }}
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl text-[15px] font-semibold transition-opacity"
            :class="selectedCount > 0 ? 'bg-red-500/10 text-red-500' : 'bg-red-500/5 text-red-500/40'"
            :disabled="selectedCount === 0"
            @click="$emit('batch-delete')"
          >
            删除所选
          </button>
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl text-[15px] font-semibold transition-opacity"
            :class="canBatchMove ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--primary-color)]/20 text-white/60'"
            :disabled="!canBatchMove"
            @click="emitBatchMove"
          >
            {{ moveTargetGroupId === UNGROUPED_GROUP_ID ? '移到未分组' : '移到分组' }}
          </button>
        </div>
      </div>
      <div class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">已添加的贴纸</span>
        <div v-if="stickers.length === 0" class="bg-[var(--card-bg)] rounded-[10px] p-4 text-center text-[var(--text-secondary)]">暂无贴纸</div>
        <div
          v-for="sticker in stickers"
          :key="sticker.id"
          class="bg-[var(--card-bg)] rounded-[10px] p-3 flex items-center gap-3 transition-colors"
          :class="selectionMode && isSelected(sticker.id) ? 'ring-1 ring-[var(--primary-color)] bg-[var(--primary-color)]/6' : ''"
          @click="handleStickerClick(sticker.id)"
        >
          <button
            v-if="selectionMode"
            type="button"
            class="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors"
            :class="isSelected(sticker.id) ? 'border-[var(--primary-color)] bg-[var(--primary-color)] text-white' : 'border-[var(--border-color)] text-transparent'"
            @click.stop="$emit('toggle-select', sticker.id)"
          >
            <i class="ph ph-check text-[14px]"></i>
          </button>
          <img :src="sticker.url" class="w-12 h-12 object-contain rounded-lg bg-gray-100 dark:bg-gray-800" @error="handleImgError">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-[15px] text-[var(--text-primary)] truncate">{{ sticker.name }}</div>
            <div v-if="groupLabel(sticker)" class="text-[12px] text-[var(--text-secondary)] truncate">{{ groupLabel(sticker) }}</div>
            <div class="text-[12px] text-[var(--text-secondary)] truncate">{{ sticker.source === 'local' ? '本地' : sticker.url }}</div>
          </div>
          <template v-if="!selectionMode">
            <button class="text-[var(--primary-color)] px-2" @click.stop="$emit('edit', sticker.id)">
              <i class="ph ph-pencil-simple text-xl"></i>
            </button>
            <button class="text-red-500 px-2" @click.stop="$emit('delete', sticker.id)">
              <i class="ph ph-trash text-xl"></i>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
  stickerGroups: { type: Array, default: () => [] },
  selectionMode: { type: Boolean, default: false },
  selectedStickerIds: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'back',
  'uploadLocal',
  'batchImport',
  'manageGroups',
  'edit',
  'delete',
  'toggle-selection-mode',
  'toggle-select',
  'toggle-select-all',
  'batch-delete',
  'batch-move-group'
])

const UNGROUPED_GROUP_ID = '__ungrouped__'
const moveTargetGroupId = ref('')

const selectedStickerIdSet = computed(() => new Set(props.selectedStickerIds || []))
const selectedCount = computed(() => selectedStickerIdSet.value.size)
const allSelected = computed(() => props.stickers.length > 0 && selectedCount.value === props.stickers.length)
const canBatchMove = computed(() => selectedCount.value > 0 && !!moveTargetGroupId.value)

function isSelected(stickerId) {
  return selectedStickerIdSet.value.has(stickerId)
}

function handleStickerClick(stickerId) {
  if (!props.selectionMode) return
  emit('toggle-select', stickerId)
}

function emitBatchMove() {
  if (!canBatchMove.value) return
  emit('batch-move-group', moveTargetGroupId.value === UNGROUPED_GROUP_ID ? null : moveTargetGroupId.value)
}

function handleImgError(e) {
  if (e && e.target) {
    e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>x</text></svg>'
  }
}

function groupLabel(sticker) {
  const ids = Array.isArray(sticker?.groupIds) ? sticker.groupIds : []
  if (ids.length === 0) return '未分组'
  const names = ids
    .map(id => props.stickerGroups.find(group => group.id === id)?.name)
    .filter(Boolean)
  return names.join('、')
}

watch(() => props.selectionMode, (value) => {
  if (!value) {
    moveTargetGroupId.value = ''
  }
})

watch(() => props.visible, (value) => {
  if (!value) {
    moveTargetGroupId.value = ''
  }
})

watch(() => props.stickerGroups, (groups) => {
  if (!moveTargetGroupId.value || moveTargetGroupId.value === UNGROUPED_GROUP_ID) return
  const exists = (groups || []).some(group => group?.id === moveTargetGroupId.value)
  if (!exists) {
    moveTargetGroupId.value = ''
  }
}, { deep: true })
</script>
