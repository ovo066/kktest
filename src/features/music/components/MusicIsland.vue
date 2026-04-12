<script setup>
import { computed } from 'vue'
import { useMusicStore } from '../../../stores/music'
import { useMusic } from '../composables/useMusic'
import { useLyrics } from '../../../composables/useLyrics'

const musicStore = useMusicStore()
const { togglePlay } = useMusic()
const { currentLineText } = useLyrics()

const track = computed(() => musicStore.currentTrack)

const showingLyric = computed(() => !!currentLineText.value)

const displayText = computed(() => {
  if (currentLineText.value) return currentLineText.value
  if (!track.value) return ''
  return track.value.title + (track.value.artist ? ` · ${track.value.artist}` : '')
})

const toggleExpand = () => {
  musicStore.islandExpanded = !musicStore.islandExpanded
}

const handlePlayPause = (e) => {
  e.stopPropagation()
  togglePlay()
}

const openPlayer = (e) => {
  e.stopPropagation()
  musicStore.islandExpanded = false
  musicStore.playerOpen = true
}

const exitListenTogether = (e) => {
  e.stopPropagation()
  musicStore.exitListenTogether()
}

const formatTime = (seconds) => {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const progressPercent = computed(() => {
  if (!musicStore.duration) return 0
  return (musicStore.progress / musicStore.duration) * 100
})
</script>

<template>
  <div
    v-if="track"
    class="music-island"
    :class="musicStore.islandExpanded ? 'is-expanded' : 'is-collapsed'"
    @click="!musicStore.islandExpanded && toggleExpand()"
  >
    <!-- Collapsed State -->
    <template v-if="!musicStore.islandExpanded">
      <div class="flex items-center w-full px-2 gap-2">
        <div class="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
          <img v-if="track.cover" :src="track.cover" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600"></div>
        </div>
        <div class="flex-1 overflow-hidden">
          <Transition name="lyric-fade" mode="out-in">
            <div
              :key="displayText"
              class="text-[10px] text-white font-medium whitespace-nowrap"
              :class="showingLyric ? 'island-lyric' : 'island-marquee'"
            >{{ displayText }}</div>
          </Transition>
        </div>
        <button @click="handlePlayPause" class="text-white hover:scale-110 transition-transform">
          <i :class="musicStore.isPlaying ? 'ph-fill ph-pause' : 'ph-fill ph-play'" class="text-xs"></i>
        </button>
      </div>
    </template>

    <!-- Expanded State -->
    <template v-else>
      <div class="flex flex-col h-full text-white">
        <div class="flex justify-between items-start mb-3">
          <div class="flex gap-3 flex-1 overflow-hidden cursor-pointer" @click="openPlayer">
            <div class="w-14 h-14 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
              <img v-if="track.cover" :src="track.cover" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <i class="ph-fill ph-music-note text-2xl text-white/50"></i>
              </div>
            </div>
            <div class="flex flex-col justify-center overflow-hidden">
              <h3 class="font-bold text-sm truncate">{{ track.title }}</h3>
              <p class="text-xs text-white/60 truncate">{{ track.artist }}</p>
            </div>
          </div>
          <button @click="toggleExpand" class="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0">
            <i class="ph ph-caret-up text-base"></i>
          </button>
        </div>

        <!-- Progress -->
        <div class="mb-3">
          <div class="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-1">
            <div class="h-full bg-white transition-all duration-300" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <div class="flex justify-between text-[10px] text-white/40">
            <span>{{ formatTime(musicStore.progress) }}</span>
            <span>{{ formatTime(musicStore.duration) }}</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-between px-2">
          <button @click="musicStore.prevTrack()" class="hover:scale-110 transition-transform">
            <i class="ph-fill ph-skip-back text-lg"></i>
          </button>
          <button
            @click="handlePlayPause"
            class="w-9 h-9 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
          >
            <i :class="musicStore.isPlaying ? 'ph-fill ph-pause' : 'ph-fill ph-play'" class="text-lg"></i>
          </button>
          <button @click="musicStore.nextTrack()" class="hover:scale-110 transition-transform">
            <i class="ph-fill ph-skip-forward text-lg"></i>
          </button>
          <button
            @click.stop="musicStore.setListenTogether(musicStore.listenContactId, !musicStore.listenTogether)"
            :class="musicStore.listenTogether ? 'text-[var(--primary-color)]' : 'text-white/40'"
            class="transition-colors"
          >
            <i class="ph-fill ph-users text-lg"></i>
          </button>
        </div>

        <div v-if="musicStore.listenTogether" class="mt-3 flex justify-center">
          <button
            @click="exitListenTogether"
            class="px-4 py-1.5 rounded-full bg-white/10 text-white/70 text-[11px] font-medium hover:bg-white/20 transition-colors"
          >
            退出一起听
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.music-island {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.is-collapsed {
  width: 180px;
  height: 36px;
  border-radius: 9999px;
  background: #000;
  padding: 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.is-expanded {
  width: 340px;
  border-radius: 32px;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(20px);
  padding: 16px;
}

.island-marquee {
  display: inline-block;
  animation: island-scroll 8s linear infinite;
}

.island-lyric {
  display: inline-block;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 100%;
}

.lyric-fade-enter-active,
.lyric-fade-leave-active {
  transition: opacity 0.3s ease;
}

.lyric-fade-enter-from,
.lyric-fade-leave-to {
  opacity: 0;
}

@keyframes island-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
</style>
