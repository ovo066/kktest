<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="visible" class="transfer-detail-overlay" @click.self="emit('close')">
        <div class="transfer-detail-panel">
          <div class="transfer-detail-header">
            <span class="transfer-detail-title">{{ isGift ? '礼物详情' : '转账详情' }}</span>
            <button class="transfer-detail-close" @click="emit('close')">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>

          <div class="transfer-detail-body">
            <!-- Transfer detail -->
            <template v-if="!isGift">
              <div class="transfer-detail-amount">
                <span class="currency">¥</span>{{ block.amount }}
              </div>
              <div v-if="block.note" class="transfer-detail-note">{{ block.note }}</div>
            </template>

            <!-- Gift detail -->
            <template v-else>
              <div v-if="block.imageUrl" class="transfer-detail-gift-image">
                <img :src="block.imageUrl" @error="giftImgError = true">
              </div>
              <div class="transfer-detail-gift-name">{{ block.item }}</div>
              <div v-if="block.description" class="transfer-detail-gift-desc">{{ block.description }}</div>
              <div v-if="block.price != null" class="transfer-detail-gift-price">¥{{ block.price }}</div>
              <div v-if="block.message" class="transfer-detail-note">{{ block.message }}</div>
            </template>

            <div class="transfer-detail-meta">
              <div class="transfer-detail-meta-row">
                <span class="meta-label">{{ block.isUser ? '发送给' : '来自' }}</span>
                <span class="meta-value">{{ sourceDisplayName }}</span>
              </div>
              <div class="transfer-detail-meta-row">
                <span class="meta-label">时间</span>
                <span class="meta-value">{{ formattedTime }}</span>
              </div>
              <div v-if="block.interactionStatus !== 'pending' && block.interactionRespondedAt" class="transfer-detail-meta-row">
                <span class="meta-label">回复时间</span>
                <span class="meta-value">{{ formattedRespondedTime }}</span>
              </div>
            </div>
          </div>

          <div class="transfer-detail-footer">
            <!-- AI-sent + pending: user can accept/reject -->
            <template v-if="block.interactionStatus === 'pending' && !block.isUser">
              <button class="detail-action-btn accept" @click="handleAccept">接收</button>
              <button class="detail-action-btn reject" @click="handleReject">拒绝</button>
            </template>

            <!-- User-sent + pending: waiting -->
            <template v-else-if="block.interactionStatus === 'pending' && block.isUser">
              <div class="detail-waiting">
                <span class="detail-waiting-dot"></span>
                等待对方接收
              </div>
            </template>

            <!-- Resolved -->
            <template v-else>
              <div class="detail-status" :class="block.interactionStatus">
                {{ block.interactionStatus === 'accepted' ? '已接收' : '已拒绝' }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  visible: Boolean,
  block: Object,
  contactName: { type: String, default: '' }
})

const emit = defineEmits(['close', 'accept', 'reject'])

const giftImgError = ref(false)

const isGift = computed(() => props.block?.type === 'gift')

function formatTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return '' }
}

const formattedTime = computed(() => {
  const msg = props.block
  if (!msg) return ''
  return formatTime(msg.time || msg.interactionRespondedAt || Date.now())
})

const formattedRespondedTime = computed(() => {
  return formatTime(props.block?.interactionRespondedAt)
})

const sourceDisplayName = computed(() => {
  const block = props.block
  if (!block) return ''
  if (block.isUser) return props.contactName || '对方'
  return block.detailSenderName || block.senderName || props.contactName || '对方'
})

function handleAccept() {
  emit('accept', props.block)
  emit('close')
}

function handleReject() {
  emit('reject', props.block)
  emit('close')
}
</script>

<style scoped>
.transfer-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.transfer-detail-panel {
  width: 100%;
  max-width: 420px;
  background: var(--card-bg, #fff);
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.transfer-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color, #e5e5ea);
}

.transfer-detail-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #000);
}

.transfer-detail-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--border-color, #e5e5ea);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, #8e8e93);
  font-size: 14px;
}

.transfer-detail-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.transfer-detail-amount {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary, #000);
  text-align: center;
  margin-bottom: 8px;
}

.transfer-detail-amount .currency {
  font-size: 20px;
  margin-right: 2px;
  font-weight: 500;
}

.transfer-detail-note {
  text-align: center;
  color: var(--text-secondary, #8e8e93);
  font-size: 14px;
  margin-bottom: 16px;
}

.transfer-detail-gift-image {
  text-align: center;
  margin-bottom: 12px;
}

.transfer-detail-gift-image img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border-radius: 12px;
}

.transfer-detail-gift-name {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #000);
  margin-bottom: 4px;
}

.transfer-detail-gift-desc {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary, #8e8e93);
  margin-bottom: 4px;
}

.transfer-detail-gift-price {
  text-align: center;
  font-size: 14px;
  color: var(--primary-color, #007aff);
  font-weight: 500;
  margin-bottom: 8px;
}

.transfer-detail-meta {
  margin-top: 20px;
  border-top: 1px solid var(--border-color, #e5e5ea);
  padding-top: 16px;
}

.transfer-detail-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.meta-label {
  font-size: 14px;
  color: var(--text-secondary, #8e8e93);
}

.meta-value {
  font-size: 14px;
  color: var(--text-primary, #000);
}

.transfer-detail-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #e5e5ea);
  display: flex;
  gap: 12px;
  justify-content: center;
}

.detail-action-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.detail-action-btn.accept {
  background: var(--primary-color, #007aff);
  color: #fff;
}

.detail-action-btn.reject {
  background: var(--border-color, #e5e5ea);
  color: var(--text-primary, #000);
}

.detail-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary, #8e8e93);
  font-size: 15px;
}

.detail-waiting-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-color, #007aff);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.detail-status {
  font-size: 15px;
  font-weight: 500;
  padding: 8px 24px;
  border-radius: 8px;
}

.detail-status.accepted {
  color: #34c759;
  background: rgba(52, 199, 89, 0.1);
}

.detail-status.rejected {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.1);
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}

.sheet-enter-active .transfer-detail-panel,
.sheet-leave-active .transfer-detail-panel {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .transfer-detail-panel,
.sheet-leave-to .transfer-detail-panel {
  transform: translateY(100%);
}
</style>
