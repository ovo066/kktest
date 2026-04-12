import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useChatStore = defineStore('chat', () => {
  // 临时消息状态
  const tempMsgId = ref(null)
  const tempMsgIsUser = ref(false)
  const tempMsgContent = ref(null)

  // 回复/编辑状态
  const replyingToId = ref(null)
  const replyingToText = ref(null)
  const editingMsgId = ref(null)

  // 图片
  const pendingImages = ref([])

  // 动态页返回标记
  const returnedFromMomentId = ref(null)

  // UI 状态
  const ui = reactive({
    isTyping: false,
    isThinking: false,
    animateMsgId: null
  })

  function clearReply() {
    replyingToId.value = null
    replyingToText.value = null
  }

  function clearEdit() {
    editingMsgId.value = null
  }

  return {
    tempMsgId,
    tempMsgIsUser,
    tempMsgContent,
    replyingToId,
    replyingToText,
    editingMsgId,
    pendingImages,
    returnedFromMomentId,
    ui,
    clearReply,
    clearEdit
  }
})
