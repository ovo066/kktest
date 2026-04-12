<template>
  <div
    ref="containerRef"
    class="reader-content h-full no-scrollbar"
    :class="[themeClass, pageModeClass]"
    :style="contentStyle"
    @scroll="onScroll"
    @click="handleContentTap"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
    <!-- Scroll mode: normal vertical layout -->
    <div v-if="!isPaginateMode" class="reader-content-inner mx-auto w-full max-w-[760px] px-[clamp(14px,4.6vw,40px)] py-[clamp(18px,3.6vh,34px)]">
      <h2 class="reader-chapter-title font-bold mb-5 sm:mb-6 leading-relaxed" :style="{ color: titleColor, fontSize: 'clamp(1.1rem, 2.2vw, 1.34rem)' }">
        {{ chapter?.title || '' }}
      </h2>
      <div ref="textRef" class="reader-text select-text">
        <p
          v-for="(para, i) in allParagraphs"
          :key="i"
          class="reader-paragraph mb-[0.95em] leading-relaxed"
          :style="paragraphStyle"
        >{{ para }}</p>
      </div>
      <div class="text-center py-10 sm:py-12 opacity-30">
        <i class="ph ph-dots-three text-[22px] sm:text-[24px]"></i>
      </div>
    </div>

    <!-- Paginate mode: CSS column layout -->
    <div v-else class="reader-paginate-wrapper" :style="paginateWrapperStyle">
      <div ref="clipRef" class="reader-paginate-clip">
        <div
          ref="columnRef"
          class="reader-column-container select-text"
          :class="{ 'is-dragging': isDraggingPage }"
          :style="columnContainerStyle"
        >
          <h2 class="reader-chapter-title font-bold leading-relaxed" :style="columnTitleStyle">
            {{ chapter?.title || '' }}
          </h2>
          <div ref="textRef" class="reader-text">
            <p
              v-for="(para, i) in allParagraphs"
              :key="i"
              class="reader-paragraph mb-[0.95em] leading-relaxed"
              :style="paragraphStyle"
            >{{ para }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isPaginateMode && totalPages > 1" class="reader-page-indicator">
      {{ currentPage + 1 }} / {{ totalPages }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  chapter: { type: Object, default: null },
  fontSize: { type: Number, default: 17 },
  lineHeight: { type: Number, default: 1.8 },
  theme: { type: String, default: 'light' },
  pageMode: { type: String, default: 'scroll' },
  prevChapterTitle: { type: String, default: '' },
  nextChapterTitle: { type: String, default: '' }
})

const emit = defineEmits(['text-selected', 'scroll-progress', 'visible-text', 'content-tap', 'page-next', 'page-prev'])

const containerRef = ref(null)
const clipRef = ref(null)
const columnRef = ref(null)
const textRef = ref(null)
const currentPage = ref(0)
const totalPages = ref(1)
const pointerStart = ref({ x: 0, y: 0, t: 0 })
const touchMoved = ref(false)
const suppressTapUntil = ref(0)
const isDraggingPage = ref(false)
const isTurningPage = ref(false)
const dragStartOffset = ref(0)
const translateX = ref(0)
const columnWidth = ref(360)
const columnGap = ref(40)
let resizeObserver = null
let turnAnimation = null
let pageCountTimer = null

const isPaginateMode = computed(() => props.pageMode === 'paginate')
const pageModeClass = computed(() => isPaginateMode.value ? 'reader-mode-paginate' : 'reader-mode-scroll')

// --- Text processing ---
function normalizeReadableText(raw) {
  let text = String(raw || '').replace(/\r\n?/g, '\n')
  if (!text) return ''
  const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(text) || /&(?:nbsp|lt|gt|amp|quot|#\d+|#x[0-9a-f]+);/i.test(text)
  if (looksLikeHtml && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html')
      text = doc.body?.textContent || text
    } catch { /* keep original */ }
  }
  return text.replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

const chapterText = computed(() => normalizeReadableText(props.chapter?.content || ''))

const allParagraphs = computed(() => {
  const text = chapterText.value
  if (!text) return []
  return text.split(/\n+/).map(p => p.trim()).filter(Boolean)
})

// --- Column pagination ---
const pageSize = computed(() => columnWidth.value + columnGap.value)

function updateColumnMetrics() {
  const viewportEl = clipRef.value || columnRef.value?.parentElement || containerRef.value
  if (!viewportEl) return
  const rect = viewportEl.getBoundingClientRect()
  if (!rect.width) return
  // Paginate columns should align exactly with the visible clip viewport.
  const w = Math.max(200, Math.round(rect.width))
  const gap = Math.max(20, Math.round(w * 0.08))
  columnWidth.value = w
  columnGap.value = gap
}

function measurePageCount() {
  if (!isPaginateMode.value) { totalPages.value = 1; return }
  const el = columnRef.value
  if (!el) { totalPages.value = 1; return }
  const size = pageSize.value
  if (size <= 0) { totalPages.value = 1; return }
  // scrollWidth = total column content width
  const count = Math.max(1, Math.ceil((el.scrollWidth / size) - 0.001))
  totalPages.value = count
}

function schedulePageCount(delay = 30) {
  if (pageCountTimer) clearTimeout(pageCountTimer)
  pageCountTimer = setTimeout(() => {
    pageCountTimer = null
    measurePageCount()
  }, delay)
}

function scrollToPage(index, animate = false) {
  const el = columnRef.value
  if (!el) return
  const target = Math.max(0, index) * pageSize.value
  if (!animate) {
    translateX.value = target
    return
  }
  // rAF-based smooth animation
  cancelTurnAnimation()
  const start = translateX.value
  const distance = target - start
  if (Math.abs(distance) < 1) { translateX.value = target; return }
  const duration = Math.max(180, Math.min(300, Math.round(250 * Math.abs(distance) / pageSize.value)))
  const startTime = performance.now()
  isTurningPage.value = true

  function step(now) {
    const elapsed = now - startTime
    const fraction = Math.min(1, elapsed / duration)
    // easeOutCubic
    const ease = 1 - Math.pow(1 - fraction, 3)
    translateX.value = start + distance * ease
    if (fraction < 1) {
      turnAnimation = requestAnimationFrame(step)
    } else {
      translateX.value = target
      turnAnimation = null
      isTurningPage.value = false
    }
  }
  turnAnimation = requestAnimationFrame(step)
}

function cancelTurnAnimation() {
  if (turnAnimation) {
    cancelAnimationFrame(turnAnimation)
    turnAnimation = null
  }
  isTurningPage.value = false
}

// --- Page navigation ---
function requestPageTurn(direction, { allowChapterTurn = true } = {}) {
  if (!isPaginateMode.value) return false
  if (isTurningPage.value) return false
  const selection = window.getSelection?.()
  if (selection && !selection.isCollapsed && selection.toString().trim()) return false

  const dir = direction === 'prev' ? 'prev' : 'next'
  const target = dir === 'prev' ? currentPage.value - 1 : currentPage.value + 1

  if (target < 0 || target >= totalPages.value) {
    if (!allowChapterTurn) return false
    emit(dir === 'prev' ? 'page-prev' : 'page-next')
    suppressTapUntil.value = Date.now() + 420
    return true
  }

  currentPage.value = target
  scrollToPage(target, true)
  emitPaginateProgress()
  suppressTapUntil.value = Date.now() + 380
  return true
}

// --- Snap to nearest page after drag ---
function snapToNearestPage(velocity = 0) {
  const size = pageSize.value
  if (size <= 0) return

  const scrollPos = translateX.value
  let targetPage = Math.round(scrollPos / size)

  // Factor in velocity for flick gestures
  if (Math.abs(velocity) > 0.3) {
    targetPage = velocity > 0
      ? Math.ceil(scrollPos / size)
      : Math.floor(scrollPos / size)
  }

  targetPage = Math.max(0, Math.min(targetPage, totalPages.value - 1))

  // Check if we're at chapter boundary
  if (targetPage === currentPage.value) {
    const overscrollLeft = scrollPos < 0
    const overscrollRight = scrollPos > (totalPages.value - 1) * size + size * 0.15
    if (overscrollLeft && props.prevChapterTitle) {
      emit('page-prev')
      suppressTapUntil.value = Date.now() + 420
      return
    }
    if (overscrollRight && props.nextChapterTitle) {
      emit('page-next')
      suppressTapUntil.value = Date.now() + 420
      return
    }
  }

  currentPage.value = targetPage
  scrollToPage(targetPage, true)
  emitPaginateProgress()
}

// --- Styles ---
const paginateWrapperStyle = computed(() => ({
  height: '100%',
  overflow: 'hidden',
  padding: 'clamp(18px,3.6vh,34px) clamp(14px,4.6vw,40px)',
  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
  boxSizing: 'border-box'
}))

const columnContainerStyle = computed(() => ({
  height: '100%',
  columnWidth: `${columnWidth.value}px`,
  columnGap: `${columnGap.value}px`,
  columnFill: 'auto',
  overflow: 'visible',
  transform: `translateX(${-translateX.value}px)`,
  willChange: isDraggingPage.value || isTurningPage.value ? 'transform' : 'auto',
  fontSize: props.fontSize + 'px',
  lineHeight: props.lineHeight,
  boxSizing: 'border-box',
  overflowWrap: 'break-word',
  wordBreak: 'break-word'
}))

const columnTitleStyle = computed(() => ({
  color: titleColor.value,
  fontSize: 'clamp(1.1rem, 2.2vw, 1.34rem)',
  marginBottom: 'clamp(16px, 2.4vh, 24px)',
  columnSpan: 'none'
}))

const themeClass = computed(() => ({
  'reader-theme-light': props.theme === 'light',
  'reader-theme-sepia': props.theme === 'sepia',
  'reader-theme-dark': props.theme === 'dark'
}))

const contentStyle = computed(() => ({
  fontSize: props.fontSize + 'px',
  lineHeight: props.lineHeight,
  overflowY: isPaginateMode.value ? 'hidden' : 'auto',
  overflowX: 'hidden',
  paddingBottom: isPaginateMode.value ? '0' : 'calc(env(safe-area-inset-bottom, 0px) + 30px)'
}))

const paragraphStyle = computed(() => ({
  textIndent: '2em',
  color: textColor.value
}))

const textColor = computed(() => {
  if (props.theme === 'dark') return 'rgba(255,255,255,0.85)'
  if (props.theme === 'sepia') return '#5B4636'
  return '#1d1d1f'
})

const titleColor = computed(() => {
  if (props.theme === 'dark') return 'rgba(255,255,255,0.9)'
  if (props.theme === 'sepia') return '#3C2A1A'
  return '#1d1d1f'
})

// --- Scroll progress (scroll mode) ---
let scrollTimer = null
function onScroll() {
  if (isPaginateMode.value) return
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    const el = containerRef.value
    if (!el) return
    const scrollTop = el.scrollTop
    const scrollHeight = el.scrollHeight - el.clientHeight
    const progress = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0
    emit('scroll-progress', Math.min(100, Math.max(0, progress)))
    emitVisibleText()
  }, 200)
}

function emitPaginateProgress() {
  const pages = Math.max(totalPages.value, 1)
  const progress = pages <= 1 ? 0 : Math.round((currentPage.value / (pages - 1)) * 100)
  emit('scroll-progress', Math.min(100, Math.max(0, progress)))
  emitVisibleText()
}

// --- Text selection ---
function emitEmptySelection() {
  emit('text-selected', { text: '', rect: null, containerRect: null })
}

function onSelectionChange() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
    emitEmptySelection(); return
  }
  const text = selection.toString().trim()
  const contentEl = textRef.value || columnRef.value
  if (!text || !contentEl) { emitEmptySelection(); return }
  const anchorNode = selection.anchorNode
  const focusNode = selection.focusNode
  if (!anchorNode || !focusNode || !contentEl.contains(anchorNode) || !contentEl.contains(focusNode)) {
    emitEmptySelection(); return
  }
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) { emitEmptySelection(); return }
  const containerRect = containerRef.value?.getBoundingClientRect()
  emit('text-selected', {
    text,
    contextText: getCurrentPageContextText(),
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    containerRect: containerRect ? { top: containerRect.top, left: containerRect.left, width: containerRect.width, height: containerRect.height } : null
  })
}

function getCurrentPageContextText() {
  if (isPaginateMode.value) {
    // Get visible text — use clip wrapper rect since column container overflows
    const el = columnRef.value
    if (!el) return ''
    const clipEl = el.parentElement
    if (!clipEl) return ''
    const clipRect = clipEl.getBoundingClientRect()
    const paragraphEls = el.querySelectorAll('.reader-paragraph')
    const visibleParts = []
    for (const p of paragraphEls) {
      const pRect = p.getBoundingClientRect()
      if (pRect.right > clipRect.left && pRect.left < clipRect.right &&
          pRect.bottom > clipRect.top && pRect.top < clipRect.bottom) {
        visibleParts.push(p.textContent || '')
      }
    }
    const page = visibleParts.join('\n')
    const parts = []
    parts.push(`阅读位置：第 ${currentPage.value + 1} / ${totalPages.value} 页`)
    parts.push(`当前页正文：${page}`)
    return parts.join('\n\n').slice(0, 1900)
  }
  const el = containerRef.value
  if (!el || !textRef.value) return ''
  const containerRect = el.getBoundingClientRect()
  const paragraphEls = textRef.value.querySelectorAll('p')
  const visibleParts = []
  for (const p of paragraphEls) {
    const pRect = p.getBoundingClientRect()
    if (pRect.bottom > containerRect.top && pRect.top < containerRect.bottom) {
      visibleParts.push(p.textContent || '')
    }
  }
  return visibleParts.join('\n').slice(0, 1000)
}

function emitVisibleText() {
  emit('visible-text', getCurrentPageContextText())
}

// --- Touch / Pointer handlers ---
function onPointerDown(event) {
  if (!isPaginateMode.value) return
  if (event.pointerType === 'touch') return
  if (isTurningPage.value) return
  pointerStart.value = { x: event.clientX, y: event.clientY, t: Date.now() }
}

function onPointerUp(event) {
  if (!isPaginateMode.value) return
  if (event.pointerType === 'touch') return
  handleSwipeEnd(event.clientX, event.clientY)
}

function onTouchStart(event) {
  const t = event.touches?.[0]
  if (!t) return
  cancelTurnAnimation()
  touchMoved.value = false
  isDraggingPage.value = false
  dragStartOffset.value = translateX.value
  pointerStart.value = { x: t.clientX, y: t.clientY, t: Date.now() }
}

function onTouchMove(event) {
  const t = event.touches?.[0]
  if (!t) return
  if (!isPaginateMode.value) return
  const selection = window.getSelection?.()
  if (selection && !selection.isCollapsed && selection.toString().trim()) return

  const dx = t.clientX - pointerStart.value.x
  const dy = t.clientY - pointerStart.value.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx > 10 || absDy > 10) touchMoved.value = true

  if (!isDraggingPage.value) {
    if (absDx < 12) return
    if (absDx <= absDy * 1.15) return
    isDraggingPage.value = true
  }

  // Directly manipulate translateX for instant response
  translateX.value = dragStartOffset.value - dx
}

function onTouchEnd(event) {
  const t = event.changedTouches?.[0]
  if (!t) return
  if (!isPaginateMode.value) {
    touchMoved.value = false
    return
  }

  const selection = window.getSelection?.()
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    isDraggingPage.value = false
    touchMoved.value = false
    return
  }

  const dx = t.clientX - pointerStart.value.x
  const elapsed = Math.max(1, Date.now() - pointerStart.value.t)
  const velocity = -dx / elapsed // positive = swiped left (next)

  if (isDraggingPage.value) {
    snapToNearestPage(velocity)
    suppressTapUntil.value = Date.now() + 380
  } else {
    handleSwipeEnd(t.clientX, t.clientY)
  }

  isDraggingPage.value = false
  touchMoved.value = false
}

function onTouchCancel() {
  if (isDraggingPage.value) {
    // Snap back to current page
    scrollToPage(currentPage.value, true)
  }
  isDraggingPage.value = false
  touchMoved.value = false
}

function handleSwipeEnd(clientX, clientY) {
  if (!isPaginateMode.value) return false
  if (isTurningPage.value) return false
  const selection = window.getSelection?.()
  if (selection && !selection.isCollapsed && selection.toString().trim()) return false

  const dx = clientX - pointerStart.value.x
  const dy = clientY - pointerStart.value.y
  const elapsed = Date.now() - pointerStart.value.t
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx < 14) return false
  if (absDx <= absDy * 1.25) return false

  const velocity = absDx / Math.max(elapsed, 1)
  const distanceOk = absDx >= Math.max(48, Math.round(columnWidth.value * 0.14))
  const velocityOk = velocity >= 0.70
  if (!distanceOk && !velocityOk) return false

  const direction = dx < 0 ? 'next' : 'prev'
  const changed = requestPageTurn(direction)
  if (changed) suppressTapUntil.value = Date.now() + 380
  return changed
}

function handleContentTap(event) {
  if (Date.now() < suppressTapUntil.value) return
  if (isTurningPage.value) return

  if (isPaginateMode.value && containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const x = event?.clientX ? (event.clientX - rect.left) : rect.width / 2
    const edgeZone = rect.width * 0.28
    if (x <= edgeZone) { requestPageTurn('prev'); return }
    if (x >= rect.width - edgeZone) { requestPageTurn('next'); return }
  }

  const selection = window.getSelection?.()
  if (selection && !selection.isCollapsed && selection.toString().trim()) return
  emit('content-tap')
}

// --- Lifecycle ---
onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }
  nextTick(() => {
    updateColumnMetrics()
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        updateColumnMetrics()
        schedulePageCount(50)
      })
      resizeObserver.observe(containerRef.value)
    }
    schedulePageCount(80)
    if (isPaginateMode.value) emitPaginateProgress()
    else emitVisibleText()
  })
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onResize)
  }
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  if (scrollTimer) clearTimeout(scrollTimer)
  if (pageCountTimer) clearTimeout(pageCountTimer)
  cancelTurnAnimation()
})

function onResize() {
  updateColumnMetrics()
  schedulePageCount(80)
}

// Reset when chapter changes
watch(() => props.chapter?.title, () => {
  nextTick(() => {
    updateColumnMetrics()
    cancelTurnAnimation()
    currentPage.value = 0
    translateX.value = 0
    if (containerRef.value) containerRef.value.scrollTop = 0
    schedulePageCount(80)
    if (isPaginateMode.value) emitPaginateProgress()
    else emitVisibleText()
  })
})

watch(() => props.pageMode, () => {
  nextTick(() => {
    updateColumnMetrics()
    cancelTurnAnimation()
    currentPage.value = 0
    translateX.value = 0
    schedulePageCount(80)
    if (isPaginateMode.value) emitPaginateProgress()
    else emitVisibleText()
  })
})

watch(
  () => [props.fontSize, props.lineHeight],
  () => {
    nextTick(() => {
      updateColumnMetrics()
      // Preserve reading position after font change
      const oldPage = currentPage.value
      schedulePageCount(50)
      setTimeout(() => {
        if (isPaginateMode.value) {
          currentPage.value = Math.min(oldPage, totalPages.value - 1)
          scrollToPage(currentPage.value, false)
          emitPaginateProgress()
        } else {
          emitVisibleText()
        }
      }, 100)
    })
  }
)

// Re-measure page count when content changes
watch(chapterText, () => {
  schedulePageCount(80)
})
</script>

<style scoped>
.reader-theme-light { background: #FAFAF8; }
.reader-theme-sepia { background: #F5E6C8; }
.reader-theme-dark { background: var(--card-bg, #1c1c1e); }

.reader-content {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.reader-paragraph {
  word-break: break-word;
  overflow-wrap: anywhere;
  orphans: 1;
  widows: 1;
}

.reader-text ::selection,
.reader-column-container ::selection {
  background: rgba(var(--primary-color-rgb, 0, 122, 255), 0.25);
}

.reader-mode-scroll {
  overflow-y: auto;
  touch-action: pan-y;
}

.reader-mode-paginate {
  overflow: hidden;
  touch-action: none;
}

.reader-paginate-clip {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.reader-column-container {
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: none;
}

.reader-column-container.is-dragging {
  -webkit-user-select: none;
  user-select: none;
}

.reader-page-indicator {
  position: absolute;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 6px);
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-color) 84%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-secondary) 16%, transparent);
  backdrop-filter: blur(8px);
}

.select-text {
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: none;
}

.reader-text,
.reader-text * {
  -webkit-touch-callout: none;
}
</style>
