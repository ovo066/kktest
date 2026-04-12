import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStickersStore = defineStore('stickers', () => {
  const stickers = ref([])
  const stickerGroups = ref([])
  const showStickerPanel = ref(false)
  const showStickerManager = ref(false)
  const editingStickerId = ref(null)

  function normalizeStickerName(name) {
    return String(name ?? '').trim().toLowerCase()
  }

  function getStickerUrl(name) {
    const target = normalizeStickerName(name)
    if (!target) return null
    const sticker = stickers.value.find(s => normalizeStickerName(s?.name) === target)
    return sticker ? sticker.url : null
  }

  return {
    stickers,
    stickerGroups,
    showStickerPanel,
    showStickerManager,
    editingStickerId,
    getStickerUrl
  }
})
