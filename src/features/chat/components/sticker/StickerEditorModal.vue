<template>
  <div v-if="visible" class="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
    <div class="bg-[var(--card-bg)] rounded-2xl w-full max-w-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] text-center">
        <span class="font-semibold text-[17px] text-[var(--text-primary)]">{{ sticker?.id ? '编辑贴纸' : '添加贴纸' }}</span>
      </div>
      <div class="p-4 space-y-3 max-h-[70vh] overflow-y-auto no-scrollbar">
        <div class="flex flex-col items-center gap-3">
          <img :src="sticker?.url || ''" class="w-20 h-20 object-contain rounded-lg bg-gray-100 dark:bg-gray-800">
        </div>
        <div class="bg-[var(--bg-color)]/60 rounded-xl overflow-hidden border border-[var(--border-color)]">
          <input
            v-model="form.name"
            type="text"
            placeholder="贴纸名称"
            class="w-full px-3 py-3 text-[15px] outline-none bg-transparent text-[var(--text-primary)] border-b border-[var(--border-color)]"
          >
          <textarea
            v-model="form.aliases"
            rows="2"
            placeholder="别名，多个用逗号分隔"
            class="w-full px-3 py-3 text-[14px] outline-none resize-none bg-transparent text-[var(--text-primary)] border-b border-[var(--border-color)]"
          ></textarea>
          <textarea
            v-model="form.keywords"
            rows="2"
            placeholder="关键词，多个用逗号分隔"
            class="w-full px-3 py-3 text-[14px] outline-none resize-none bg-transparent text-[var(--text-primary)]"
          ></textarea>
        </div>

        <div class="bg-[var(--bg-color)]/60 rounded-xl p-3 border border-[var(--border-color)]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[13px] text-[var(--text-secondary)] uppercase">贴纸分组</span>
            <button class="text-[13px] text-[var(--primary-color)]" @click="$emit('manageGroups')">管理分组</button>
          </div>
          <div v-if="stickerGroups.length === 0" class="text-[13px] text-[var(--text-secondary)]">暂无分组，可先创建后再分配</div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="group in stickerGroups"
              :key="group.id"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="form.groupIds.includes(group.id) ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'"
              @click="toggleGroup(group.id)"
            >
              {{ group.name }}
            </button>
          </div>
          <div class="text-[12px] text-[var(--text-secondary)] mt-2">不选则视为未分组。</div>
        </div>
      </div>
      <div class="flex border-t border-[var(--border-color)]">
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] border-r border-[var(--border-color)]" @click="$emit('cancel')">取消</button>
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] font-semibold" @click="handleConfirm">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  sticker: { type: Object, default: null },
  stickerGroups: { type: Array, default: () => [] }
})

const emit = defineEmits(['cancel', 'confirm', 'manageGroups'])

const form = reactive({
  name: '',
  aliases: '',
  keywords: '',
  groupIds: []
})

function joinList(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

function splitList(text) {
  return String(text || '')
    .split(/[\n,，、|/\\]+/g)
    .map(item => item.trim())
    .filter(Boolean)
}

watch(() => [props.visible, props.sticker], () => {
  if (!props.visible) return
  form.name = String(props.sticker?.name || '').trim()
  form.aliases = joinList(props.sticker?.aliases)
  form.keywords = joinList(props.sticker?.keywords)
  form.groupIds = Array.isArray(props.sticker?.groupIds) ? [...props.sticker.groupIds] : []
}, { immediate: true })

function toggleGroup(groupId) {
  const index = form.groupIds.indexOf(groupId)
  if (index > -1) {
    form.groupIds.splice(index, 1)
  } else {
    form.groupIds.push(groupId)
  }
}

function handleConfirm() {
  emit('confirm', {
    name: String(form.name || '').trim(),
    aliases: splitList(form.aliases),
    keywords: splitList(form.keywords),
    groupIds: [...form.groupIds]
  })
}
</script>
