import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBootstrapStore = defineStore('bootstrap', () => {
  const isHydrating = ref(true)
  const loadError = ref('')
  const hydratedAt = ref(0)

  function startHydration() {
    isHydrating.value = true
    loadError.value = ''
  }

  function finishHydration(error = null) {
    isHydrating.value = false
    loadError.value = error ? String(error) : ''
    hydratedAt.value = Date.now()
  }

  return {
    isHydrating,
    loadError,
    hydratedAt,
    startHydration,
    finishHydration
  }
})
