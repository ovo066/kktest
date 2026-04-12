<script setup>
import { ref } from 'vue'
import { useMusicStore } from '../../stores/music'
import { useSettingsStore } from '../../stores/settings'
import { resolveMusicTrack } from '../../features/music'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  title: { type: String, default: '' },
  artist: { type: String, default: '' },
  cover: { type: String, default: '' },
  url: { type: String, default: '' },
  isUser: { type: Boolean, default: false }
})

const musicStore = useMusicStore()
const store = useSettingsStore()
const { showToast } = useToast()
const resolving = ref(false)

async function playMusic() {
  if (resolving.value) return

  const baseTrack = {
    title: props.title || '',
    artist: props.artist || '',
    cover: props.cover || '',
    url: props.url || ''
  }

  if (baseTrack.url) {
    musicStore.playTrack({
      title: baseTrack.title || '未知曲目',
      artist: baseTrack.artist || '未知歌手',
      cover: baseTrack.cover,
      url: baseTrack.url
    })
    return
  }

  resolving.value = true
  try {
    const resolved = await resolveMusicTrack(baseTrack, {
      apiUrl: store.musicSearchApiUrl || '',
      allowPreview: false
    })
    if (!resolved?.url) {
      showToast('这首歌暂时找不到可播放音源')
      return
    }
    musicStore.playTrack({
      title: resolved.title || baseTrack.title,
      artist: resolved.artist || baseTrack.artist,
      cover: resolved.cover || baseTrack.cover,
      url: resolved.url,
      source: resolved.source || 'online'
    })
  } catch {
    showToast('解析音源失败，请稍后重试')
  } finally {
    resolving.value = false
  }
}
</script>

<template>
  <div class="music-card-wrap" @click="playMusic">
    <div class="music-card" :class="isUser ? 'music-card-user' : 'music-card-ai'">
      <div class="music-card-body">
        <!-- Thumbnail -->
        <div class="music-card-thumb">
          <img v-if="cover" :src="cover" class="w-full h-full object-cover" />
          <div v-else class="music-card-thumb-placeholder">
            <i class="ph-fill ph-music-note text-white/50 text-xl"></i>
          </div>
          <div class="music-card-play-overlay">
            <div class="music-card-play-btn">
              <i v-if="resolving" class="ph ph-circle-notch animate-spin text-white text-xs"></i>
              <i v-else class="ph-fill ph-play text-white text-xs"></i>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="music-card-info">
          <h4 class="music-card-title">{{ title || '未知曲目' }}</h4>
          <p class="music-card-artist">{{ artist || '未知歌手' }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="music-card-footer">
        <div class="flex items-center gap-1">
          <i class="ph ph-music-notes text-[10px]"></i>
          <span class="text-[9px] uppercase tracking-wider font-bold">Music</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-card-wrap {
  cursor: pointer;
  max-width: 260px;
}

.music-card {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s ease;
}

.music-card:active {
  transform: scale(0.98);
}

.music-card-user {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2));
}

.music-card-ai {
  background: rgba(255, 255, 255, 0.08);
}

.dark .music-card-ai {
  background: rgba(255, 255, 255, 0.06);
}

.music-card-body {
  display: flex;
  padding: 10px;
  gap: 10px;
}

.music-card-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.music-card-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-color, #007AFF), #6366f1);
}

.music-card-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
}

.music-card-play-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.music-card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.music-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.music-card-artist {
  font-size: 11px;
  color: var(--text-secondary, rgba(255,255,255,0.6));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-card-footer {
  padding: 4px 10px 6px;
  background: rgba(0, 0, 0, 0.12);
  color: var(--text-secondary, rgba(255,255,255,0.4));
}
</style>
