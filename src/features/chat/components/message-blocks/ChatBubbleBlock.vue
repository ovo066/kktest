<template>
  <div
    :class="['chat-message-row', block.isUser ? 'chat-message-user' : 'chat-message-ai', wrapClass(block)]"
    :data-msg-id="block.msgId"
    :data-msg-part="block.msgPartKey || 'message'"
    @click="handleRootClick"
  >
    <ChatMultiSelectCheckbox :visible="multiSelectMode" :selected="isSelected" />

    <div
      class="avatar-slot avatar-left shrink-0 mr-2 self-end"
      :class="{
        'avatar-visible': !block.isUser && block.showAvatar,
        'avatar-placeholder': !block.isUser && !block.showAvatar && (block.isGroupChat || showChatAvatars)
      }"
    >
      <div class="chat-avatar chat-avatar-ai w-8 h-8 rounded-full chat-avatar-bg flex items-center justify-center text-sm overflow-hidden">
        <img v-if="block.senderAvatarType === 'image'" :src="block.senderAvatar" class="w-full h-full object-cover">
        <span v-else>{{ block.isUser ? (block.senderAvatar || '😊') : (block.senderAvatar || '🤖') }}</span>
      </div>
    </div>

    <div class="chat-bubble-wrapper flex flex-col max-w-[75%]" :class="block.isUser ? 'items-end' : 'items-start'">
      <div v-if="block.senderName" class="chat-sender-name text-[12px] mb-1 ml-3">{{ block.senderName }}</div>
      <div class="flex items-center gap-1" :class="block.isUser ? 'flex-row-reverse' : ''">
        <div v-if="block.fromOffline" class="w-0.5 h-full rounded-full bg-[var(--primary-color)] opacity-30 shrink-0"></div>
        <div
          class="bubble"
          :class="[block.bubbleClass, block.animClass]"
          @contextmenu.prevent="emit('context-menu', $event, block)"
        >
          <div v-if="block.replyText" class="reply-context">{{ block.replyText }}</div>
          <template v-if="block.imageUrl">
            <img :src="block.imageUrl" class="bubble-image max-w-[220px] rounded-[12px]">
            <div v-if="block.text && block.text !== '[图片]'" class="bubble-caption mt-2 text-[15px]">{{ block.text }}</div>
          </template>
          <span v-else class="bubble-text" v-html="renderText(block.text)"></span>
        </div>
      </div>
      <div v-if="block.fromOffline" class="text-[10px] text-[var(--text-secondary)] opacity-40 mt-0.5" :class="block.isUser ? 'mr-2' : 'ml-2'">线下</div>
      <div v-if="block.metaText" class="msg-meta" :class="block.isUser ? 'user-meta' : 'ai-meta'">
        {{ block.metaText }}
      </div>
    </div>

    <div
      class="avatar-slot avatar-right shrink-0 ml-2 self-end"
      :class="{
        'avatar-visible': block.isUser && block.showAvatar,
        'avatar-placeholder': block.isUser && !block.showAvatar && showChatAvatars
      }"
    >
      <div class="chat-avatar chat-avatar-user w-8 h-8 rounded-full chat-avatar-bg flex items-center justify-center text-sm overflow-hidden">
        <img v-if="block.senderAvatarType === 'image'" :src="block.senderAvatar" class="w-full h-full object-cover">
        <span v-else>{{ block.isUser ? (block.senderAvatar || '😊') : (block.senderAvatar || '🤖') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ChatMultiSelectCheckbox from './ChatMultiSelectCheckbox.vue'

const props = defineProps({
  block: { type: Object, required: true },
  multiSelectMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  showChatAvatars: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-select', 'context-menu'])

const isSelected = computed(() => props.multiSelectMode && props.selected)

function handleRootClick() {
  if (!props.multiSelectMode) return
  emit('toggle-select', props.block.key)
}

function wrapClass(block) {
  const align = block.isUser ? 'justify-end' : 'justify-start'
  return `flex w-full ${block.mb} ${align} items-end select-none`
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderText(text) {
  if (!text || typeof text !== 'string') return ''
  return escapeHtml(text)
}
</script>

<style scoped>
.avatar-slot {
  display: none;
  width: 32px;
}

.avatar-slot.avatar-visible {
  display: flex;
}

.avatar-slot.avatar-placeholder {
  display: block;
}

.avatar-slot.avatar-placeholder .chat-avatar {
  visibility: hidden;
}

.chat-message-user {
  flex-direction: row;
}

.chat-message-ai {
  flex-direction: row;
}

.chat-message-user .avatar-left {
  display: none;
}

.chat-message-ai .avatar-right {
  display: none;
}
</style>
