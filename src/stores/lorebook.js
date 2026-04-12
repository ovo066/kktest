import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useLorebookStore = defineStore('lorebook', () => {
  const lorebook = reactive({
    books: [],
    currentBookId: null,
    editingBookId: null,
    editingEntryId: null,
    tempAlwaysActive: false
  })

  return {
    lorebook
  }
})
