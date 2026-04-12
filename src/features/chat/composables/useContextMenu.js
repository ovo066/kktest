/**
 * 右键菜单相关的组合式函数
 */
import { ref } from 'vue'
import { haptic } from '../../../utils/haptic'

export function useContextMenu() {
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuMaxHeight = ref(0)
  const contextMenuAnchor = ref('top')
  // Useful for "multi-select" to preselect the exact bubble the user long-pressed.
  const contextMenuBlockKey = ref(null)
  const contextMenuMsgId = ref(null)
  const contextMenuPartIndex = ref(null)
  const contextMenuIsUser = ref(false)
  const contextMenuContent = ref('')
  // 聚焦气泡的位置和内容
  const focusedBubble = ref(null)

  function clamp(value, min, max) {
    if (max < min) return min
    return Math.min(Math.max(value, min), max)
  }

  function getViewportBounds() {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    const top = vv ? vv.offsetTop : 0
    const left = vv ? vv.offsetLeft : 0
    const width = vv ? vv.width : window.innerWidth
    const height = vv ? vv.height : window.innerHeight
    return {
      top,
      left,
      right: left + width,
      bottom: top + height
    }
  }

  function showContextMenu(e, block) {
    contextMenuBlockKey.value = block?.key ?? null
    contextMenuMsgId.value = block.msgId
    contextMenuPartIndex.value = block.partIndex ?? null
    contextMenuIsUser.value = block.isUser
    contextMenuContent.value = block.contextContent

    // 获取气泡元素
    const bubbleEl = e.currentTarget
    if (bubbleEl) {
      const rect = bubbleEl.getBoundingClientRect()
      // 获取气泡的计算样式
      const styles = window.getComputedStyle(bubbleEl)
      focusedBubble.value = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        innerHTML: bubbleEl.innerHTML,
        className: bubbleEl.className,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        isUser: block.isUser
      }
    }

    // 菜单位置
    const menuWidth = 200
    const menuHeight = block.isUser ? 320 : 368
    const viewport = getViewportBounds()
    const minX = viewport.left + 10
    const maxX = viewport.right - menuWidth - 10
    const minY = viewport.top + 10
    const viewportMenuMaxHeight = Math.max(160, viewport.bottom - viewport.top - 20)
    let menuX, menuY
    let menuMaxHeight = viewportMenuMaxHeight

    if (focusedBubble.value) {
      const rect = focusedBubble.value
      const availableBelow = Math.max(160, viewport.bottom - (rect.top + rect.height) - 18)
      const availableAbove = Math.max(160, rect.top - viewport.top - 18)

      if (block.isUser) {
        menuX = rect.left + rect.width - menuWidth
      } else {
        menuX = rect.left
      }

      if (availableBelow >= menuHeight) {
        contextMenuAnchor.value = 'top'
        menuY = rect.top + rect.height + 8
        menuMaxHeight = availableBelow
      } else if (availableAbove >= menuHeight) {
        contextMenuAnchor.value = 'bottom'
        menuY = viewport.bottom - rect.top + 8
        menuMaxHeight = availableAbove
      } else if (availableAbove >= availableBelow) {
        contextMenuAnchor.value = 'bottom'
        menuMaxHeight = availableAbove
        menuY = viewport.bottom - rect.top + 8
      } else {
        contextMenuAnchor.value = 'top'
        menuMaxHeight = availableBelow
        menuY = rect.top + rect.height + 8
      }
    } else {
      contextMenuAnchor.value = 'top'
      menuX = e.clientX
      menuY = e.clientY
    }

    const effectiveMenuHeight = Math.min(menuHeight, menuMaxHeight)
    const maxOffset = viewport.bottom - effectiveMenuHeight - 10

    contextMenuX.value = clamp(menuX, minX, maxX)
    contextMenuY.value = contextMenuAnchor.value === 'bottom'
      ? clamp(menuY, 10, maxOffset)
      : clamp(menuY, minY, maxOffset)
    contextMenuMaxHeight.value = Math.min(menuMaxHeight, viewportMenuMaxHeight)
    contextMenuVisible.value = true
    haptic()
  }

  function hideContextMenu() {
    contextMenuVisible.value = false
    contextMenuMaxHeight.value = 0
    contextMenuAnchor.value = 'top'
    contextMenuBlockKey.value = null
    focusedBubble.value = null
  }

  return {
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuMaxHeight,
    contextMenuAnchor,
    contextMenuBlockKey,
    contextMenuMsgId,
    contextMenuPartIndex,
    contextMenuIsUser,
    contextMenuContent,
    focusedBubble,
    showContextMenu,
    hideContextMenu
  }
}
