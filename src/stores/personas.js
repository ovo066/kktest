import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useContactsStore } from './contacts'

export const usePersonasStore = defineStore('personas', () => {
  const personas = ref([])
  const defaultPersonaId = ref(null)
  const editingPersonaId = ref(null)
  const tempPersonaAvatar = ref(null)

  function getPersonaForContact(contactId) {
    const contactsStore = useContactsStore()
    const contact = contactsStore.contacts.find(c => c.id === contactId)
    if (contact && contact.personaId) {
      const persona = personas.value.find(p => p.id === contact.personaId)
      if (persona) return persona
    }
    if (defaultPersonaId.value) {
      return personas.value.find(p => p.id === defaultPersonaId.value)
    }
    return null
  }

  return {
    personas,
    defaultPersonaId,
    editingPersonaId,
    tempPersonaAvatar,
    getPersonaForContact
  }
})
