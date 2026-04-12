import { defineStore } from 'pinia'
import { ref } from 'vue'

export const DEFAULT_PROMPT = '你是一个友好的AI助手。'

export const useContactsStore = defineStore('contacts', () => {
  const contacts = ref([])
  const activeChat = ref(null)
  const editingContactId = ref(null)
  const tempAvatar = ref(null)

  // 群聊状态
  const selectedMemberId = ref(null)

  function isGroupChat(contact) {
    return contact && contact.type === 'group'
  }

  function getGroupMember(contact, memberId) {
    if (!isGroupChat(contact)) return null
    return contact.members?.find(m => m.id === memberId)
  }

  function getContactPrompt(contactId) {
    const contact = contacts.value.find(c => c.id === contactId)
    if (contact && typeof contact.prompt === 'string') return contact.prompt
    return ''
  }

  return {
    contacts,
    activeChat,
    editingContactId,
    tempAvatar,
    selectedMemberId,
    isGroupChat,
    getGroupMember,
    getContactPrompt
  }
})
