import { haptic } from '../utils/haptic'

// iOS Safari: long-press does not fire 'contextmenu', so we polyfill it via touch events.
export function installIosContextMenuPolyfill() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') return

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return

  let timer = null
  let startX = 0
  let startY = 0
  let fired = false
  let suppressClickUntil = 0
  let suppressClickX = 0
  let suppressClickY = 0
  const DELAY = 500
  const THRESHOLD_SQ = 10 * 10
  const SUPPRESS_CLICK_MS = 700
  const SUPPRESS_CLICK_RADIUS_SQ = 24 * 24

  function armClickSuppression(x, y) {
    suppressClickX = x
    suppressClickY = y
    suppressClickUntil = Date.now() + SUPPRESS_CLICK_MS
  }

  function shouldSuppressClick(e) {
    if (Date.now() > suppressClickUntil) return false
    const dx = (Number(e?.clientX) || 0) - suppressClickX
    const dy = (Number(e?.clientY) || 0) - suppressClickY
    return (dx * dx + dy * dy) <= SUPPRESS_CLICK_RADIUS_SQ
  }

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    startX = t.clientX
    startY = t.clientY
    fired = false
    timer = setTimeout(() => {
      timer = null
      fired = true
      armClickSuppression(startX, startY)
      haptic()
      const el = document.elementFromPoint(startX, startY)
      if (!el) return
      el.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: startX, clientY: startY
      }))
    }, DELAY)
  }, { passive: true })

  document.addEventListener('touchmove', (e) => {
    if (!timer) return
    const t = e.touches[0]
    if ((t.clientX - startX) ** 2 + (t.clientY - startY) ** 2 > THRESHOLD_SQ) {
      clearTimeout(timer)
      timer = null
    }
  }, { passive: true })

  const cancel = () => { if (timer) { clearTimeout(timer); timer = null } }
  document.addEventListener('touchend', (e) => {
    cancel()
    // If we just fired the context menu, prevent the subsequent click/tap.
    if (!fired) return
    fired = false
    if (e.cancelable) e.preventDefault()
    e.stopPropagation()
  }, { capture: true, passive: false })

  document.addEventListener('click', (e) => {
    if (!shouldSuppressClick(e)) return
    suppressClickUntil = 0
    if (e.cancelable) e.preventDefault()
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
    e.stopPropagation()
  }, true)

  document.addEventListener('touchcancel', cancel)
}
