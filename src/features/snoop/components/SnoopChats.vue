<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 3" :key="i" class="snoop-chat-skeleton">
        <div class="snoop-skeleton-icon"></div>
        <div class="snoop-skeleton-lines">
          <div class="snoop-skeleton-line" style="width: 40%"></div>
          <div class="snoop-skeleton-line snoop-skeleton-line--short" style="width: 60%"></div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="error" class="snoop-empty">
      <i class="ph ph-warning-circle text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">{{ error }}</div>
      <button class="snoop-retry-btn" @click="$emit('retry')">重试</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!items?.length" class="snoop-empty">
      <i class="ph ph-chat-dots text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无聊天记录</div>
    </div>

    <!-- Chat list -->
    <template v-else-if="!selectedChat">
      <div
        v-for="(chat, idx) in items"
        :key="idx"
        class="snoop-chat-item"
        @click="selectedChat = chat"
      >
        <div class="snoop-chat-avatar">
          <i class="ph-fill ph-user text-[18px]"></i>
        </div>
        <div class="snoop-chat-info">
          <div class="snoop-chat-name">{{ chat.friend }}</div>
          <div class="snoop-chat-preview">
            {{ lastMsg(chat) }}
          </div>
        </div>
        <div class="snoop-chat-time">
          {{ chat.msgs?.[chat.msgs.length - 1]?.time || '' }}
        </div>
      </div>
    </template>

    <!-- Chat detail -->
    <template v-else>
      <div class="snoop-chatdetail-header" @click="selectedChat = null">
        <i class="ph ph-caret-left text-[18px]"></i>
        <span>{{ selectedChat.friend }}</span>
        <span v-if="selectedChat.relationship" class="snoop-chatdetail-rel">{{ selectedChat.relationship }}</span>
      </div>
      <div class="snoop-chatdetail-msgs">
        <div
          v-for="(msg, idx) in selectedChat.msgs"
          :key="idx"
          class="snoop-msg"
          :class="msg.from === 'self' ? 'snoop-msg--self' : 'snoop-msg--friend'"
        >
          <div class="snoop-msg-bubble">{{ msg.content }}</div>
          <div class="snoop-msg-time">{{ msg.time || '' }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  contact: Object,
  items: Array,
  loading: Boolean,
  error: String
})
defineEmits(['retry'])

const selectedChat = ref(null)

function lastMsg(chat) {
  const msgs = chat.msgs
  if (!msgs?.length) return ''
  const last = msgs[msgs.length - 1]
  const prefix = last.from === 'self' ? '我: ' : ''
  const text = last.content || ''
  return prefix + (text.length > 20 ? text.slice(0, 20) + '...' : text)
}
</script>

<style scoped>
.snoop-tab-content {
  padding: 8px 0;
}

/* Chat list */
.snoop-chat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.1s;
}

.snoop-chat-item:active {
  background: rgba(0, 0, 0, 0.04);
}

.dark .snoop-chat-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-chat-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #8e8e93;
}

.dark .snoop-chat-avatar {
  background: rgba(255, 255, 255, 0.08);
}

.snoop-chat-info {
  flex: 1;
  min-width: 0;
}

.snoop-chat-name {
  font-size: 15px;
  font-weight: 500;
}

.snoop-chat-preview {
  font-size: 13px;
  color: #8e8e93;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.snoop-chat-time {
  font-size: 11px;
  color: #8e8e93;
  flex-shrink: 0;
}

/* Chat detail */
.snoop-chatdetail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dark .snoop-chatdetail-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.snoop-chatdetail-header:active { opacity: 0.6; }

.snoop-chatdetail-rel {
  font-size: 12px;
  font-weight: 400;
  color: #8e8e93;
}

.snoop-chatdetail-msgs {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.snoop-msg {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.snoop-msg--self {
  align-self: flex-end;
  align-items: flex-end;
}

.snoop-msg--friend {
  align-self: flex-start;
  align-items: flex-start;
}

.snoop-msg-bubble {
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.snoop-msg--self .snoop-msg-bubble {
  background: var(--primary-color, #007aff);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.snoop-msg--friend .snoop-msg-bubble {
  background: rgba(0, 0, 0, 0.06);
  border-bottom-left-radius: 4px;
}

.dark .snoop-msg--friend .snoop-msg-bubble {
  background: rgba(255, 255, 255, 0.1);
}

.snoop-msg-time {
  font-size: 10px;
  color: #8e8e93;
  margin-top: 2px;
  padding: 0 4px;
}

/* Skeleton */
.snoop-chat-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.snoop-skeleton-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.dark .snoop-skeleton-icon {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.snoop-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.snoop-skeleton-line--short { height: 10px; }

.dark .snoop-skeleton-line {
  background: rgba(255, 255, 255, 0.06);
}

@keyframes snoop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Shared */
.snoop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.snoop-retry-btn {
  margin-top: 12px;
  padding: 6px 20px;
  border-radius: 8px;
  font-size: 13px;
  border: none;
  background: var(--primary-color, #007aff);
  color: #fff;
  cursor: pointer;
}

.snoop-retry-btn:active { opacity: 0.7; }
</style>
