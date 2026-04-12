<template>
  <transition name="lockscreen">
    <div
      v-if="visible"
      class="lockscreen-root"
      :style="{ backgroundImage: bgImage }"
      @click="onRootClick"
      @touchstart="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
      @mousedown="onMouseDown"
    >
      <div class="lockscreen-gradient-top"></div>

      <!-- Status bar area (空白占位，PhoneFrame 已有 StatusBar) -->
      <div class="lockscreen-status-spacer"></div>

      <!-- Lock icon -->
      <div class="lockscreen-lock-icon">
        <i class="ph-fill ph-lock-simple"></i>
      </div>

      <!-- Date -->
      <div class="lockscreen-date">{{ dateText }}</div>

      <!-- Large time -->
      <div class="lockscreen-time">{{ timeText }}</div>

      <!-- Widget bar -->
      <div class="lockscreen-widgets">
        <!-- Battery -->
        <div class="lockscreen-widget-left">
          <div class="lockscreen-widget-battery-head">
            <i class="ph-fill ph-device-mobile"></i>
            <span class="lockscreen-battery-pct">{{ batteryPctText }}</span>
          </div>
          <div class="lockscreen-battery-label">当前电量</div>
          <div class="lockscreen-battery-bar">
            <div class="lockscreen-battery-fill" :style="batteryFillStyle"></div>
          </div>
        </div>

        <!-- Circle progress -->
        <div class="lockscreen-widget-center">
          <div class="lockscreen-circle-wrap">
            <div class="lockscreen-circle-bg-glass"></div>
            <svg viewBox="0 0 36 36" class="lockscreen-circle-svg">
              <path class="lockscreen-circle-track" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="lockscreen-circle-progress" :style="{ strokeDasharray: dayProgress + ', 100' }" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div class="lockscreen-circle-inner">
              <i class="ph-fill ph-calendar-blank"></i>
              <span>{{ dayOfYear }}</span>
            </div>
          </div>
        </div>

        <!-- Chat icon -->
        <div class="lockscreen-widget-right">
          <div class="lockscreen-chat-circle">
            <i class="ph-fill ph-chat-circle-dots"></i>
          </div>
        </div>
      </div>

      <!-- Spacer -->
      <div class="lockscreen-spacer"></div>

      <!-- Music player card -->
      <div class="lockscreen-player">
        <div class="lockscreen-player-inner">
          <div class="lockscreen-player-top">
            <div class="lockscreen-player-cover">
              <img v-if="coverSrc" :src="coverSrc" alt="" />
              <i v-else class="ph-fill ph-music-notes"></i>
            </div>
            <div class="lockscreen-player-info">
              <div class="lockscreen-player-title">{{ playerTitle }}</div>
              <div class="lockscreen-player-sub">{{ playerSub }}</div>
            </div>
          </div>
          <div class="lockscreen-player-progress">
            <span class="lockscreen-player-time">00:00</span>
            <div class="lockscreen-player-bar">
              <div class="lockscreen-player-bar-fill"></div>
            </div>
            <span class="lockscreen-player-time lockscreen-player-time-end">Love</span>
          </div>
        </div>
      </div>

      <!-- Bottom buttons -->
      <div class="lockscreen-bottom-btns">
        <div class="lockscreen-btn-glass">
          <i class="ph-fill ph-phone"></i>
        </div>
        <div class="lockscreen-btn-glass">
          <i class="ph-fill ph-camera"></i>
        </div>
      </div>

      <!-- Swipe hint -->
      <div v-if="showSwipeHint" class="lockscreen-swipe-hint" :class="{ 'is-hinting': showHint }">
        上滑解锁
      </div>
      <button
        v-if="showTapUnlockButton"
        type="button"
        class="lockscreen-tap-unlock"
        @click.stop="unlock"
        @touchstart.stop
        @touchend.stop
        @mousedown.stop
      >
        点按解锁
      </button>

      <!-- Home indicator -->
      <div v-if="showHomeBar" class="lockscreen-home-bar" :class="{ 'is-subtle': lockscreenHomeBarSubtle }"></div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useBattery } from '../../composables/useBattery'

const settingsStore = useSettingsStore()
const emit = defineEmits(['unlocked'])

const visible = ref(true)
const now = ref(new Date())
const { batteryPct } = useBattery()
let clockInterval = null

// Touch / swipe state
const touchStartY = ref(0)
const isDragging = ref(false)
const showHint = ref(true)
const unlockedOnce = ref(false)

const UNLOCK_TOUCH_THRESHOLD = 96
const UNLOCK_MOUSE_THRESHOLD = 96

const defaultWallpaper = 'https://images.unsplash.com/photo-1518182170546-0766ce6fec56?q=80&w=1000&auto=format&fit=crop'

const bgImage = computed(() => {
  const wp = settingsStore.lockScreenWallpaper || settingsStore.wallpaper || defaultWallpaper
  return `url('${wp}')`
})

const timeText = computed(() => {
  const h = now.value.getHours()
  const m = now.value.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
})

const dateText = computed(() => {
  const d = now.value
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

const dayOfYear = computed(() => {
  const today = now.value
  const start = new Date(today.getFullYear(), 0, 0)
  const diff = today - start
  return Math.floor(diff / (1000 * 60 * 60 * 24))
})

const dayProgress = computed(() => {
  const today = now.value
  const startOfYear = new Date(today.getFullYear(), 0, 1)
  const endOfYear = new Date(today.getFullYear() + 1, 0, 1)
  return Math.floor((today - startOfYear) / (endOfYear - startOfYear) * 100)
})

const coverSrc = computed(() => settingsStore.wallpaper || defaultWallpaper)

const batteryPctText = computed(() => {
  const pct = batteryPct.value
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return '--%'
  return `${Math.max(0, Math.min(100, Math.round(pct)))}%`
})

const batteryFillStyle = computed(() => {
  const pct = batteryPct.value
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { width: '100%', opacity: 0.25 }
  }
  return { width: Math.max(0, Math.min(100, Math.round(pct))) + '%' }
})

const playerTitle = computed(() => settingsStore.lockScreen?.playerTitle || '⋆ ˚｡肩并肩幸福在指尖˚ ༘ ⋆｡˚')
const playerSub = computed(() => settingsStore.lockScreen?.playerSub || '新的一年还有好多天')
const unlockMode = computed(() => {
  const mode = String(settingsStore.theme?.lockScreenUnlockMode || '').trim()
  return ['swipe', 'tap'].includes(mode) ? mode : 'swipe'
})
const showSwipeHint = computed(() => unlockMode.value === 'swipe')
const showTapUnlockButton = computed(() => unlockMode.value === 'tap')
const allowSwipeUnlock = computed(() => showSwipeHint.value)
const allowDirectTapUnlock = computed(() => unlockMode.value === 'tap')
const showHomeBar = computed(() => {
  if (typeof navigator === 'undefined') return true
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true

  // iOS installed web apps already have the system home indicator; avoid rendering a second one.
  return !(
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator?.standalone
  )
})

const lockscreenHomeBarSubtle = computed(() => {
  if (typeof navigator === 'undefined') return false
  if (!/Android/i.test(navigator.userAgent || '')) return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  )
})

function updateClock() {
  now.value = new Date()
}

function getTouchClientY(e) {
  if (e?.touches?.length) return Number(e.touches[0].clientY)
  if (e?.changedTouches?.length) return Number(e.changedTouches[0].clientY)
  return Number.NaN
}

function onRootClick() {
  if (allowDirectTapUnlock.value) {
    unlock()
  }
}

// Swipe-up to unlock
function onTouchStart(e) {
  if (!allowSwipeUnlock.value) return
  const y = getTouchClientY(e)
  if (!Number.isFinite(y)) return
  touchStartY.value = y
  isDragging.value = true
  showHint.value = false
}

function onTouchMove(e) {
  if (!allowSwipeUnlock.value) return
  if (!isDragging.value) return
  const y = getTouchClientY(e)
  if (!Number.isFinite(y)) return
  const deltaY = touchStartY.value - y
  if (deltaY > UNLOCK_TOUCH_THRESHOLD) {
    unlock()
  }
}

function onTouchEnd(e) {
  if (!allowSwipeUnlock.value) return
  if (!isDragging.value) return
  const endY = getTouchClientY(e)
  const deltaY = Number.isFinite(endY) ? (touchStartY.value - endY) : 0
  isDragging.value = false
  if (deltaY > UNLOCK_TOUCH_THRESHOLD) {
    unlock()
  }
}

function onTouchCancel() {
  isDragging.value = false
}

// Mouse fallback (for desktop)
function onMouseDown(e) {
  if (!allowSwipeUnlock.value) return
  if (e.button !== 0) return
  const startY = e.clientY
  showHint.value = false

  function onMouseMove(ev) {
    const deltaY = startY - ev.clientY
    if (deltaY > UNLOCK_MOUSE_THRESHOLD) {
      unlock()
      cleanup()
    }
  }

  function onMouseUp() {
    cleanup()
  }

  function cleanup() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onKeyDown(e) {
  const key = String(e?.key || '')
  if (key === 'Enter' || key === ' ' || key === 'ArrowUp') {
    unlock()
  }
}

function unlock() {
  if (unlockedOnce.value) return
  unlockedOnce.value = true
  visible.value = false
  emit('unlocked')
}

onMounted(() => {
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown)
  }
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown)
  }
})
</script>

<style scoped>
.lockscreen-root {
  position: absolute;
  inset: 0;
  z-index: 100;
  background-color: #1a1a2e;
  background-size: cover;
  background-position: center 60%;
  display: flex;
  flex-direction: column;
  color: #ffffff;
  user-select: none;
  cursor: grab;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.lockscreen-gradient-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 300px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.25), transparent);
  z-index: 0;
  pointer-events: none;
}

.lockscreen-status-spacer {
  height: var(--phone-statusbar-space, 47px);
  flex-shrink: 0;
}

/* Lock icon */
.lockscreen-lock-icon {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  margin-bottom: 2px;
  font-size: 16px;
  opacity: 0.9;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2));
}

/* Date */
.lockscreen-date {
  position: relative;
  z-index: 1;
  text-align: center;
  margin-top: 6px;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.04em;
  opacity: 0.9;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

/* Large time */
.lockscreen-time {
  position: relative;
  z-index: 1;
  text-align: center;
  font-size: 6.5rem;
  font-weight: 700;
  letter-spacing: -3px;
  line-height: 1;
  margin-top: -5px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

/* Widgets bar */
.lockscreen-widgets {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: end;
  height: 80px;
  padding: 0 32px;
  margin-top: 8px;
}

.lockscreen-widget-left {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  height: 100%;
}

.lockscreen-widget-battery-head {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 4px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

.lockscreen-widget-battery-head i {
  font-size: 16px;
  opacity: 0.9;
}

.lockscreen-battery-pct {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.lockscreen-battery-label {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
  margin-bottom: 6px;
}

.lockscreen-battery-bar {
  width: 96px;
  height: 8px;
  background: rgba(255,255,255,0.3);
  border-radius: 99px;
  overflow: hidden;
  backdrop-filter: blur(4px);
}

.lockscreen-battery-fill {
  height: 100%;
  background: #ffffff;
  border-radius: 99px;
  box-shadow: 0 0 10px rgba(255,255,255,0.8);
}

/* Circle widget */
.lockscreen-widget-center {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  height: 100%;
  padding-bottom: 4px;
}

.lockscreen-circle-wrap {
  position: relative;
  width: 68px;
  height: 68px;
}

.lockscreen-circle-bg-glass {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lockscreen-circle-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  transform-origin: center;
  padding: 4px;
  position: relative;
  z-index: 1;
}

.lockscreen-circle-track {
  fill: none;
  stroke: rgba(255,255,255,0.3);
  stroke-width: 3;
}

.lockscreen-circle-progress {
  fill: none;
  stroke: #fff;
  stroke-width: 3;
  stroke-linecap: round;
}

.lockscreen-circle-inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
  padding-top: 2px;
}

.lockscreen-circle-inner i {
  font-size: 10px;
  margin-bottom: 1px;
}

.lockscreen-circle-inner span {
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

/* Chat circle widget */
.lockscreen-widget-right {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 4px;
}

.lockscreen-chat-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lockscreen-chat-circle i {
  font-size: 28px;
  opacity: 0.9;
}

/* Spacer */
.lockscreen-spacer {
  flex: 1;
}

/* Music player */
.lockscreen-player {
  position: relative;
  z-index: 1;
  padding: 0 16px;
  margin-bottom: 24px;
}

.lockscreen-player-inner {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 24px;
  padding: 14px;
  color: #000000;
}

.lockscreen-player-top {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.lockscreen-player-cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(200, 220, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.lockscreen-player-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lockscreen-player-cover i {
  font-size: 24px;
  color: rgba(0,0,0,0.3);
}

.lockscreen-player-info {
  flex: 1;
  overflow: hidden;
  padding-right: 8px;
}

.lockscreen-player-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.lockscreen-player-sub {
  font-size: 11px;
  color: #666;
  font-weight: 500;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lockscreen-player-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
}

.lockscreen-player-time {
  font-size: 10px;
  font-weight: 600;
  color: #999;
  width: 32px;
  text-align: left;
  flex-shrink: 0;
}

.lockscreen-player-time-end {
  text-align: right;
}

.lockscreen-player-bar {
  flex: 1;
  height: 4px;
  background: #d1d5db;
  border-radius: 99px;
  overflow: hidden;
}

.lockscreen-player-bar-fill {
  width: 45%;
  height: 100%;
  background: #1f2937;
  border-radius: 99px;
}

/* Bottom buttons */
.lockscreen-bottom-btns {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  padding: 0 48px 36px;
  align-items: center;
}

.lockscreen-btn-glass {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(60, 60, 60, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 200ms ease;
}

.lockscreen-btn-glass:active {
  transform: scale(0.9);
}

.lockscreen-btn-glass i {
  font-size: 22px;
  color: #ffffff;
}

/* Swipe hint */
.lockscreen-swipe-hint {
  position: relative;
  z-index: 1;
  text-align: center;
  font-size: 12px;
  opacity: 0;
  margin-bottom: 4px;
  letter-spacing: 0.06em;
  font-weight: 500;
  transition: opacity 0.3s ease;
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.lockscreen-swipe-hint.is-hinting {
  animation: hintPulse 2.5s ease-in-out infinite;
}

.lockscreen-tap-unlock {
  position: relative;
  z-index: 1;
  margin: 0 auto 10px;
  min-width: 104px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.28);
  background: rgba(0,0,0,0.22);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  padding: 10px 14px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.lockscreen-tap-unlock:active {
  transform: scale(0.97);
}

@keyframes hintPulse {
  0%, 100% { opacity: 0; }
  40%, 60% { opacity: 0.7; }
}

/* Home indicator */
.lockscreen-home-bar {
  position: relative;
  z-index: 1;
  width: 130px;
  height: 5px;
  background: rgba(255,255,255,0.9);
  border-radius: 99px;
  margin: 0 auto calc(8px + var(--app-safe-bottom));
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.lockscreen-home-bar.is-subtle {
  width: 90px;
  height: 3px;
  opacity: 0.55;
  background: rgba(255, 255, 255, 0.52);
  margin-bottom: max(4px, calc(4px + var(--app-safe-bottom) * 0.25));
}

/* Transition */
.lockscreen-leave-active {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
}

.lockscreen-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
