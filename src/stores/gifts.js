import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGiftsStore = defineStore('gifts', () => {
  const customGifts = ref([])

  function addCustomGift(gift) {
    if (!gift || !gift.name) return null
    customGifts.value.push(gift)
    return gift
  }

  function removeCustomGift(id) {
    const idx = customGifts.value.findIndex(g => g.id === id)
    if (idx !== -1) customGifts.value.splice(idx, 1)
  }

  function getCustomGiftByName(name) {
    const n = String(name ?? '').trim()
    if (!n) return null
    return customGifts.value.find(g => g.name === n) || null
  }

  function exportData() {
    return JSON.parse(JSON.stringify(customGifts.value))
  }

  function importData(data) {
    if (Array.isArray(data)) customGifts.value = data
  }

  return {
    customGifts,
    addCustomGift,
    removeCustomGift,
    getCustomGiftByName,
    exportData,
    importData
  }
})
