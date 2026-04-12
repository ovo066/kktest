<template>
  <div class="relative w-full h-full sm:w-[390px] sm:h-[844px] sm:max-h-[90vh] bg-black sm:rounded-[3.5rem] phone-frame overflow-hidden flex flex-col shadow-2xl ring-4 ring-gray-900">
    <div class="flex-1 bg-[var(--bg-color)] w-full h-full relative overflow-hidden sm:rounded-[3rem] flex flex-col transition-colors duration-300" id="screen" :style="screenVars">
      <StatusBar
        v-if="effectiveShowPhoneStatusBar"
        :textColor="lockScreenVisible ? 'white' : statusBarColor"
        :style="lockScreenVisible ? { zIndex: 200 } : {}"
      />
      <DynamicIsland v-if="effectiveShowPhoneStatusBar && !lockScreenVisible" />
      <div class="flex-1 relative w-full h-full bg-[var(--bg-color)] overflow-hidden">
        <slot></slot>
      </div>
      <HomeIndicator v-show="!lockScreenVisible && showHomeIndicator" :variant="homeIndicatorVariant" @click="emit('goHome')" />
      <LockScreen v-if="showLockScreen" @unlocked="onUnlocked" />
    </div>
  </div>
  <Toast />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReaderStore } from '../../stores/reader'
import { useSettingsStore } from '../../stores/settings'
import StatusBar from './StatusBar.vue'
import DynamicIsland from './DynamicIsland.vue'
import HomeIndicator from './HomeIndicator.vue'
import LockScreen from './LockScreen.vue'
import Toast from '../common/Toast.vue'

defineProps({
  statusBarColor: {
    type: String,
    default: 'white'
  }
})

const emit = defineEmits(['goHome', 'lockscreen-visibility-change'])

const store = useSettingsStore()
const readerStore = useReaderStore()
const route = useRoute()
const LOCKSCREEN_UNLOCK_GRACE_KEY = 'aichat_lockscreen_unlock_grace_until'
const LOCKSCREEN_UNLOCK_GRACE_MS = 20 * 1000

function getGraceStorages() {
  if (typeof window === 'undefined') return []
  return [window.sessionStorage, window.localStorage]
}

function clearUnlockGrace() {
  getGraceStorages().forEach((storage) => {
    try {
      storage?.removeItem(LOCKSCREEN_UNLOCK_GRACE_KEY)
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  })
}

function hasRecentUnlockGrace() {
  if (typeof window === 'undefined') return false
  for (const storage of getGraceStorages()) {
    try {
      const raw = storage?.getItem(LOCKSCREEN_UNLOCK_GRACE_KEY)
      const unlockUntil = Number(raw)
      if (Number.isFinite(unlockUntil) && unlockUntil > Date.now()) {
        return true
      }
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }
  clearUnlockGrace()
  return false
}

function markUnlockGrace() {
  if (typeof window === 'undefined') return
  const unlockUntil = String(Date.now() + LOCKSCREEN_UNLOCK_GRACE_MS)
  getGraceStorages().forEach((storage) => {
    try {
      storage?.setItem(LOCKSCREEN_UNLOCK_GRACE_KEY, unlockUntil)
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  })
}

const showLockScreen = ref(!hasRecentUnlockGrace())
const lockScreenVisible = computed(() => showLockScreen.value)
const showHomeIndicator = computed(() => String(route.name || '') !== 'offline')
const showPhoneStatusBar = computed(() => store.theme?.showPhoneStatusBar !== false)
const displayMode = ref('browser')
const domFullscreen = ref(false)

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent || '')
}

function detectDisplayMode() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'browser'
  if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui'
  if (window.navigator?.standalone) return 'standalone'
  return 'browser'
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null
}

async function requestRootFullscreen() {
  const el = document.documentElement
  if (el.requestFullscreen) return el.requestFullscreen()
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen()
  if (el.msRequestFullscreen) return el.msRequestFullscreen()
  return Promise.resolve()
}

const isAndroidImmersiveMode = computed(() => (
  isAndroidDevice() &&
  (displayMode.value === 'fullscreen' || displayMode.value === 'standalone' || displayMode.value === 'minimal-ui')
))
const isIOSStandalone = computed(() => (
  isIOSDevice() &&
  (displayMode.value === 'fullscreen' || displayMode.value === 'standalone' || displayMode.value === 'minimal-ui')
))
const homeIndicatorVariant = computed(() => {
  // iOS installed PWA already has the system home indicator; avoid a "double" bar and gesture conflicts.
  if (isIOSStandalone.value) return 'hidden'
  return isAndroidImmersiveMode.value ? 'subtle' : 'ios'
})
const readerFullscreen = computed(() => readerStore.readerOpen && readerStore.readerViewMode === 'fullscreen')
const effectiveShowPhoneStatusBar = computed(() => {
  if (!showPhoneStatusBar.value) return false
  // iOS uses the system status bar + safe area; do not render the simulated bar.
  if (isIOSDevice()) return false
  // Hide when reader is in fullscreen mode
  if (readerFullscreen.value) return false
  return true
})

const screenVars = computed(() => {
  if (effectiveShowPhoneStatusBar.value) {
    return {
      '--phone-statusbar-space': '47px',
      '--phone-statusbar-spacer': '40px'
    }
  }
  return {
    '--phone-statusbar-space': 'env(safe-area-inset-top, 0px)',
    '--phone-statusbar-spacer': 'env(safe-area-inset-top, 0px)'
  }
})

let displayModeMqls = []
let autoFullscreenHandler = null
let unlockHideTimer = null
const updateDomFullscreen = () => { domFullscreen.value = !!getFullscreenElement() }

watch(lockScreenVisible, (visible) => {
  emit('lockscreen-visibility-change', visible)
}, { immediate: true })

const handleDisplayModeChange = () => {
  displayMode.value = detectDisplayMode()
}

function cleanupAutoFullscreenHandler() {
  if (!autoFullscreenHandler) return
  window.removeEventListener('pointerdown', autoFullscreenHandler, true)
  window.removeEventListener('touchstart', autoFullscreenHandler, true)
  autoFullscreenHandler = null
}

function bindAutoFullscreenHandlerOnce() {
  if (typeof window === 'undefined') return
  if (autoFullscreenHandler) return

  autoFullscreenHandler = async () => {
    cleanupAutoFullscreenHandler()
    try {
      await requestRootFullscreen()
    } catch {
      // Some Android browsers require strict user activation timing.
    }

    // If fullscreen still didn't take, arm it again on the next interaction.
    setTimeout(() => {
      if (!isAndroidDevice()) return
      if (!showPhoneStatusBar.value) return
      if (!(displayMode.value === 'standalone' || displayMode.value === 'minimal-ui' || displayMode.value === 'fullscreen')) return
      if (domFullscreen.value) return
      bindAutoFullscreenHandlerOnce()
    }, 0)
  }

  // Pointer events cover touch on modern Android; keep touchstart as fallback.
  if ('onpointerdown' in window) {
    window.addEventListener('pointerdown', autoFullscreenHandler, { capture: true, once: true })
  } else {
    window.addEventListener('touchstart', autoFullscreenHandler, { capture: true, once: true })
  }
}

onMounted(() => {
  handleDisplayModeChange()
  updateDomFullscreen()

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  displayModeMqls = [
    window.matchMedia('(display-mode: fullscreen)'),
    window.matchMedia('(display-mode: standalone)'),
    window.matchMedia('(display-mode: minimal-ui)')
  ]
  displayModeMqls.forEach(mq => mq.addEventListener?.('change', handleDisplayModeChange))
  window.addEventListener('pageshow', handleDisplayModeChange)
  document.addEventListener('visibilitychange', handleDisplayModeChange)

  document.addEventListener('fullscreenchange', updateDomFullscreen)
  document.addEventListener('webkitfullscreenchange', updateDomFullscreen)
  document.addEventListener('msfullscreenchange', updateDomFullscreen)

  // Android PWA: attempt fullscreen immediately (will likely fail without user gesture
  // on most browsers, but some allow it during page load).
  if (isAndroidDevice() && showPhoneStatusBar.value) {
    const mode = detectDisplayMode()
    if (mode === 'standalone' || mode === 'minimal-ui' || mode === 'fullscreen') {
      setTimeout(() => {
        if (!getFullscreenElement()) {
          requestRootFullscreen().catch(() => {})
        }
      }, 80)
    }
  }

  watch(
    () => {
      // Android PWA: remember user preference by re-entering fullscreen on first interaction.
      if (!isAndroidDevice()) return false
      if (!showPhoneStatusBar.value) return false
      if (lockScreenVisible.value) return false
      if (!(displayMode.value === 'standalone' || displayMode.value === 'minimal-ui' || displayMode.value === 'fullscreen')) return false
      return !domFullscreen.value
    },
    (need) => {
      if (need) bindAutoFullscreenHandlerOnce()
      else cleanupAutoFullscreenHandler()
    },
    { immediate: true }
  )
})

onUnmounted(() => {
  displayModeMqls.forEach(mq => mq.removeEventListener?.('change', handleDisplayModeChange))
  if (typeof window !== 'undefined') {
    window.removeEventListener('pageshow', handleDisplayModeChange)
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleDisplayModeChange)
    document.removeEventListener('fullscreenchange', updateDomFullscreen)
    document.removeEventListener('webkitfullscreenchange', updateDomFullscreen)
    document.removeEventListener('msfullscreenchange', updateDomFullscreen)
  }
  if (unlockHideTimer) {
    clearTimeout(unlockHideTimer)
    unlockHideTimer = null
  }
  cleanupAutoFullscreenHandler()
})

function onUnlocked() {
  markUnlockGrace()
  // Keep component alive briefly for the leave animation, then remove
  if (unlockHideTimer) clearTimeout(unlockHideTimer)
  unlockHideTimer = setTimeout(() => {
    showLockScreen.value = false
    unlockHideTimer = null
  }, 600)
}
</script>

<style>
.phone-frame {
  box-shadow: 0 0 0 14px #1a1a1a, 0 0 0 16px #333, 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

@media (max-width: 640px) {
  .phone-frame {
    box-shadow: none;
    border-radius: 0;
  }
}
</style>
