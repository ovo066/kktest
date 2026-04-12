import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useContactsStore } from './contacts'

export const useConfigsStore = defineStore('configs', () => {
  const configs = ref([])
  const activeConfigId = ref(null)

  const getConfig = computed(() => {
    return configs.value.find(c => c.id === activeConfigId.value) || configs.value[0]
  })

  function getGroupMemberConfig(contact, memberId) {
    const contactsStore = useContactsStore()
    const member = contactsStore.getGroupMember(contact, memberId)
    if (!member || !member.configId) return null
    return configs.value.find(c => c.id === member.configId)
  }

  return {
    configs,
    activeConfigId,
    getConfig,
    getGroupMemberConfig
  }
})
