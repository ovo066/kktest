<template>
  <div class="absolute inset-0 z-20 bg-[var(--bg-color)] flex flex-col">
    <!-- Glass header -->
    <div class="glass-panel z-10 flex items-center px-4 pt-app pb-3 shrink-0">
      <button class="text-[var(--primary-color)] text-[17px] flex items-center" @click="goBack">
        <i class="ph ph-caret-left text-[20px]"></i>
        <span>返回</span>
      </button>
      <span class="flex-1 text-center font-semibold text-[17px] text-[var(--text-primary)]">收藏详情</span>
      <div class="w-12"></div>
    </div>

    <div v-if="favorite" class="flex-1 overflow-y-auto no-scrollbar px-4 py-4 pb-24">
      <!-- Contact info card (glass) -->
      <div class="contact-card rounded-[16px] border border-[var(--border-color)] bg-[var(--card-bg)] p-4 mb-5 flex items-center gap-3 shadow-sm">
        <div class="w-12 h-12 rounded-full bg-[var(--avatar-bg)] overflow-hidden flex items-center justify-center text-xl shrink-0 ring-2 ring-white/15">
          <img v-if="favorite.contactAvatarType === 'image'" :src="favorite.contactAvatar" class="w-full h-full object-cover">
          <span v-else>{{ favorite.contactAvatar || '🤖' }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[16px] font-semibold text-[var(--text-primary)] truncate">{{ favorite.contactName }}</div>
          <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">{{ favorite.timeText }}</div>
        </div>
        <span
          class="text-[11px] px-2.5 py-1 rounded-full shrink-0 font-medium"
          :class="roleBadgeClass(favorite)"
        >
          {{ roleBadgeText(favorite) }}
        </span>
        <span
          v-if="favorite.kind === FAVORITE_KIND_COLLECTION"
          class="text-[11px] px-2.5 py-1 rounded-full shrink-0 font-medium bg-amber-400/10 text-amber-600 dark:text-amber-300"
        >
          {{ favorite.itemCount }}条
        </span>
      </div>

      <!-- Letter paper -->
      <div class="letter-paper">
        <!-- Corner ornaments -->
        <div class="letter-ornament letter-ornament-tl" aria-hidden="true">&#10086;</div>
        <div class="letter-ornament letter-ornament-br" aria-hidden="true">&#10086;</div>

        <!-- Content -->
        <div class="letter-body">
          <div v-if="detailBlocks.length > 0" class="favorite-rendered-message">
            <ChatMessageBlock
              v-for="block in detailBlocks"
              :key="block.key"
              :block="block"
              :multi-select-mode="false"
              :selected="false"
              :show-chat-avatars="false"
            />
          </div>
          <template v-else>
            <div v-if="favorite.imageUrl" class="letter-image-frame mb-5">
              <img :src="favorite.imageUrl" class="w-full max-h-[360px] object-cover rounded-sm">
            </div>
            <div class="letter-text">{{ favorite.detailContent }}</div>
          </template>
        </div>

        <!-- Divider -->
        <div class="letter-divider"></div>

        <!-- Snippet footer -->
        <div class="letter-footer">
          <div class="letter-footer-label">EXCERPT</div>
          <div class="letter-footer-text">{{ favorite.snippet }}</div>
        </div>
      </div>
    </div>

    <!-- Bottom action button -->
    <div v-if="favorite" class="absolute bottom-0 inset-x-0 px-4 pb-app pt-3 z-10">
      <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/80 to-transparent pointer-events-none"></div>
      <button
        class="relative w-full rounded-[18px] bg-[var(--primary-color)] text-white py-3 text-[15px] font-medium shadow-md active:opacity-80 transition-opacity"
        @click="openInChat"
      >
        {{ favorite.kind === FAVORITE_KIND_COLLECTION ? '在聊天中定位首条消息' : '在聊天中定位消息' }}
      </button>
    </div>

    <!-- Not found state -->
    <div v-else class="flex-1 flex flex-col items-center justify-center px-6 text-center text-[var(--text-secondary)]">
      <i class="ph ph-star text-5xl opacity-40 mb-3"></i>
      <div class="text-[16px] text-[var(--text-primary)] mb-1">收藏不存在</div>
      <div class="text-[13px] opacity-70">这条消息可能已经被取消收藏或删除。</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { useStickersStore } from '../../../stores/stickers'
import ChatMessageBlock from '../components/ChatMessageBlock.vue'
import { useMessageParser } from '../composables/useMessageParser'
import {
  FAVORITE_KIND_COLLECTION,
  resolveFavoriteDetailData
} from '../../../utils/favorites'

const route = useRoute()
const router = useRouter()
const contactsStore = useContactsStore()
const stickersStore = useStickersStore()

const favoriteDetail = computed(() => resolveFavoriteDetailData(contactsStore.contacts, {
  contactId: route.params.contactId,
  msgId: route.params.msgId,
  favoritePartKey: route.query.part,
  kind: route.query.kind,
  favoriteId: route.query.favoriteId
}))

const favorite = computed(() => favoriteDetail.value.favorite)
const favoriteRenderMessages = computed(() => favoriteDetail.value.previewMessages)

const { blocks: detailBlocks } = useMessageParser({
  getMessages: () => favoriteRenderMessages.value,
  getStickerUrl: (name) => stickersStore.getStickerUrl(name),
  showTimestamps: () => false,
  allowAIStickers: () => true,
  allowAITransfer: () => true,
  allowAIGift: () => true,
  allowAIVoice: () => true,
  allowAICall: () => true,
  allowAIMockImage: () => true,
  allowAIMusicRecommend: () => true,
  allowAIMeet: () => true,
  timestampGapMs: 0,
  getAnimateMsgId: () => null,
  isGroupChat: () => false,
  getGroupMembers: () => [],
  showChatAvatars: () => false,
  getContactAvatar: () => null,
  getUserAvatar: () => null,
  showNarrations: () => true,
  getMockImagePlaceholder: () => ''
})

function roleBadgeText(item) {
  if (item?.role === 'user') return '我'
  if (item?.role === 'mixed') return '多条'
  return 'AI'
}

function roleBadgeClass(item) {
  if (item?.role === 'user') return 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]'
  if (item?.role === 'mixed') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-[var(--border-color)] text-[var(--text-secondary)]'
}

function goBack() {
  router.back()
}

function openInChat() {
  if (!favorite.value) return

  const contact = contactsStore.contacts.find(item => String(item?.id ?? '') === String(favorite.value.contactId))
  if (contact) {
    contactsStore.activeChat = contact
  }

  router.push({
    name: 'chat',
    params: { contactId: favorite.value.contactId },
    query: {
      jumpToMsg: favorite.value.anchorMsgId || favorite.value.msgId,
      jumpToPart: favorite.value.anchorPartKey || favorite.value.favoritePartKey
    }
  })
}
</script>

<style scoped>
/* ========== Letter Paper ========== */
.letter-paper {
  position: relative;
  background-color: #fdfaf3;
  border-radius: 14px;
  padding: 32px 24px 24px;
  border: 1px solid rgba(200, 180, 160, 0.25);
  box-shadow: 0 4px 24px rgba(200, 160, 140, 0.12);
  animation: letterBreathe 4s ease-in-out infinite alternate;
  /* Notebook line pattern */
  background-image: linear-gradient(rgba(180, 160, 140, 0.06) 1px, transparent 1px);
  background-size: 100% 28px;
  background-position: 0 24px;
  overflow: hidden;
}

/* Corner ornaments */
.letter-ornament {
  position: absolute;
  font-size: 20px;
  color: rgba(200, 150, 150, 0.2);
  z-index: 0;
  pointer-events: none;
  user-select: none;
  line-height: 1;
}
.letter-ornament-tl {
  top: 10px;
  left: 12px;
  transform: rotate(-30deg);
}
.letter-ornament-br {
  bottom: 10px;
  right: 12px;
  transform: rotate(150deg);
}

.letter-body {
  position: relative;
  z-index: 1;
}

.favorite-rendered-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.favorite-rendered-message :deep(.chat-message-row) {
  padding-left: 0;
  padding-right: 0;
}

.favorite-rendered-message :deep(.chat-message-row .chat-bubble-wrapper),
.favorite-rendered-message :deep(.chat-message-row > .flex.flex-col.items-start),
.favorite-rendered-message :deep(.chat-message-row > .flex.flex-col.items-end) {
  max-width: 100%;
}

.favorite-rendered-message :deep(.bubble) {
  max-width: min(100%, 520px);
}

.favorite-rendered-message :deep(.chat-narration-row) {
  margin-bottom: 0.35rem;
}

/* Message text - serif font for letter feel */
.letter-text {
  font-family: 'Georgia', 'Noto Serif SC', 'Songti SC', 'Times New Roman', serif;
  font-size: 17px;
  line-height: 1.85;
  color: #4a3f35;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Image frame - vintage photo border */
.letter-image-frame {
  border: 6px solid rgba(240, 230, 215, 0.8);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* Divider line */
.letter-divider {
  margin: 20px 0 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(180, 160, 140, 0.3), transparent);
}

/* Footer */
.letter-footer {
  position: relative;
  z-index: 1;
  color: #7a6f62;
}
.letter-footer-label {
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  opacity: 0.4;
  margin-bottom: 4px;
}
.letter-footer-text {
  font-size: 13px;
  opacity: 0.6;
  line-height: 1.5;
}

/* Breathing glow animation */
@keyframes letterBreathe {
  from {
    box-shadow: 0 4px 20px rgba(200, 160, 140, 0.1);
  }
  to {
    box-shadow: 0 4px 30px rgba(200, 160, 140, 0.2), 0 0 60px rgba(230, 180, 180, 0.06);
  }
}

/* ========== Dark Mode ========== */
:global(.dark) .letter-paper {
  background-color: #1e2033;
  border-color: rgba(200, 170, 100, 0.15);
  background-image: linear-gradient(rgba(200, 180, 120, 0.04) 1px, transparent 1px);
  animation-name: letterBreatheDark;
}
:global(.dark) .letter-ornament {
  color: rgba(200, 170, 100, 0.15);
}
:global(.dark) .letter-text {
  color: #d8d0c4;
}
:global(.dark) .letter-image-frame {
  border-color: rgba(200, 180, 120, 0.15);
}
:global(.dark) .letter-divider {
  background: linear-gradient(90deg, transparent, rgba(200, 180, 120, 0.2), transparent);
}
:global(.dark) .letter-footer {
  color: #9a8f7e;
}

@keyframes letterBreatheDark {
  from {
    box-shadow: 0 4px 20px rgba(200, 170, 100, 0.06);
  }
  to {
    box-shadow: 0 4px 30px rgba(200, 170, 100, 0.12), 0 0 50px rgba(180, 160, 100, 0.04);
  }
}

/* ========== Contact Card ========== */
.contact-card {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
</style>
