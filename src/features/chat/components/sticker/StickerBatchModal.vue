<template>
  <div v-if="visible" class="absolute inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4">
    <div class="bg-[var(--card-bg)] rounded-2xl w-full max-w-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] text-center">
        <span class="font-semibold text-[17px] text-[var(--text-primary)]">批量导入</span>
      </div>
      <div class="p-4">
        <p class="text-[13px] text-[var(--text-secondary)] mb-1">支持：标签:URL、标签 URL、`[分组] 标签 URL`、`分组/标签 URL`</p>
        <p class="text-[12px] text-[var(--text-secondary)] mb-3">也支持 JSON；带 `group/groups/分组` 字段时会自动创建并分配分组</p>

        <div class="bg-[var(--bg-color)]/60 rounded-xl p-3 border border-[var(--border-color)] mb-3">
          <div class="flex items-center justify-between mb-2 gap-3">
            <span class="text-[13px] text-[var(--text-secondary)] uppercase">导入到分组</span>
            <button class="text-[13px] text-[var(--primary-color)] shrink-0" @click="$emit('manageGroups')">管理分组</button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="selectedGroupId === '' ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'"
              @click="selectedGroupId = ''"
            >
              未分组
            </button>
            <button
              v-for="group in stickerGroups"
              :key="group.id"
              type="button"
              class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
              :class="selectedGroupId === group.id ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'"
              @click="selectedGroupId = group.id"
            >
              {{ group.name }}
            </button>
          </div>
          <input
            v-model="newGroupName"
            type="text"
            placeholder="或新建分组名称（可选）"
            class="w-full mt-3 px-3 py-2.5 text-[14px] outline-none rounded-lg bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)]"
          >
        </div>

        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept=".txt,.json,text/plain,application/json"
          @change="onFileChange"
        >
        <button
          class="w-full mb-3 py-2.5 rounded-lg border border-[var(--border-color)] text-[13px] text-[var(--primary-color)]"
          @click="openFilePicker"
        >
          导入 txt/json 文件
        </button>

        <textarea
          :value="modelValue"
          rows="8"
          placeholder="[难过] 流泪猫 https://example.com/sad.png
开心/哈哈狗 https://example.com/happy.png
{&quot;name&quot;:&quot;摸鱼水獭&quot;,&quot;url&quot;:&quot;https://example.com/work.png&quot;,&quot;group&quot;:&quot;打工&quot;}"
          class="w-full border border-[var(--border-color)] rounded-lg p-3 text-[15px] outline-none resize-none bg-transparent text-[var(--text-primary)]"
          @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
      </div>
      <div class="flex border-t border-[var(--border-color)]">
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] border-r border-[var(--border-color)]" @click="$emit('cancel')">取消</button>
        <button class="flex-1 py-3 text-[var(--primary-color)] text-[17px] font-semibold" @click="emitConfirm">导入</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
  stickerGroups: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'cancel', 'confirm', 'import-file', 'manageGroups'])

const fileInput = ref(null)
const selectedGroupId = ref('')
const newGroupName = ref('')

watch(() => props.visible, (value) => {
  if (!value) return
  selectedGroupId.value = ''
  newGroupName.value = ''
}, { immediate: true })

watch(() => props.stickerGroups, (groups) => {
  if (!selectedGroupId.value) return
  const exists = (groups || []).some(group => group?.id === selectedGroupId.value)
  if (!exists) {
    selectedGroupId.value = ''
  }
}, { deep: true })

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  emit('import-file', {
    file,
    groupId: selectedGroupId.value || null,
    newGroupName: String(newGroupName.value || '').trim()
  })
  event.target.value = ''
}

function emitConfirm() {
  emit('confirm', {
    groupId: selectedGroupId.value || null,
    newGroupName: String(newGroupName.value || '').trim()
  })
}
</script>
