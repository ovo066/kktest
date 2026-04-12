import { computed, ref } from 'vue'

export function useChatSnoopConsent({ activeChat, router }) {
  const showSnoopConsent = ref(false)

  const canOpenSnoop = computed(() => !!activeChat.value?.id && activeChat.value?.type !== 'group')

  function openSnoopConsent() {
    if (!canOpenSnoop.value) return
    showSnoopConsent.value = true
  }

  function confirmSnoopConsent() {
    if (!canOpenSnoop.value) {
      showSnoopConsent.value = false
      return
    }

    showSnoopConsent.value = false
    const contactId = activeChat.value?.id
    if (contactId) router.push('/snoop/' + contactId)
  }

  return {
    showSnoopConsent,
    canOpenSnoop,
    openSnoopConsent,
    confirmSnoopConsent
  }
}
