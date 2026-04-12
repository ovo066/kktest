import { ref } from 'vue'

const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer = null

export function useToast() {
  function showToast(msg, duration = 2500) {
    toastMessage.value = msg
    toastVisible.value = true

    if (toastTimer) {
      clearTimeout(toastTimer)
    }

    toastTimer = setTimeout(() => {
      toastVisible.value = false
      toastTimer = null
    }, duration)
  }

  return {
    toastMessage,
    toastVisible,
    showToast
  }
}
