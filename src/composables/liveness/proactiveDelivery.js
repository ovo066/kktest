import { makeId } from '../../utils/id'
import { markPendingUserMessagesAsRead, sendNotification } from './notifications'
import { useSoundEffects } from '../useSoundEffects'

export function createProactiveDelivery({
  chatStore,
  hasRecentDuplicateAssistantMessage,
  livenessStore,
  momentsStore,
  store,
  setGlobalLastProactiveAt
}) {
  const soundEffects = useSoundEffects()

  async function deliverProactiveMoment(contact, decision, config) {
    await sleep((decision.delaySeconds || 5) * 1000)

    const moment = momentsStore.addMoment({
      content: decision.momentContent,
      authorId: contact.id,
      authorName: contact.name,
      authorAvatar: contact.avatar
    })

    if (moment) {
      await sendNotification(contact, `发了一条动态: ${decision.momentContent.slice(0, 40)}`, config, {
        type: 'moment',
        momentId: moment.id
      })
      livenessStore.recordProactiveMsg(contact.id)
      setGlobalLastProactiveAt(Date.now())

      livenessStore.pushEvent({
        type: 'proactive_moment',
        contactId: contact.id,
        context: {
          momentId: moment.id,
          content: decision.momentContent.slice(0, 50),
          reason: decision.reason
        }
      })
    }
  }

  async function deliverProactiveMessage(contact, decision, config) {
    const delay = decision.delaySeconds * 1000

    if (config.simulateReadReceipt) {
      await sleep(Math.min(delay * 0.3, 5000))
    }

    if (config.simulateTypingIndicator) {
      setTypingState(contact.id, true)
      const base = config.replyDelayBase || 2000
      const perChar = config.replyDelayPerChar || 50
      const jitter = (Math.random() - 0.5) * 2 * (config.replyDelayJitter || 3000)
      const typingDuration = base + decision.content.length * perChar + jitter
      await sleep(Math.max(1000, typingDuration))
      setTypingState(contact.id, false)
    } else {
      await sleep(delay)
    }

    if (hasRecentDuplicateAssistantMessage(contact, decision.content)) {
      livenessStore.recordProactiveMsg(contact.id)
      setGlobalLastProactiveAt(Date.now())
      livenessStore.pushEvent({
        type: 'proactive_dedup_skip',
        contactId: contact.id,
        context: {
          content: String(decision.content || '').slice(0, 50),
          reason: 'duplicate_recent_content'
        }
      })
      return
    }

    const msgId = makeId('msg')
    const msg = {
      id: msgId,
      role: 'assistant',
      content: decision.content,
      time: Date.now(),
      proactive: true
    }

    if (!Array.isArray(contact.msgs)) {
      contact.msgs = []
    }
    contact.msgs.push(msg)
    markPendingUserMessagesAsRead(contact, 'delayed_reply')

    // 未读计数：用户不在当前聊天时 +1
    const inActiveChat = store.activeChat?.id === contact.id
    if (!inActiveChat) {
      contact.unreadCount = (contact.unreadCount || 0) + 1
    }

    soundEffects.playEvent(inActiveChat ? 'messageReceive' : 'notification')

    // 发送通知
    await sendNotification(contact, decision.content, config, { type: 'chat' })

    livenessStore.recordProactiveMsg(contact.id)
    setGlobalLastProactiveAt(msg.time)
    livenessStore.pushEvent({
      type: 'proactive_sent',
      contactId: contact.id,
      context: {
        msgId,
        content: decision.content.slice(0, 50),
        reason: decision.reason
      }
    })
  }

  function setTypingState(contactId, typing) {
    if (store.activeChat?.id === contactId) {
      chatStore.ui.isTyping = typing
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  return {
    deliverProactiveMessage,
    deliverProactiveMoment
  }
}
