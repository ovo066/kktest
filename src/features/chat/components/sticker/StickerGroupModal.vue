<template>
  <div v-if="visible" class="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
    <div class="bg-[var(--card-bg)] rounded-2xl w-full max-w-md overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] text-center">
        <span class="font-semibold text-[17px] text-[var(--text-primary)]">贴纸分组</span>
      </div>
      <div class="p-4 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
        <div class="space-y-2">
          <div v-if="groups.length === 0" class="text-[13px] text-[var(--text-secondary)] text-center py-4">暂无分组</div>
          <div
            v-for="group in groups"
            :key="group.id"
            class="flex items-stretch gap-2"
          >
            <button
              type="button"
              class="flex-1 px-3 py-3 rounded-xl border text-left transition-colors"
              :class="form.id === group.id ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/8' : 'border-[var(--border-color)] bg-[var(--bg-color)]/40'"
              @click="selectGroup(group)"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-[15px] text-[var(--text-primary)] truncate">{{ group.name }}</div>
                  <div v-if="group.description" class="text-[12px] text-[var(--text-secondary)] truncate">{{ group.description }}</div>
                </div>
                <span class="text-[12px] text-[var(--text-secondary)] shrink-0">{{ stickerCount(group.id) }} 张</span>
              </div>
            </button>
            <button
              type="button"
              class="w-11 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 shrink-0"
              :aria-label="`删除分组 ${group.name}`"
              @click.stop="$emit('delete', group.id)"
            >
              <i class="ph ph-trash text-lg"></i>
            </button>
          </div>
        </div>

        <div class="bg-[var(--bg-color)]/60 rounded-xl overflow-hidden border border-[var(--border-color)]">
          <input
            v-model="form.name"
            type="text"
            placeholder="分组名称"
            class="w-full px-3 py-3 text-[15px] outline-none bg-transparent text-[var(--text-primary)] border-b border-[var(--border-color)]"
          >
          <textarea
            v-model="form.description"
            rows="2"
            placeholder="分组说明（可选）"
            class="w-full px-3 py-3 text-[14px] outline-none resize-none bg-transparent text-[var(--text-primary)]"
          ></textarea>
        </div>

        <div class="flex gap-2">
          <button type="button" class="flex-1 py-2.5 rounded-xl bg-[var(--primary-color)] text-white text-[15px] font-semibold" @click="handleSave">
            {{ form.id ? '更新分组' : '新建分组' }}
          </button>
          <button
            v-if="form.id"
            type="button"
            class="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-[15px] font-semibold"
            @click="$emit('delete', form.id)"
          >
            删除
          </button>
          <button
            v-if="form.id"
            type="button"
            class="px-4 py-2.5 rounded-xl bg-[var(--card-bg)] text-[var(--text-secondary)] text-[15px]"
            @click="resetForm"
          >
            取消编辑
          </button>
        </div>
      </div>
      <div class="flex border-t border-[var(--border-color)]">
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] font-semibold" @click="$emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  groups: { type: Array, default: () => [] },
  stickers: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'save', 'delete'])

const form = reactive({
  id: '',
  name: '',
  description: ''
})

const pendingCreatedGroup = ref(null)

function normalizeGroupText(value) {
  return String(value || '').trim().toLowerCase()
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.description = ''
}

function selectGroup(group) {
  form.id = String(group?.id || '')
  form.name = String(group?.name || '')
  form.description = String(group?.description || '')
}

function stickerCount(groupId) {
  return (props.stickers || []).filter((sticker) => Array.isArray(sticker?.groupIds) && sticker.groupIds.includes(groupId)).length
}

function handleSave() {
  pendingCreatedGroup.value = form.id
    ? null
    : {
        name: form.name,
        description: form.description
      }
  emit('save', {
    id: form.id || null,
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim()
  })
  if (!form.id) {
    resetForm()
  }
}

watch(() => props.visible, (visible) => {
  if (!visible) resetForm()
})

watch(() => props.groups, (groups) => {
  const currentExists = groups.some(group => group?.id === form.id)
  if (form.id && !currentExists) {
    resetForm()
  }

  if (!pendingCreatedGroup.value) return

  const expectedName = normalizeGroupText(pendingCreatedGroup.value.name)
  const expectedDescription = normalizeGroupText(pendingCreatedGroup.value.description)
  const createdGroup = groups.find((group) => (
    normalizeGroupText(group?.name) === expectedName
      && normalizeGroupText(group?.description) === expectedDescription
  ))
  if (!createdGroup) return

  selectGroup(createdGroup)
  pendingCreatedGroup.value = null
}, { deep: true })
</script>
