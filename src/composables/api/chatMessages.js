import { trimText } from './errors'
import { useSoundEffects } from '../useSoundEffects'

export function isAIGeneratedImageMessage(msg) {
  if (!msg || !msg.isImage) return false
  if (msg.generatedByAIImage === true) return true
  if (msg.skipForAIContext === true) return true

  const source = String(msg.imageSource || '').trim().toLowerCase()
  if (source === 'ai-generated' || source === 'ai_generated') return true

  if (typeof msg.imagePrompt === 'string' && msg.imagePrompt.trim()) return true
  if (typeof msg.imageSceneTags === 'string' && msg.imageSceneTags.trim()) return true
  return false
}

export function shouldSkipMessageForAIContext(msg) {
  if (!msg) return true
  if (msg.skipForAIContext === true) return true
  if (msg.isImageRendering) return true
  if (isAIGeneratedImageMessage(msg)) return true
  return false
}

export function removeMessageIfVisiblyEmpty(chat, msgId) {
  if (!chat || !Array.isArray(chat.msgs) || !msgId) return
  const idx = chat.msgs.findIndex(m => m && m.id === msgId)
  if (idx < 0) return
  const msg = chat.msgs[idx]
  const visible = msg?.displayContent != null ? msg.displayContent : msg?.content
  if (!trimText(visible)) {
    chat.msgs.splice(idx, 1)
  }
}

export function markPendingUserMessagesAsRead(chat, reason = 'assistant_reply') {
  if (!chat || !Array.isArray(chat.msgs)) return 0
  const now = Date.now()
  let changed = 0
  for (const msg of chat.msgs) {
    if (!msg || msg.role !== 'user') continue
    if (msg.hideInChat || msg.hidden) continue
    const current = String(msg.readStatus || '').trim().toLowerCase()
    const alreadyRead = current === 'read' || (Number.isFinite(Number(msg.readAt)) && Number(msg.readAt) > 0)
    if (alreadyRead) continue
    msg.readStatus = 'read'
    msg.readAt = now
    if (reason) msg.readReason = reason
    changed += 1
  }
  if (changed > 0) {
    useSoundEffects().playEvent('readReceipt')
  }
  return changed
}
