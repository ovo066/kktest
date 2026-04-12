import { applyAssistantPlannerActions } from '../../../utils/plannerAssistantActions'

export function useChatPlannerActions(options = {}) {
  const {
    store,
    plannerStore,
    showToast
  } = options

  async function processAssistantPlannerActions(contact, previousMsgIds) {
    if (!contact || !Array.isArray(contact.msgs) || contact.msgs.length === 0) {
      return { addedEvents: [] }
    }
    const enabled = !!store?.allowAIPlannerCapture

    const newAssistantMessages = contact.msgs.filter((msg) => {
      if (!msg || msg.role !== 'assistant') return false
      if (msg.hidden) return false
      if (previousMsgIds && previousMsgIds.has(msg.id)) return false
      return true
    })

    const addedEvents = []
    let blockCount = 0
    let duplicateCount = 0
    let invalidCount = 0
    newAssistantMessages.forEach((message) => {
      const result = applyAssistantPlannerActions({
        plannerStore,
        activeChat: contact,
        message,
        enabled
      })
      blockCount += Number(result.blockCount || 0)
      duplicateCount += Number(result.duplicateCount || 0)
      invalidCount += Number(result.invalidCount || 0)
      if (result.addedEvents?.length) {
        addedEvents.push(...result.addedEvents)
      }
    })

    if (!enabled) {
      return { addedEvents: [], blockCount, duplicateCount, invalidCount }
    }

    if (addedEvents.length === 1) {
      showToast?.(`已记入日程：${addedEvents[0].title}，可在任务/日历查看`, 4200)
    } else if (addedEvents.length > 1) {
      showToast?.(`已记入日程 ${addedEvents.length} 项，可在任务/日历查看`, 4200)
    } else if (blockCount > 0 && duplicateCount > 0 && invalidCount === 0) {
      showToast?.('这件事之前已经记过了', 3200)
    } else if (blockCount > 0 && invalidCount > 0) {
      showToast?.('识别到日程指令，但未成功写入', 3600)
    }

    return { addedEvents, blockCount, duplicateCount, invalidCount }
  }

  return {
    processAssistantPlannerActions
  }
}
