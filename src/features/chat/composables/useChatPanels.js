import { ref } from 'vue'

export function useChatPanels({
  closePlusMenu = () => {},
  compressImage,
  musicStore,
  store
}) {
  const photoInput = ref(null)
  const showMemoryPanel = ref(false)
  const showMemorySettings = ref(false)

  function openPhotoPicker() {
    closePlusMenu()
    photoInput.value?.click()
  }

  async function handlePhotoInput(e) {
    const files = Array.from(e.target.files || [])
    if (!store.activeChat || files.length === 0) {
      e.target.value = ''
      return
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dataUrl = await compressImage(file, 400, 0.85)
      store.pendingImages.push(dataUrl)
    }
    e.target.value = ''
  }

  function removePendingImage(index) {
    store.pendingImages.splice(index, 1)
  }

  function openMemoryPanel() {
    closePlusMenu()
    store.showStickerPanel = false
    store.showStickerManager = false
    showMemorySettings.value = false
    showMemoryPanel.value = true
  }

  function closeMemoryPanel() {
    showMemoryPanel.value = false
    showMemorySettings.value = false
  }

  function openMemorySettings() {
    showMemoryPanel.value = false
    showMemorySettings.value = true
  }

  function backFromMemorySettings() {
    showMemorySettings.value = false
    showMemoryPanel.value = true
  }

  function openMusicLibrary() {
    closePlusMenu()
    musicStore.libraryOpen = true
  }

  return {
    backFromMemorySettings,
    closeMemoryPanel,
    handlePhotoInput,
    openMemoryPanel,
    openMemorySettings,
    openMusicLibrary,
    openPhotoPicker,
    photoInput,
    removePendingImage,
    showMemoryPanel,
    showMemorySettings
  }
}
