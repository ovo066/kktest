import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { makeId } from '../utils/id'

export const useAlbumStore = defineStore('album', () => {
  const photos = ref([])
  const activeTab = ref('photos') // 'photos' | 'people' | 'favorites'
  const selectedContactId = ref(null) // 当前查看的人物 id（进入人物详情时设置）
  const viewerPhotoId = ref(null)

  // Sorted by createdAt descending
  const sortedPhotos = computed(() =>
    [...photos.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  )

  const favoritePhotos = computed(() =>
    sortedPhotos.value.filter(p => p.isFavorite)
  )

  const photosByContact = computed(() => {
    const map = {}
    for (const p of sortedPhotos.value) {
      const key = p.contactId || '_unknown'
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return map
  })

  const contactsWithPhotos = computed(() => {
    const map = {}
    for (const p of sortedPhotos.value) {
      if (!p.contactId) continue
      if (!map[p.contactId]) {
        map[p.contactId] = {
          contactId: p.contactId,
          contactName: p.contactName || p.contactId,
          count: 0,
          avatar: p.contactAvatar || null,
          coverUrl: null // 第一张图作为封面
        }
      }
      map[p.contactId].count++
      if (!map[p.contactId].coverUrl) {
        map[p.contactId].coverUrl = p.url || null
      }
    }
    return Object.values(map)
  })

  // 当前展示的照片列表（用于 viewer 导航）
  const filteredPhotos = computed(() => {
    if (activeTab.value === 'favorites') return favoritePhotos.value
    if (selectedContactId.value) {
      return photosByContact.value[selectedContactId.value] || []
    }
    return sortedPhotos.value
  })

  function addPhoto({ url, imageRef, contactId, contactName, contactAvatar, source, prompt, width, height }) {
    const normalizedUrl = typeof url === 'string' ? url : ''
    const normalizedRef = typeof imageRef === 'string' ? imageRef : ''
    if (!normalizedUrl && !normalizedRef) return null
    const exists = photos.value.find((p) => {
      if (normalizedRef && p.imageRef === normalizedRef) return true
      return normalizedUrl && p.url === normalizedUrl && p.contactId === contactId
    })
    if (exists) return exists
    const photo = {
      id: makeId('photo'),
      url: normalizedUrl || null,
      imageRef: normalizedRef || null,
      contactId: contactId || null,
      contactName: contactName || '',
      contactAvatar: contactAvatar || null,
      source: source || 'upload',
      prompt: prompt || '',
      createdAt: Date.now(),
      isFavorite: false,
      width: width || null,
      height: height || null
    }
    photos.value.push(photo)
    return photo
  }

  function removePhoto(id) {
    const idx = photos.value.findIndex(p => p.id === id)
    if (idx !== -1) photos.value.splice(idx, 1)
  }

  function toggleFavorite(id) {
    const photo = photos.value.find(p => p.id === id)
    if (photo) photo.isFavorite = !photo.isFavorite
  }

  function getPhotoById(id) {
    return photos.value.find(p => p.id === id) || null
  }

  function collectFromContacts(contacts) {
    if (!Array.isArray(contacts)) return 0
    let count = 0
    for (const c of contacts) {
      if (!Array.isArray(c.msgs)) continue
      for (const msg of c.msgs) {
        if (!msg.isImage) continue
        const imageUrl = typeof msg.imageUrl === 'string' ? msg.imageUrl : ''
        const imageRef = typeof msg.imageRef === 'string' ? msg.imageRef : ''
        if (!imageUrl && !imageRef) continue
        const added = addPhoto({
          url: imageUrl,
          imageRef,
          contactId: c.id,
          contactName: c.name,
          contactAvatar: c.avatar || null,
          source: msg.imageSource === 'ai-generated' ? 'ai' : 'chat',
          prompt: msg.imagePrompt || ''
        })
        if (added && added.id) count++
      }
    }
    return count
  }

  return {
    photos,
    activeTab,
    selectedContactId,
    viewerPhotoId,
    sortedPhotos,
    favoritePhotos,
    photosByContact,
    contactsWithPhotos,
    filteredPhotos,
    addPhoto,
    removePhoto,
    toggleFavorite,
    getPhotoById,
    collectFromContacts
  }
})
