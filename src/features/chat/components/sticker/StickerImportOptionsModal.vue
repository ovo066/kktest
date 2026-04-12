<template>
  <div v-if="visible" class="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
    <div class="bg-[var(--card-bg)] rounded-2xl w-full max-w-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] text-center">
        <span class="font-semibold text-[17px] text-[var(--text-primary)]">导入贴纸</span>
      </div>

      <div class="p-4 space-y-3">
        <p v-if="summary" class="text-[13px] text-[var(--text-secondary)]">{{ summary }}</p>

        <div class="bg-[var(--bg-color)]/60 rounded-xl p-3 border border-[var(--border-color)]">
          <div class="flex items-center justify-between mb-2 gap-3">
            <span class="text-[13px] text-[var(--text-secondary)] uppercase">导入到分组</span>
            <button class="text-[13px] text-[var(--primary-color)] shrink-0" @click="$emit('manageGroups')">管理分组</button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="form.groupId === '' ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'"
              @click="form.groupId = ''"
            >
              未分组
            </button>
            <button
              v-for="group in groups"
              :key="group.id"
              type="button"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="form.groupId === group.id ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'"
              @click="form.groupId = group.id"
            >
              {{ group.name }}
            </button>
          </div>

          <div class="text-[12px] text-[var(--text-secondary)] mt-2">也可以直接新建分组，填写后会优先使用新分组。</div>
        </div>

        <div class="bg-[var(--bg-color)]/60 rounded-xl overflow-hidden border border-[var(--border-color)]">
          <input
            v-model="form.newGroupName"
            type="text"
            placeholder="新建分组名称（可选）"
            class="w-full px-3 py-3 text-[15px] outline-none bg-transparent text-[var(--text-primary)]"
          >
        </div>
      </div>

      <div class="flex border-t border-[var(--border-color)]">
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] border-r border-[var(--border-color)]" @click="$emit('cancel')">取消</button>
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] font-semibold" @click="handleConfirm">开始导入</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  groups: { type: Array, default: () => [] },
  summary: { type: String, default: '' }
})

const emit = defineEmits(['cancel', 'confirm', 'manageGroups'])

const form = reactive({
  groupId: '',
  newGroupName: ''
})

watch(() => props.visible, (value) => {
  if (!value) return
  form.groupId = ''
  form.newGroupName = ''
}, { immediate: true })

watch(() => props.groups, (groups) => {
  if (!form.groupId) return
  const exists = (groups || []).some(group => group?.id === form.groupId)
  if (!exists) {
    form.groupId = ''
  }
}, { deep: true })

function handleConfirm() {
  emit('confirm', {
    groupId: String(form.groupId || '').trim() || null,
    newGroupName: String(form.newGroupName || '').trim()
  })
}
</script>
