// Keep layout synced with the visual viewport so mobile PWAs stay attached to the keyboard.
export function installViewportSync() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const root = document.documentElement
  const visualViewport = window.visualViewport || null
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPad|iPhone|iPod/i.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isMobile = isAndroid || isIOS
  const KEYBOARD_THRESHOLD = 120
  let maxInnerHeight = window.innerHeight
  let syncRafId = 0
  let tailSyncTimer = 0
  let lastAppVh = -1
  let lastAppVw = -1
  let lastKbInset = -1
  let lastKeyboardOpen = null
  let lastIosStandalone = null
  let focusBurstSeq = 0
  const DISPLAY_MODE_FULLSCREEN = '(display-mode: fullscreen)'
  const DISPLAY_MODE_STANDALONE = '(display-mode: standalone)'
  const DISPLAY_MODE_MINIMAL_UI = '(display-mode: minimal-ui)'

  const detectDisplayMode = () => {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia(DISPLAY_MODE_FULLSCREEN).matches) return 'fullscreen'
      if (window.matchMedia(DISPLAY_MODE_STANDALONE).matches) return 'standalone'
      if (window.matchMedia(DISPLAY_MODE_MINIMAL_UI).matches) return 'minimal-ui'
    }
    if (window.navigator?.standalone) return 'standalone'
    return 'browser'
  }

  const syncViewportVars = () => {
    syncRafId = 0
    const useVisualViewport = isMobile && !!visualViewport
    const rawHeight = useVisualViewport ? visualViewport.height : window.innerHeight
    const rawWidth = useVisualViewport ? visualViewport.width : window.innerWidth
    const rawOffsetTop = useVisualViewport ? visualViewport.offsetTop : 0
    const rawOuterHeight = window.outerHeight
    const rawOuterWidth = window.outerWidth

    const fallbackHeight = document.documentElement?.clientHeight || window.innerHeight || 0
    const fallbackWidth = document.documentElement?.clientWidth || window.innerWidth || 0

    const viewportHeight = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : fallbackHeight
    const viewportWidth = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : fallbackWidth
    const viewportOffsetTop = Number.isFinite(rawOffsetTop) && rawOffsetTop > 0 ? rawOffsetTop : 0
    const outerHeight = Number.isFinite(rawOuterHeight) && rawOuterHeight > 0 ? rawOuterHeight : 0
    const outerWidth = Number.isFinite(rawOuterWidth) && rawOuterWidth > 0 ? rawOuterWidth : 0
    const displayMode = detectDisplayMode()
    const isStandaloneDisplayMode = displayMode === 'fullscreen' || displayMode === 'standalone' || displayMode === 'minimal-ui'
    const isIOSStandalone = isIOS && isStandaloneDisplayMode

    if (lastIosStandalone !== isIOSStandalone) {
      lastIosStandalone = isIOSStandalone
      root.classList.toggle('ios-standalone', isIOSStandalone)
      if (document.body) {
        document.body.classList.toggle('ios-standalone', isIOSStandalone)
      }
    }

    // Track the largest layout height seen; when the keyboard is open the visual viewport shrinks.
    // This works on Android (layout viewport stays stable) and iOS (layout viewport may also shrink,
    // but the max value remains the keyboard-closed height).
    if (Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
      maxInnerHeight = Math.max(maxInnerHeight, window.innerHeight)
    }

    const keyboardInset = useVisualViewport
      ? Math.max(0, maxInnerHeight - (viewportHeight + viewportOffsetTop))
      : 0

    // iOS standalone: prefer the largest stable viewport candidate when the keyboard is closed.
    // Some versions report visualViewport/innerHeight slightly short, causing a bottom blank strip.
    let appVh = viewportHeight
    let appVw = viewportWidth
    if (isIOSStandalone && keyboardInset < KEYBOARD_THRESHOLD) {
      appVh = Math.max(appVh, window.innerHeight || 0, fallbackHeight, outerHeight)
      appVw = Math.max(appVw, window.innerWidth || 0, fallbackWidth, outerWidth)
    } else if (isIOS && keyboardInset < KEYBOARD_THRESHOLD && window.innerHeight > viewportHeight) {
      appVh = window.innerHeight
    }

    const roundedAppVh = Math.round(appVh)
    const roundedAppVw = Math.round(appVw)
    const roundedKbInset = Math.round(keyboardInset)

    if (roundedAppVh !== lastAppVh) {
      lastAppVh = roundedAppVh
      root.style.setProperty('--app-vh', `${roundedAppVh}px`)
    }
    if (roundedAppVw !== lastAppVw) {
      lastAppVw = roundedAppVw
      root.style.setProperty('--app-vw', `${roundedAppVw}px`)
    }
    if (roundedKbInset !== lastKbInset) {
      lastKbInset = roundedKbInset
      root.style.setProperty('--kb-inset', `${roundedKbInset}px`)
    }

    const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD
    if (lastKeyboardOpen !== keyboardOpen) {
      lastKeyboardOpen = keyboardOpen
      root.classList.toggle('keyboard-open', keyboardOpen)
    }
  }

  const scheduleSync = () => {
    if (!syncRafId) {
      syncRafId = requestAnimationFrame(syncViewportVars)
    }
    // Some Android keyboards report a few late viewport values.
    if (tailSyncTimer) clearTimeout(tailSyncTimer)
    tailSyncTimer = window.setTimeout(() => {
      if (!syncRafId) {
        syncRafId = requestAnimationFrame(syncViewportVars)
      }
    }, 200)
  }

  const runFocusBurstSync = (frameCount = 10) => {
    focusBurstSeq += 1
    const seq = focusBurstSeq
    // Cap burst frames to reduce jank during keyboard animation on low-end Android
    let left = Math.max(1, Math.min(frameCount, isAndroid ? 4 : frameCount))
    const tick = () => {
      if (seq !== focusBurstSeq) return
      scheduleSync()
      left -= 1
      if (left > 0) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const isEditableTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false
    return !!target.closest('textarea,input,[contenteditable=""],[contenteditable="true"]')
  }

  syncViewportVars()
  window.addEventListener('resize', scheduleSync, { passive: true })
  window.addEventListener('orientationchange', () => {
    maxInnerHeight = window.innerHeight
    scheduleSync()
  }, { passive: true })
  window.addEventListener('pageshow', scheduleSync, { passive: true })
  document.addEventListener('visibilitychange', scheduleSync)
  document.addEventListener('focusin', (event) => {
    if (!isMobile || !isEditableTarget(event.target)) return
    runFocusBurstSync(12)
  })
  document.addEventListener('focusout', (event) => {
    if (!isMobile || !isEditableTarget(event.target)) return
    runFocusBurstSync(12)
  })

  if (typeof window.matchMedia === 'function') {
    ;[
      window.matchMedia(DISPLAY_MODE_FULLSCREEN),
      window.matchMedia(DISPLAY_MODE_STANDALONE),
      window.matchMedia(DISPLAY_MODE_MINIMAL_UI)
    ].forEach(mq => mq.addEventListener?.('change', scheduleSync))
  }

  if (isMobile && visualViewport) {
    visualViewport.addEventListener('resize', scheduleSync, { passive: true })
    // Android often floods visualViewport.scroll events while keyboard animates.
    // Resize is enough there; iOS still benefits from scroll updates.
    if (isIOS) {
      visualViewport.addEventListener('scroll', scheduleSync, { passive: true })
    }
  }
}
