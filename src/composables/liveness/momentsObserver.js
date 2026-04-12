/**
 * 动态观察事件源 — 用户发新动态时，通知 AI 角色决定是否回应
 */
import { watch } from 'vue'
import { EventType, isQuietHours } from './eventTypes'

export function createMomentsSource({ emit, store, livenessStore, momentsStore }) {
  let stopWatch = null

  function start() {
    stop()
    if (!momentsStore) return

    // 监听动态列表长度变化（新增动态）
    stopWatch = watch(
      () => momentsStore.moments?.length,
      (newLen, oldLen) => {
        if (!store.allowLivenessEngine) return
        if (isQuietHours(store.livenessConfig)) return
        if (!newLen || newLen <= (oldLen || 0)) return

        // 取最新一条动态
        const latest = momentsStore.sortedMoments?.[0] || momentsStore.moments?.[0]
        if (!latest) return

        // 只关注用户自己发的动态（非 AI 角色发的）
        const isUserPost = !store.contacts?.some(c => c.id === latest.authorId)
        if (!isUserPost) return

        const content = (latest.content || '').slice(0, 200)
        const mood = latest.mood || null

        // 通知所有联系人（让每个角色独立决定是否回应）
        const contacts = store.contacts || []
        for (const contact of contacts) {
          if (contact.type === 'group') continue
          const s = livenessStore.getState(contact.id)

          emit({
            type: EventType.MOMENT_POST,
            contactId: contact.id,
            context: {
              postContent: content,
              postMood: mood,
              affection: s.affection,
              authorName: latest.authorName || '用户'
            }
          })
        }
      }
    )
  }

  function stop() {
    if (stopWatch) {
      stopWatch()
      stopWatch = null
    }
  }

  return { start, stop }
}
