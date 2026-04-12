<template>
  <div class="vn-theme-page absolute inset-0 z-20 bg-[#fafafa] flex flex-col">
    <!-- Header -->
    <header
      class="vn-theme-header sticky top-0 z-40 bg-white/80 backdrop-blur-xl px-6 flex items-center justify-between border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <div>
        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Visual Novel</h1>
        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] mt-0.5">Creative Studio</p>
      </div>
      <button
        class="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
        @click="router.push('/vn/wizard')"
      >
        <i class="ph-bold ph-plus"></i>
      </button>
    </header>

    <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8 space-y-5 pt-5">
      <!-- Return home -->
      <button
        class="w-full rounded-2xl bg-white border border-gray-100 px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-all shadow-sm"
        @click="router.push('/')"
      >
        <div class="flex items-center gap-2.5 text-gray-600">
          <i class="ph ph-house text-lg"></i>
          <span class="font-medium text-[14px]">返回桌面</span>
        </div>
        <i class="ph ph-caret-right text-gray-300"></i>
      </button>

      <!-- Quick tools -->
      <div class="grid grid-cols-2 gap-4">
        <button
          class="bg-white border border-gray-100 rounded-[24px] p-4 flex flex-col items-start gap-3 active:scale-[0.97] transition-all shadow-sm group"
          @click="router.push('/vn/image-config')"
        >
          <div class="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-active:bg-indigo-500 group-active:text-white transition-colors">
            <i class="ph ph-palette text-xl"></i>
          </div>
          <div>
            <div class="text-gray-800 text-[13px] font-bold">画笔配置</div>
            <div class="text-gray-400 text-[10px] mt-0.5">API & 生成策略</div>
          </div>
        </button>
        <button
          class="bg-white border border-gray-100 rounded-[24px] p-4 flex flex-col items-start gap-3 active:scale-[0.97] transition-all shadow-sm group"
          @click="showCharacterPicker = true"
        >
          <div class="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 group-active:bg-rose-500 group-active:text-white transition-colors">
            <i class="ph ph-user-rectangle text-xl"></i>
          </div>
          <div>
            <div class="text-gray-800 text-[13px] font-bold">立绘工房</div>
            <div class="text-gray-400 text-[10px] mt-0.5">管理角色素材</div>
          </div>
        </button>
      </div>

      <!-- Section title -->
      <div class="flex items-center justify-between px-1 pt-2">
        <h2 class="text-[11px] font-black text-gray-400 uppercase tracking-widest">我的项目 ({{ projects.length }})</h2>
      </div>

      <!-- Empty state -->
      <div v-if="projects.length === 0" class="py-16 flex flex-col items-center text-center space-y-4">
        <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
          <i class="ph ph-notebook text-4xl"></i>
        </div>
        <div>
          <h4 class="font-bold text-gray-700">还没有剧本</h4>
          <p class="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">点击右上角 + 号，开始创造你的第一个视觉小说</p>
        </div>
      </div>

      <!-- Project cards -->
      <div
        v-for="p in projects"
        :key="p.id"
        class="bg-white border border-gray-100 rounded-[28px] shadow-sm overflow-hidden"
      >
        <!-- Project card header -->
        <div
          class="px-5 py-5 flex items-center gap-4 cursor-pointer active:bg-gray-50 transition-colors"
          @click="goPlay(p.id)"
        >
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0">
            <i class="ph ph-game-controller text-2xl text-indigo-400"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-gray-900 font-bold text-[16px] truncate">{{ p.name }}</div>
            <div class="text-gray-400 text-[12px] mt-1 truncate line-clamp-1">
              {{ p.worldSetting || '自由剧情' }}
            </div>
            <div class="flex items-center gap-3 mt-2">
              <span class="text-gray-400 text-[11px] flex items-center gap-1">
                <i class="ph ph-users"></i>{{ (p.characters || []).length }}
              </span>
              <span class="text-gray-400 text-[11px] flex items-center gap-1">
                <i class="ph ph-clock"></i>{{ formatTime(p.updatedAt) }}
              </span>
            </div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center text-white shrink-0 shadow-lg active:scale-90 transition-transform">
            <i class="ph ph-play-fill text-xl"></i>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="px-5 pb-4 flex items-center gap-2">
          <button
            class="h-8 px-3 rounded-xl bg-gray-50 text-gray-500 text-[12px] font-medium active:bg-gray-100 transition-colors"
            @click.stop="goSetup(p.id)"
          >
            <i class="ph ph-gear-six mr-1"></i>设置
          </button>
          <button
            class="h-8 px-3 rounded-xl bg-gray-50 text-gray-500 text-[12px] font-medium active:bg-gray-100 transition-colors"
            @click.stop="goResources(p.id)"
          >
            <i class="ph ph-images mr-1"></i>资源
          </button>
          <button
            class="h-8 px-3 rounded-xl bg-gray-50 text-gray-500 text-[12px] font-medium active:bg-gray-100 transition-colors"
            @click.stop="goPrepare(p.id)"
          >
            <i class="ph ph-download-simple mr-1"></i>预生成
          </button>
          <div class="flex-1"></div>
          <button
            class="h-8 px-3 rounded-xl bg-red-50 text-red-400 text-[12px] font-medium active:bg-red-100 transition-colors"
            @click.stop="removeProject(p.id)"
          >
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Character picker bottom sheet -->
    <Transition name="vn-sheet">
      <div
        v-if="showCharacterPicker"
        class="absolute inset-0 z-30 flex items-end justify-center"
      >
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showCharacterPicker = false"></div>
        <div class="w-full max-w-[560px] max-h-[70vh] rounded-t-[32px] bg-white border-t border-gray-100 flex flex-col overflow-hidden z-10 shadow-2xl">
          <div class="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
            <span class="text-gray-900 font-bold text-[17px]">选择角色</span>
            <button
              class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 active:scale-90"
              @click="showCharacterPicker = false"
            >
              <i class="ph ph-x text-base"></i>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 pb-8 space-y-2">
            <button
              v-for="c in contacts"
              :key="c.id"
              class="w-full rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center gap-3 active:bg-gray-100 transition-colors"
              @click="goStudio(c.id)"
            >
              <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                <img v-if="c.avatarType === 'image' && c.avatar" :src="c.avatar" class="w-full h-full object-cover" />
                <span v-else-if="c.avatarType === 'emoji' && c.avatar">{{ c.avatar }}</span>
                <span v-else class="text-gray-400 text-[13px]">{{ (c.name || '?')[0] }}</span>
              </div>
              <div class="flex-1 min-w-0 text-left">
                <div class="text-gray-800 text-[14px] font-medium truncate">{{ c.name }}</div>
              </div>
              <i class="ph ph-caret-right text-gray-300"></i>
            </button>
            <div v-if="contacts.length === 0" class="text-center py-8 text-gray-400 text-[13px]">
              暂无角色，请先在聊天中创建联系人
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVNStore } from '../../../stores/vn'
import { useContactsStore } from '../../../stores/contacts'
import { useStorage } from '../../../composables/useStorage'

const router = useRouter()
const vnStore = useVNStore()
const contactsStore = useContactsStore()
const { scheduleSave } = useStorage()

const showCharacterPicker = ref(false)

const contacts = computed(() => {
  return (contactsStore.contacts || []).filter(c => !c.isGroup)
})

const projects = computed(() => {
  const list = vnStore.projects || []
  return Array.isArray(list) ? [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : []
})

function goSetup(projectId) {
  router.push(`/vn/setup/${projectId}`)
}

function goResources(projectId) {
  router.push(`/vn/resources/${projectId}`)
}

function goPrepare(projectId) {
  vnStore.setCurrentProject(projectId)
  router.push(`/vn/prepare/${projectId}`)
}

function goPlay(projectId) {
  vnStore.setCurrentProject(projectId)
  router.push(`/vn/play/${projectId}`)
}

function removeProject(projectId) {
  vnStore.deleteProject(projectId)
  scheduleSave()
}

function goStudio(contactId) {
  showCharacterPicker.value = false
  router.push(`/vn/studio/${contactId}`)
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`

  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.vn-sheet-enter-active { transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1); }
.vn-sheet-leave-active { transition: all 0.3s ease; }
.vn-sheet-enter-from,
.vn-sheet-leave-to { opacity: 0; }
.vn-sheet-enter-from > div:last-child { transform: translateY(100%); }
.vn-sheet-leave-to > div:last-child { transform: translateY(30%); }
</style>

