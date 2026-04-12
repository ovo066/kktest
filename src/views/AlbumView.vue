<template>
  <div class="album-root" :class="{ dark: settingsStore.isDark }">

    <!-- ===== Person Detail Sub-view ===== -->
    <transition name="album-push">
      <div v-if="albumStore.selectedContactId" class="album-view album-person-detail" key="person">
        <header class="album-header">
          <button class="hdr-btn" @click="exitPerson">
            <i class="ph-bold ph-caret-left"></i>
          </button>
          <div class="hdr-center">
            <div class="hdr-avatar" v-if="selectedPerson">
              <img v-if="selectedPerson.avatar && !selectedPerson.avatar.startsWith('#')" :src="selectedPerson.avatar" alt="" />
              <span v-else class="hdr-avatar-fb">{{ (selectedPerson.contactName || '?')[0] }}</span>
            </div>
            <span class="hdr-title">{{ selectedPerson?.contactName || '' }}</span>
          </div>
          <span class="hdr-count">{{ personPhotos.length }}</span>
        </header>
        <div class="album-body">
          <AlbumGrid
            v-if="personPhotos.length"
            :photos="personPhotos"
            @select="openViewer"
          />
          <div v-else class="album-empty">
            <div class="empty-icon">📸</div>
            <p class="empty-title">暂无照片</p>
          </div>
        </div>
      </div>
    </transition>

    <!-- ===== Main View ===== -->
    <div class="album-view" :class="{ 'is-behind': !!albumStore.selectedContactId }">
      <!-- Header -->
      <header class="album-header">
        <button class="hdr-btn" @click="router.back()">
          <i class="ph-bold ph-caret-left"></i>
        </button>
        <span class="hdr-title">相册</span>
        <label class="hdr-btn">
          <i class="ph ph-plus"></i>
          <input type="file" accept="image/*" multiple hidden @change="handleUpload" />
        </label>
      </header>

      <!-- Tabs (iOS segmented style) -->
      <div class="seg-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="seg-item"
          :class="{ active: albumStore.activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Body -->
      <div class="album-body">

        <!-- Photos tab -->
        <template v-if="albumStore.activeTab === 'photos'">
          <AlbumGrid
            v-if="albumStore.sortedPhotos.length"
            :photos="albumStore.sortedPhotos"
            @select="openViewer"
          />
          <div v-else class="album-empty">
            <div class="empty-icon">📸</div>
            <p class="empty-title">等待第一份回忆</p>
            <p class="empty-sub">和TA聊天时的照片会出现在这里</p>
          </div>
        </template>

        <!-- People tab -->
        <template v-else-if="albumStore.activeTab === 'people'">
          <AlbumContactPills
            v-if="albumStore.contactsWithPhotos.length"
            :contacts="albumStore.contactsWithPhotos"
            @select="enterPerson"
          />
          <div v-else class="album-empty">
            <div class="empty-icon">👤</div>
            <p class="empty-title">暂无人物</p>
            <p class="empty-sub">聊天中的图片会按角色自动归类</p>
          </div>
        </template>

        <!-- Favorites tab -->
        <template v-else>
          <AlbumGrid
            v-if="albumStore.favoritePhotos.length"
            :photos="albumStore.favoritePhotos"
            @select="openViewer"
          />
          <div v-else class="album-empty">
            <div class="empty-icon">❤️</div>
            <p class="empty-title">暂无收藏</p>
            <p class="empty-sub">浏览照片时点击爱心即可收藏</p>
          </div>
        </template>
      </div>
    </div>

    <!-- ===== Viewer ===== -->
    <AlbumViewer
      :photo="viewerPhoto"
      :has-prev="viewerIndex > 0"
      :has-next="viewerIndex < currentViewerList.length - 1"
      @close="closeViewer"
      @toggle-favorite="handleToggleFavorite"
      @delete="handleDelete"
      @prev="navigateViewer(-1)"
      @next="navigateViewer(1)"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAlbumStore } from '../stores/album'
import { useContactsStore } from '../stores/contacts'
import { useSettingsStore } from '../stores/settings'
import { useStorage } from '../composables/useStorage'
import AlbumGrid from '../components/album/AlbumGrid.vue'
import AlbumViewer from '../components/album/AlbumViewer.vue'
import AlbumContactPills from '../components/album/AlbumContactPills.vue'

const router = useRouter()
const albumStore = useAlbumStore()
const contactsStore = useContactsStore()
const settingsStore = useSettingsStore()
const { scheduleSave } = useStorage()

const tabs = [
  { key: 'photos', label: '照片' },
  { key: 'people', label: '人物' },
  { key: 'favorites', label: '收藏' }
]

function switchTab(key) {
  albumStore.activeTab = key
}

// ====== Person detail ======
const selectedPerson = computed(() =>
  albumStore.contactsWithPhotos.find(c => c.contactId === albumStore.selectedContactId) || null
)

const personPhotos = computed(() =>
  albumStore.photosByContact[albumStore.selectedContactId] || []
)

function enterPerson(contactId) {
  albumStore.selectedContactId = contactId
}

function exitPerson() {
  albumStore.selectedContactId = null
}

// ====== Viewer ======
const viewerIndex = ref(-1)

// The photo list used by the viewer depends on current context
const currentViewerList = computed(() => {
  if (albumStore.selectedContactId) return personPhotos.value
  if (albumStore.activeTab === 'favorites') return albumStore.favoritePhotos
  return albumStore.sortedPhotos
})

const viewerPhoto = computed(() => {
  if (viewerIndex.value < 0) return null
  return currentViewerList.value[viewerIndex.value] || null
})

function openViewer(photo) {
  const idx = currentViewerList.value.findIndex(p => p.id === photo.id)
  viewerIndex.value = idx
}

function closeViewer() {
  viewerIndex.value = -1
}

function navigateViewer(dir) {
  const next = viewerIndex.value + dir
  if (next >= 0 && next < currentViewerList.value.length) {
    viewerIndex.value = next
  }
}

function handleToggleFavorite(id) {
  albumStore.toggleFavorite(id)
  scheduleSave()
}

function handleDelete(id) {
  albumStore.removePhoto(id)
  scheduleSave()
  if (currentViewerList.value.length === 0) {
    viewerIndex.value = -1
  } else if (viewerIndex.value >= currentViewerList.value.length) {
    viewerIndex.value = currentViewerList.value.length - 1
  }
}

function handleUpload(e) {
  const files = e.target.files
  if (!files?.length) return
  for (const file of files) {
    const reader = new FileReader()
    reader.onload = () => {
      albumStore.addPhoto({ url: reader.result, source: 'upload' })
      scheduleSave()
    }
    reader.readAsDataURL(file)
  }
  e.target.value = ''
}

onMounted(() => {
  if (albumStore.photos.length === 0 && contactsStore.contacts?.length) {
    const count = albumStore.collectFromContacts(contactsStore.contacts)
    if (count > 0) scheduleSave()
  }
})
</script>

<style scoped>
/* ===== Root ===== */
.album-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--album-bg, #f6f6f6);
}
.album-root.dark {
  --album-bg: #0e0e10;
}
.album-root:not(.dark) {
  --album-bg: #f6f6f6;
}

/* ===== Shared view shell ===== */
.album-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--album-bg);
  overflow: hidden;
  z-index: 1;
}

.album-view.is-behind {
  pointer-events: none;
}

.album-person-detail {
  z-index: 2;
}

/* ===== Header ===== */
.album-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  min-height: 44px;
  padding-top: var(--app-pt, 0px);
  background: rgba(246,246,246,0.82);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-bottom: 0.5px solid rgba(0,0,0,0.08);
  z-index: 5;
}

.dark .album-header {
  background: rgba(14,14,16,0.82);
  border-bottom-color: rgba(255,255,255,0.06);
}

.hdr-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--album-accent, #007AFF);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.dark .hdr-btn {
  color: #5ac8fa;
}

.hdr-title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  color: #000;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark .hdr-title {
  color: #f0f0f0;
}

.hdr-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.hdr-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #ddd;
}

.dark .hdr-avatar {
  background: #333;
}

.hdr-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hdr-avatar-fb {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #999;
}

.hdr-count {
  width: 32px;
  text-align: center;
  font-size: 13px;
  color: #888;
  flex-shrink: 0;
}

/* ===== Segmented control ===== */
.seg-bar {
  flex-shrink: 0;
  display: flex;
  margin: 8px 16px;
  padding: 2px;
  background: rgba(0,0,0,0.06);
  border-radius: 8px;
}

.dark .seg-bar {
  background: rgba(255,255,255,0.08);
}

.seg-item {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  border-radius: 7px;
  cursor: pointer;
  transition: all 180ms ease;
}

.seg-item.active {
  background: #fff;
  color: #000;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04);
}

.dark .seg-item {
  color: #888;
}

.dark .seg-item.active {
  background: rgba(255,255,255,0.14);
  color: #fff;
  box-shadow: none;
}

/* ===== Body ===== */
.album-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ===== Empty state ===== */
.album-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 14px;
  width: 80px;
  height: 80px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.03);
}

.dark .empty-icon {
  background: rgba(255,255,255,0.04);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
}

.dark .empty-title {
  color: #ccc;
}

.empty-sub {
  font-size: 13px;
  color: #999;
  margin: 0;
}

/* ===== Person detail push transition ===== */
.album-push-enter-active {
  transition: transform 340ms cubic-bezier(0.22,0.61,0.36,1);
  z-index: 2;
}
.album-push-leave-active {
  transition: transform 340ms cubic-bezier(0.22,0.61,0.36,1);
  z-index: 2;
}
.album-push-enter-from {
  transform: translate3d(100%,0,0);
}
.album-push-leave-to {
  transform: translate3d(100%,0,0);
}
</style>
