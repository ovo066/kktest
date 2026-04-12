import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  PRIMARY_PLUS_MENU_ITEMS,
  SECONDARY_PLUS_MENU_ITEMS
} from './chatInputMenuItems'

const MENU_OPEN_AFTER_KEYBOARD_TIMEOUT_MS = 520

export function useChatInputMenu(options) {
  const { emit, inputEl, isTouchDevice } = options

  const plusButton = ref(null)
  const plusMenu = ref(null)
  const showMenu = ref(false)
  const showMoreMenu = ref(false)
  const menuUiMounted = ref(false)
  const menuBottomPx = ref(70)
  const menuMaxHeightPx = ref(420)

  let menuWarmupTimer = 0
  let menuWarmupIdleId = null
  let menuPositionSyncRaf = 0
  let menuPositionSyncTimer = 0
  let pendingMenuOpenRaf = 0
  let pendingMenuOpenTimer = 0
  let pendingMenuOpen = false

  function ensureMenuUiMounted() {
    if (menuUiMounted.value) return
    menuUiMounted.value = true
  }

  function finalizeMenuWarmup() {
    menuWarmupTimer = 0
    menuWarmupIdleId = null
    ensureMenuUiMounted()
  }

  function scheduleMenuWarmup() {
    if (menuUiMounted.value) return
    if (typeof window === 'undefined') {
      ensureMenuUiMounted()
      return
    }
    if (typeof window.requestIdleCallback === 'function') {
      menuWarmupIdleId = window.requestIdleCallback(finalizeMenuWarmup, { timeout: 500 })
      return
    }
    menuWarmupTimer = window.setTimeout(finalizeMenuWarmup, 180)
  }

  function updateMenuPosition() {
    if (typeof window === 'undefined') return

    const btn = plusButton.value
    if (!btn) {
      menuBottomPx.value = 70
      menuMaxHeightPx.value = 420
      return
    }

    const rect = btn.getBoundingClientRect()
    const vv = window.visualViewport
    const vh = vv ? (vv.height + vv.offsetTop) : window.innerHeight
    const viewportTop = vv ? vv.offsetTop : 0
    menuBottomPx.value = Math.max(10, vh - rect.top + 8)
    menuMaxHeightPx.value = Math.max(220, rect.top - viewportTop - 18)
  }

  function clearMenuPositionStabilizer() {
    if (menuPositionSyncRaf) {
      cancelAnimationFrame(menuPositionSyncRaf)
      menuPositionSyncRaf = 0
    }
    if (menuPositionSyncTimer) {
      clearTimeout(menuPositionSyncTimer)
      menuPositionSyncTimer = 0
    }
  }

  function clearPendingMenuOpen() {
    pendingMenuOpen = false
    if (pendingMenuOpenRaf) {
      cancelAnimationFrame(pendingMenuOpenRaf)
      pendingMenuOpenRaf = 0
    }
    if (pendingMenuOpenTimer) {
      clearTimeout(pendingMenuOpenTimer)
      pendingMenuOpenTimer = 0
    }
  }

  function isKeyboardOpen() {
    return typeof document !== 'undefined' &&
      document.documentElement.classList.contains('keyboard-open')
  }

  function stabilizeMenuPosition() {
    if (typeof window === 'undefined') return

    clearMenuPositionStabilizer()
    let framesLeft = 8
    const tick = () => {
      menuPositionSyncRaf = 0
      updateMenuPosition()
      framesLeft -= 1
      if (framesLeft > 0) {
        menuPositionSyncRaf = requestAnimationFrame(tick)
      }
    }
    menuPositionSyncRaf = requestAnimationFrame(tick)
    menuPositionSyncTimer = window.setTimeout(() => {
      menuPositionSyncTimer = 0
      updateMenuPosition()
    }, 260)
  }

  function blurInputForMenuToggle() {
    const el = inputEl.value
    if (!el || typeof el.blur !== 'function') return
    try {
      el.blur()
    } catch {
      // ignore blur errors on unusual webviews
    }
  }

  function isMenuEventTarget(target) {
    if (!target) return false
    if (plusMenu.value?.contains(target)) return true
    if (plusButton.value?.contains(target)) return true
    return false
  }

  function openMenu() {
    ensureMenuUiMounted()
    if (showMenu.value) return
    showMoreMenu.value = false
    showMenu.value = true
  }

  function closeMenu() {
    clearPendingMenuOpen()
    showMoreMenu.value = false
    if (!showMenu.value) return
    showMenu.value = false
  }

  function openMenuAfterKeyboardSettles() {
    if (typeof window === 'undefined') {
      openMenu()
      return
    }

    clearPendingMenuOpen()
    pendingMenuOpen = true
    const startedAt = Date.now()

    const tryOpen = () => {
      pendingMenuOpenRaf = 0
      if (!pendingMenuOpen) return
      if (!isKeyboardOpen() || Date.now() - startedAt >= MENU_OPEN_AFTER_KEYBOARD_TIMEOUT_MS) {
        clearPendingMenuOpen()
        openMenu()
        return
      }
      pendingMenuOpenRaf = requestAnimationFrame(tryOpen)
    }

    pendingMenuOpenRaf = requestAnimationFrame(tryOpen)
    pendingMenuOpenTimer = window.setTimeout(() => {
      if (!pendingMenuOpen) return
      clearPendingMenuOpen()
      openMenu()
    }, MENU_OPEN_AFTER_KEYBOARD_TIMEOUT_MS)
  }

  function handlePlusClick() {
    if (pendingMenuOpen && !showMenu.value) {
      clearPendingMenuOpen()
      return
    }

    if (showMenu.value) {
      closeMenu()
      return
    }

    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    const shouldCollapseKeyboardFirst = isTouchDevice && (
      isKeyboardOpen() ||
      activeElement === inputEl.value
    )

    if (shouldCollapseKeyboardFirst) {
      blurInputForMenuToggle()
      openMenuAfterKeyboardSettles()
      return
    }

    openMenu()
  }

  function emitMenuAction(eventName) {
    closeMenu()
    emit(eventName)
  }

  function toggleMoreMenu() {
    showMoreMenu.value = !showMoreMenu.value
  }

  function handleDocumentPointerDown(event) {
    if (!showMenu.value) return
    if (isMenuEventTarget(event?.target)) return
    closeMenu()
  }

  function handleWindowResize() {
    if (!showMenu.value) return
    updateMenuPosition()
  }

  function handleDocumentKeydown(event) {
    if (event?.key === 'Escape') {
      closeMenu()
    }
  }

  watch(showMenu, (value) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return

    if (value) {
      nextTick(updateMenuPosition)
      stabilizeMenuPosition()
      document.addEventListener('pointerdown', handleDocumentPointerDown, true)
      document.addEventListener('keydown', handleDocumentKeydown)
      window.addEventListener('resize', handleWindowResize)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleWindowResize)
        window.visualViewport.addEventListener('scroll', handleWindowResize)
      }
      return
    }

    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    document.removeEventListener('keydown', handleDocumentKeydown)
    window.removeEventListener('resize', handleWindowResize)
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handleWindowResize)
      window.visualViewport.removeEventListener('scroll', handleWindowResize)
    }
    clearMenuPositionStabilizer()
  })

  onMounted(() => {
    scheduleMenuWarmup()
  })

  onBeforeUnmount(() => {
    clearMenuPositionStabilizer()
    clearPendingMenuOpen()
    if (menuWarmupTimer) {
      clearTimeout(menuWarmupTimer)
      menuWarmupTimer = 0
    }
    if (menuWarmupIdleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(menuWarmupIdleId)
      menuWarmupIdleId = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      document.removeEventListener('keydown', handleDocumentKeydown)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleWindowResize)
        window.visualViewport.removeEventListener('scroll', handleWindowResize)
      }
    }
  })

  return {
    plusButton,
    plusMenu,
    showMenu,
    showMoreMenu,
    menuUiMounted,
    menuBottomPx,
    menuMaxHeightPx,
    primaryPlusMenuItems: PRIMARY_PLUS_MENU_ITEMS,
    secondaryPlusMenuItems: SECONDARY_PLUS_MENU_ITEMS,
    closeMenu,
    emitMenuAction,
    handlePlusClick,
    toggleMoreMenu
  }
}
