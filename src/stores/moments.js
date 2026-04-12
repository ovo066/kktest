import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMomentsStore = defineStore('moments', () => {
  function genId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  function normalizeReply(reply = {}) {
    const content = typeof reply.content === 'string' ? reply.content.trim() : ''
    return {
      id: reply.id || genId('r'),
      content,
      authorId: reply.authorId || 'unknown',
      authorName: reply.authorName || '匿名',
      authorAvatar: Object.prototype.hasOwnProperty.call(reply, 'authorAvatar') ? reply.authorAvatar : null,
      time: Number.isFinite(reply.time) ? reply.time : Date.now(),
      replyToReplyId: reply.replyToReplyId || null,
      replyToAuthorId: reply.replyToAuthorId || null,
      replyToAuthorName: reply.replyToAuthorName || null,
      replyToContentPreview: reply.replyToContentPreview || null
    }
  }

  function parseInlineCommentPayload(payload) {
    const raw = String(payload || '').trim()
    if (!raw) return null
    const parts = raw.split(/[:：]/).map(x => x.trim())
    if (parts.length < 2) {
      // 兼容简写：(动态评论:内容) => 默认评论最近一条动态
      return {
        momentId: 'latest',
        replyToReplyId: null,
        content: parts[0] || ''
      }
    }

    const momentId = parts[0]
    const second = parts[1] || ''
    const secondIsReplyRef = /^(?:r[_-]|reply[_-]|latest|last|latest[_-]?reply|last[_-]?reply|最新|最近|最新回复|最近回复)/i.test(second)

    if (parts.length >= 3 && secondIsReplyRef) {
      return {
        momentId,
        replyToReplyId: second,
        content: parts.slice(2).join('：').trim()
      }
    }

    return {
      momentId,
      replyToReplyId: null,
      content: parts.slice(1).join('：').trim()
    }
  }

  // 论坛用户设置（保留兼容）
  const forumUser = ref({
    id: 'forum_user',
    name: '匿名用户',
    avatar: null,
    bio: ''
  })

  // 动态列表
  const moments = ref([])

  // 关注的用户ID列表
  const following = ref([])

  // 联系人熟人分组（同组默认互相认识）
  const contactGroups = ref([])
  const contactGroupMap = ref({})

  // 未读动态
  const unreadMomentIds = ref(new Set())
  const lastSeenMomentTime = ref(0)

  // 按时间排序的动态
  const sortedMoments = computed(() => {
    return [...moments.value].sort((a, b) => b.time - a.time)
  })

  // 关注的人的动态
  const followingMoments = computed(() => {
    return moments.value
      .filter(m => following.value.includes(m.authorId))
      .sort((a, b) => b.time - a.time)
  })

  function addMoment(moment) {
    const fallbackAuthor = forumUser.value || {}
    const hasAuthorAvatar = Object.prototype.hasOwnProperty.call(moment || {}, 'authorAvatar')
    const newMoment = {
      id: moment.id || genId('p'),
      content: moment.content || '',
      images: Array.isArray(moment.images) ? moment.images : [],
      mood: moment.mood || null,
      tags: moment.tags || [],
      authorId: moment.authorId || fallbackAuthor.id || 'user',
      authorName: moment.authorName || fallbackAuthor.name || 'User',
      authorAvatar: hasAuthorAvatar ? moment.authorAvatar : (fallbackAuthor.avatar || null),
      time: moment.time || Date.now(),
      likes: moment.likes || 0,
      isLiked: moment.isLiked || false,
      replies: Array.isArray(moment.replies)
        ? moment.replies.map(normalizeReply).filter(r => r.content)
        : [],
      linkedChatId: moment.linkedChatId || null
    }

    moments.value.unshift(newMoment)
    unreadMomentIds.value.add(newMoment.id)
    return newMoment
  }

  function likeMoment(momentId) {
    const m = moments.value.find(x => x.id === momentId)
    if (m) {
      if (m.isLiked) {
        m.likes = Math.max(0, (m.likes || 0) - 1)
        m.isLiked = false
      } else {
        m.likes = (m.likes || 0) + 1
        m.isLiked = true
      }
    }
  }

  function addReply(momentId, reply) {
    const m = moments.value.find(x => x.id === momentId)
    if (m) {
      const newReply = normalizeReply(reply)
      if (!newReply.content) return null
      m.replies.push(newReply)
      return newReply
    }
    return null
  }

  function deleteMoment(momentId) {
    const idx = moments.value.findIndex(x => x.id === momentId)
    if (idx !== -1) moments.value.splice(idx, 1)
    unreadMomentIds.value.delete(momentId)
  }

  function deleteReply(momentId, replyId) {
    const m = moments.value.find(x => x.id === momentId)
    if (m) {
      const idx = m.replies.findIndex(r => r.id === replyId)
      if (idx !== -1) m.replies.splice(idx, 1)
    }
  }

  function toggleFollow(userId) {
    const idx = following.value.indexOf(userId)
    if (idx === -1) {
      following.value.push(userId)
    } else {
      following.value.splice(idx, 1)
    }
  }

  function isFollowing(userId) {
    return following.value.includes(userId)
  }

  function ensureContactGroupName(name) {
    const raw = String(name || '').trim()
    return raw || '新分组'
  }

  function addContactGroup(name = '') {
    const existingNames = new Set(contactGroups.value.map(g => String(g?.name || '').trim()))
    const base = ensureContactGroupName(name)
    let nextName = base
    let i = 2
    while (existingNames.has(nextName)) {
      nextName = `${base}${i}`
      i += 1
    }
    const group = {
      id: genId('cg'),
      name: nextName
    }
    contactGroups.value.push(group)
    return group
  }

  function renameContactGroup(groupId, name) {
    const group = contactGroups.value.find(g => g.id === groupId)
    if (!group) return
    group.name = ensureContactGroupName(name)
  }

  function deleteContactGroup(groupId) {
    const idx = contactGroups.value.findIndex(g => g.id === groupId)
    if (idx !== -1) {
      contactGroups.value.splice(idx, 1)
    }
    if (contactGroupMap.value && typeof contactGroupMap.value === 'object') {
      Object.keys(contactGroupMap.value).forEach(contactId => {
        if (contactGroupMap.value[contactId] === groupId) {
          delete contactGroupMap.value[contactId]
        }
      })
    }
  }

  function getContactGroupId(contactId) {
    if (!contactId) return ''
    return contactGroupMap.value?.[contactId] || ''
  }

  function setContactGroup(contactId, groupId) {
    if (!contactId) return
    if (!contactGroupMap.value || typeof contactGroupMap.value !== 'object') {
      contactGroupMap.value = {}
    }
    const safeGroupId = String(groupId || '').trim()
    if (!safeGroupId) {
      delete contactGroupMap.value[contactId]
      return
    }
    const exists = contactGroups.value.some(g => g.id === safeGroupId)
    if (!exists) return
    contactGroupMap.value[contactId] = safeGroupId
  }

  function areContactsAcquainted(aId, bId) {
    if (!aId || !bId) return false
    if (aId === bId) return true
    const ga = getContactGroupId(aId)
    const gb = getContactGroupId(bId)
    return !!ga && ga === gb
  }

  function updateForumUser(data) {
    Object.assign(forumUser.value, data)
  }

  function markAllSeen() {
    unreadMomentIds.value.clear()
    lastSeenMomentTime.value = Date.now()
  }

  function getMomentById(id) {
    return moments.value.find(m => m.id === id) || null
  }

  // 从AI输出解析动态内容（新格式）
  function parseMomentContent(text, author) {
    if (!text || typeof text !== 'string') {
      return {
        moments: 0,
        replies: 0,
        latestMomentId: null,
        latestMomentContent: '',
        latestReplyMomentId: null,
        latestReplyId: null,
        latestReplyContent: ''
      }
    }

    const safeAuthor = author || { id: 'unknown', name: '未知', avatar: null }
    let didMoments = 0
    let didReplies = 0
    let latestMomentId = null
    let latestMomentContent = ''
    let latestReplyMomentId = null
    let latestReplyId = null
    let latestReplyContent = ''

    // 新格式：(动态:内容) 或 (动态:内容:心情)
    const momentRegex = /[(\uff08]\s*(?:动态|moment)\s*[:\uff1a]\s*([^:\uff1a)\uff09]+?)(?:[:\uff1a]([^)\uff09]+?))?\s*[)\uff09]/gi
    let match
    while ((match = momentRegex.exec(text)) !== null) {
      const content = (match[1] || '').trim()
      const mood = (match[2] || '').trim() || null
      if (!content) continue

      const createdMoment = addMoment({
        content,
        mood,
        authorId: safeAuthor.id,
        authorName: safeAuthor.name,
        authorAvatar: safeAuthor.avatar
      })
      if (!createdMoment) continue
      didMoments++
      latestMomentId = createdMoment.id
      latestMomentContent = createdMoment.content || content
    }

    // 新格式：
    // (动态评论:momentId:内容)
    // (动态评论:momentId:replyId:内容)
    const commentRegex = /[(\uff08]\s*(?:动态评论|moment-comment)\s*[:\uff1a]\s*([^)\uff09]+?)\s*[)\uff09]/gi
    while ((match = commentRegex.exec(text)) !== null) {
      const parsed = parseInlineCommentPayload(match[1])
      if (!parsed) continue

      let targetId = (parsed.momentId || '').trim()
      let replyToReplyId = (parsed.replyToReplyId || '').trim()
      const replyContent = (parsed.content || '').trim()
      if (!replyContent) continue

      // 解析 latest/最新 别名
      if (/^(latest|last|最新|最近)$/i.test(targetId)) {
        targetId = moments.value[0]?.id || ''
      }
      if (!targetId) continue

      const targetMoment = moments.value.find(x => x.id === targetId)
      if (!targetMoment) continue

      if (/^(latest|last|最新|最近)$/i.test(replyToReplyId) || /^(latest[_-]?reply|last[_-]?reply|最新回复|最近回复)$/i.test(replyToReplyId)) {
        replyToReplyId = targetMoment.replies?.[targetMoment.replies.length - 1]?.id || ''
      }

      const targetReply = replyToReplyId
        ? targetMoment.replies?.find(r => r.id === replyToReplyId) || null
        : null

      const newReply = addReply(targetId, {
        content: replyContent,
        authorId: safeAuthor.id,
        authorName: safeAuthor.name,
        authorAvatar: safeAuthor.avatar,
        replyToReplyId: targetReply?.id || null,
        replyToAuthorId: targetReply?.authorId || null,
        replyToAuthorName: targetReply?.authorName || null,
        replyToContentPreview: targetReply?.content ? targetReply.content.slice(0, 80) : null
      })
      if (!newReply) continue
      didReplies++
      latestReplyMomentId = targetId
      latestReplyId = newReply.id
      latestReplyContent = newReply.content || replyContent
    }

    // 旧格式 fallback：[论坛:发帖]...[/论坛:发帖]
    const postBlockRegex = /\[论坛\s*(?:[:\uff1a]\s*)?发帖\]([\s\S]*?)(?:\[\/论坛\s*(?:[:\uff1a]\s*)?发帖\]|\[\/论坛\]|$)/g
    while ((match = postBlockRegex.exec(text)) !== null) {
      const parsed = parseOldPostBlock(match[1])
      if (!parsed || (!parsed.title && !parsed.content)) continue
      const content = parsed.title
        ? (parsed.title + '\n' + parsed.content).trim()
        : parsed.content
      const createdMoment = addMoment({
        content,
        tags: parsed.tags,
        authorId: safeAuthor.id,
        authorName: safeAuthor.name,
        authorAvatar: safeAuthor.avatar
      })
      if (!createdMoment) continue
      didMoments++
      latestMomentId = createdMoment.id
      latestMomentContent = createdMoment.content || content
    }

    // 旧格式 fallback：[论坛:回复]...[/论坛:回复]
    const replyBlockRegex = /\[论坛\s*(?:[:\uff1a]\s*)?回复\]([\s\S]*?)(?:\[\/论坛\s*(?:[:\uff1a]\s*)?回复\]|\[\/论坛\]|$)/g
    while ((match = replyBlockRegex.exec(text)) !== null) {
      const parsed = parseOldReplyBlock(match[1])
      if (!parsed) continue
      const newReply = addReply(parsed.postId, {
        content: parsed.content,
        authorId: safeAuthor.id,
        authorName: safeAuthor.name,
        authorAvatar: safeAuthor.avatar
      })
      if (!newReply) continue
      didReplies++
      latestReplyMomentId = parsed.postId
      latestReplyId = newReply.id
      latestReplyContent = newReply.content || parsed.content
    }

    // 旧格式内联: [论坛:发帖:标题:内容]
    const postInlineRegex = /\[论坛[:\uff1a]发帖[:\uff1a]([^\]:\uff1a]+)[:\uff1a]([^\]]+)\]/g
    while ((match = postInlineRegex.exec(text)) !== null) {
      const createdMoment = addMoment({
        content: (match[1].trim() + '\n' + match[2].trim()).trim(),
        authorId: safeAuthor.id,
        authorName: safeAuthor.name,
        authorAvatar: safeAuthor.avatar
      })
      if (!createdMoment) continue
      didMoments++
      latestMomentId = createdMoment.id
      latestMomentContent = createdMoment.content
    }

    // 旧格式内联: [论坛:回复:postId:内容]
    const replyInlineRegex = /\[论坛[:\uff1a]回复[:\uff1a]([^\]:\uff1a]+)[:\uff1a]([^\]]+)\]/g
    while ((match = replyInlineRegex.exec(text)) !== null) {
      const targetId = match[1].trim()
      const newReply = addReply(targetId, {
        content: match[2].trim(),
        authorId: safeAuthor.id,
        authorName: safeAuthor.name,
        authorAvatar: safeAuthor.avatar
      })
      if (!newReply) continue
      didReplies++
      latestReplyMomentId = targetId
      latestReplyId = newReply.id
      latestReplyContent = newReply.content || match[2].trim()
    }

    return {
      moments: didMoments,
      replies: didReplies,
      latestMomentId,
      latestMomentContent,
      latestReplyMomentId,
      latestReplyId,
      latestReplyContent
    }
  }

  // 旧格式解析辅助函数
  function parseOldPostBlock(block) {
    const raw = (block || '').trim()
    if (!raw) return null

    const titleMatch = raw.match(/^\s*(?:标题|title)\s*[:\uff1a]\s*(.+)\s*$/im)
    const tagsMatch = raw.match(/^\s*(?:标签|tags?|tag)\s*[:\uff1a]\s*(.+)\s*$/im)
    let title = titleMatch?.[1]?.trim() || ''
    const tags = parseTags(tagsMatch?.[1])

    const withoutTags = raw.replace(/^\s*(?:标签|tags?|tag)\s*[:\uff1a].*$/gim, '').trim()
    const contentMatch = withoutTags.match(/^\s*(?:内容|正文|content)\s*[:\uff1a]\s*([\s\S]*)$/im)
    let content = ''
    if (contentMatch?.[1] != null) {
      content = contentMatch[1].trim()
    } else {
      let tmp = withoutTags.replace(/^\s*(?:标题|title)\s*[:\uff1a].*$/im, '').trim()
      const lines = tmp.split('\n')
      const firstNonEmpty = lines.findIndex(l => l.trim().length > 0)
      if (!title && firstNonEmpty !== -1) {
        title = lines[firstNonEmpty].trim().replace(/^#+\s*/, '')
        lines.splice(firstNonEmpty, 1)
        tmp = lines.join('\n')
      }
      content = tmp.replace(/^\s*(?:内容|正文|content)\s*[:\uff1a]\s*/im, '').trim()
    }

    return { title, content, tags }
  }

  function parseOldReplyBlock(block) {
    const raw = (block || '').trim()
    if (!raw) return null

    const idMatch = raw.match(/^\s*(?:帖子ID|post\s*id|postId|id)\s*[:\uff1a]\s*(.+)\s*$/im)
    let postId = normalizePostId(idMatch?.[1])
    if (!postId) postId = moments.value[0]?.id || ''

    const withoutId = raw.replace(/^\s*(?:帖子ID|post\s*id|postId|id)\s*[:\uff1a].*$/im, '').trim()
    const contentMatch = withoutId.match(/^\s*(?:内容|正文|content|回复)\s*[:\uff1a]\s*([\s\S]*)$/im)
    const content = (contentMatch?.[1] != null ? contentMatch[1] : withoutId).trim()
    if (!postId || !content) return null
    return { postId, content }
  }

  function normalizePostId(raw) {
    if (!raw) return ''
    const cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, '')
    if (!cleaned) return ''
    if (/^(latest|last)$/i.test(cleaned) || cleaned === '最新' || cleaned === '最近') {
      return moments.value[0]?.id || ''
    }
    return cleaned
  }

  function parseTags(raw) {
    if (!raw) return []
    const parts = raw
      .split(/[,\uff0c、\s]+/g)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.replace(/^#/, ''))
    return Array.from(new Set(parts)).slice(0, 10)
  }

  return {
    // 核心
    forumUser,
    moments,
    following,
    contactGroups,
    contactGroupMap,
    unreadMomentIds,
    lastSeenMomentTime,
    sortedMoments,
    followingMoments,

    // CRUD
    addMoment,
    likeMoment,
    addReply,
    deleteMoment,
    deleteReply,
    toggleFollow,
    isFollowing,
    addContactGroup,
    renameContactGroup,
    deleteContactGroup,
    getContactGroupId,
    setContactGroup,
    areContactsAcquainted,
    updateForumUser,
    markAllSeen,
    getMomentById,

    // 解析
    parseMomentContent,
  }
})
