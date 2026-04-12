<template>
  <div class="vn-theme-page absolute inset-0 z-20 bg-[#f8fafc] flex flex-col">
    <!-- Header -->
    <header
      class="vn-theme-header bg-white/80 backdrop-blur-xl px-5 flex items-center justify-between border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <button @click="router.push('/vn')" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-gray-50 active:scale-90 transition-transform">
        <i class="ph-bold ph-caret-left"></i>
      </button>
      <h1 class="text-xl font-black text-gray-900">资源管理</h1>
      <button @click="goPlay" class="text-indigo-600 font-bold text-[15px] px-2">播放</button>
    </header>

    <main class="flex-1 overflow-y-auto p-5 space-y-8 pb-24 no-scrollbar">
      <div v-if="!project" class="text-gray-400 text-sm mt-10 text-center">
        项目不存在
      </div>

      <template v-else>
        <!-- Backgrounds -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-gray-800 flex items-center gap-2">
              <i class="ph ph-image text-indigo-500"></i> 背景
            </h2>
            <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ bgEntries.length }}</span>
          </div>

          <div v-if="bgEntries.length === 0" class="py-10 flex flex-col items-center text-center">
            <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 text-gray-200">
              <i class="ph ph-image text-3xl"></i>
            </div>
            <p class="text-sm text-gray-400">暂无背景资源</p>
          </div>
          <div v-else class="grid grid-cols-2 gap-4">
            <div v-for="bg in bgEntries" :key="bg.name" class="group">
              <div class="aspect-video bg-gray-100 rounded-[20px] overflow-hidden border border-gray-100 shadow-sm">
                <div v-if="bg.url" class="w-full h-full bg-cover bg-center" :style="{ backgroundImage: `url('${bg.url}')` }"></div>
                <div v-else class="w-full h-full flex items-center justify-center text-gray-200">
                  <i class="ph ph-image text-3xl"></i>
                </div>
              </div>
              <p class="mt-2 text-[11px] font-bold text-gray-600 text-center truncate">{{ bg.name }}</p>
              <p v-if="bg.prompt" class="text-[10px] text-gray-400 text-center truncate">{{ bg.prompt }}</p>
            </div>
          </div>
        </section>

        <!-- Sprites -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-gray-800 flex items-center gap-2">
              <i class="ph ph-user-square text-violet-500"></i> 角色立绘
            </h2>
            <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ spriteEntries.length }}</span>
          </div>

          <div v-if="spriteEntries.length === 0" class="py-10 flex flex-col items-center text-center">
            <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 text-gray-200">
              <i class="ph ph-user text-3xl"></i>
            </div>
            <p class="text-sm text-gray-400">暂无立绘资源</p>
          </div>
          <div v-else class="grid grid-cols-3 gap-3">
            <div v-for="sp in spriteEntries" :key="sp.key" class="flex flex-col items-center">
              <div class="w-full aspect-[3/4] bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden flex items-end justify-center p-2">
                <img v-if="sp.url" :src="sp.url" class="h-full w-auto object-contain" alt="">
                <div v-else class="w-full h-full rounded-xl bg-gray-50 flex items-center justify-center">
                  <i class="ph ph-user text-3xl text-gray-200"></i>
                </div>
              </div>
              <div class="mt-2 text-center">
                <p class="text-[10px] font-bold text-gray-800">{{ sp.key.split('_')[0] }}</p>
                <p class="text-[9px] text-gray-400">{{ sp.key.split('_').slice(1).join('_') }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- BGM -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-gray-800 flex items-center gap-2">
              <i class="ph ph-music-notes text-rose-500"></i> 背景音乐
            </h2>
            <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ bgmEntries.length }}</span>
          </div>

          <!-- Add BGM -->
          <div class="p-5 rounded-[24px] bg-white border border-gray-100 shadow-sm space-y-3">
            <input
              ref="bgmFileInput"
              type="file"
              accept="audio/*"
              class="hidden"
              @change="handleBgmUpload"
            >
            <button
              class="w-full py-3 rounded-2xl bg-indigo-500 text-white text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
              @click="$refs.bgmFileInput.click()"
            >
              <i class="ph ph-upload-simple"></i> 上传本地音频
            </button>
            <div class="flex gap-2">
              <input
                v-model="bgmUrlInput"
                type="text"
                class="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[13px] text-gray-900 outline-none focus:border-indigo-400"
                placeholder="输入 BGM 链接..."
                @keydown.enter="addBgmFromUrl"
              >
              <button
                class="px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 text-[13px] font-bold active:scale-95 transition-all"
                @click="addBgmFromUrl"
              >
                添加
              </button>
            </div>
            <input
              v-model="bgmNameInput"
              type="text"
              class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[13px] text-gray-900 outline-none focus:border-indigo-400"
              placeholder="BGM 名称（用于 [bgm:名称] 指令）"
            >
          </div>

          <!-- BGM List -->
          <div v-if="bgmEntries.length === 0" class="py-8 flex flex-col items-center text-center">
            <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3 text-gray-200">
              <i class="ph ph-music-notes text-3xl"></i>
            </div>
            <p class="text-sm text-gray-400">暂无 BGM 资源</p>
          </div>
          <div v-else class="p-4 rounded-[24px] bg-white border border-gray-100 shadow-sm divide-y divide-gray-50">
            <div
              v-for="bgm in bgmEntries"
              :key="bgm.name"
              class="py-3 flex items-center justify-between first:pt-0 last:pb-0"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <button
                  class="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  @click="toggleBgmPreview(bgm)"
                >
                  <i :class="previewingBgm === bgm.name ? 'ph ph-pause' : 'ph ph-play-fill'" class="text-xs"></i>
                </button>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-gray-800 truncate">{{ bgm.name }}</h4>
                  <p class="text-[10px] text-gray-400 truncate">{{ bgm.type === 'local' ? '本地文件' : bgm.url }}</p>
                </div>
              </div>
              <button
                class="p-2 text-gray-300 hover:text-rose-500 transition-colors shrink-0"
                @click="deleteBgm(bgm.name)"
              >
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'

const router = useRouter()
const route = useRoute()
const vnStore = useVNStore()
const { scheduleSave } = useStorage()

const projectId = computed(() => String(route.params.projectId || ''))

const project = computed(() => {
  const list = vnStore.projects || []
  const p = Array.isArray(list) ? list.find(x => x.id === projectId.value) : null
  return p || null
})

onMounted(() => {
  if (projectId.value) vnStore.setCurrentProject(projectId.value)
})

onBeforeUnmount(() => {
  stopBgmPreview()
})

const bgEntries = computed(() => {
  const bgs = project.value?.resources?.backgrounds || {}
  return Object.keys(bgs).map(name => ({ name, ...(bgs[name] || {}) }))
})

const spriteEntries = computed(() => {
  const sps = project.value?.resources?.sprites || {}
  return Object.keys(sps).map(key => ({ key, ...(sps[key] || {}) }))
})

const bgmEntries = computed(() => {
  const bgms = project.value?.resources?.bgm || {}
  return Object.keys(bgms).map(name => ({ name, ...(bgms[name] || {}) }))
})

// BGM state
const bgmUrlInput = ref('')
const bgmNameInput = ref('')
const previewingBgm = ref(null)
let previewAudio = null

function handleBgmUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const name = bgmNameInput.value.trim() || file.name.replace(/\.[^.]+$/, '')
    saveBgm(name, reader.result, 'local')
    bgmNameInput.value = ''
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function addBgmFromUrl() {
  const url = bgmUrlInput.value.trim()
  if (!url) return

  const name = bgmNameInput.value.trim() || extractBgmName(url)
  saveBgm(name, url, 'url')
  bgmUrlInput.value = ''
  bgmNameInput.value = ''
}

function extractBgmName(url) {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop() || 'bgm'
    return filename.replace(/\.[^.]+$/, '')
  } catch {
    return 'bgm_' + Date.now()
  }
}

function saveBgm(name, url, type) {
  if (!project.value) return
  vnStore.setResource('bgm', name, { url, type, name })
  scheduleSave()
}

function deleteBgm(name) {
  if (!project.value) return
  if (previewingBgm.value === name) stopBgmPreview()
  delete project.value.resources.bgm[name]
  project.value.updatedAt = Date.now()
  scheduleSave()
}

function toggleBgmPreview(bgm) {
  if (previewingBgm.value === bgm.name) {
    stopBgmPreview()
  } else {
    stopBgmPreview()
    previewAudio = new Audio(bgm.url)
    previewAudio.volume = 0.5
    previewAudio.play().catch(() => {})
    previewingBgm.value = bgm.name
    previewAudio.onended = () => {
      previewingBgm.value = null
    }
  }
}

function stopBgmPreview() {
  if (previewAudio) {
    previewAudio.pause()
    previewAudio = null
  }
  previewingBgm.value = null
}

function goPlay() {
  if (!projectId.value) return
  vnStore.setCurrentProject(projectId.value)
  router.push(`/vn/play/${projectId.value}`)
}
</script>
