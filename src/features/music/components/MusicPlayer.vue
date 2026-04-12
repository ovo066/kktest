<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useMusicStore } from '../../../stores/music'
import { useMusic } from '../composables/useMusic'
import { useLyrics } from '../../../composables/useLyrics'

const musicStore = useMusicStore()
const { seek, setVolume, togglePlay } = useMusic()
const { lines: lyricsLines, hasLyrics, currentLineIndex, loading: lyricsLoading } = useLyrics()

const track = computed(() => musicStore.currentTrack)
const showQueue = ref(false)
const showLyrics = ref(false)
const lyricRefs = ref([])

const setLyricRef = (el, index) => {
  if (el) lyricRefs.value[index] = el
}

watch(currentLineIndex, (idx) => {
  if (idx >= 0 && lyricRefs.value[idx]) {
    nextTick(() => {
      lyricRefs.value[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})

const closePlayer = () => {
  musicStore.playerOpen = false
}

const exitListenTogether = () => {
  musicStore.exitListenTogether()
}

const handleSeek = (e) => {
  seek(parseFloat(e.target.value))
}

const handleVolume = (e) => {
  setVolume(parseFloat(e.target.value))
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

const playModeIcon = computed(() => {
  const m = musicStore.playMode
  if (m === 'shuffle') return 'ph-fill ph-shuffle'
  if (m === 'single') return 'ph-fill ph-repeat-once'
  return 'ph-fill ph-repeat'
})

const playModeActive = computed(() => {
  return musicStore.playMode !== 'order'
})

function cyclePlayMode() {
  const modes = ['order', 'loop', 'single', 'shuffle']
  const idx = modes.indexOf(musicStore.playMode)
  musicStore.playMode = modes[(idx + 1) % modes.length]
}
</script>

<template>
  <Transition name="player-slide">
    <div v-if="musicStore.playerOpen" class="music-player-overlay">
      <!-- Close Handle -->
      <div class="player-handle" @click="closePlayer">
        <div class="w-10 h-1 bg-white/20 rounded-full"></div>
      </div>

      <!-- Page 1: Cover + Controls -->
      <div v-if="!showLyrics" class="player-content" @click.self="hasLyrics && (showLyrics = true)">
        <!-- Album Art (click to enter lyrics) -->
        <div class="player-art-wrap" @click="hasLyrics && (showLyrics = true)">
          <img v-if="track?.cover" :src="track.cover" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <i class="ph-fill ph-music-note text-7xl text-white/30"></i>
          </div>
        </div>

        <!-- Info -->
        <div class="w-full text-center mt-6 mb-4 px-4">
          <h2 class="text-xl font-bold text-white mb-1 truncate">{{ track?.title || '未在播放' }}</h2>
          <p class="text-white/60 text-base">{{ track?.artist || '未知歌手' }}</p>
        </div>

        <!-- Progress Bar -->
        <div class="w-full flex flex-col gap-1 px-6 mb-4">
          <div class="relative w-full h-1.5 bg-white/10 rounded-full group cursor-pointer">
            <input
              type="range" :min="0" :max="musicStore.duration || 0" :value="musicStore.progress"
              @input="handleSeek"
              class="player-range-input"
            />
            <div class="absolute left-0 top-0 h-full bg-white rounded-full" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <div class="flex justify-between text-[11px] text-white/40 font-mono">
            <span>{{ formatTime(musicStore.progress) }}</span>
            <span>{{ formatTime(musicStore.duration) }}</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="w-full flex items-center justify-between px-8 mb-6">
          <button @click="cyclePlayMode" :class="playModeActive ? 'text-[var(--primary-color)]' : 'text-white/40'">
            <i :class="playModeIcon" class="text-xl"></i>
          </button>
          <button @click="musicStore.prevTrack()" class="text-white hover:scale-110 active:scale-95 transition-transform">
            <i class="ph-fill ph-skip-back text-3xl"></i>
          </button>
          <button
            @click="togglePlay()"
            class="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
          >
            <i :class="musicStore.isPlaying ? 'ph-fill ph-pause' : 'ph-fill ph-play'" class="text-3xl"></i>
          </button>
          <button @click="musicStore.nextTrack()" class="text-white hover:scale-110 active:scale-95 transition-transform">
            <i class="ph-fill ph-skip-forward text-3xl"></i>
          </button>
          <button @click="showQueue = true" class="text-white/40">
            <i class="ph-fill ph-list text-xl"></i>
          </button>
        </div>

        <!-- Volume -->
        <div class="w-full flex items-center gap-3 px-8 mb-6">
          <i class="ph ph-speaker-low text-white/40 text-sm"></i>
          <div class="flex-1 relative h-1 bg-white/10 rounded-full">
            <input
              type="range" min="0" max="1" step="0.01" :value="musicStore.volume"
              @input="handleVolume"
              class="player-range-input"
            />
            <div class="absolute left-0 top-0 h-full bg-white/60 rounded-full" :style="{ width: `${musicStore.volume * 100}%` }"></div>
          </div>
          <i class="ph ph-speaker-high text-white/40 text-sm"></i>
        </div>

        <!-- Listen Together -->
        <div class="w-full flex justify-center items-center gap-2">
          <button
            @click="musicStore.setListenTogether(musicStore.listenContactId, !musicStore.listenTogether)"
            class="flex items-center gap-2 px-5 py-2 rounded-full transition-colors"
            :class="musicStore.listenTogether ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'bg-white/5 text-white/50'"
          >
            <i class="ph-fill ph-users text-base"></i>
            <span class="text-xs font-bold">{{ musicStore.listenTogether ? '一起听 · 已开启' : '一起听' }}</span>
          </button>
          <button
            v-if="musicStore.listenTogether"
            @click="exitListenTogether"
            class="flex items-center gap-1 px-4 py-2 rounded-full bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
          >
            <i class="ph ph-sign-out text-sm"></i>
            <span class="text-xs font-medium">退出</span>
          </button>
        </div>
      </div>

      <!-- Page 2: Full-screen Lyrics -->
      <div v-else class="lyrics-page" @click="showLyrics = false">
        <!-- Song info top bar -->
        <div class="lyrics-page-header">
          <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
            <img v-if="track?.cover" :src="track.cover" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600"></div>
          </div>
          <div class="flex-1 overflow-hidden">
            <p class="text-white text-sm font-bold truncate">{{ track?.title || '未在播放' }}</p>
            <p class="text-white/50 text-xs truncate">{{ track?.artist || '未知歌手' }}</p>
          </div>
          <button @click.stop="showLyrics = false" class="text-white/40 hover:text-white/70 p-1">
            <i class="ph ph-caret-down text-xl"></i>
          </button>
        </div>

        <!-- Lyrics body -->
        <div class="lyrics-body" @click.stop>
          <div v-if="lyricsLoading" class="lyrics-empty">歌词加载中...</div>
          <div v-else-if="!hasLyrics" class="lyrics-empty">暂无歌词</div>
          <div v-else class="lyrics-scroll">
            <div class="lyrics-spacer"></div>
            <div
              v-for="(line, i) in lyricsLines" :key="i"
              :ref="(el) => setLyricRef(el, i)"
              class="lyrics-line"
              :class="{
                'is-current': i === currentLineIndex,
                'is-past': i < currentLineIndex,
                'is-future': i > currentLineIndex
              }"
            >{{ line.text }}</div>
            <div class="lyrics-spacer"></div>
          </div>
        </div>

        <!-- Bottom mini controls -->
        <div class="lyrics-page-controls" @click.stop>
          <div class="w-full flex flex-col gap-1 px-6 mb-3">
            <div class="relative w-full h-1 bg-white/10 rounded-full">
              <input
                type="range" :min="0" :max="musicStore.duration || 0" :value="musicStore.progress"
                @input="handleSeek"
                class="player-range-input"
              />
              <div class="absolute left-0 top-0 h-full bg-white rounded-full" :style="{ width: `${progressPercent}%` }"></div>
            </div>
            <div class="flex justify-between text-[10px] text-white/40 font-mono">
              <span>{{ formatTime(musicStore.progress) }}</span>
              <span>{{ formatTime(musicStore.duration) }}</span>
            </div>
          </div>
          <div class="flex items-center justify-center gap-8">
            <button @click="musicStore.prevTrack()" class="text-white hover:scale-110 transition-transform">
              <i class="ph-fill ph-skip-back text-2xl"></i>
            </button>
            <button
              @click="togglePlay()"
              class="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl"
            >
              <i :class="musicStore.isPlaying ? 'ph-fill ph-pause' : 'ph-fill ph-play'" class="text-2xl"></i>
            </button>
            <button @click="musicStore.nextTrack()" class="text-white hover:scale-110 transition-transform">
              <i class="ph-fill ph-skip-forward text-2xl"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Queue Sheet -->
      <Transition name="player-slide">
        <div v-if="showQueue" class="queue-overlay">
          <div class="flex justify-between items-center px-6 mb-4">
            <h3 class="text-lg font-bold text-white">播放队列</h3>
            <button @click="showQueue = false" class="text-white/60 text-sm">关闭</button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 pb-8">
            <div v-if="musicStore.queue.length === 0" class="text-center text-white/30 py-12">队列为空</div>
            <div
              v-for="(item, index) in musicStore.queue" :key="item.id || index"
              class="flex items-center gap-3 py-3 border-b border-white/5"
              :class="{ 'text-[var(--primary-color)]': index === musicStore.currentIndex }"
            >
              <div class="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                <img v-if="item.cover" :src="item.cover" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center"><i class="ph ph-music-note"></i></div>
              </div>
              <div class="flex-1 overflow-hidden" @click="musicStore.playTrack(item)">
                <p class="font-medium text-sm truncate">{{ item.title }}</p>
                <p class="text-xs opacity-50 truncate">{{ item.artist }}</p>
              </div>
              <button @click="musicStore.removeFromQueue(item.id)" class="text-white/30 hover:text-red-400 p-1">
                <i class="ph ph-x text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.music-player-overlay {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(40px);
}

.player-handle {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.player-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 16px 32px;
  overflow-y: auto;
}

.player-art-wrap {
  width: 100%;
  max-width: 280px;
  aspect-ratio: 1;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

/* Page 2: Full-screen lyrics */
.lyrics-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 0 24px;
  overflow: hidden;
}

.lyrics-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px 12px;
  flex-shrink: 0;
}

.lyrics-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.lyrics-body::before,
.lyrics-body::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 2;
  pointer-events: none;
}

.lyrics-body::before {
  top: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.88), transparent);
}

.lyrics-body::after {
  bottom: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.88), transparent);
}

.lyrics-scroll {
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  text-align: center;
  padding: 0 24px;
}

.lyrics-scroll::-webkit-scrollbar {
  display: none;
}

.lyrics-spacer {
  height: 40%;
}

.lyrics-line {
  padding: 8px 0;
  font-size: 16px;
  line-height: 1.6;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  color: rgba(255, 255, 255, 0.3);
  filter: blur(1px);
}

.lyrics-line.is-past {
  color: rgba(255, 255, 255, 0.25);
  filter: blur(0.5px);
}

.lyrics-line.is-current {
  color: white;
  font-size: 22px;
  font-weight: 700;
  filter: none;
  transform: scale(1.05);
}

.lyrics-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
}

.lyrics-page-controls {
  flex-shrink: 0;
  padding: 12px 0 0;
}

.player-range-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 10;
  margin: 0;
}

.queue-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  z-index: 20;
  display: flex;
  flex-direction: column;
  padding-top: 64px;
}

.player-slide-enter-active,
.player-slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.player-slide-enter-from,
.player-slide-leave-to {
  transform: translateY(100%);
}
</style>
