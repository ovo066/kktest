<template>
  <Teleport to="body">
    <Transition name="call-overlay">
      <div
        v-if="callActive"
        class="fixed inset-0 z-[2000] bg-[#0a0a0a] flex flex-col overflow-hidden"
      >
        <!-- 响铃阶段 -->
        <CallRinging
          v-if="callPhase === 'ringing' || callPhase === 'incoming'"
          :contact="contact"
          :call-mode="callMode"
          :is-incoming="callPhase === 'incoming'"
          :invite-text="aiText"
          @cancel="handleEndCall"
          @accept="handleAcceptCall"
        />

        <!-- 连接中 -->
        <div
          v-else-if="callPhase === 'connecting'"
          class="absolute inset-0 flex items-center justify-center z-30"
        >
          <div class="absolute inset-0">
            <img
              v-if="contact?.avatarType === 'image'"
              :src="contact?.avatar"
              class="w-full h-full object-cover scale-110 opacity-30"
            >
            <div class="absolute inset-0 backdrop-blur-[60px] bg-[#0a0a0a]/70"></div>
          </div>
          <div class="flex flex-col items-center gap-4 relative z-10">
            <div class="w-16 h-16 rounded-full overflow-hidden ring-[1.5px] ring-white/12 shadow-2xl">
              <img v-if="contact?.avatarType === 'image'" :src="contact?.avatar" class="w-full h-full object-cover">
              <div v-else class="w-full h-full bg-gradient-to-br from-[#2a2a2a] to-[#111] flex items-center justify-center">
                <span class="text-3xl">{{ contact?.avatar || '🤖' }}</span>
              </div>
            </div>
            <div class="flex flex-col items-center gap-1.5">
              <div class="text-white/90 text-base font-semibold">{{ contact?.name }}</div>
              <div class="flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full bg-white/30 animate-ping"></div>
                <span class="text-white/40 text-xs font-medium">连接中</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 已连接 -->
        <template v-else-if="callPhase === 'connected' || callPhase === 'ended'">
          <CallConnected
            :contact="contact"
            :call-mode="callMode"
            :video-sub-mode="videoSubMode"
            :sprite-url="currentSpriteUrl"
            :bg-url="currentBgUrl"
            :character-image="currentCharacterImage"
            :emotion="aiEmotion"
            :ai-speaking="aiSpeaking"
            :duration="durationText"
            :user-avatar="userPersonaAvatar"
            :user-avatar-type="userPersonaAvatarType"
            :user-avatar-emoji="userPersonaEmoji"
          />

          <!-- 对话气泡区（覆盖在背景之上） -->
          <div v-if="callPhase === 'connected'" class="absolute inset-0 z-30 flex flex-col pointer-events-none">
            <!-- 顶部留白（给时长胶囊和 PiP 留空间） -->
            <div class="shrink-0" :style="{ height: transcriptTopSafeArea }"></div>

            <!-- 对话气泡滚动区 -->
            <CallTranscript
              class="pointer-events-auto"
              :messages="callMessages"
              :streaming-text="subtitleText"
            />

            <!-- 文本输入 -->
            <div class="shrink-0 pointer-events-auto relative z-40">
              <CallTextInput
                :visible="showTextInput"
                :disabled="isWaitingReply"
                :stt-listening="sttListening"
                :interim-text="interimText"
                @send="handleUserInput"
              />
            </div>

            <!-- 控制栏 -->
            <div class="shrink-0 pointer-events-auto relative z-50">
              <CallControls
                :muted="muted"
                :show-text-input="showTextInput"
                :is-video="callMode === 'video'"
                :video-sub-mode="videoSubMode"
                :show-recognize-button="isManualSTTTriggerMode"
                :recognize-disabled="!canTriggerManualRecognition"
                :recognize-label="manualRecognitionButtonLabel"
                @toggle-mute="toggleMute"
                @end-call="handleEndCall"
                @toggle-text-input="toggleTextInput"
                @open-resources="showResourcePanel = true"
                @toggle-video-mode="toggleVideoSubMode"
                @trigger-recognition="handleManualRecognition"
              />
              <div class="pb-app"></div>
            </div>
          </div>

          <!-- 结束提示 -->
          <div
            v-if="callPhase === 'ended'"
            class="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm call-fade-out"
          >
            <div class="text-center">
              <div class="text-white/90 text-lg font-semibold mb-1.5">通话结束</div>
              <div class="text-white/40 text-sm font-medium">{{ durationText }}</div>
            </div>
          </div>
        </template>

        <!-- 资源管理面板 -->
        <CallResourcePanel
          :visible="showResourcePanel"
          :contact-id="contact?.id || ''"
          @close="showResourcePanel = false"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useCallOverlayRuntime } from '../composables/useCallOverlayRuntime'

import CallRinging from './CallRinging.vue'
import CallConnected from './CallConnected.vue'
import CallControls from './CallControls.vue'
import CallTranscript from './CallTranscript.vue'
import CallTextInput from './CallTextInput.vue'
import CallResourcePanel from './CallResourcePanel.vue'

import '../call-animations.css'

const props = defineProps({
  contact: { type: Object, default: null }
})

const contact = computed(() => props.contact)

const {
  callActive,
  callPhase,
  callMode,
  videoSubMode,
  aiSpeaking,
  aiText,
  aiEmotion,
  callMessages,
  currentSpriteUrl,
  currentBgUrl,
  currentCharacterImage,
  sttListening,
  interimText,
  muted,
  showTextInput,
  showResourcePanel,
  isWaitingReply,
  subtitleText,
  durationText,
  transcriptTopSafeArea,
  isManualSTTTriggerMode,
  canTriggerManualRecognition,
  manualRecognitionButtonLabel,
  userPersonaAvatar,
  userPersonaAvatarType,
  userPersonaEmoji,
  toggleMute,
  handleEndCall,
  handleAcceptCall,
  toggleTextInput,
  toggleVideoSubMode,
  handleManualRecognition,
  handleUserInput,
  startCall,
  receiveCall
} = useCallOverlayRuntime({ contact })

defineExpose({ startCall, receiveCall })
</script>

