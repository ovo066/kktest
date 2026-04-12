<template>
  <ChatMessageShell
    :block="block"
    :multi-select-mode="multiSelectMode"
    :selected="isSelected"
    :show-chat-avatars="showChatAvatars"
    :root-class="wrapClass(block)"
    @click="handleRootClick"
  >
    <template #default="{ isUser }">
      <div
        v-if="block.type === 'transfer'"
        class="transfer-card"
        :class="[isUser ? 'transfer-card-user' : 'transfer-card-ai', block.animClass]"
        @click.stop="handleTransferDetailClick"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div class="transfer-card-accent"></div>
        <div class="transfer-card-label">TRANSFER</div>
        <div class="transfer-card-amount"><span class="currency">¥</span>{{ block.amount }}</div>
        <div v-if="block.note" class="transfer-card-note">{{ block.note }}</div>
        <div class="transfer-card-divider"></div>
        <div class="transfer-card-footer">
          <span>转账</span>
          <template v-if="isUser">
            <span v-if="block.interactionStatus === 'pending'" class="interaction-status pending">等待接收</span>
            <span v-else-if="block.interactionStatus === 'accepted'" class="interaction-status accepted">对方已接收</span>
            <span v-else-if="block.interactionStatus === 'rejected'" class="interaction-status rejected">对方已拒绝</span>
            <span v-else>已发送</span>
          </template>
          <template v-else>
            <span v-if="block.interactionStatus === 'pending'" class="interaction-btns">
              <button class="interaction-btn accept" @click.stop="emit('accept-transfer', block)">接收</button>
              <button class="interaction-btn reject" @click.stop="emit('reject-transfer', block)">拒绝</button>
            </span>
            <span v-else-if="block.interactionStatus === 'accepted'" class="interaction-status accepted">已接收</span>
            <span v-else-if="block.interactionStatus === 'rejected'" class="interaction-status rejected">已拒绝</span>
            <span v-else>已收到</span>
          </template>
        </div>
      </div>

      <div
        v-else-if="block.type === 'gift'"
        class="gift-card"
        :class="[isUser ? 'gift-card-user' : 'gift-card-ai', block.animClass]"
        @click.stop="handleTransferDetailClick"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div class="gift-card-image">
          <img v-if="block.imageUrl && !giftImgFailed" :src="block.imageUrl" class="gift-card-img" @error="handleGiftImgError">
          <div v-else class="gift-card-placeholder">{{ block.item }}</div>
        </div>
        <div class="gift-card-body">
          <div class="gift-card-title">{{ block.item }}</div>
          <div v-if="block.description" class="gift-card-desc">{{ block.description }}</div>
          <div class="gift-card-footer">
            <span v-if="block.price != null" class="gift-card-price">¥{{ block.price }}</span>
            <span v-if="block.message" class="gift-card-message">{{ block.message }}</span>
          </div>
          <div class="gift-card-status">
            <template v-if="isUser">
              <span v-if="block.interactionStatus === 'pending'" class="interaction-status pending">等待接收</span>
              <span v-else-if="block.interactionStatus === 'accepted'" class="interaction-status accepted">对方已接收</span>
              <span v-else-if="block.interactionStatus === 'rejected'" class="interaction-status rejected">对方已拒绝</span>
            </template>
            <template v-else>
              <span v-if="block.interactionStatus === 'pending'" class="interaction-btns">
                <button class="interaction-btn accept" @click.stop="emit('accept-gift', block)">接收</button>
                <button class="interaction-btn reject" @click.stop="emit('reject-gift', block)">拒绝</button>
              </span>
              <span v-else-if="block.interactionStatus === 'accepted'" class="interaction-status accepted">已接收</span>
              <span v-else-if="block.interactionStatus === 'rejected'" class="interaction-status rejected">已拒绝</span>
            </template>
          </div>
        </div>
      </div>

      <div
        v-else-if="block.type === 'meet'"
        class="meet-card"
        :class="[isUser ? 'meet-card-user' : 'meet-card-ai', block.animClass]"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div class="meet-card-header">
          <i class="ph-fill ph-map-pin meet-card-icon"></i>
          <span class="meet-card-title">线下见面邀请</span>
        </div>
        <div class="meet-card-location">{{ block.location }}</div>
        <div v-if="block.time" class="meet-card-time">{{ block.time }}</div>
        <div v-if="block.note" class="meet-card-note">{{ block.note }}</div>
        <div class="meet-card-divider"></div>
        <div class="meet-card-footer">
          <template v-if="isUser">
            <span v-if="block.interactionStatus === 'pending'" class="interaction-status pending">等待回复</span>
            <span v-else-if="block.interactionStatus === 'accepted'" class="interaction-status accepted">对方已同意</span>
            <span v-else-if="block.interactionStatus === 'rejected'" class="interaction-status rejected">对方已拒绝</span>
            <span v-else>已发送</span>
          </template>
          <template v-else>
            <span v-if="block.interactionStatus === 'pending'" class="interaction-btns">
              <button class="interaction-btn accept" @click.stop="emit('accept-meet', block)">同意</button>
              <button class="interaction-btn reject" @click.stop="emit('reject-meet', block)">拒绝</button>
            </span>
            <span v-else-if="block.interactionStatus === 'accepted'" class="interaction-status accepted">已同意</span>
            <span v-else-if="block.interactionStatus === 'rejected'" class="interaction-status rejected">已拒绝</span>
            <span v-else>已收到</span>
          </template>
        </div>
      </div>

      <div
        v-else-if="block.type === 'voice'"
        class="voice-bubble"
        :class="[isUser ? 'voice-bubble-user' : 'voice-bubble-ai', block.animClass, { 'voice-expanded': voiceExpanded }]"
        @click.stop="toggleVoice"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div class="voice-bubble-main">
          <button class="voice-play-btn" @click.stop="handleVoicePlay">
            <i v-if="voiceLoading" class="ph ph-circle-notch animate-spin"></i>
            <i v-else class="ph-fill" :class="voicePlaying ? 'ph-pause' : 'ph-play'"></i>
          </button>
          <div class="voice-waveform" :class="{ 'voice-waveform-playing': voicePlaying }">
            <div
              v-for="(height, index) in waveformBars"
              :key="index"
              class="voice-waveform-bar"
              :style="{ height: `${height}px`, animationDelay: `${index * 0.05}s` }"
            ></div>
          </div>
          <span class="voice-duration">{{ block.duration }}″</span>
        </div>
        <div v-if="voiceExpanded" class="voice-text-expand">{{ block.text }}</div>
      </div>

      <div
        v-else-if="block.type === 'call'"
        class="call-bubble"
        :class="[isUser ? 'call-bubble-user' : 'call-bubble-ai', block.animClass]"
        role="button"
        tabindex="0"
        @click.stop="handleCallHistoryClick"
        @keydown.enter.prevent="handleCallHistoryClick"
        @keydown.space.prevent="handleCallHistoryClick"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div class="call-bubble-main">
          <div class="call-bubble-icon">
            <i :class="block.callMode === 'video' ? 'ph-fill ph-video-camera' : 'ph-fill ph-phone'"></i>
          </div>
          <div class="call-bubble-body">
            <div class="call-bubble-title">{{ isUser ? (block.callMode === 'video' ? '视频通话' : '语音通话') : (block.callMode === 'video' ? '视频通话邀请' : '语音通话邀请') }}</div>
            <div class="call-bubble-desc">{{ block.callText || (isUser ? '发起了通话邀请' : '邀请你进行通话') }}</div>
          </div>
          <span class="call-bubble-badge">{{ isUser ? (block.callMode === 'video' ? 'VIDEO' : 'VOICE') : 'INVITE' }}</span>
        </div>
      </div>

      <div
        v-else-if="block.type === 'callRecord'"
        class="call-record-card"
        :class="[isUser ? 'call-record-card-user' : 'call-record-card-ai', block.animClass]"
        role="button"
        tabindex="0"
        @click.stop="handleCallHistoryClick"
        @keydown.enter.prevent="handleCallHistoryClick"
        @keydown.space.prevent="handleCallHistoryClick"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      >
        <div class="call-record-main">
          <div class="call-record-icon" :class="block.callMode === 'video' ? 'is-video' : 'is-voice'">
            <i :class="block.callMode === 'video' ? 'ph-fill ph-video-camera' : 'ph-fill ph-phone'"></i>
          </div>
          <div class="call-record-text">
            <div class="call-record-title">{{ block.callMode === 'video' ? '视频通话' : '语音通话' }}</div>
            <div class="call-record-sub">{{ block.callDuration > 0 ? `通话时长 ${formatDuration(block.callDuration)}` : '未接通' }}</div>
          </div>
        </div>
      </div>

      <MusicCard
        v-else
        :title="block.title"
        :artist="block.artist"
        :cover="block.cover"
        :url="block.url"
        :is-user="isUser"
        :class="block.animClass"
        @contextmenu.prevent="emit('context-menu', $event, block)"
      />
    </template>
  </ChatMessageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToast } from '../../../../composables/useToast'
import { useVoicePlayback } from '../../../../composables/useVoicePlayback'
import MusicCard from '../../../../components/cards/MusicCard.vue'
import ChatMessageShell from './ChatMessageShell.vue'

const props = defineProps({
  block: { type: Object, required: true },
  multiSelectMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  showChatAvatars: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-select',
  'context-menu',
  'open-call-history',
  'accept-transfer',
  'reject-transfer',
  'accept-gift',
  'reject-gift',
  'accept-meet',
  'reject-meet',
  'open-transfer-detail'
])

const isSelected = computed(() => props.multiSelectMode && props.selected)
const giftImgFailed = ref(false)
const voiceExpanded = ref(false)
const voicePlaying = ref(false)
const voiceLoading = ref(false)
const waveformBars = computed(() => Array.isArray(props.block?.waveform) ? props.block.waveform : [])

const { showToast } = useToast()
const voicePlayer = useVoicePlayback()

watch(() => [props.block?.key, props.block?.imageUrl], () => {
  giftImgFailed.value = false
})

watch(() => [props.block?.key, props.block?.type], () => {
  resetVoiceState({ stopPlayback: true })
})

function handleGiftImgError() {
  giftImgFailed.value = true
}

function handleRootClick() {
  if (props.block?.type === 'call' || props.block?.type === 'callRecord') {
    handleCallHistoryClick()
    return
  }

  if (!props.multiSelectMode) return
  emit('toggle-select', props.block.key)
}

function handleCallHistoryClick() {
  if (props.multiSelectMode) {
    emit('toggle-select', props.block.key)
    return
  }
  emit('open-call-history', props.block)
}

function handleTransferDetailClick() {
  if (props.multiSelectMode) {
    emit('toggle-select', props.block.key)
    return
  }
  emit('open-transfer-detail', props.block)
}

function toggleVoice() {
  voiceExpanded.value = !voiceExpanded.value
}

async function handleVoicePlay() {
  if (voiceLoading.value) return

  if (voicePlaying.value) {
    resetVoiceState({ stopPlayback: true })
    return
  }

  voiceLoading.value = true
  voicePlaying.value = false
  voiceExpanded.value = true

  try {
    await voicePlayer.play({
      msgId: props.block?.msgId || null,
      isUser: !!props.block?.isUser,
      contactId: props.block?.isUser ? '' : (props.block?.contactId || ''),
      text: props.block?.text || '',
      emotion: props.block?.emotion || '',
      durationSec: props.block?.duration || 1,
      onEnded: () => {
        resetVoiceState()
      }
    })
    voicePlaying.value = true
  } catch (error) {
    showToast(error?.message || '语音播放失败')
    resetVoiceState()
  } finally {
    voiceLoading.value = false
  }
}

function resetVoiceState({ stopPlayback = false } = {}) {
  if (stopPlayback) {
    voicePlayer.stop()
  }
  voiceExpanded.value = false
  voicePlaying.value = false
  voiceLoading.value = false
}

function formatDuration(seconds) {
  if (!seconds) return '00:00'
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`
}

function wrapClass(block) {
  const align = block.isUser ? 'justify-end' : 'justify-start'
  return `flex w-full ${block.mb} ${align} items-end select-none`
}

onBeforeUnmount(() => {
  resetVoiceState({ stopPlayback: true })
})
</script>
