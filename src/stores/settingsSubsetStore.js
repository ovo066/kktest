import { defineStore } from 'pinia'
import { toRef } from 'vue'
import { useSettingsStore } from './settings'

function pickSettingsStateRefs(store, keys) {
  return Object.fromEntries(keys.map((key) => [key, toRef(store.$state, key)]))
}

export function createSettingsSubsetStore(storeId, keys) {
  return defineStore(storeId, () => pickSettingsStateRefs(useSettingsStore(), keys))
}
