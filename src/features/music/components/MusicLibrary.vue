<script setup>
import { ref, computed } from 'vue'
import { useMusicStore } from '../../../stores/music'
import { useMusic } from '../composables/useMusic'
import { useMusicSearch } from '../composables/useMusicSearch'

const musicStore = useMusicStore()
const { handleFileUpload } = useMusic()
const { results: searchResults, searching, error: searchError, search, playResult, addToLibrary } = useMusicSearch()

const activeTab = ref('library') // 'library' | 'search'
const searchQuery = ref('')
const onlineQuery = ref('')
let searchTimer = null

const filteredLibrary = computed(() => {
  if (!searchQuery.value) return musicStore.library
  const q = searchQuery.value.toLowerCase()
  return musicStore.library.filter(t =>
    (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q)
  )
})

const onFileChange = (e) => {
  handleFileUpload(e.target.files)
  e.target.value = ''
}

function handleOnlineSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (onlineQuery.value.trim()) search(onlineQuery.value)
  }, 400)
}

function submitOnlineSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  if (onlineQuery.value.trim()) search(onlineQuery.value)
}
</script>

<template>
  <Transition name="lib-slide">
    <div v-if="musicStore.libraryOpen" class="music-library-sheet">
      <!-- Drag handle -->
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 bg-[var(--border-color)] rounded-full opacity-40"></div>
      </div>
      <!-- Header -->
      <div class="px-5 pb-3 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold" style="color: var(--text-primary)">音乐</h2>
          <button @click="musicStore.libraryOpen = false" class="w-7 h-7 rounded-full bg-[var(--border-color)]/30 flex items-center justify-center">
            <i class="ph ph-x text-sm" style="color: var(--text-secondary)"></i>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 p-0.5 rounded-xl" style="background: var(--input-bg, rgba(120,120,128,0.12))">
          <button
            class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            :class="activeTab === 'library' ? 'lib-tab-active' : 'lib-tab-inactive'"
            @click="activeTab = 'library'"
          >我的音乐</button>
          <button
            class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            :class="activeTab === 'search' ? 'lib-tab-active' : 'lib-tab-inactive'"
            @click="activeTab = 'search'"
          >在线搜索</button>
        </div>
      </div>

      <!-- Library Tab -->
      <div v-if="activeTab === 'library'" class="flex-1 overflow-y-auto flex flex-col">
        <div class="px-5 pb-3 flex flex-col gap-2">
          <div class="relative">
            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)"></i>
            <input v-model="searchQuery" type="text" placeholder="筛选本地音乐..."
              class="w-full rounded-xl py-2 pl-9 pr-4 outline-none text-sm"
              style="background: var(--input-bg, rgba(120,120,128,0.12)); color: var(--text-primary); border: 1px solid var(--input-border, transparent)" />
          </div>
          <label class="flex items-center justify-center gap-2 py-2 rounded-xl cursor-pointer font-medium text-xs text-white active:scale-[0.98] transition-transform"
            style="background: var(--primary-color, #007AFF)">
            <i class="ph ph-upload-simple"></i>
            <span>上传音乐</span>
            <input type="file" class="hidden" accept="audio/*" multiple @change="onFileChange" />
          </label>
        </div>
        <div class="flex-1 overflow-y-auto px-5 pb-8">
          <div v-if="filteredLibrary.length === 0" class="flex flex-col items-center justify-center py-16 opacity-40">
            <i class="ph ph-music-notes text-5xl mb-3" style="color: var(--text-secondary)"></i>
            <p class="text-sm" style="color: var(--text-secondary)">音乐库为空</p>
          </div>
          <div v-else class="flex flex-col gap-0.5">
            <div v-for="track in filteredLibrary" :key="track.id"
              class="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--card-bg)] transition-colors">
              <div class="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 cursor-pointer" @click="musicStore.playTrack(track)">
                <img v-if="track.cover" :src="track.cover" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center" style="background: linear-gradient(135deg, var(--primary-color), #6366f1)">
                  <i class="ph-fill ph-music-note text-lg text-white/50"></i>
                </div>
              </div>
              <div class="flex-1 overflow-hidden cursor-pointer" @click="musicStore.playTrack(track)">
                <h4 class="font-medium text-sm truncate" style="color: var(--text-primary)">{{ track.title }}</h4>
                <p class="text-xs truncate" style="color: var(--text-secondary)">{{ track.artist || '未知歌手' }}</p>
              </div>
              <button @click="musicStore.removeFromLibrary(track.id)"
                class="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60 hover:text-red-400">
                <i class="ph ph-trash text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Search Tab -->
      <div v-if="activeTab === 'search'" class="flex-1 overflow-y-auto flex flex-col">
        <div class="px-5 pb-3">
          <form class="relative" @submit.prevent="submitOnlineSearch">
            <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)"></i>
            <input v-model="onlineQuery" type="text" placeholder="搜索歌曲、歌手..."
              class="w-full rounded-xl py-2 pl-9 pr-4 outline-none text-sm"
              style="background: var(--input-bg, rgba(120,120,128,0.12)); color: var(--text-primary); border: 1px solid var(--input-border, transparent)"
              @input="handleOnlineSearch" />
          </form>
        </div>
        <div class="flex-1 overflow-y-auto px-5 pb-8">
          <div v-if="searching" class="flex items-center justify-center py-16">
            <i class="ph ph-circle-notch animate-spin text-2xl" style="color: var(--primary-color)"></i>
          </div>
          <div v-else-if="searchError" class="flex flex-col items-center justify-center py-16 opacity-60">
            <i class="ph ph-warning text-3xl mb-2" style="color: var(--text-secondary)"></i>
            <p class="text-xs text-center px-8" style="color: var(--text-secondary)">{{ searchError }}</p>
          </div>
          <div v-else-if="searchResults.length === 0 && onlineQuery" class="flex flex-col items-center justify-center py-16 opacity-40">
            <i class="ph ph-music-notes-simple text-5xl mb-3" style="color: var(--text-secondary)"></i>
            <p class="text-sm" style="color: var(--text-secondary)">未找到相关歌曲</p>
          </div>
          <div v-else-if="searchResults.length === 0" class="flex flex-col items-center justify-center py-16 opacity-40">
            <i class="ph ph-globe text-5xl mb-3" style="color: var(--text-secondary)"></i>
            <p class="text-sm" style="color: var(--text-secondary)">输入关键词搜索在线音乐</p>
          </div>
          <div v-else class="flex flex-col gap-0.5">
            <div v-for="track in searchResults" :key="track.id"
              class="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--card-bg)] transition-colors">
              <div class="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 cursor-pointer" @click="playResult(track)">
                <img v-if="track.cover" :src="track.cover" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center" style="background: linear-gradient(135deg, var(--primary-color), #6366f1)">
                  <i class="ph-fill ph-music-note text-lg text-white/50"></i>
                </div>
              </div>
              <div class="flex-1 overflow-hidden cursor-pointer" @click="playResult(track)">
                <h4 class="font-medium text-sm truncate" style="color: var(--text-primary)">{{ track.title }}</h4>
                <p class="text-xs truncate" style="color: var(--text-secondary)">{{ track.artist }}</p>
              </div>
              <button v-if="track.url" @click="addToLibrary(track)"
                class="w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                style="color: var(--primary-color)" title="收藏到音乐库">
                <i class="ph ph-plus text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.music-library-sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  height: 80vh;
  z-index: 110;
  display: flex;
  flex-direction: column;
  border-radius: 24px 24px 0 0;
  overflow: hidden;
  background: var(--bg-color, #f2f2f7);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.15);
}

.dark .music-library-sheet {
  background: var(--dark-bg-color, #1c1c1e);
}

.lib-tab-active {
  background: var(--card-bg, #fff);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.lib-tab-inactive {
  background: transparent;
  color: var(--text-secondary);
}

.lib-slide-enter-active,
.lib-slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.lib-slide-enter-from,
.lib-slide-leave-to {
  transform: translateY(100%);
}
</style>
