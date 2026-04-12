export function resolveSocialAuthor(authorType, currentUser, contacts = [], {
  fallbackId = 'user',
  fallbackName = '匿名用户'
} = {}) {
  const defaultAuthor = {
    id: currentUser?.id || fallbackId,
    name: currentUser?.name || fallbackName,
    avatar: currentUser?.avatar || null
  }

  if (authorType === 'user') return defaultAuthor
  if (typeof authorType !== 'string' || !authorType.startsWith('contact:')) return defaultAuthor

  const contactId = authorType.slice(8)
  const contact = contacts.find(item => item?.id === contactId)
  if (!contact) return defaultAuthor

  return {
    id: contact.id,
    name: contact.name,
    avatar: contact.avatar || null
  }
}

