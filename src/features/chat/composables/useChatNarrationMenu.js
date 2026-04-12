import { ref } from 'vue'

export function useChatNarrationMenu({
  enterMultiSelect,
  scheduleSave,
  showToast,
  store
}) {
  const narrationHiddenByAvatar = ref(false)
  const narrationMenuVisible = ref(false)
  const narrationMenuX = ref(0)
  const narrationMenuY = ref(0)
  const narrationMenuContent = ref('')
  const narrationMenuBlockKey = ref('')

  function showNarrationMenu(e, block) {
    narrationMenuContent.value = block.text
    narrationMenuBlockKey.value = block?.key || ''
    const menuWidth = 192
    const menuHeight = 148
    let x = e.clientX
    let y = e.clientY
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
    narrationMenuX.value = Math.max(10, x)
    narrationMenuY.value = Math.max(10, y)
    narrationMenuVisible.value = true
  }

  function hideNarrationMenu() {
    narrationMenuVisible.value = false
    narrationMenuBlockKey.value = ''
  }

  function handleToggleNarrations() {
    store.showNarrations = !store.showNarrations
    narrationHiddenByAvatar.value = false
    scheduleSave()
    hideNarrationMenu()
    showToast(store.showNarrations ? '已显示旁白' : '已隐藏旁白')
  }

  function handleAvatarToggleNarrations() {
    store.showNarrations = !store.showNarrations
    narrationHiddenByAvatar.value = !store.showNarrations
    scheduleSave()
    showToast(store.showNarrations ? '已显示旁白' : '已隐藏旁白')
  }

  function handleCopyNarration() {
    if (narrationMenuContent.value) {
      navigator.clipboard.writeText(narrationMenuContent.value).then(() => showToast('已复制'))
    }
    hideNarrationMenu()
  }

  function handleNarrationEnterMultiSelect() {
    enterMultiSelect(narrationMenuBlockKey.value)
    hideNarrationMenu()
  }

  return {
    handleAvatarToggleNarrations,
    handleCopyNarration,
    handleNarrationEnterMultiSelect,
    handleToggleNarrations,
    hideNarrationMenu,
    narrationHiddenByAvatar,
    narrationMenuVisible,
    narrationMenuX,
    narrationMenuY,
    showNarrationMenu
  }
}
