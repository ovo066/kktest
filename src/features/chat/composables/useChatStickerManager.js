import { computed, ref, watch } from 'vue'
import { useSoundEffects } from '../../../composables/useSoundEffects'
import {
  sanitizeStickerGroupSelection,
  sameStickerGroupSelection
} from '../../../utils/stickerGroups'

export function useChatStickerManager({
  closePlusMenu,
  compressImage,
  guessImportedStickerNameFromFile,
  importStickerFiles,
  makeId,
  runStickerBatchImport,
  readStickerBatchFileText,
  scheduleSave,
  showConfirm,
  showToast,
  store
}) {
  const soundEffects = useSoundEffects()
  const stickerLocalInput = ref(null)
  const stickerBatchVisible = ref(false)
  const stickerBatchText = ref('')
  const stickerImportOptionsVisible = ref(false)
  const pendingStickerImportFiles = ref([])
  const stickerEditorVisible = ref(false)
  const stickerEditorDraft = ref(null)
  const stickerGroupVisible = ref(false)
  const stickerSelectionMode = ref(false)
  const selectedStickerIds = ref([])

  const stickerImportOptionsSummary = computed(() => {
    const count = pendingStickerImportFiles.value.length
    if (count <= 0) return ''
    return count === 1
      ? '将导入 1 张本地图片，可选择已有分组或直接新建分组。'
      : `将导入 ${count} 张本地图片，可选择已有分组或直接新建分组。`
  })

  watch(() => store.showStickerManager, (visible) => {
    if (!visible) {
      resetStickerSelection()
    }
  })

  // 贴纸面板
  function openStickerPanel() {
    closePlusMenu()
    store.showStickerManager = false
    store.showStickerPanel = true
  }

  function closeStickerPanel() {
    store.showStickerPanel = false
  }

  function openStickerManager() {
    store.showStickerPanel = false
    resetStickerSelection()
    store.showStickerManager = true
  }

  function closeStickerManager() {
    resetStickerSelection()
    store.showStickerManager = false
    store.showStickerPanel = true
  }

  function openStickerBatchModal() {
    stickerBatchVisible.value = true
    stickerBatchText.value = ''
  }

  function closeStickerBatchModal() {
    stickerBatchVisible.value = false
  }

  function normalizeStickerImportGroupName(value) {
    return String(value || '').trim()
  }

  function findStickerGroupByName(name) {
    const lookup = normalizeStickerImportGroupName(name).toLowerCase()
    if (!lookup) return null
    return (store.stickerGroups || []).find((group) => {
      return normalizeStickerImportGroupName(group?.name).toLowerCase() === lookup
    }) || null
  }

  function ensureStickerImportGroup(name) {
    const normalizedName = normalizeStickerImportGroupName(name)
    if (!normalizedName) return null

    const existing = findStickerGroupByName(normalizedName)
    if (existing) return existing

    const now = Date.now()
    const group = {
      id: makeId('sticker_group'),
      name: normalizedName,
      description: '',
      createdAt: now,
      updatedAt: now
    }
    store.stickerGroups.push(group)
    return group
  }

  function resolveStickerImportGroupIds(payload = {}) {
    const newGroupName = normalizeStickerImportGroupName(payload?.newGroupName)
    if (newGroupName) {
      const group = ensureStickerImportGroup(newGroupName)
      return group ? [group.id] : []
    }
    return payload?.groupId
      ? sanitizeStickerGroupSelection([payload.groupId], store.stickerGroups)
      : []
  }

  function openStickerImportOptionsModal(files = []) {
    const nextFiles = Array.from(files).filter(Boolean)
    if (nextFiles.length === 0) return
    pendingStickerImportFiles.value = nextFiles
    stickerImportOptionsVisible.value = true
  }

  function closeStickerImportOptionsModal() {
    stickerImportOptionsVisible.value = false
    pendingStickerImportFiles.value = []
  }

  async function confirmStickerImportOptions(payload) {
    const files = Array.from(pendingStickerImportFiles.value || []).filter(Boolean)
    if (files.length === 0) {
      closeStickerImportOptionsModal()
      return
    }

    const defaultGroupIds = resolveStickerImportGroupIds(payload)
    closeStickerImportOptionsModal()
    try {
      await importStickerFiles(files, { defaultGroupIds })
    } catch (err) {
      console.warn('Failed to import local sticker files:', err)
      showToast('导入贴纸失败')
    }
  }

  function openStickerEditor(stickerId) {
    const target = (store.stickers || []).find(sticker => sticker.id === stickerId)
    if (!target) return
    stickerEditorDraft.value = {
      ...target,
      aliases: Array.isArray(target.aliases) ? [...target.aliases] : [],
      keywords: Array.isArray(target.keywords) ? [...target.keywords] : [],
      groupIds: Array.isArray(target.groupIds) ? [...target.groupIds] : []
    }
    stickerEditorVisible.value = true
  }

  function openStickerEditorForCreate(url, name = '', groupIds = []) {
    stickerEditorDraft.value = {
      id: null,
      name: String(name || '').trim(),
      url,
      source: 'local',
      aliases: [],
      keywords: [],
      groupIds: [...sanitizeStickerGroupSelection(groupIds, store.stickerGroups)]
    }
    stickerEditorVisible.value = true
  }

  function closeStickerEditor() {
    stickerEditorVisible.value = false
    stickerEditorDraft.value = null
  }

  function getValidSelectedStickerIds() {
    const validIds = new Set((store.stickers || []).map(sticker => sticker?.id).filter(Boolean))
    return (selectedStickerIds.value || []).filter(id => validIds.has(id))
  }

  function resetStickerSelection() {
    stickerSelectionMode.value = false
    selectedStickerIds.value = []
  }

  function toggleStickerSelectionMode() {
    if (!Array.isArray(store.stickers) || store.stickers.length === 0) return
    if (stickerSelectionMode.value) {
      resetStickerSelection()
      return
    }
    stickerSelectionMode.value = true
    selectedStickerIds.value = []
  }

  function toggleStickerSelection(stickerId) {
    const id = String(stickerId || '').trim()
    if (!id) return

    const next = new Set(getValidSelectedStickerIds())
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selectedStickerIds.value = Array.from(next)

    if (!stickerSelectionMode.value && selectedStickerIds.value.length > 0) {
      stickerSelectionMode.value = true
    }
  }

  function toggleSelectAllStickers() {
    const allIds = (store.stickers || []).map(sticker => sticker?.id).filter(Boolean)
    if (allIds.length === 0) {
      resetStickerSelection()
      return
    }
    if (getValidSelectedStickerIds().length === allIds.length) {
      selectedStickerIds.value = []
      return
    }
    stickerSelectionMode.value = true
    selectedStickerIds.value = allIds
  }

  async function handleStickerLocalInput(e) {
    const files = Array.from(e.target.files || []).filter(Boolean)
    e.target.value = ''
    if (files.length === 0) return

    try {
      if (files.length === 1) {
        const [file] = files
        const url = await compressImage(file, 200)
        if (!url) {
          showToast('导入贴纸失败')
          return
        }
        openStickerEditorForCreate(url, guessImportedStickerNameFromFile(file))
      } else {
        openStickerImportOptionsModal(files)
      }
    } catch (err) {
      console.warn('Failed to import local sticker file:', err)
      showToast('导入贴纸失败')
    }
  }

  function confirmStickerEditor(payload) {
    const name = String(payload?.name || '').trim()
    if (!name) {
      showToast('请输入贴纸名称')
      return
    }
    if (!stickerEditorDraft.value?.url) return

    const now = Date.now()
    const nextSticker = {
      ...stickerEditorDraft.value,
      name,
      aliases: Array.isArray(payload?.aliases) ? payload.aliases : [],
      keywords: Array.isArray(payload?.keywords) ? payload.keywords : [],
      groupIds: sanitizeStickerGroupSelection(payload?.groupIds, store.stickerGroups),
      updatedAt: now
    }

    if (nextSticker.id) {
      const index = store.stickers.findIndex(sticker => sticker.id === nextSticker.id)
      if (index !== -1) {
        store.stickers[index] = {
          ...store.stickers[index],
          ...nextSticker
        }
      }
      showToast('已更新贴纸')
    } else {
      store.stickers.push({
        ...nextSticker,
        id: makeId('sticker'),
        createdAt: now,
        updatedAt: now
      })
      showToast('已添加贴纸')
    }

    scheduleSave()
    closeStickerEditor()
  }

  async function deleteSelectedStickers() {
    const ids = getValidSelectedStickerIds()
    if (ids.length === 0) {
      showToast('请先选择贴纸')
      return
    }

    const confirmed = await showConfirm({
      title: '批量删除贴纸',
      message: `确定删除这 ${ids.length} 张贴纸吗？此操作不可撤销。`,
      confirmText: '删除',
      confirmColor: '#FF3B30'
    })
    if (!confirmed) return

    const selectedIdSet = new Set(ids)
    store.stickers = (store.stickers || []).filter(sticker => !selectedIdSet.has(sticker?.id))
    if (stickerEditorDraft.value?.id && selectedIdSet.has(stickerEditorDraft.value.id)) {
      closeStickerEditor()
    }
    scheduleSave()
    resetStickerSelection()
    showToast(`已删除 ${ids.length} 张贴纸`)
  }

  function moveSelectedStickersToGroup(groupId) {
    const ids = getValidSelectedStickerIds()
    if (ids.length === 0) {
      showToast('请先选择贴纸')
      return
    }

    const nextGroupIds = groupId
      ? sanitizeStickerGroupSelection([groupId], store.stickerGroups)
      : []
    if (groupId && nextGroupIds.length === 0) {
      showToast('分组不存在')
      return
    }

    const selectedIdSet = new Set(ids)
    let changed = 0
    const nextUpdatedAt = Date.now()
    store.stickers = (store.stickers || []).map((sticker) => {
      if (!selectedIdSet.has(sticker?.id)) return sticker
      if (sameStickerGroupSelection(sticker?.groupIds, nextGroupIds)) return sticker
      changed += 1
      return {
        ...sticker,
        groupIds: [...nextGroupIds],
        updatedAt: nextUpdatedAt
      }
    })

    if (changed <= 0) {
      showToast(groupId ? '所选贴纸已在该分组' : '所选贴纸已是未分组')
      return
    }

    if (stickerEditorDraft.value?.id && selectedIdSet.has(stickerEditorDraft.value.id)) {
      stickerEditorDraft.value = {
        ...stickerEditorDraft.value,
        groupIds: [...nextGroupIds]
      }
    }

    scheduleSave()
    resetStickerSelection()
    const groupName = nextGroupIds.length > 0
      ? (store.stickerGroups.find(group => group.id === nextGroupIds[0])?.name || '目标分组')
      : '未分组'
    showToast(`已将 ${changed} 张贴纸移动到${groupName}`)
  }

  function openStickerGroupModal() {
    stickerGroupVisible.value = true
  }

  function closeStickerGroupModal() {
    stickerGroupVisible.value = false
  }

  function saveStickerGroup(payload) {
    const name = String(payload?.name || '').trim()
    if (!name) {
      showToast('请输入分组名称')
      return
    }

    const now = Date.now()
    if (payload?.id) {
      const index = store.stickerGroups.findIndex(group => group.id === payload.id)
      if (index !== -1) {
        store.stickerGroups[index] = {
          ...store.stickerGroups[index],
          name,
          description: String(payload?.description || '').trim(),
          updatedAt: now
        }
      }
      showToast('已更新分组')
    } else {
      store.stickerGroups.push({
        id: makeId('sticker_group'),
        name,
        description: String(payload?.description || '').trim(),
        createdAt: now,
        updatedAt: now
      })
      showToast('已创建分组')
    }
    scheduleSave()
  }

  async function deleteStickerGroup(groupId) {
    const group = store.stickerGroups.find(item => item.id === groupId)
    if (!group) return
    const confirmed = await showConfirm({
      title: '删除贴纸分组',
      message: `确定删除“${group.name}”吗？分组会从贴纸和角色配置中移除，但贴纸本身不会删除。`,
      confirmText: '删除',
      confirmColor: '#FF3B30'
    })
    if (!confirmed) return

    const activeChatId = store.activeChat?.id || null
    store.stickerGroups = store.stickerGroups.filter(item => item.id !== groupId)
    store.stickers = (store.stickers || []).map((sticker) => ({
      ...sticker,
      groupIds: (Array.isArray(sticker?.groupIds) ? sticker.groupIds : []).filter(id => id !== groupId)
    }))
    if (stickerEditorDraft.value) {
      stickerEditorDraft.value = {
        ...stickerEditorDraft.value,
        groupIds: (Array.isArray(stickerEditorDraft.value.groupIds) ? stickerEditorDraft.value.groupIds : []).filter(id => id !== groupId)
      }
    }
    store.contacts = (store.contacts || []).map((contact) => ({
      ...contact,
      stickerGroupIds: (Array.isArray(contact?.stickerGroupIds) ? contact.stickerGroupIds : []).filter(id => id !== groupId),
      members: Array.isArray(contact?.members)
        ? contact.members.map((member) => ({
            ...member,
            stickerGroupIds: (Array.isArray(member?.stickerGroupIds) ? member.stickerGroupIds : []).filter(id => id !== groupId)
          }))
        : contact?.members
    }))
    if (activeChatId) {
      store.activeChat = store.contacts.find(contact => contact.id === activeChatId) || null
    }
    scheduleSave()
    showToast('已删除分组')
  }

  function resetStickerBatchModal() {
    stickerBatchText.value = ''
    stickerBatchVisible.value = false
  }

  function confirmStickerBatch(payload) {
    const defaultGroupIds = resolveStickerImportGroupIds(payload)
    if (runStickerBatchImport(stickerBatchText.value, { defaultGroupIds })) {
      resetStickerBatchModal()
    }
  }

  async function handleStickerBatchFile(payload) {
    const file = payload?.file || payload
    const content = await readStickerBatchFileText(file)
    if (!content) return

    stickerBatchText.value = content
    const defaultGroupIds = resolveStickerImportGroupIds(payload)
    if (runStickerBatchImport(content, { defaultGroupIds })) {
      resetStickerBatchModal()
    }
  }

  function deleteSticker(id) {
    store.stickers = store.stickers.filter(s => s.id !== id)
    selectedStickerIds.value = getValidSelectedStickerIds()
    if (stickerSelectionMode.value && selectedStickerIds.value.length === 0) {
      stickerSelectionMode.value = false
    }
    if (stickerEditorDraft.value?.id === id) {
      closeStickerEditor()
    }
    scheduleSave()
    showToast('已删除')
  }

  function sendSticker(name) {
    closeStickerPanel()
    if (!store.activeChat) return
    store.activeChat.msgs.push({
      id: makeId('msg'),
      role: 'user',
      content: '(sticker:' + name + ')',
      time: Date.now(),
      readStatus: 'unread',
      isSticker: true,
      stickerName: name
    })
    scheduleSave()
    soundEffects.playEvent('messageSend')
  }

  return {
    closeStickerBatchModal,
    closeStickerEditor,
    closeStickerGroupModal,
    closeStickerImportOptionsModal,
    closeStickerManager,
    closeStickerPanel,
    confirmStickerBatch,
    confirmStickerEditor,
    confirmStickerImportOptions,
    deleteSelectedStickers,
    deleteSticker,
    deleteStickerGroup,
    handleStickerBatchFile,
    handleStickerLocalInput,
    moveSelectedStickersToGroup,
    openStickerBatchModal,
    openStickerEditor,
    openStickerGroupModal,
    openStickerManager,
    openStickerPanel,
    resetStickerSelection,
    saveStickerGroup,
    selectedStickerIds,
    sendSticker,
    stickerBatchText,
    stickerBatchVisible,
    stickerEditorDraft,
    stickerEditorVisible,
    stickerGroupVisible,
    stickerImportOptionsSummary,
    stickerImportOptionsVisible,
    stickerLocalInput,
    stickerSelectionMode,
    toggleSelectAllStickers,
    toggleStickerSelection,
    toggleStickerSelectionMode
  }
}
