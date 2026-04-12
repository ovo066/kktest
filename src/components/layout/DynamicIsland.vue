<template>
  <div
    class="di-container"
    :class="{ 'di-expanded': isExpanded, 'di-collapsing': isCollapsing }"
    @click="onTap"
  >
    <div class="di-glow"></div>
    <Transition name="di-content">
      <div v-if="isExpanded && notification" class="di-content">
        <div class="di-avatar">
          <img v-if="notification.avatar && notification.avatarType === 'image'" :src="notification.avatar" class="w-full h-full object-cover rounded-full">
          <span v-else class="text-base">{{ notification.avatar || '📝' }}</span>
        </div>
        <div class="di-text">
          <div class="di-name">{{ notification.name || '动态' }}</div>
          <div class="di-preview">{{ notification.preview }}</div>
        </div>
        <div class="di-badge">
          <i class="ph ph-shooting-star"></i>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useDynamicIsland } from '../../composables/useDynamicIsland'
import { useContactsStore } from '../../stores/contacts'

const router = useRouter()
const store = useContactsStore()
const { isExpanded, isCollapsing, notification, handleTap } = useDynamicIsland()

function onTap() {
  if (!isExpanded.value) return
  const notif = handleTap()
  if (!notif) return
  if (notif.type === 'chat' && notif.contactId) {
    const target = store.contacts?.find(c => c.id === notif.contactId)
    if (target) {
      store.activeChat = target
      target.unreadCount = 0
    }
    router.push('/chat/' + notif.contactId)
  } else if (notif.momentId) {
    router.push('/moments/' + notif.momentId)
  }
}
</script>

<style scoped>
.di-container {
  position: absolute;
  left: 50%;
  top: 11px;
  transform: translateX(-50%);
  z-index: 60;
  width: 112px;
  height: 32px;
  background: rgba(10, 10, 10, 0.78);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  pointer-events: none;
  transition:
    width 0.55s cubic-bezier(0.32, 0.72, 0, 1.1),
    height 0.55s cubic-bezier(0.32, 0.72, 0, 1.1),
    border-radius 0.55s cubic-bezier(0.32, 0.72, 0, 1.1),
    top 0.4s cubic-bezier(0.32, 0.72, 0, 1),
    background 0.4s ease,
    border-color 0.6s ease,
    box-shadow 0.6s ease;
}

/* Glow layer behind content */
.di-glow {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  opacity: 0;
  background: radial-gradient(
    ellipse at 50% 0%,
    var(--primary-color, #007AFF) 0%,
    transparent 70%
  );
  filter: blur(12px);
  transition: opacity 0.6s ease;
  pointer-events: none;
}

/* Expanded state */
.di-expanded {
  width: calc(100% - 28px);
  height: 70px;
  border-radius: 26px;
  top: 8px;
  pointer-events: auto;
  cursor: pointer;
  background: rgba(12, 12, 12, 0.85);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.35),
    0 0 0 0.5px rgba(255, 255, 255, 0.1) inset;
  animation: di-breathe 3s ease-in-out 0.6s infinite;
}

.di-expanded .di-glow {
  opacity: 0.15;
  animation: di-glow-pulse 3s ease-in-out 0.6s infinite;
}

/* Collapsing micro-bounce */
.di-collapsing {
  animation: di-shrink-bounce 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
}

/* Breathing shadow animation */
@keyframes di-breathe {
  0%, 100% {
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.35),
      0 0 0 0.5px rgba(255, 255, 255, 0.1) inset;
  }
  50% {
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.4),
      0 0 20px -4px var(--primary-color, #007AFF),
      0 0 0 0.5px rgba(255, 255, 255, 0.18) inset;
  }
}

@keyframes di-glow-pulse {
  0%, 100% { opacity: 0.12; }
  50% { opacity: 0.25; }
}

@keyframes di-shrink-bounce {
  0% {
    transform: translateX(-50%) scale(1.02);
  }
  40% {
    transform: translateX(-50%) scale(0.96);
  }
  100% {
    transform: translateX(-50%) scale(1);
  }
}

/* Content layout */
.di-content {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 15px;
  width: 100%;
  height: 100%;
  color: white;
}

.di-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
  border: 0.5px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.di-avatar img {
  border-radius: 12px;
}

.di-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.di-name {
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
}

.di-preview {
  font-size: 12px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.di-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-color, #007AFF);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Content enter/leave transitions */
.di-content-enter-active {
  transition:
    opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1) 0.12s,
    transform 0.5s cubic-bezier(0.23, 1, 0.32, 1) 0.12s,
    filter 0.4s ease 0.12s;
}
.di-content-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    filter 0.2s ease;
}
.di-content-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(6px);
  filter: blur(4px);
}
.di-content-leave-to {
  opacity: 0;
  transform: scale(0.96);
  filter: blur(2px);
}
</style>
