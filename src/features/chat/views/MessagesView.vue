<template>
  <div class="absolute inset-0 z-20 bg-white dark:bg-black flex flex-col">
    <div class="pt-app-lg pb-2 px-4 glass-panel flex items-center justify-between relative">
      <button class="text-[#007AFF] text-[17px] flex items-center" @click="router.push('/')">
        <i class="ph ph-caret-left"></i> 主页
      </button>
      <span class="font-semibold text-[17px] text-black dark:text-white absolute left-1/2 -translate-x-1/2">信息</span>
      <div class="flex items-center gap-2">
        <button class="text-[#007AFF]" @click="openNewGroup" title="新建群聊">
          <i class="ph ph-users-three text-2xl"></i>
        </button>
        <button class="text-[#007AFF]" @click="openNewContact" title="新建联系人">
          <i class="ph ph-note-pencil text-2xl"></i>
        </button>
      </div>
    </div>

    <div ref="listRef" class="flex-1 overflow-y-auto no-scrollbar" @scroll.passive="onListScroll">
      <div v-if="store.contacts.length === 0" class="flex flex-col items-center justify-center h-full text-[#8E8E93]">
        <i class="ph ph-chat-circle-dots text-6xl mb-4 opacity-50"></i>
        <p>暂无联系人</p>
      </div>
      <div v-else class="relative" :style="{ height: `${totalListHeight}px` }">
        <div
          v-for="item in visibleContacts"
          :key="item.contact.id"
          class="absolute left-0 right-0 h-[76px] px-4 py-3 flex gap-3 active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer border-b border-[#C6C6C8]/30 dark:border-gray-800"
          :style="{ transform: `translateY(${item.top}px)` }"
          @click="openChat(item.contact.id)"
        >
          <div v-if="item.contact.type !== 'group'" class="relative w-[50px] h-[50px] shrink-0">
            <div class="w-full h-full rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-2xl overflow-hidden">
              <img v-if="item.contact.avatarType === 'image'" :src="item.contact.avatar" loading="lazy" decoding="async" class="w-full h-full object-cover">
              <template v-else>{{ item.contact.avatar || '🤖' }}</template>
            </div>
            <span v-if="item.contact.unreadCount" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center px-1">{{ item.contact.unreadCount > 99 ? '99+' : item.contact.unreadCount }}</span>
          </div>
          <div v-else class="relative w-[50px] h-[50px] shrink-0">
            <div class="w-full h-full rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center overflow-hidden relative">
              <template v-if="item.contact.members && item.contact.members.length > 0">
                <div
                  v-for="(member, idx) in item.contact.members.slice(0, 4)"
                  :key="idx"
                  class="absolute flex items-center justify-center bg-[#E9E9EB] dark:bg-gray-600 overflow-hidden"
                  :style="getGroupAvatarStyle(idx, Math.min(item.contact.members.length, 4))"
                >
                  <img v-if="member.avatarType === 'image'" :src="member.avatar" loading="lazy" decoding="async" class="w-full h-full object-cover">
                  <span v-else class="text-xs">{{ member.avatar }}</span>
                </div>
              </template>
              <span v-else class="text-2xl">👥</span>
            </div>
            <span v-if="item.contact.unreadCount" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center px-1">{{ item.contact.unreadCount > 99 ? '99+' : item.contact.unreadCount }}</span>
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex justify-between items-baseline mb-[2px]">
              <span class="font-semibold text-[17px] text-black dark:text-white truncate">{{ item.contact.name }}</span>
              <span class="text-[14px] text-[#8E8E93] shrink-0 ml-2">{{ formatTimeShort(item.summary.lastMsgTime) }}</span>
            </div>
            <div class="text-[15px] text-[#8E8E93] truncate">{{ formatPreview(item) || '暂无消息' }}</div>
          </div>
          <i class="ph-bold ph-caret-right text-[#C7C7CC] text-sm self-center"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { readCachedContactMessageSummary } from '../../../utils/contactMessageSummary'

const CONTACT_ROW_HEIGHT = 76
const CONTACT_ROW_OVERSCAN = 8

const router = useRouter()
const store = useContactsStore()
const openNewContact = inject('openNewContact')
const openNewGroup = inject('openNewGroup')
const listRef = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(CONTACT_ROW_HEIGHT * 12)
let resizeObserver = null

const sortedContacts = computed(() => {
  return store.contacts
    .map((contact, index) => ({
      contact,
      index,
      summary: readCachedContactMessageSummary(contact)
    }))
    .sort((a, b) => {
      const ta = Number(a.summary.lastMsgTime || 0)
      const tb = Number(b.summary.lastMsgTime || 0)
      if (tb !== ta) return tb - ta
      return a.index - b.index
    })
})

const totalListHeight = computed(() => sortedContacts.value.length * CONTACT_ROW_HEIGHT)

const visibleContacts = computed(() => {
  const items = sortedContacts.value
  if (items.length === 0) return []

  const safeViewportHeight = Math.max(viewportHeight.value, CONTACT_ROW_HEIGHT * 6)
  const maxScrollTop = Math.max(0, totalListHeight.value - safeViewportHeight)
  const safeScrollTop = Math.max(0, Math.min(scrollTop.value, maxScrollTop))
  const startIndex = Math.max(0, Math.floor(safeScrollTop / CONTACT_ROW_HEIGHT) - CONTACT_ROW_OVERSCAN)
  const endIndex = Math.min(
    items.length,
    Math.ceil((safeScrollTop + safeViewportHeight) / CONTACT_ROW_HEIGHT) + CONTACT_ROW_OVERSCAN
  )

  return items.slice(startIndex, endIndex).map((item, offset) => ({
    ...item,
    top: (startIndex + offset) * CONTACT_ROW_HEIGHT
  }))
})

function syncViewportMetrics() {
  const el = listRef.value
  if (!el) return
  scrollTop.value = el.scrollTop || 0
  viewportHeight.value = el.clientHeight || CONTACT_ROW_HEIGHT * 12
}

function onListScroll(event) {
  scrollTop.value = event?.target?.scrollTop || 0
}

function openChat(contactId) {
  const contact = store.contacts.find(c => c.id === contactId)
  if (contact) {
    contact.unreadCount = 0
    store.activeChat = contact
    router.push('/chat/' + contactId)
  }
}

function formatTimeShort(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatPreview(item) {
  const preview = item?.summary?.lastMsgPreview || ''
  if (!preview) return ''
  if (item?.contact?.type === 'group' && item?.summary?.lastMsgSenderName) {
    return `${item.summary.lastMsgSenderName}: ${preview}`
  }
  return preview
}

function getGroupAvatarStyle(idx, total) {
  const size = total === 1 ? '100%' : '50%'
  let top = '0'
  let left = '0'

  if (total === 2) {
    left = idx === 0 ? '0' : '50%'
  } else if (total === 3) {
    if (idx === 0) {
      top = '25%'
      left = '0'
    } else {
      top = idx === 1 ? '0' : '50%'
      left = '50%'
    }
  } else if (total === 4) {
    top = idx < 2 ? '0' : '50%'
    left = idx % 2 === 0 ? '0' : '50%'
  }

  return {
    width: size,
    height: total === 2 ? '100%' : size,
    top,
    left
  }
}

onMounted(() => {
  nextTick(syncViewportMetrics)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncViewportMetrics())
    if (listRef.value) resizeObserver.observe(listRef.value)
    return
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncViewportMetrics)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
    return
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncViewportMetrics)
  }
})
</script>

