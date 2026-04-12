import { ref, reactive } from 'vue'
import { normalizeImageUrlInput } from '../../../utils/mediaUrl'

export function useMomentsProfileEditor({
  momentsStore,
  scheduleSave
}) {
  const showEditProfile = ref(false)
  const editProfile = reactive({
    name: '',
    bio: '',
    avatar: null
  })

  function syncEditProfileFromStore() {
    editProfile.name = momentsStore.forumUser?.name || ''
    editProfile.bio = momentsStore.forumUser?.bio || ''
    editProfile.avatar = momentsStore.forumUser?.avatar || null
  }

  function openEditProfile() {
    syncEditProfileFromStore()
    showEditProfile.value = true
  }

  function closeEditProfile() {
    showEditProfile.value = false
  }

  function onAvatarPick(event) {
    const file = event.target?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      editProfile.avatar = reader.result
    }
    reader.readAsDataURL(file)
    if (event.target) event.target.value = ''
  }

  function handleProfileAvatarUrlInput() {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') return
    const raw = window.prompt(
      '请输入头像图床 URL（支持 http/https）',
      editProfile.avatar || momentsStore.forumUser?.avatar || ''
    )
    if (raw === null) return
    const url = normalizeImageUrlInput(raw)
    if (url === null) return
    editProfile.avatar = url || null
  }

  function saveProfile() {
    momentsStore.updateForumUser({
      name: editProfile.name || momentsStore.forumUser.name,
      bio: editProfile.bio,
      avatar: editProfile.avatar || momentsStore.forumUser.avatar
    })
    closeEditProfile()
    scheduleSave()
  }

  return {
    editProfile,
    handleProfileAvatarUrlInput,
    onAvatarPick,
    openEditProfile,
    saveProfile,
    showEditProfile,
    closeEditProfile
  }
}
