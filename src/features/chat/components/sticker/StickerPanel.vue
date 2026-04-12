<template>
  <div
    v-if="visible"
    class="absolute bottom-0 left-0 right-0 bg-[var(--bg-color)] dark:bg-[var(--card-bg)] rounded-t-2xl shadow-2xl z-40"
    style="height: 45%;"
  >
    <div class="flex justify-between items-center px-4 py-3 border-b border-[var(--border-color)]">
      <button class="text-[var(--primary-color)] text-[15px]" @click="$emit('manage')">管理</button>
      <span class="font-semibold text-[17px] text-[var(--text-primary)]">贴纸</span>
      <button class="text-[var(--primary-color)] text-[15px]" @click="$emit('close')">完成</button>
    </div>
    <!-- 搜索栏 -->
    <div class="px-3 pt-2 pb-1">
      <div class="flex items-center bg-[var(--card-bg)] dark:bg-[var(--bg-color)] rounded-lg px-3 py-[6px]">
        <i class="ph ph-magnifying-glass text-[var(--text-secondary)] text-[16px] mr-2 shrink-0"></i>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="搜索贴纸"
          class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
        >
        <button v-if="searchQuery" class="text-[var(--text-secondary)] ml-1 shrink-0" @click="searchQuery = ''">
          <i class="ph-fill ph-x-circle text-[16px]"></i>
        </button>
      </div>
    </div>
    <div v-if="groupTabs.length > 1" class="px-3 pb-2 overflow-x-auto no-scrollbar">
      <div class="flex items-center gap-2 min-w-max">
        <button
          v-for="tab in groupTabs"
          :key="tab.id"
          class="px-3 py-1.5 rounded-full text-[12px] transition-colors whitespace-nowrap"
          :class="selectedGroupId === tab.id ? 'bg-[var(--primary-color)] text-white' : 'bg-[var(--card-bg)] dark:bg-[var(--bg-color)] text-[var(--text-secondary)]'"
          @click="selectedGroupId = tab.id"
        >
          {{ tab.name }}
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-3 grid grid-cols-4 gap-2 no-scrollbar" style="max-height: calc(100% - 138px);">
      <div v-if="stickers.length === 0" class="col-span-4 text-center text-[var(--text-secondary)] py-8">暂无贴纸，点击管理添加</div>
      <div v-else-if="filteredStickers.length === 0" class="col-span-4 text-center text-[var(--text-secondary)] py-8">未找到匹配的贴纸</div>
      <button
        v-for="sticker in filteredStickers"
        :key="sticker.id"
        class="aspect-square bg-[var(--card-bg)] dark:bg-[var(--bg-color)] rounded-xl p-2 cursor-pointer active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"
        @click="$emit('select', sticker.name)"
      >
        <img :src="sticker.url" class="max-w-full max-h-[80%] object-contain" @error="handleImgError">
        <span v-if="searchQuery" class="text-[10px] text-[var(--text-secondary)] truncate w-full text-center">{{ sticker.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { filterStickersByGroupIds } from '../../../../utils/stickerGroups'

const props = defineProps({
  visible: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
  stickerGroups: { type: Array, default: () => [] }
})

defineEmits(['select', 'manage', 'close'])

const searchQuery = ref('')
const searchInput = ref(null)
const selectedGroupId = ref('__all__')

// 模糊匹配：将搜索词的每个字符拆开，按顺序匹配目标字符串
function fuzzyMatch(name, query) {
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  let ni = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = n.indexOf(q[qi], ni)
    if (idx === -1) return false
    ni = idx + 1
  }
  return true
}

const groupTabs = computed(() => {
  const tabs = [{ id: '__all__', name: '全部' }]
  const groups = Array.isArray(props.stickerGroups) ? props.stickerGroups : []
  groups.forEach((group) => {
    const count = filterStickersByGroupIds(props.stickers, [group.id]).length
    if (count > 0) {
      tabs.push({ id: group.id, name: group.name })
    }
  })
  const ungroupedCount = props.stickers.filter(sticker => !Array.isArray(sticker?.groupIds) || sticker.groupIds.length === 0).length
  if (ungroupedCount > 0) {
    tabs.push({ id: '__ungrouped__', name: '未分组' })
  }
  return tabs
})

const filteredStickers = computed(() => {
  let list = props.stickers
  if (selectedGroupId.value === '__ungrouped__') {
    list = list.filter(sticker => !Array.isArray(sticker?.groupIds) || sticker.groupIds.length === 0)
  } else if (selectedGroupId.value !== '__all__') {
    list = filterStickersByGroupIds(list, [selectedGroupId.value])
  }

  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.trim()
  return list.filter(s => fuzzyMatch(s.name || '', q))
})

// 面板关闭时清空搜索
watch(() => props.visible, (v) => {
  if (!v) {
    searchQuery.value = ''
    selectedGroupId.value = '__all__'
  }
})

watch(groupTabs, (tabs) => {
  if (!tabs.some(tab => tab.id === selectedGroupId.value)) {
    selectedGroupId.value = '__all__'
  }
})

function handleImgError(e) {
  if (e && e.target) {
    e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>x</text></svg>'
  }
}
</script>
