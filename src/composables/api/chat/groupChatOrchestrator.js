import { runGroupSingleChatOrchestrator } from './groupSingleChatOrchestrator'
import { runGroupMultiChatOrchestrator } from './groupMultiChatOrchestrator'

export async function runGroupChatOrchestrator(context, onChunk) {
  const { contactsStore, buildApiFailure } = context
  const activeChat = contactsStore.activeChat

  if (!activeChat || activeChat.type !== 'group') {
    return buildApiFailure('GROUP_CHAT_REQUIRED', '当前不是群聊', {
      feature: 'chat',
      action: 'callGroupAPI'
    })
  }

  if (activeChat.groupMode === 'multi') {
    const memberId = contactsStore.selectedMemberId
    if (!memberId) {
      return buildApiFailure('MEMBER_NOT_SELECTED', '请先选择发言成员', {
        feature: 'chat',
        action: 'callGroupAPI'
      })
    }
    return runGroupMultiChatOrchestrator(context, memberId, onChunk)
  }

  return runGroupSingleChatOrchestrator(context, onChunk)
}
