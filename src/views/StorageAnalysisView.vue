<template>
  <div class="absolute inset-0 z-20 bg-[var(--bg-color)] flex flex-col">
    <!-- Header -->
    <div class="pt-app-lg pb-2 px-4 flex items-center justify-between">
      <button class="text-[var(--primary-color)] text-[17px] flex items-center gap-1" @click="router.back()">
        <i class="ph ph-caret-left text-xl"></i>
        <span>设置</span>
      </button>
      <h1 class="text-[17px] font-semibold text-[var(--text-primary)]">存储空间</h1>
      <div class="w-16"></div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
      <!-- Storage Bar -->
      <div class="space-y-3">
        <div class="flex items-end justify-between px-1">
          <span class="text-[28px] font-bold text-[var(--text-primary)]">{{ formatBytes(totalSize) }}</span>
          <span class="text-[13px] text-[var(--text-secondary)]">已使用</span>
        </div>
        <div class="h-3 rounded-full overflow-hidden flex bg-[var(--border-color)]" v-if="totalSize > 0">
          <div
            v-for="seg in barSegments"
            :key="seg.key"
            :style="{ width: seg.percent + '%', backgroundColor: seg.color }"
            class="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
          ></div>
        </div>
        <div v-else class="h-3 rounded-full bg-[var(--border-color)]"></div>
      </div>

      <!-- Category List -->
      <div class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">分类</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <div
            v-for="(cat, idx) in categories"
            :key="cat.key"
            class="px-4 py-3.5 flex items-center gap-3"
            :class="{ 'border-b border-[var(--border-color)]': idx < categories.length - 1 }"
          >
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[16px]" :style="{ backgroundColor: cat.color }">
              <i :class="cat.icon"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-center">
                <span class="text-[17px] text-[var(--text-primary)]">{{ cat.label }}</span>
                <span class="text-[15px] text-[var(--text-secondary)]">{{ formatBytes(cat.size) }}</span>
              </div>
              <span class="text-[12px] text-[var(--text-secondary)]">{{ cat.desc }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Per-Contact Breakdown (only if contacts exist) -->
      <div v-if="contactBreakdown.length" class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">按联系人</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <div
            v-for="(item, idx) in contactBreakdown"
            :key="item.id"
            class="px-4 py-3 flex items-center gap-3"
            :class="{ 'border-b border-[var(--border-color)]': idx < contactBreakdown.length - 1 }"
          >
            <div class="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center text-[14px] overflow-hidden shrink-0">
              <template v-if="item.avatarType === 'emoji'">{{ item.avatar }}</template>
              <img v-else-if="item.avatar" :src="item.avatar" class="w-full h-full object-cover" />
              <i v-else class="ph ph-user text-[var(--text-secondary)]"></i>
            </div>
            <div class="flex-1 min-w-0 truncate">
              <span class="text-[15px] text-[var(--text-primary)]">{{ item.name || '未命名' }}</span>
              <span class="text-[12px] text-[var(--text-secondary)] ml-2">{{ item.msgCount }} 条消息</span>
            </div>
            <span class="text-[14px] text-[var(--text-secondary)] shrink-0">{{ formatBytes(item.size) }}</span>
          </div>
        </div>
      </div>

      <!-- Block Export / Import -->
      <div class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">分块管理</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <div
            v-for="(item, idx) in exportBlocks"
            :key="item.key"
            class="px-4 py-3 flex items-center gap-3"
            :class="{ 'border-b border-[var(--border-color)]': idx < exportBlocks.length - 1 }"
          >
            <i :class="item.icon" class="text-xl text-[var(--primary-color)] shrink-0"></i>
            <span class="text-[15px] text-[var(--text-primary)] flex-1 min-w-0">{{ item.label }}</span>
            <button class="px-3 py-1 rounded-md text-[13px] text-[var(--primary-color)] border border-[var(--border-color)]" @click="handleBlockExport(item.key)">导出</button>
            <button class="px-3 py-1 rounded-md text-[13px] text-[var(--primary-color)] border border-[var(--border-color)]" @click="triggerBlockImport(item.key)">导入</button>
          </div>
        </div>
        <input ref="blockImportInput" type="file" class="hidden" accept="application/json" @change="handleBlockImport" />
      </div>

      <!-- Full export / import -->
      <div class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">全量操作</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <button
            class="w-full px-4 py-3.5 text-[var(--primary-color)] flex items-center justify-center gap-2 border-b border-[var(--border-color)]"
            @click="handleFullExport"
          >
            <i class="ph ph-export text-xl"></i>
            <span class="text-[17px]">导出完整备份（ZIP）</span>
          </button>
          <button
            class="w-full px-4 py-3.5 text-[var(--primary-color)] flex items-center justify-center gap-2 border-b border-[var(--border-color)]"
            @click="handleFullExportJson"
          >
            <i class="ph ph-file-arrow-down text-xl"></i>
            <span class="text-[17px]">导出兼容备份（JSON）</span>
          </button>
          <button
            class="w-full px-4 py-3.5 text-[var(--primary-color)] flex items-center justify-center gap-2"
            @click="fullImportInput?.click()"
          >
            <i class="ph ph-download text-xl"></i>
            <span class="text-[17px]">导入全部数据</span>
          </button>
          <input
            ref="fullImportInput"
            type="file"
            class="hidden"
            accept=".zip,.json,application/zip,application/x-zip-compressed,application/json"
            @change="handleFullImport"
          />
        </div>
        <p class="px-1 text-[12px] text-[var(--text-secondary)]">支持 .zip / .json。推荐 ZIP；如果手机文件选择器不方便选压缩包，可导出 JSON 兼容备份。</p>
      </div>

      <div class="h-8"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts'
import { useConfigsStore } from '../stores/configs'
import { useLorebookStore } from '../stores/lorebook'
import { usePersonasStore } from '../stores/personas'
import { useStickersStore } from '../stores/stickers'
import { useWidgetsStore } from '../stores/widgets'
import { useVNStore } from '../stores/vn'
import { useReaderStore } from '../stores/reader'
import { useSettingsStore } from '../stores/settings'
import { useMomentsStore } from '../stores/moments'
import { useAlbumStore } from '../stores/album'
import { useLivenessStore } from '../stores/liveness'
import { useCharacterResourcesStore } from '../stores/characterResources'
import { useStorage } from '../composables/useStorage'
import { useToast } from '../composables/useToast'
import { showConfirm } from '../composables/useConfirm'
import { toLocalDateKey } from '../utils/dateKey'
import { downloadBlob } from '../utils/download'

const router = useRouter()
const contactsStore = useContactsStore()
const configsStore = useConfigsStore()
const lorebookStore = useLorebookStore()
const personasStore = usePersonasStore()
const stickersStore = useStickersStore()
const widgetsStore = useWidgetsStore()
const vnStore = useVNStore()
const readerStore = useReaderStore()
const settingsStore = useSettingsStore()
const momentsStore = useMomentsStore()
const albumStore = useAlbumStore()
const livenessStore = useLivenessStore()
const charResStore = useCharacterResourcesStore()
const { scheduleSave, exportData, importData } = useStorage()
const { showToast } = useToast()

const blockImportInput = ref(null)
const fullImportInput = ref(null)
const pendingImportKey = ref('')
const analysisData = ref(null)

function roughSize(obj) {
  try {
    const str = JSON.stringify(obj)
    return str ? str.length * 2 : 0  // JS strings are UTF-16
  } catch { return 0 }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const val = bytes / Math.pow(k, i)
  return val.toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i]
}

function analyze() {
  const contacts = contactsStore.contacts || []
  const configs = configsStore.configs || []
  const lorebook = lorebookStore.lorebook?.books || []
  const personas = personasStore.personas || []
  const stickers = stickersStore.stickers || []
  const forum = momentsStore.moments || []
  const albumPhotos = albumStore.photos || []
  const vnProjects = vnStore.projects || []
  const readerBooks = readerStore.books || []
  const widgets = widgetsStore.widgets || []
  const charRes = charResStore.exportData()
  const liveness = livenessStore.exportData()
  const savedThemes = settingsStore.savedThemes || []

  // Messages size (inside contacts)
  let msgsSize = 0
  let promptsSize = 0
  let contactMetaSize = 0
  const perContact = contacts.map(c => {
    const msgs = c.msgs || []
    const mSize = roughSize(msgs)
    msgsSize += mSize
    const pSize = roughSize(c.prompt || '')
    promptsSize += pSize
    const rest = roughSize({ ...c, msgs: [], prompt: '' })
    contactMetaSize += rest
    return {
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      avatarType: c.avatarType,
      msgCount: msgs.length,
      size: mSize + pSize + rest
    }
  })
  perContact.sort((a, b) => b.size - a.size)

  const configsSize = roughSize(configs)
  const lorebookSize = roughSize(lorebook)
  const personasSize = roughSize(personas)
  const stickersSize = roughSize(stickers)
  const forumSize = roughSize(forum)
  const albumSize = roughSize(albumPhotos)
  const vnSize = roughSize(vnProjects)
  const readerSize = roughSize(readerBooks)
  const widgetsSize = roughSize(widgets)
  const charResSize = roughSize(charRes)
  const livenessSize = roughSize(liveness)
  const themesSize = roughSize(savedThemes) + roughSize(settingsStore.theme)

  analysisData.value = {
    msgsSize,
    promptsSize,
    contactMetaSize,
    configsSize,
    lorebookSize,
    personasSize,
    stickersSize,
    forumSize,
    albumSize,
    vnSize,
    readerSize,
    widgetsSize,
    charResSize,
    livenessSize,
    themesSize,
    perContact
  }
}

const totalSize = computed(() => {
  if (!analysisData.value) return 0
  const d = analysisData.value
  return d.msgsSize + d.promptsSize + d.contactMetaSize + d.configsSize + d.lorebookSize +
    d.personasSize + d.stickersSize + d.forumSize + d.albumSize + d.vnSize +
    d.readerSize + d.widgetsSize + d.charResSize + d.livenessSize + d.themesSize
})

const COLORS = {
  messages: '#007AFF',
  contacts: '#5856D6',
  configs: '#FF9500',
  lorebook: '#34C759',
  personas: '#AF52DE',
  stickers: '#FF2D55',
  forum: '#FF3B30',
  album: '#00C7BE',
  vn: '#5AC8FA',
  reader: '#FFD60A',
  themes: '#FF6482',
  other: '#8E8E93'
}

const categories = computed(() => {
  if (!analysisData.value) return []
  const d = analysisData.value
  return [
    { key: 'messages', label: '聊天记录', desc: `${(contactsStore.contacts || []).reduce((s, c) => s + (c.msgs?.length || 0), 0)} 条消息`, size: d.msgsSize + d.promptsSize + d.contactMetaSize, color: COLORS.messages, icon: 'ph ph-chat-circle-dots' },
    { key: 'configs', label: 'API 配置', desc: `${(configsStore.configs || []).length} 个配置`, size: d.configsSize, color: COLORS.configs, icon: 'ph ph-gear' },
    { key: 'lorebook', label: '世界书', desc: `${(lorebookStore.lorebook?.books || []).length} 本`, size: d.lorebookSize, color: COLORS.lorebook, icon: 'ph ph-book-open' },
    { key: 'personas', label: '人格面具', desc: `${(personasStore.personas || []).length} 个`, size: d.personasSize, color: COLORS.personas, icon: 'ph ph-mask-happy' },
    { key: 'stickers', label: '贴纸', desc: `${(stickersStore.stickers || []).length} 组`, size: d.stickersSize, color: COLORS.stickers, icon: 'ph ph-smiley-sticker' },
    { key: 'forum', label: '朋友圈', desc: `${(momentsStore.moments || []).length} 条动态`, size: d.forumSize, color: COLORS.forum, icon: 'ph ph-camera' },
    { key: 'album', label: '相册', desc: `${(albumStore.photos || []).length} 张照片`, size: d.albumSize, color: COLORS.album, icon: 'ph ph-images' },
    { key: 'vn', label: '视觉小说', desc: `${(vnStore.projects || []).length} 个项目`, size: d.vnSize, color: COLORS.vn, icon: 'ph ph-film-strip' },
    { key: 'reader', label: '阅读器', desc: `${(readerStore.books || []).length} 本书`, size: d.readerSize, color: COLORS.reader, icon: 'ph ph-book-bookmark' },
    { key: 'themes', label: '主题预设', desc: `${(settingsStore.savedThemes || []).length} 个预设`, size: d.themesSize, color: COLORS.themes, icon: 'ph ph-palette' },
    { key: 'other', label: '其他', desc: '小组件/角色资源/拟真引擎', size: d.widgetsSize + d.charResSize + d.livenessSize, color: COLORS.other, icon: 'ph ph-dots-three' }
  ].filter(c => c.size > 0)
})

const barSegments = computed(() => {
  const total = totalSize.value
  if (total === 0) return []
  return categories.value.map(c => ({
    key: c.key,
    color: c.color,
    percent: Math.max(0.5, (c.size / total) * 100)
  }))
})

const contactBreakdown = computed(() => {
  if (!analysisData.value) return []
  return analysisData.value.perContact.slice(0, 20)
})

const exportBlocks = [
  { key: 'contacts', label: '聊天记录', icon: 'ph ph-chat-circle-dots' },
  { key: 'configs', label: 'API 配置', icon: 'ph ph-gear' },
  { key: 'lorebook', label: '世界书', icon: 'ph ph-book-open' },
  { key: 'personas', label: '人格面具', icon: 'ph ph-mask-happy' },
  { key: 'stickers', label: '贴纸', icon: 'ph ph-smiley-sticker' },
  { key: 'forum', label: '朋友圈', icon: 'ph ph-camera' },
  { key: 'album', label: '相册', icon: 'ph ph-images' },
  { key: 'vn', label: '视觉小说', icon: 'ph ph-film-strip' },
  { key: 'reader', label: '阅读器', icon: 'ph ph-book-bookmark' },
  { key: 'themes', label: '主题预设', icon: 'ph ph-palette' }
]

function getBlockData(key) {
  switch (key) {
    case 'contacts': return contactsStore.contacts || []
    case 'configs': return configsStore.configs || []
    case 'lorebook': return lorebookStore.lorebook?.books || []
    case 'personas': return personasStore.personas || []
    case 'stickers': return stickersStore.stickers || []
    case 'forum': return momentsStore.moments || []
    case 'album': return albumStore.photos || []
    case 'vn': return vnStore.projects || []
    case 'reader': return readerStore.books || []
    case 'themes': return { savedThemes: settingsStore.savedThemes || [], theme: settingsStore.theme || {} }
    default: return null
  }
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: Date.now(), blockType: filename.replace(/\.json$/, ''), data }, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}

function redactConfigsForExport(configs) {
  if (!Array.isArray(configs)) return configs
  return configs.map(cfg => {
    if (!cfg || typeof cfg !== 'object') return cfg
    return { ...cfg, key: '' }
  })
}

async function handleBlockExport(key) {
  const data = getBlockData(key)
  if (!data) return

  let includeSecrets = false
  if (key === 'configs') {
    includeSecrets = await showConfirm({
      title: '导出 API 配置',
      message: '是否在导出的配置中包含 API Key？推荐不包含，以免误分享泄露。',
      confirmText: '包含 Key',
      cancelText: '不包含 Key'
    })
  }

  const finalData = (key === 'configs' && !includeSecrets) ? redactConfigsForExport(data) : data
  const date = toLocalDateKey()
  downloadJson(finalData, `aichat_${key}_${date}.json`)
  const label = exportBlocks.find(b => b.key === key)?.label || key
  if (key === 'configs') {
    showToast(includeSecrets ? `已导出 ${label}（包含 Key）` : `已导出 ${label}（不包含 Key）`)
  } else {
    showToast('已导出 ' + label)
  }
}

function triggerBlockImport(key) {
  pendingImportKey.value = key
  blockImportInput.value?.click()
}

async function handleBlockImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const key = pendingImportKey.value
  if (!key) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const data = parsed.data || parsed
    applyBlockData(key, data)
    scheduleSave()
    showToast('已导入 ' + exportBlocks.find(b => b.key === key)?.label)
    analyze()
  } catch {
    showToast('导入失败')
  }
  e.target.value = ''
}

function applyBlockData(key, data) {
  switch (key) {
    case 'contacts':
      if (Array.isArray(data)) contactsStore.contacts = data
      break
    case 'configs':
      if (Array.isArray(data)) configsStore.configs = data
      break
    case 'lorebook':
      if (Array.isArray(data)) lorebookStore.lorebook.books = data
      break
    case 'personas':
      if (Array.isArray(data)) personasStore.personas = data
      break
    case 'stickers':
      if (Array.isArray(data)) stickersStore.stickers = data
      break
    case 'forum':
      if (Array.isArray(data)) momentsStore.moments.splice(0, momentsStore.moments.length, ...data)
      break
    case 'album':
      if (Array.isArray(data)) albumStore.photos = data
      break
    case 'vn':
      if (Array.isArray(data)) vnStore.projects = data
      break
    case 'reader':
      if (Array.isArray(data)) readerStore.books = data
      break
    case 'themes':
      if (data && typeof data === 'object') {
        if (Array.isArray(data.savedThemes)) settingsStore.savedThemes = data.savedThemes
        if (data.theme) Object.assign(settingsStore.theme, data.theme)
      }
      break
  }
}

async function confirmFullExportSecrets() {
  return await showConfirm({
    title: '导出全部数据',
    message: '是否在备份中包含 API Key 等敏感信息？推荐不包含，以免误分享泄露。',
    confirmText: '包含 Key',
    cancelText: '不包含 Key'
  })
}

async function handleFullExport() {
  const includeSecrets = await confirmFullExportSecrets()
  const success = await exportData({ includeSecrets, format: 'zip' })
  if (success) {
    showToast(includeSecrets ? '已导出完整备份（ZIP，包含 Key）' : '已导出完整备份（ZIP，不包含 Key）')
  }
}

async function handleFullExportJson() {
  const includeSecrets = await confirmFullExportSecrets()
  const success = await exportData({ includeSecrets, format: 'json' })
  if (success) {
    showToast(includeSecrets ? '已导出兼容备份（JSON，包含 Key）' : '已导出兼容备份（JSON，不包含 Key）')
  }
}

async function handleFullImport(e) {
  const file = e.target.files?.[0]
  if (!file) return

  const confirmed = await showConfirm({
    title: '导入全部数据',
    message: '导入将覆盖当前已保存的数据，建议先导出备份。是否继续？',
    confirmText: '继续导入',
    cancelText: '取消'
  })
  if (!confirmed) {
    e.target.value = ''
    return
  }

  const success = await importData(file)
  if (success) {
    showToast('已导入')
    analyze()
  } else {
    showToast('导入失败')
  }
  e.target.value = ''
}

onMounted(() => {
  analyze()
})
</script>
