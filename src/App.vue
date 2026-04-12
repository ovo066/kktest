<template>
  <PhoneFrame
    :status-bar-color="statusBarColor"
    @go-home="goHome"
    @lockscreen-visibility-change="handleLockScreenVisibilityChange"
  >
    <AccessGate v-if="!accessStore.canAccessApp" />
    <div v-else-if="!bootstrapStore.isHydrating" class="route-view">
      <router-view v-slot="{ Component }">
        <transition :name="transitionName">
          <div :key="route.fullPath" class="route-page">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </div>

    <Transition name="boot-fade">
      <div v-if="showBootOverlay && accessStore.canAccessApp" class="app-boot-overlay">
        <div class="app-boot-card">
          <div class="app-boot-spinner"></div>
          <div class="app-boot-title">正在恢复数据</div>
          <div class="app-boot-subtitle">大聊天和大存档会稍慢一些</div>
        </div>
      </div>
    </Transition>

    <ContactModal
      v-if="contactModalVisible"
      :visible="contactModalVisible"
      :is-edit="contactModalIsEdit"
      :contact-id="contactsStore.editingContactId || ''"
      @close="closeContactModal"
      @saved="closeContactModal"
      @deleted="handleContactDeleted"
    />

    <GroupModal
      v-if="groupModalVisible"
      :visible="groupModalVisible"
      :is-edit="groupModalIsEdit"
      :contact-id="contactsStore.editingContactId || ''"
      @close="closeGroupModal"
      @saved="closeGroupModal"
      @deleted="handleGroupDeleted"
    />
  </PhoneFrame>
  <!-- Global confirm dialog -->
  <IosConfirm
    :visible="confirmVisible"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    :destructive="destructive"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
  <!-- Music overlays -->
  <MusicIsland v-if="musicStore.currentTrack" />
  <MusicPlayer v-if="musicStore.playerOpen" />
  <MusicLibrary v-if="musicStore.libraryOpen" />
  <AccessAnnouncementModal
    :visible="announcementModalVisible"
    :announcement="announcement"
    @acknowledge="handleAnnouncementAcknowledge"
  />
</template>

<script setup>
import { ref, onUnmounted, computed, provide, watch, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAccessControlStore } from './stores/accessControl'
import { useBootstrapStore } from './stores/bootstrap'
import { useContactsStore } from './stores/contacts'
import { useLorebookStore } from './stores/lorebook'
import { useMusicStore } from './stores/music'
import { useStorage } from './composables/useStorage'
import { useAccessAnnouncement } from './composables/useAccessAnnouncement'
import { useConfirm } from './composables/useConfirm'
import { useLivenessEngine } from './composables/useLivenessEngine'
import { useSoundEffects } from './composables/useSoundEffects'
import AccessAnnouncementModal from './components/layout/AccessAnnouncementModal.vue'
import AccessGate from './components/layout/AccessGate.vue'
import PhoneFrame from './components/layout/PhoneFrame.vue'
import IosConfirm from './components/common/IosConfirm.vue'
import { useMusic } from './features/music'

const ContactModal = defineAsyncComponent(() => import('./components/modals/ContactModal.vue'))
const GroupModal = defineAsyncComponent(() => import('./components/modals/GroupModal.vue'))
const MusicIsland = defineAsyncComponent(() => import('./features/music/ui').then((mod) => mod.MusicIsland))
const MusicPlayer = defineAsyncComponent(() => import('./features/music/ui').then((mod) => mod.MusicPlayer))
const MusicLibrary = defineAsyncComponent(() => import('./features/music/ui').then((mod) => mod.MusicLibrary))

const router = useRouter()
const route = useRoute()
const accessStore = useAccessControlStore()
const bootstrapStore = useBootstrapStore()
const contactsStore = useContactsStore()
const lorebookStore = useLorebookStore()
const musicStore = useMusicStore()
const { requestPersistence } = useStorage()
const {
  announcement,
  isVisible: announcementVisible,
  maybeLoadAnnouncement,
  acknowledgeAnnouncement,
  resetAnnouncement
} = useAccessAnnouncement()
const livenessEngine = useLivenessEngine()
const soundEffects = useSoundEffects()
const {
  confirmVisible,
  confirmTitle,
  confirmMessage,
  confirmText,
  cancelText,
  destructive,
  handleConfirm,
  handleCancel
} = useConfirm()

const musicEngine = useMusic()

const contactModalVisible = ref(false)
const contactModalIsEdit = ref(false)
const groupModalVisible = ref(false)
const groupModalIsEdit = ref(false)
const transitionName = ref('slide-left')
const bootSideEffectsStarted = ref(false)
const showBootOverlay = ref(false)
const lockScreenVisible = ref(false)
const BOOT_OVERLAY_DELAY_MS = 220
let bootOverlayTimer = null

// Set status bar color based on current route.
const statusBarColor = computed(() => {
  return route.path === '/' ? 'white' : 'dark'
})
const announcementModalVisible = computed(() => announcementVisible.value && !lockScreenVisible.value)

// Update transition direction based on navigation order.
watch(() => route.path, (to, from) => {
  // Keep this aligned with home app ordering and feature entry points.
  // Using prefixes so nested routes (e.g. /chat/:id, /moments/:id) behave consistently.
  const isChatMessagesTransition =
    (from?.startsWith('/chat') && to.startsWith('/messages')) ||
    (from?.startsWith('/messages') && to.startsWith('/chat'))
  if (isChatMessagesTransition) {
    transitionName.value = 'route-none'
    return
  }
  const order = ['/', '/favorites', '/messages', '/chat', '/snoop', '/persona', '/settings', '/lorebook', '/moments', '/theme', '/album', '/vn', '/meet', '/planner']
  const toIndex = order.findIndex(p => to.startsWith(p))
  const fromIndex = order.findIndex(p => from?.startsWith(p))
  transitionName.value = toIndex > fromIndex ? 'slide-left' : 'slide-right'
})

function startBootSideEffects() {
  if (bootSideEffectsStarted.value) return
  bootSideEffectsStarted.value = true
  requestPersistence()
  livenessEngine.setupAutoToggle()
  soundEffects.startRuntime()
}

function clearBootOverlayTimer() {
  if (bootOverlayTimer == null) return
  clearTimeout(bootOverlayTimer)
  bootOverlayTimer = null
}

watch([
  () => bootstrapStore.isHydrating,
  () => accessStore.canAccessApp
], ([hydrating, canAccessApp]) => {
  clearBootOverlayTimer()
  if (hydrating) {
    showBootOverlay.value = false
    bootOverlayTimer = setTimeout(() => {
      bootOverlayTimer = null
      if (bootstrapStore.isHydrating) {
        showBootOverlay.value = true
      }
    }, BOOT_OVERLAY_DELAY_MS)
    return
  }

  if (!canAccessApp) {
    showBootOverlay.value = false
    return
  }

  showBootOverlay.value = false
  startBootSideEffects()
}, { immediate: true })

watch([
  () => bootstrapStore.isHydrating,
  () => accessStore.session?.provider,
  () => accessStore.session?.userId
], ([hydrating]) => {
  if (hydrating) return
  void maybeLoadAnnouncement(accessStore.session)
}, { immediate: true })

onUnmounted(() => {
  clearBootOverlayTimer()
  resetAnnouncement()
  livenessEngine.destroy()
  musicEngine.cleanup()
  soundEffects.cleanup()
})

function goHome() {
  contactsStore.activeChat = null
  lorebookStore.lorebook.currentBookId = null
  router.push('/')
}

// Expose modal actions to child components.
function openNewContact() {
  contactsStore.editingContactId = null
  contactModalIsEdit.value = false
  contactModalVisible.value = true
}

function syncActiveChatByRouteParam() {
  const rawContactId = route.params.contactId
  const contactId = rawContactId == null ? '' : String(rawContactId).trim()
  if (!contactId) return null

  const contact = contactsStore.contacts.find(c => String(c.id) === contactId) || null
  if (!contact) return null

  if (contactsStore.activeChat?.id !== contact.id) {
    contactsStore.activeChat = contact
  }
  return contact
}

function openEditContact() {
  const contact = syncActiveChatByRouteParam() || contactsStore.activeChat
  if (!contact || contact.type === 'group') return
  contactsStore.editingContactId = contact.id
  contactModalIsEdit.value = true
  contactModalVisible.value = true
}

function closeContactModal() {
  contactModalVisible.value = false
  contactsStore.editingContactId = null
}

function handleContactDeleted() {
  closeContactModal()
  router.push('/messages')
}

// Group modal actions
function openNewGroup() {
  contactsStore.editingContactId = null
  groupModalIsEdit.value = false
  groupModalVisible.value = true
}

function openEditGroup() {
  const contact = syncActiveChatByRouteParam() || contactsStore.activeChat
  if (!contact || contact.type !== 'group') return
  contactsStore.editingContactId = contact.id
  groupModalIsEdit.value = true
  groupModalVisible.value = true
}

function closeGroupModal() {
  groupModalVisible.value = false
  contactsStore.editingContactId = null
}

function handleGroupDeleted() {
  closeGroupModal()
  router.push('/messages')
}

function handleAnnouncementAcknowledge() {
  acknowledgeAnnouncement(accessStore.session)
}

function handleLockScreenVisibilityChange(visible) {
  lockScreenVisible.value = !!visible
}

// Provide modal actions to child components.
provide('openNewContact', openNewContact)
provide('openEditContact', openEditContact)
provide('openNewGroup', openNewGroup)
provide('openEditGroup', openEditGroup)
</script>

<style>
.route-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  --nav-duration: 380ms;
  --nav-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
}

.route-page {
  position: absolute;
  inset: 0;
}

.app-boot-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.72) 45%, rgba(245, 247, 250, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(244, 246, 249, 0.96));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.dark .app-boot-overlay {
  background:
    radial-gradient(circle at top, rgba(38, 42, 48, 0.88), rgba(18, 20, 24, 0.92) 48%, rgba(10, 11, 13, 0.97)),
    linear-gradient(180deg, rgba(28, 30, 34, 0.9), rgba(10, 11, 13, 0.97));
}

.app-boot-card {
  min-width: 220px;
  max-width: 280px;
  padding: 20px 18px;
  border-radius: 24px;
  text-align: center;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.52);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.dark .app-boot-card {
  background: rgba(24, 26, 30, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
}

.app-boot-spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 12px;
  border-radius: 9999px;
  border: 3px solid rgba(0, 122, 255, 0.18);
  border-top-color: var(--primary-color, #007aff);
  animation: boot-spin 0.9s linear infinite;
}

.app-boot-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.app-boot-subtitle {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.boot-fade-enter-active,
.boot-fade-leave-active {
  transition: opacity 180ms ease;
}

.boot-fade-enter-from,
.boot-fade-leave-to {
  opacity: 0;
}

@keyframes boot-spin {
  to {
    transform: rotate(360deg);
  }
}

.route-page::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: rgba(0, 0, 0, 0.06);
  transition: opacity var(--nav-duration) var(--nav-ease);
}

.dark .route-page::before {
  background: rgba(0, 0, 0, 0.2);
}

.route-page::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -24px;
  width: 24px;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0));
  transition: opacity 140ms ease-out;
}

.dark .route-page::after {
  background: linear-gradient(to left, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}

/* Route transition animation (iOS-like) */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform var(--nav-duration) var(--nav-ease);
  will-change: transform;
}

.route-none-enter-active,
.route-none-leave-active {
  transition: none;
}

.route-none-enter-from,
.route-none-enter-to,
.route-none-leave-from,
.route-none-leave-to {
  transform: translate3d(0, 0, 0);
}

/* Keep interactions disabled only on the leaving page. */
.slide-left-leave-active,
.slide-right-leave-active {
  pointer-events: none;
}

.slide-left-enter-active {
  z-index: 2;
}

.slide-left-leave-active {
  z-index: 1;
}

.slide-right-enter-active {
  z-index: 1;
}

.slide-right-leave-active {
  z-index: 2;
}

.slide-left-enter-from {
  transform: translate3d(100%, 0, 0);
}

.slide-left-enter-to,
.slide-left-leave-from,
.slide-right-enter-to,
.slide-right-leave-from {
  transform: translate3d(0, 0, 0);
}

.slide-left-leave-to {
  transform: translate3d(-18%, 0, 0);
}

.slide-right-enter-from {
  transform: translate3d(-18%, 0, 0);
}

.slide-right-leave-to {
  transform: translate3d(100%, 0, 0);
}

.slide-left-leave-to.route-page::before {
  opacity: 1;
}

.slide-right-enter-from.route-page::before {
  opacity: 1;
}

.slide-left-enter-active.route-page::after,
.slide-right-leave-active.route-page::after {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active {
    transition: none;
  }

  .route-page::before,
  .route-page::after {
    transition: none;
  }
}
</style>

