<template>
  <div class="meet-player" @click="handleTap">
    <!-- Background Layer with Ken Burns -->
    <MeetBackground :bg="player.currentBg" />

    <Transition name="fade-cg">
      <div v-if="player.currentCg?.url" class="cg-layer">
        <img
          :src="player.currentCg.url"
          :alt="player.currentCg.name || 'CG'"
          class="cg-image"
          draggable="false"
        >
      </div>
    </Transition>

    <!-- Sprite Layer: Main focus, minimal obstruction -->
    <div class="sprite-layer" :class="{ 'is-hidden-under-cg': !!player.currentCg?.url }">
      <VNSprite
        v-for="sp in player.sprites"
        :key="sp.characterId"
        :character-id="sp.characterId"
        :vn-name="sp.vnName"
        :expression="sp.expression"
        :position="sp.position"
        :animation="sp.animation"
        :image-url="sp.url"
        :is-exiting="!!sp.isExiting"
        class="vn-character-sprite meet-sprite-card"
      />
    </div>

    <!-- Mood Gauge: Floating change notifications -->
    <MeetMoodGauge
      ref="moodGaugeRef"
      :mood-values="player.moodValues"
    />

    <!-- Narration Overlay -->
    <Transition name="fade-narrative">
      <MeetNarration
        v-if="player.currentDialog?.isNarration"
        :text="player.currentDialog.text"
        :text-speed="player.textSpeed"
        :is-playing="player.isPlaying"
        @complete="onTextComplete"
      />
    </Transition>

    <!-- Dialog Box Layer -->
    <Transition name="slide-dialog">
      <MeetDialogBox
        v-if="!player.currentDialog?.isNarration && player.currentDialog"
        :name="player.currentDialog.vnName"
        :name-color="player.currentDialog.nameColor"
        :text="player.currentDialog.text"
        :text-speed="player.textSpeed"
        :is-playing="player.isPlaying"
        @complete="onTextComplete"
      />
    </Transition>

    <!-- Choices / Interaction -->
    <Transition name="fade-choices">
      <MeetChoices
        v-if="player.currentChoices"
        :options="player.currentChoices"
        @select="onChoiceSelect"
        @custom="onCustomInput"
      />
    </Transition>

    <!-- Top Bar: Minimal controls -->
    <MeetTopBar
      :location="player.currentLocation"
      :time-of-day="player.currentTimeOfDay"
      :is-generating="player.isGenerating || player.isGeneratingImage"
      @back="goHome"
      @menu="openMenu"
    />

    <Transition name="fade-audio-hint">
      <div
        v-if="needsAudioUnlock"
        class="audio-unlock-hint"
        @click.stop="tryResumeAudioPlayback"
      >
        <i class="ph ph-speaker-simple-high"></i>
        点击屏幕开启声音
      </div>
    </Transition>

    <!-- Secondary Panels -->
    <MeetHistory v-if="showHistory" @close="closeHistory" />
    <MeetSaveLoad v-if="showSave" @close="closeSave" />

    <MeetPlayerMenuSheet
      :visible="showMenu"
      :is-auto-play="player.isAutoPlay"
      :is-tts-enabled="meeting?.voice?.ttsEnabled === true"
      @close="closeMenu"
      @open-save="openSave"
      @open-history="openHistory"
      @toggle-auto-play="toggleAutoPlay"
      @toggle-tts="toggleMeetTts"
      @restart="restartMeeting"
      @show-mood-details="showMoodDetails"
      @leave="goHome"
    />

    <MeetPlayerStartOverlay
      :visible="showStartOverlay"
      :title="meetingTitle"
      :location="meeting?.location || ''"
      :description="startDescription"
      :has-history="hasHistory"
      :is-generating="player.isGenerating"
      :start-action-label="startActionLabel"
      @setup="goSetup"
      @start="start"
      @restart="restartMeeting"
    />

    <audio
      v-if="currentBgmUrl"
      ref="bgmAudio"
      :src="currentBgmUrl"
      loop
      autoplay
      :volume="player.volume.bgm"
    ></audio>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useMeetStore } from '../../../stores/meet'
import { useStorage } from '../../../composables/useStorage'
import { useMeetApi } from '../composables/useMeetApi'
import { useMeetTTS } from '../composables/useMeetTTS'
import { useMeetResources } from '../composables/useMeetResources'
import { useMeetPlayerMedia } from '../composables/meetPlayer/useMeetPlayerMedia'
import { useMeetPlayerRuntime } from '../composables/meetPlayer/useMeetPlayerRuntime'

import MeetBackground from '../components/MeetBackground.vue'
import MeetDialogBox from '../components/MeetDialogBox.vue'
import MeetNarration from '../components/MeetNarration.vue'
import MeetChoices from '../components/MeetChoices.vue'
import MeetTopBar from '../components/MeetTopBar.vue'
import MeetMoodGauge from '../components/MeetMoodGauge.vue'
import MeetHistory from '../components/MeetHistory.vue'
import MeetSaveLoad from '../components/MeetSaveLoad.vue'
import MeetPlayerMenuSheet from '../components/MeetPlayerMenuSheet.vue'
import MeetPlayerStartOverlay from '../components/MeetPlayerStartOverlay.vue'
import VNSprite from '../../../components/media/VNSprite.vue'
import { useMeetPlayerShell } from '../composables/meetPlayer/useMeetPlayerShell'

/* Import sprite animation keyframes */
import '../../vn/vn-animations.css'
import '../meet-theme.css'

const router = useRouter()
const route = useRoute()
const meetStore = useMeetStore()
const { scheduleSave } = useStorage()
const { startMeeting, sendChoice, sendInput } = useMeetApi()
const meetResources = useMeetResources()

const bgmAudio = ref(null)

const meetingId = computed(() => String(route.params.id || ''))
const meeting = computed(() =>
  meetStore.meetings.find((item) => item.id === meetingId.value) || null
)

const player = meetStore.player
const { speak, stopSpeaking } = useMeetTTS({ meeting, player })

const {
  currentBgmUrl,
  needsAudioUnlock,
  tryResumeAudioPlayback,
  resetMediaRuntime,
  clearTransientSceneMedia,
  applySnapshotMediaInstruction,
  handleBgInstruction,
  handleCgInstruction,
  handleSpriteInstruction,
  handleBgmInstruction,
  handleSfxInstruction,
  applyAutoSceneFixups
} = useMeetPlayerMedia({
  player,
  meetStore,
  scheduleSave,
  bgmAudio,
  ...meetResources
})

const {
  restoreMeetingRuntime,
  continueMeeting,
  restartMeeting: restartMeetingFlow,
  onCustomInput,
  onChoiceSelect,
  handleAdvanceTap,
  onTextComplete
} = useMeetPlayerRuntime({
  meeting,
  meetStore,
  player,
  scheduleSave,
  startMeeting,
  sendChoice,
  sendInput,
  speak,
  stopSpeaking,
  media: {
    resetMediaRuntime,
    clearTransientSceneMedia,
    applySnapshotMediaInstruction,
    handleBgInstruction,
    handleCgInstruction,
    handleSpriteInstruction,
    handleBgmInstruction,
    handleSfxInstruction,
    applyAutoSceneFixups
  }
})
const {
  closeHistory,
  closeMenu,
  closeSave,
  goHome,
  goSetup,
  handleKeydown,
  handleTap,
  hasHistory,
  initializePlayerView,
  meetingTitle,
  moodGaugeRef,
  openHistory,
  openMenu,
  openSave,
  restartMeeting,
  showHistory,
  showMenu,
  showMoodDetails,
  showSave,
  showStartOverlay,
  start,
  startActionLabel,
  startDescription,
  toggleAutoPlay
} = useMeetPlayerShell({
  continueMeeting,
  handleAdvanceTap,
  meeting,
  meetingId,
  meetStore,
  player,
  restartMeetingFlow,
  restoreMeetingRuntime,
  router,
  tryResumeAudioPlayback
})

onMounted(() => {
  if (!initializePlayerView()) {
    return
  }
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function toggleMeetTts() {
  if (!meeting.value) return
  if (!meeting.value.voice || typeof meeting.value.voice !== 'object') {
    meeting.value.voice = { ttsEnabled: false }
  }
  const nextEnabled = meeting.value.voice.ttsEnabled !== true
  meeting.value.voice.ttsEnabled = nextEnabled
  if (!nextEnabled) {
    stopSpeaking()
  }
  scheduleSave()
}

</script>

<style scoped>
.meet-player {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #1a1a1a;
  overflow: hidden;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.audio-unlock-hint {
  position: absolute;
  left: 50%;
  top: calc(var(--app-pt, 12px) + 64px);
  transform: translateX(-50%);
  z-index: 120;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
}

.fade-audio-hint-enter-active,
.fade-audio-hint-leave-active {
  transition: opacity 0.22s ease;
}

.fade-audio-hint-enter-from,
.fade-audio-hint-leave-to {
  opacity: 0;
}

.cg-layer {
  position: absolute;
  inset: 0;
  z-index: 11;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.08);
}

.cg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.02) contrast(1.02);
}

/* Sprite Layer */
.sprite-layer {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.28s ease;
}

.sprite-layer.is-hidden-under-cg {
  opacity: 0;
}

.vn-character-sprite {
  height: 85% !important;
  object-fit: contain;
  filter: drop-shadow(0 0 15px rgba(0,0,0,0.3));
}

.sprite-layer :deep(.meet-sprite-card) {
  bottom: clamp(7vh, 10vh, 13vh) !important;
  height: min(74vh, calc(100vh - 180px)) !important;
}

.sprite-layer :deep(.meet-sprite-card[style*="left: 4%"]) {
  left: 10% !important;
}

.sprite-layer :deep(.meet-sprite-card[style*="right: 4%"]) {
  right: 10% !important;
}

.fade-cg-enter-active,
.fade-cg-leave-active {
  transition: opacity 0.45s ease;
}

.fade-cg-enter-from,
.fade-cg-leave-to {
  opacity: 0;
}

/* Transitions */
.fade-narrative-enter-active, .fade-narrative-leave-active { transition: opacity 0.5s; }
.fade-narrative-enter-from, .fade-narrative-leave-to { opacity: 0; }

.slide-dialog-enter-active { transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-dialog-leave-active { transition: all 0.4s ease-in; }
.slide-dialog-enter-from { transform: translateY(100px); opacity: 0; }
.slide-dialog-leave-to { transform: translateY(40px); opacity: 0; }

.fade-choices-enter-active { transition: opacity 0.4s; }
.fade-choices-leave-active { transition: opacity 0.3s; }
.fade-choices-enter-from, .fade-choices-leave-to { opacity: 0; }

</style>
