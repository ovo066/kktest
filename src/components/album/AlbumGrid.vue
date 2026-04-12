<template>
  <div
    ref="scrollerRef"
    class="album-grid-scroller"
    :style="gridVars"
  >
    <div class="album-grid-spacer" :style="{ height: `${totalSize}px` }">
      <div
        v-for="virtualRow in virtualRows"
        :key="virtualRow.key"
        class="album-grid-row"
        :style="{
          transform: `translateY(${virtualRow.start}px)`,
          height: `${itemSize}px`
        }"
      >
        <button
          v-for="column in columns"
          :key="`${virtualRow.index}-${column}`"
          type="button"
          class="album-grid-item"
          :class="{ 'is-empty': !getPhotoAt(virtualRow.index, column) }"
          :disabled="!getPhotoAt(virtualRow.index, column)"
          @click="handleSelect(virtualRow.index, column)"
        >
          <template v-if="getPhotoAt(virtualRow.index, column)">
            <img :src="getPhotoAt(virtualRow.index, column).url" alt="" loading="lazy" decoding="async" />
            <span v-if="getPhotoAt(virtualRow.index, column).isFavorite" class="fav-badge">
              <i class="ph-fill ph-heart"></i>
            </span>
            <span v-if="getPhotoAt(virtualRow.index, column).contactName" class="name-badge">
              {{ getPhotoAt(virtualRow.index, column).contactName }}
            </span>
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = defineProps({
  photos: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])

const COLUMN_COUNT = 3
const GRID_GAP_PX = 1.5
const OVERSCAN_ROWS = 6
const FALLBACK_ITEM_SIZE = 120

const columns = Array.from({ length: COLUMN_COUNT }, (_, index) => index)
const scrollerRef = ref(null)
const scrollerWidth = ref(0)

let resizeObserver = null
let hasWindowResizeFallback = false

function updateScrollerWidth(element = scrollerRef.value) {
  const nextWidth = Math.max(0, Number(element?.clientWidth || 0))
  if (nextWidth !== scrollerWidth.value) {
    scrollerWidth.value = nextWidth
  }
}

function stopObservingScroller() {
  resizeObserver?.disconnect()
  resizeObserver = null

  if (hasWindowResizeFallback && typeof window !== 'undefined') {
    window.removeEventListener('resize', updateScrollerWidth)
    hasWindowResizeFallback = false
  }
}

function startObservingScroller(element) {
  stopObservingScroller()
  if (!element) return

  updateScrollerWidth(element)

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const nextWidth = Math.max(0, Number(entry?.contentRect?.width || element.clientWidth || 0))
      if (nextWidth !== scrollerWidth.value) {
        scrollerWidth.value = nextWidth
      }
    })
    resizeObserver.observe(element)
    return
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateScrollerWidth, { passive: true })
    hasWindowResizeFallback = true
  }
}

watch(scrollerRef, (element) => {
  startObservingScroller(element)
}, { immediate: true })

onBeforeUnmount(() => {
  stopObservingScroller()
})

const itemSize = computed(() => {
  const width = scrollerWidth.value
  if (width <= 0) return FALLBACK_ITEM_SIZE
  const totalGap = GRID_GAP_PX * (COLUMN_COUNT - 1)
  return Math.max(72, (width - totalGap) / COLUMN_COUNT)
})

const rowSize = computed(() => itemSize.value + GRID_GAP_PX)
const rowCount = computed(() => Math.ceil(props.photos.length / COLUMN_COUNT))

const rowVirtualizer = useVirtualizer(computed(() => ({
  count: rowCount.value,
  getScrollElement: () => scrollerRef.value,
  estimateSize: () => rowSize.value,
  overscan: OVERSCAN_ROWS
})))

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => Math.max(0, rowVirtualizer.value.getTotalSize() - GRID_GAP_PX))
const gridVars = computed(() => ({
  '--album-grid-gap': `${GRID_GAP_PX}px`
}))

function getPhotoAt(rowIndex, columnIndex) {
  const photoIndex = rowIndex * COLUMN_COUNT + columnIndex
  return props.photos[photoIndex] || null
}

function handleSelect(rowIndex, columnIndex) {
  const photo = getPhotoAt(rowIndex, columnIndex)
  if (!photo) return
  emit('select', photo)
}
</script>

<style scoped>
.album-grid-scroller {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  contain: strict;
}

.album-grid-spacer {
  position: relative;
  width: 100%;
}

.album-grid-row {
  position: absolute;
  inset-inline: 0;
  top: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--album-grid-gap);
  will-change: transform;
}

.album-grid-item {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  border: 0;
  background: rgba(0,0,0,0.03);
  appearance: none;
}

.dark .album-grid-item {
  background: rgba(255,255,255,0.03);
}

.album-grid-item:active:not(.is-empty) {
  opacity: 0.75;
}

.album-grid-item.is-empty {
  cursor: default;
  pointer-events: none;
  background: transparent;
}

.album-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fav-badge {
  position: absolute;
  bottom: 5px;
  right: 5px;
  color: #fff;
  font-size: 13px;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));
}

.name-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 4px;
  line-height: 1.4;
  max-width: calc(100% - 10px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
