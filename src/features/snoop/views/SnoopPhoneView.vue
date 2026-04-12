<template>
  <div class="snoop-phone">
    <!-- Top bar -->
    <div class="snoop-topbar">
      <button class="snoop-back" @click="router.back()">
        <i class="ph ph-caret-left text-[20px]"></i>
      </button>
      <div class="snoop-topbar-title">{{ contact?.name }}的手机</div>
      <button
        class="snoop-refresh"
        :class="{ 'snoop-refresh--spinning': refreshing }"
        @click="handleRefresh"
        :disabled="refreshing"
      >
        <i class="ph ph-arrows-clockwise text-[18px]"></i>
      </button>
    </div>

    <!-- Content area -->
    <div class="snoop-content">
      <KeepAlive>
        <component
          :is="currentTabComponent"
          :key="activeTab"
          :contact="contact"
          :items="currentItems"
          :loading="currentLoading"
          :error="currentError"
          @retry="loadTab(activeTab)"
        />
      </KeepAlive>
    </div>

    <!-- Bottom tab bar -->
    <div class="snoop-tabbar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="snoop-tab"
        :class="{ 'snoop-tab--active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <i :class="tab.icon" class="text-[20px]"></i>
        <span class="snoop-tab-label">{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { useSnoopStore } from '../../../stores/snoop'
import { generateSnoopContent } from '../composables/useSnoopGenerate'
import SnoopBrowser from '../components/SnoopBrowser.vue'
import SnoopNotes from '../components/SnoopNotes.vue'
import SnoopChats from '../components/SnoopChats.vue'
import SnoopAlbum from '../components/SnoopAlbum.vue'
import SnoopForum from '../components/SnoopForum.vue'

const router = useRouter()
const route = useRoute()
const contactsStore = useContactsStore()
const snoopStore = useSnoopStore()

const contact = computed(() => {
  const id = route.params.contactId
  return contactsStore.contacts.find(c => c.id === id)
})

const tabs = [
  { key: 'browser', label: '浏览器', icon: 'ph ph-globe-simple' },
  { key: 'notes', label: '便签', icon: 'ph ph-note-pencil' },
  { key: 'chats', label: '消息', icon: 'ph ph-chat-dots' },
  { key: 'album', label: '相册', icon: 'ph ph-images' },
  { key: 'forum', label: '论坛', icon: 'ph ph-chats-circle' }
]

const TAB_COMPONENTS = {
  browser: SnoopBrowser,
  notes: SnoopNotes,
  chats: SnoopChats,
  album: SnoopAlbum,
  forum: SnoopForum
}

const activeTab = ref('browser')
const loadingTabs = ref({})
const errorTabs = ref({})
const refreshing = ref(false)

const currentTabComponent = computed(() => TAB_COMPONENTS[activeTab.value])
const currentItems = computed(() => {
  const cached = snoopStore.getCache(contact.value?.id, activeTab.value)
  return cached?.items || null
})
const currentLoading = computed(() => !!loadingTabs.value[activeTab.value])
const currentError = computed(() => errorTabs.value[activeTab.value] || '')

async function loadTab(category) {
  const c = contact.value
  if (!c) return

  const cached = snoopStore.getCache(c.id, category)
  if (cached) return // Already cached

  loadingTabs.value[category] = true
  errorTabs.value[category] = ''

  try {
    const items = await generateSnoopContent(c, category)
    snoopStore.setCache(c.id, category, items)
  } catch (e) {
    errorTabs.value[category] = e?.message || '生成失败'
  } finally {
    loadingTabs.value[category] = false
  }
}

function switchTab(key) {
  activeTab.value = key
  loadTab(key)
}

async function handleRefresh() {
  const c = contact.value
  if (!c) return

  refreshing.value = true
  const category = activeTab.value
  snoopStore.clearCache(c.id, category)
  errorTabs.value[category] = ''
  loadingTabs.value[category] = true

  try {
    const items = await generateSnoopContent(c, category)
    snoopStore.setCache(c.id, category, items)
  } catch (e) {
    errorTabs.value[category] = e?.message || '生成失败'
  } finally {
    loadingTabs.value[category] = false
    refreshing.value = false
  }
}

onMounted(() => {
  loadTab(activeTab.value)
})
</script>

<style scoped>
.snoop-phone {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #f5f5f7;
  color: #1c1c1e;
}

.dark .snoop-phone {
  background: #0e0e10;
  color: #f5f5f7;
}

/* Top bar */
.snoop-topbar {
  display: flex;
  align-items: center;
  padding: var(--app-pt, 48px) 16px 12px;
  min-height: calc(var(--app-pt, 48px) + 44px);
  gap: 8px;
  background: rgba(245, 245, 247, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  position: relative;
  z-index: 5;
}

.dark .snoop-topbar {
  background: rgba(14, 14, 16, 0.85);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.snoop-back {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  cursor: pointer;
  border-radius: 8px;
}

.snoop-back:active { opacity: 0.5; }

.snoop-topbar-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.snoop-refresh {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.3s;
}

.snoop-refresh:active { opacity: 0.5; }
.snoop-refresh:disabled { opacity: 0.4; cursor: default; }

.snoop-refresh--spinning {
  animation: snoop-spin 0.8s linear infinite;
}

@keyframes snoop-spin {
  to { transform: rotate(360deg); }
}

/* Content */
.snoop-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Tab bar */
.snoop-tabbar {
  display: flex;
  padding: 6px 0;
  padding-bottom: max(6px, env(safe-area-inset-bottom));
  background: rgba(245, 245, 247, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.dark .snoop-tabbar {
  background: rgba(14, 14, 16, 0.85);
  border-top-color: rgba(255, 255, 255, 0.08);
}

.snoop-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border: none;
  background: none;
  color: #8e8e93;
  cursor: pointer;
  transition: color 0.15s;
}

.snoop-tab--active {
  color: var(--primary-color, #007aff);
}

.snoop-tab-label {
  font-size: 10px;
}
</style>
