import { extractFavoriteTargets, stripFavoriteTokensForDisplay } from '../../../composables/api/favoriteTokens'
import { addFavoriteCollection } from '../../../utils/favorites'
import {
  favoritePartIndexToKey,
  getLastFavoriteEligiblePartIndex,
  isMessagePartFavorited,
  setMessagePartFavorited,
  toggleMessagePartFavorite
} from '../../../utils/messageFavorites'

export function useChatFavorites({ store, scheduleSave, showToast, makeId }) {
  function resolveCharLabel(contact) {
    return String(contact?.name || '').trim() || '{{char}}'
  }

  function toggleFavorite(msgId, partIndex = null) {
    const msgs = store.activeChat?.msgs
    if (!Array.isArray(msgs)) return
    const msg = msgs.find(m => m.id === msgId)
    if (!msg) return
    const favorited = toggleMessagePartFavorite(msg, partIndex)
    showToast?.(favorited ? '已收藏' : '已取消收藏')
    scheduleSave()
  }

  function favoriteSelectedBlocks(blocks = []) {
    const contact = store.activeChat
    if (!contact || !Array.isArray(blocks) || blocks.length < 2) {
      showToast?.('请至少选择 2 条气泡')
      return false
    }

    const refs = []
    const seen = new Set()
    for (const block of blocks) {
      const msgId = String(block?.msgId ?? '').trim()
      if (!msgId) continue

      const partKey = String(block?.msgPartKey || favoritePartIndexToKey(block?.partIndex)).trim()
        || favoritePartIndexToKey(null)
      const refKey = `${msgId}:${partKey}`
      if (seen.has(refKey)) continue
      seen.add(refKey)
      refs.push({ msgId, partKey })
    }

    if (refs.length < 2) {
      showToast?.('请至少选择 2 条气泡')
      return false
    }

    const result = addFavoriteCollection(contact, refs, {
      id: typeof makeId === 'function' ? makeId('favorite_collection') : '',
      createdAt: Date.now()
    })

    if (result.duplicate) {
      showToast?.('这组气泡已经收藏过了')
      return false
    }
    if (!result.created) {
      showToast?.('收藏失败，请重试')
      return false
    }

    scheduleSave()
    showToast?.(`已收藏 ${refs.length} 条气泡`)
    return true
  }

  function processAssistantFavoriteTokens(contact, previousMsgIds) {
    const msgs = contact?.msgs
    if (!Array.isArray(msgs)) return

    let changed = false
    const allowAIFavorite = !!store.allowAIFavorite
    const charLabel = resolveCharLabel(contact)

    for (let index = 0; index < msgs.length; index += 1) {
      const assistantMsg = msgs[index]
      if (assistantMsg?.role !== 'assistant') continue
      if (previousMsgIds instanceof Set && previousMsgIds.has(assistantMsg.id)) continue
      if (!assistantMsg?.content || typeof assistantMsg.content !== 'string') continue

      const targets = extractFavoriteTargets(assistantMsg.content)
      if (targets.length === 0) continue

      const strippedContent = stripFavoriteTokensForDisplay(assistantMsg.content)
      if (assistantMsg.content !== strippedContent) {
        assistantMsg.content = strippedContent
        changed = true
      }

      if (typeof assistantMsg.displayContent === 'string') {
        const strippedDisplayContent = stripFavoriteTokensForDisplay(assistantMsg.displayContent)
        if (assistantMsg.displayContent !== strippedDisplayContent) {
          assistantMsg.displayContent = strippedDisplayContent
          changed = true
        }
      }

      if (!allowAIFavorite) continue

      for (const target of targets) {
        if (target === 'self') {
          const partIndex = getLastFavoriteEligiblePartIndex(assistantMsg)
          const wasFavorited = isMessagePartFavorited(assistantMsg, partIndex)
          const favorited = setMessagePartFavorited(assistantMsg, partIndex, true)
          if (!wasFavorited && favorited) {
            showToast?.(`已被 ${charLabel} 收藏`)
            changed = true
          }
          continue
        }

        if (target !== 'user') continue

        for (let messageIndex = index - 1; messageIndex >= 0; messageIndex -= 1) {
          const userMsg = msgs[messageIndex]
          if (userMsg?.role !== 'user') continue
          const partIndex = getLastFavoriteEligiblePartIndex(userMsg)
          const wasFavorited = isMessagePartFavorited(userMsg, partIndex)
          const favorited = setMessagePartFavorited(userMsg, partIndex, true)
          if (!wasFavorited && favorited) {
            showToast?.(`${charLabel} 收藏了你的消息`)
            changed = true
          }
          break
        }
      }
    }

    if (changed) {
      scheduleSave()
    }
  }

  return {
    toggleFavorite,
    favoriteSelectedBlocks,
    processAssistantFavoriteTokens
  }
}
