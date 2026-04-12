/**
 * 灵动岛通知系统 — 单例 composable
 * 管理通知队列，提供展开/收起/点击 API
 */
import { ref } from 'vue'

const isExpanded = ref(false)
const isCollapsing = ref(false)
const notification = ref(null)
const queue = ref([])

let autoCollapseTimer = null

const AUTO_COLLAPSE_MS = 3800
const NEXT_ITEM_DELAY_MS = 500
const COLLAPSE_ANIM_MS = 500

function collapse() {
  isExpanded.value = false
  isCollapsing.value = true
  if (autoCollapseTimer) {
    clearTimeout(autoCollapseTimer)
    autoCollapseTimer = null
  }

  // Clear collapsing state after animation finishes
  setTimeout(() => {
    isCollapsing.value = false
  }, COLLAPSE_ANIM_MS)

  // 收起后延迟处理下一条
  if (queue.value.length > 0) {
    setTimeout(() => {
      processNext()
    }, NEXT_ITEM_DELAY_MS)
  } else {
    // Clear notification after collapse animation
    setTimeout(() => {
      if (!isExpanded.value) {
        notification.value = null
      }
    }, COLLAPSE_ANIM_MS)
  }
}

function processNext() {
  if (queue.value.length === 0) {
    notification.value = null
    isExpanded.value = false
    return
  }

  const next = queue.value.shift()
  notification.value = next
  isCollapsing.value = false
  isExpanded.value = true

  // 自动收起
  autoCollapseTimer = setTimeout(() => {
    autoCollapseTimer = null
    collapse()
  }, AUTO_COLLAPSE_MS)
}

function push(notif) {
  if (!notif) return
  if (isExpanded.value) {
    // 已有通知在展示，入队
    queue.value.push(notif)
  } else {
    // 直接展示
    notification.value = notif
    isCollapsing.value = false
    isExpanded.value = true
    autoCollapseTimer = setTimeout(() => {
      autoCollapseTimer = null
      collapse()
    }, AUTO_COLLAPSE_MS)
  }
}

function handleTap() {
  const current = notification.value
  collapse()
  return current || null
}

export function useDynamicIsland() {
  return {
    isExpanded,
    isCollapsing,
    notification,
    queue,
    push,
    collapse,
    handleTap
  }
}
