import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSnoopStore = defineStore('snoop', () => {
  // phoneCache[contactId][category] = { items: [...], generatedAt: timestamp }
  const phoneCache = ref({})

  function getCache(contactId, category) {
    return phoneCache.value[contactId]?.[category] || null
  }

  function setCache(contactId, category, items) {
    if (!phoneCache.value[contactId]) phoneCache.value[contactId] = {}
    phoneCache.value[contactId][category] = { items, generatedAt: Date.now() }
  }

  function clearCache(contactId, category) {
    if (phoneCache.value[contactId]) {
      delete phoneCache.value[contactId][category]
    }
  }

  function exportData() {
    return JSON.parse(JSON.stringify(phoneCache.value))
  }

  function importData(d) {
    if (d && typeof d === 'object') phoneCache.value = d
  }

  return { phoneCache, getCache, setCache, clearCache, exportData, importData }
})
