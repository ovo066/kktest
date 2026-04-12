<template>
  <div class="absolute inset-0 z-20 bg-[var(--bg-color)] flex flex-col">
    <!-- Header -->
    <div class="glass-panel pt-app-lg pb-2 px-4 flex items-center justify-between z-10 shrink-0">
      <div class="w-16">
        <button v-if="!editMode" class="text-[var(--primary-color)] text-[17px] flex items-center gap-0.5" @click="router.back()">
          <i class="ph ph-caret-left text-[20px]"></i>
          <span>返回</span>
        </button>
        <button v-else class="text-[var(--primary-color)] text-[15px]" @click="toggleSelectAll">
          {{ isAllSelected ? '取消全选' : '全选' }}
        </button>
      </div>
      <span class="text-[17px] font-semibold text-[var(--text-primary)]">收藏</span>
      <div class="w-16 text-right">
        <button
          v-if="favorites.length > 0"
          class="text-[var(--primary-color)] text-[15px]"
          @click="toggleEditMode"
        >{{ editMode ? '完成' : '编辑' }}</button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto p-4 no-scrollbar" :class="{ 'pb-24': editMode }">
      <!-- Empty state -->
      <div v-if="favorites.length === 0" class="flex flex-col items-center justify-center h-full">
        <div class="empty-icon w-20 h-20 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center mb-4">
          <i class="ph ph-star text-[36px] text-[var(--text-secondary)] opacity-30"></i>
        </div>
        <p class="text-[15px] text-[var(--text-secondary)] opacity-60">还没有收藏的消息</p>
      </div>

      <!-- Favorite items -->
      <TransitionGroup name="fav-list" tag="div">
        <div v-for="item in favorites" :key="item.key" class="mb-3">
          <button
            class="fav-card w-full rounded-[14px] border p-3 text-left flex items-center gap-3 transition-all"
            :class="editMode && selectedKeys.has(item.key)
              ? 'fav-card-selected border-[var(--primary-color)]/40 bg-[var(--primary-color)]/5'
              : 'border-[var(--border-color)]/50 bg-[var(--card-bg)]'"
            @click="handleItemClick(item)"
          >
            <!-- Checkbox (edit mode) -->
            <Transition name="check-slide">
              <div v-if="editMode" class="shrink-0">
                <div
                  class="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all duration-200"
                  :class="selectedKeys.has(item.key)
                    ? 'bg-[var(--primary-color)] border-[var(--primary-color)]'
                    : 'border-[var(--border-color)]'"
                >
                  <i v-if="selectedKeys.has(item.key)" class="ph-bold ph-check text-white text-[11px]"></i>
                </div>
              </div>
            </Transition>

            <!-- Avatar -->
            <div class="w-10 h-10 rounded-full bg-[var(--avatar-bg)] flex items-center justify-center text-lg overflow-hidden shrink-0">
              <img v-if="item.contactAvatarType === 'image'" :src="item.contactAvatar" class="w-full h-full object-cover">
              <span v-else>{{ item.contactAvatar || '🤖' }}</span>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[14px] font-medium text-[var(--text-primary)] truncate">{{ item.contactName }}</span>
                <span
                  class="text-[11px] px-1.5 py-0.5 rounded-full shrink-0"
                  :class="roleBadgeClass(item)"
                >{{ roleBadgeText(item) }}</span>
                <span
                  v-if="item.kind === FAVORITE_KIND_COLLECTION"
                  class="text-[11px] px-1.5 py-0.5 rounded-full shrink-0 bg-amber-400/10 text-amber-600 dark:text-amber-300"
                >{{ item.itemCount }}条</span>
                <span class="text-[11px] text-[var(--text-secondary)] opacity-50 ml-auto shrink-0">{{ item.timeText }}</span>
              </div>
              <p class="text-[13px] text-[var(--text-secondary)] line-clamp-2 break-all">{{ item.snippet }}</p>
            </div>
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- Bottom toolbar (edit mode) -->
    <Transition name="toolbar-slide">
      <div v-if="editMode" class="absolute bottom-0 inset-x-0 glass-panel border-t border-[var(--border-color)] px-4 py-3 pb-app flex justify-center z-10">
        <button
          class="px-6 py-2.5 rounded-full text-[15px] font-medium transition-all"
          :class="selectedKeys.size > 0
            ? 'bg-red-500 text-white active:opacity-80 shadow-sm'
            : 'bg-[var(--border-color)] text-[var(--text-secondary)] opacity-60'"
          :disabled="selectedKeys.size === 0"
          @click="unfavoriteSelected"
        >
          取消收藏{{ selectedKeys.size > 0 ? ` (${selectedKeys.size})` : '' }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import {
  FAVORITE_KIND_COLLECTION,
  collectFavorites,
  removeFavoriteCollection
} from '../../../utils/favorites'
import { setMessagePartFavorited, favoritePartKeyToIndex } from '../../../utils/messageFavorites'
import { useStorage } from '../../../composables/useStorage'
import { useToast } from '../../../composables/useToast'

const router = useRouter()
const contactsStore = useContactsStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

const editMode = ref(false)
const selectedKeys = reactive(new Set())

const favorites = computed(() => collectFavorites(contactsStore.contacts))

const isAllSelected = computed(() =>
  favorites.value.length > 0 && selectedKeys.size === favorites.value.length
)

function toggleEditMode() {
  editMode.value = !editMode.value
  if (!editMode.value) selectedKeys.clear()
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedKeys.clear()
  } else {
    for (const item of favorites.value) {
      selectedKeys.add(item.key)
    }
  }
}

function handleItemClick(item) {
  if (editMode.value) {
    if (selectedKeys.has(item.key)) {
      selectedKeys.delete(item.key)
    } else {
      selectedKeys.add(item.key)
    }
  } else {
    router.push({
      name: 'favorite-detail',
      params: {
        contactId: item.contactId,
        msgId: item.anchorMsgId || item.msgId || item.favoriteId
      },
      query: item.kind === FAVORITE_KIND_COLLECTION
        ? {
            kind: FAVORITE_KIND_COLLECTION,
            favoriteId: item.favoriteId
          }
        : {
            part: item.favoritePartKey
          }
    })
  }
}

function roleBadgeText(item) {
  if (item.role === 'user') return '我'
  if (item.role === 'mixed') return '多条'
  return 'AI'
}

function roleBadgeClass(item) {
  if (item.role === 'user') return 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]'
  if (item.role === 'mixed') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-[var(--border-color)] text-[var(--text-secondary)]'
}

function unfavoriteSelected() {
  if (selectedKeys.size === 0) return

  let count = 0
  for (const key of selectedKeys) {
    const fav = favorites.value.find(f => f.key === key)
    if (!fav) continue

    const contact = contactsStore.contacts.find(c => String(c?.id ?? '') === String(fav.contactId))
    if (!contact) continue

    if (fav.kind === FAVORITE_KIND_COLLECTION) {
      if (removeFavoriteCollection(contact, fav.favoriteId)) {
        count++
      }
      continue
    }

    if (!contact?.msgs) continue

    const msg = contact.msgs.find(m => m.id === fav.msgId)
    if (!msg) continue

    const partIndex = favoritePartKeyToIndex(fav.favoritePartKey)
    setMessagePartFavorited(msg, partIndex, false)
    count++
  }

  if (count > 0) {
    scheduleSave()
    showToast?.(`已取消 ${count} 条收藏`)
  }

  selectedKeys.clear()
  editMode.value = false
}
</script>

<style scoped>
/* Card styles */
.fav-card {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.fav-card:active {
  opacity: 0.7;
}
.fav-card-selected {
  box-shadow: 0 0 0 1px var(--primary-color), 0 2px 12px rgba(0, 122, 255, 0.08);
  animation: selectedBreathe 2.5s ease-in-out infinite alternate;
}

@keyframes selectedBreathe {
  from { box-shadow: 0 0 0 1px var(--primary-color), 0 2px 8px rgba(0, 122, 255, 0.06); }
  to { box-shadow: 0 0 0 1px var(--primary-color), 0 2px 16px rgba(0, 122, 255, 0.14); }
}

/* Empty state */
.empty-icon {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

/* Checkbox slide animation */
.check-slide-enter-active,
.check-slide-leave-active {
  transition: all 0.2s ease;
}
.check-slide-enter-from,
.check-slide-leave-to {
  opacity: 0;
  transform: scale(0.5);
  width: 0;
  margin-right: -12px;
}

/* List item transitions */
.fav-list-enter-active,
.fav-list-leave-active {
  transition: all 0.3s ease;
}
.fav-list-enter-from,
.fav-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.fav-list-move {
  transition: transform 0.3s ease;
}

/* Bottom toolbar slide */
.toolbar-slide-enter-active,
.toolbar-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.toolbar-slide-enter-from,
.toolbar-slide-leave-to {
  transform: translateY(100%);
}
</style>
