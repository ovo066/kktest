<template>
  <div class="vn-player" @click="handleTap">
    <VNBackground :bg="player.currentBg" />
    <VNSpriteLayer :sprites="player.sprites" />

    <!-- ===== Top Bar ===== -->
    <div class="vn-topbar">
      <button class="vn-glass-circle" @click.stop="goHome" aria-label="返回">
        <i class="ph ph-caret-left"></i>
      </button>

      <div class="vn-scene-pill">
        <span class="vn-scene-label">{{ sceneLabel }}</span>
        <span v-if="player.isGenerating || player.isGeneratingImage" class="vn-gen-dot"></span>
      </div>

      <VNControls
        :is-auto="player.isAutoPlay"
        :is-generating="player.isGenerating || player.isGeneratingImage"
        @toggle-auto="toggleAutoPlay"
        @show-history="showHistory = true"
        @menu="toggleMenu"
      />
    </div>

    <!-- ===== Narration (serif typewriter) ===== -->
    <VNNarration
      v-if="player.currentDialog?.isNarration"
      :text="player.currentDialog.text"
      :text-speed="player.textSpeed"
      :is-playing="player.isPlaying"
      @complete="onNarrationComplete"
    />

    <!-- ===== Dialog (glassmorphism) ===== -->
    <VNDialogBox
      v-else-if="player.currentDialog"
      :name="player.currentDialog.vnName"
      :name-color="player.currentDialog.nameColor"
      :text="player.currentDialog.text"
      :text-speed="player.textSpeed"
      :is-playing="player.isPlaying"
      @complete="onDialogComplete"
    />

    <!-- ===== Choices ===== -->
    <VNChoices
      v-if="player.currentChoices"
      :options="player.currentChoices"
      @select="onChoiceSelect"
    />

    <!-- ===== Input Bar ===== -->
    <Transition name="vn-input">
      <div v-if="showInputBar" class="vn-input-area">
        <div class="vn-input-glass">
          <input
            v-model="userInput"
            type="text"
            class="vn-input-field"
            placeholder="输入推动剧情…（留空=继续）"
            @click.stop
            @keydown.enter="sendUserInput"
          >
          <button
            class="vn-input-send"
            :disabled="player.isGenerating"
            @click.stop="sendUserInput"
          >
            <i class="ph ph-paper-plane-tilt"></i>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== Panels ===== -->
    <Transition name="vn-panel">
      <VNHistory v-if="showHistory" @close="showHistory = false" />
    </Transition>
    <Transition name="vn-panel">
      <VNSaveLoad v-if="showSave" @close="showSave = false" />
    </Transition>
    <Transition name="vn-panel">
      <VNSettingsPanel v-if="showSettings" @close="showSettings = false" />
    </Transition>

    <!-- ===== Menu Bottom Sheet ===== -->
    <Transition name="vn-menu">
      <div v-if="showMenu" class="vn-menu-backdrop" @click.stop="showMenu = false">
        <div class="vn-menu-sheet" @click.stop>
          <div class="vn-menu-handle"></div>
          <button class="vn-menu-item" @click.stop="showSave = true; showMenu = false">
            <i class="ph ph-floppy-disk"></i>
            <span>存档 / 读档</span>
          </button>
          <button class="vn-menu-item" @click.stop="showSettings = true; showMenu = false">
            <i class="ph ph-sliders-horizontal"></i>
            <span>设置</span>
          </button>
          <button class="vn-menu-item" @click.stop="goResources">
            <i class="ph ph-images"></i>
            <span>资源管理</span>
          </button>
          <div class="vn-menu-divider"></div>
          <button class="vn-menu-item" @click.stop="restartStory">
            <i class="ph ph-arrow-counter-clockwise"></i>
            <span>重新开始</span>
          </button>
          <button class="vn-menu-item danger" @click.stop="goHome">
            <i class="ph ph-sign-out"></i>
            <span>退出</span>
          </button>
          <button class="vn-menu-cancel" @click.stop="showMenu = false">
            取消
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== Start Overlay ===== -->
    <Transition name="vn-start">
      <div v-if="showStartOverlay" class="vn-start-overlay" @click.stop>
        <div class="vn-start-card">
          <div class="vn-start-glow"></div>
          <div class="vn-start-deco">&#10022;</div>
          <div class="vn-start-title">{{ projectTitle }}</div>
          <div class="vn-start-desc">
            需要先在「项目设置」里填写世界观与角色。点击开始，AI 将生成剧情。
          </div>
          <div class="vn-start-actions">
            <button class="vn-start-btn secondary" @click.stop="goSetup">
              <i class="ph ph-gear-six"></i> 设置
            </button>
            <button
              class="vn-start-btn primary"
              :disabled="player.isGenerating"
              @click.stop="start"
            >
              <i class="ph ph-play"></i> 开始
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'
import { useVNApi } from '../composables/useVNApi'
import { useImageGen } from '../../../composables/useImageGen'
import { useTTS } from '../../../composables/useTTS'
import { useBGM } from '../../../composables/useBGM'

import VNBackground from '../components/VNBackground.vue'
import VNSpriteLayer from '../components/VNSpriteLayer.vue'
import VNDialogBox from '../components/VNDialogBox.vue'
import VNNarration from '../components/VNNarration.vue'
import VNChoices from '../components/VNChoices.vue'
import VNControls from '../components/VNControls.vue'
import VNHistory from '../components/VNHistory.vue'
import VNSaveLoad from '../components/VNSaveLoad.vue'
import VNSettingsPanel from '../components/VNSettingsPanel.vue'

import '../vn-animations.css'

const router = useRouter()
const route = useRoute()
const vnStore = useVNStore()
const { scheduleSave } = useStorage()
const { startStory, sendChoice, sendInput } = useVNApi()
const { generateBackground, generateSprite } = useImageGen()
const { speak, stopSpeaking } = useTTS()
const bgm = useBGM()

const showHistory = ref(false)
const showSave = ref(false)
const showSettings = ref(false)
const showMenu = ref(false)

const userInput = ref('')

const projectId = computed(() => String(route.params.projectId || ''))
const project = computed(() => {
  const list = vnStore.projects || []
  return Array.isArray(list) ? (list.find(p => p.id === projectId.value) || null) : null
})

const player = vnStore.player

const projectTitle = computed(() => project.value?.name || 'VN')

const sceneLabel = computed(() => {
  const name = player.currentBg?.name
  if (!name) return projectTitle.value
  return name.replace(/_/g, ' \u00B7 ')
})

const showStartOverlay = computed(() => {
  if (!project.value) return false
  const hasAny = (project.value.history?.length || 0) > 0
  const hasRuntime = !!player.currentDialog || !!player.currentBg || (player.sprites?.length || 0) > 0
  return !hasAny && !hasRuntime && !player.isGenerating
})

const showInputBar = computed(() => {
  if (!project.value) return false
  if (showHistory.value || showSave.value || showSettings.value || showMenu.value) return false
  if (player.currentChoices) return false
  if (player.isPlaying) return false
  if (player._resolveWait) return false
  return (player.instructionQueue?.length || 0) === 0
})

onMounted(() => {
  if (!project.value) {
    router.replace('/vn')
    return
  }
  vnStore.setCurrentProject(projectId.value)
  vnStore.resetPlayer()
  document.addEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if (showHistory.value || showSave.value || showSettings.value || showMenu.value) {
    if (e.key === 'Escape') {
      showHistory.value = false
      showSave.value = false
      showSettings.value = false
      showMenu.value = false
    }
    return
  }

  switch (e.key) {
    case ' ':
    case 'Enter':
      e.preventDefault()
      handleTap()
      break
    case 'a': case 'A': toggleAutoPlay(); break
    case 'h': case 'H': showHistory.value = true; break
    case 's': case 'S': showSave.value = true; break
    case 'Escape': showMenu.value = true; break
  }
}

watch(projectId, () => {
  if (!project.value) return
  vnStore.setCurrentProject(projectId.value)
})

onBeforeUnmount(() => {
  stopSpeaking()
  bgm.stop()
  document.removeEventListener('keydown', handleKeydown)
})

function goHome() { stopSpeaking(); bgm.stop(); router.push('/vn') }
function goSetup() { router.push(`/vn/setup/${projectId.value}`) }
function goResources() { showMenu.value = false; router.push(`/vn/resources/${projectId.value}`) }
function toggleMenu() { showMenu.value = !showMenu.value }
function toggleAutoPlay() { player.isAutoPlay = !player.isAutoPlay }

function onDialogComplete() { player.isPlaying = false }
function onNarrationComplete() { player.isPlaying = false }

function handleTap() {
  if (showHistory.value || showSave.value || showSettings.value || showMenu.value) return
  if (player.currentChoices) return

  if (player.isPlaying) {
    player.isPlaying = false
    return
  }

  if (player._resolveWait) {
    const resolve = player._resolveWait
    player._resolveWait = null
    player.isWaitingInput = false
    resolve()
  }
}

function waitForUserInput() {
  return new Promise(resolve => {
    player.isWaitingInput = true
    player._resolveWait = () => resolve()
  })
}

async function start() {
  const res = await startStory()
  if (!res.success) return
  await playInstructions(res.instructions || [])
  scheduleSave()
}

async function restartStory() {
  showMenu.value = false
  stopSpeaking()
  bgm.stop()
  vnStore.resetPlayer()
  const res = await startStory()
  if (!res.success) return
  await playInstructions(res.instructions || [])
  scheduleSave()
}

async function sendUserInput() {
  if (player.isGenerating) return
  const text = userInput.value.trim()
  userInput.value = ''
  const res = await sendInput(text || '继续')
  if (!res.success) return
  await playInstructions(res.instructions || [])
  scheduleSave()
}

async function onChoiceSelect(opt) {
  if (!opt) return
  player.currentChoices = null
  const res = await sendChoice(opt.text)
  if (!res.success) return
  await playInstructions(res.instructions || [])
  scheduleSave()
}

async function playInstructions(instructions) {
  player.instructionQueue = instructions
  player.instructionIndex = 0

  for (let i = 0; i < instructions.length; i++) {
    player.instructionIndex = i
    const inst = instructions[i]

    switch (inst.type) {
      case 'bg':
        await handleBgInstruction(inst)
        break
      case 'sprite':
        await handleSpriteInstruction(inst)
        break
      case 'variable':
        handleVariableInstruction(inst)
        break
      case 'bgm':
        handleBgmInstruction(inst)
        break
      case 'dialog':
        await handleDialogInstruction(inst)
        await waitForUserInput()
        break
      case 'narration':
        await handleNarrationInstruction(inst)
        await waitForUserInput()
        break
      case 'choices':
        player.currentChoices = inst.options || []
        vnStore.addToHistory(inst)
        scheduleSave()
        return
      default:
        break
    }

    vnStore.addToHistory(inst)
    scheduleSave()

    if (player.isAutoPlay && (inst.type === 'dialog' || inst.type === 'narration')) {
      await sleep(player.autoPlayDelay || 2000)
      if (player._resolveWait) {
        const resolve = player._resolveWait
        player._resolveWait = null
        player.isWaitingInput = false
        resolve()
      }
    }
  }

  player.instructionQueue = []
  player.instructionIndex = 0
}

async function handleBgInstruction(inst) {
  let bg = vnStore.getResource('backgrounds', inst.name)
  if (!bg && inst.isNew && inst.prompt) {
    player.isGeneratingImage = true
    try {
      const url = await generateBackground(inst.name, inst.prompt)
      bg = { url }
    } catch {
      bg = { url: null }
    } finally {
      player.isGeneratingImage = false
    }
  }

  if (bg?.url) {
    player.currentBg = { name: inst.name, url: bg.url }
  } else {
    player.currentBg = { name: inst.name, url: null }
  }
}

async function handleSpriteInstruction(inst) {
  if (inst.position === 'none') {
    const idx = player.sprites.findIndex(s => s.characterId === inst.characterId)
    if (idx !== -1) {
      player.sprites[idx].animation = inst.animation || 'fadeOut'
      player.sprites[idx].isExiting = true
      await sleep(340)
      player.sprites.splice(idx, 1)
    }
    return
  }

  const resourceKey = `${inst.characterId}_${inst.expression}`
  let sprite = vnStore.getResource('sprites', resourceKey)

  if (!sprite && inst.isNew && inst.prompt) {
    const char = vnStore.currentProject?.characters?.find(c => c.contactId === inst.characterId)
    if (char) {
      player.isGeneratingImage = true
      try {
        const url = await generateSprite(char, inst.expression)
        sprite = { url }
      } catch {
        sprite = { url: null }
      } finally {
        player.isGeneratingImage = false
      }
    }
  }

  const spriteUrl = sprite?.url || null
  const existing = player.sprites.findIndex(s => s.characterId === inst.characterId)
  const spriteData = {
    characterId: inst.characterId,
    vnName: inst.vnName,
    expression: inst.expression,
    position: inst.position,
    animation: inst.animation || (existing === -1 ? 'fadeIn' : null),
    url: spriteUrl,
    isExiting: false
  }

  if (existing !== -1) player.sprites[existing] = spriteData
  else player.sprites.push(spriteData)
}

function handleVariableInstruction(inst) {
  if (!inst?.key) return
  const key = String(inst.key)
  if (inst.operation === 'add') {
    const current = Number(vnStore.getVariable(key, 0) || 0)
    vnStore.setVariable(key, current + Number(inst.value || 0))
  } else {
    vnStore.setVariable(key, inst.value)
  }
}

function handleBgmInstruction(inst) {
  if (inst.name === null || inst.name === 'stop') {
    bgm.stop()
  } else {
    bgm.play(inst.name)
  }
}

async function handleDialogInstruction(inst) {
  const char = vnStore.currentProject?.characters?.find(c => c.contactId === inst.characterId)

  player.isPlaying = true
  player.currentDialog = {
    characterId: inst.characterId,
    vnName: inst.vnName,
    text: inst.text,
    nameColor: char?.nameColor || '#e8a0bf',
    isNarration: false
  }

  speak(inst.text, inst.characterId).catch(() => {})
}

async function handleNarrationInstruction(inst) {
  player.isPlaying = true
  player.currentDialog = {
    characterId: '',
    vnName: '',
    text: inst.text,
    nameColor: '#ffffff',
    isNarration: true
  }

  speak(inst.text, { isNarration: true }).catch(() => {})
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms || 0)))
}
</script>

<style scoped>
.vn-player {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #000;
  overflow: hidden;
}

/* ===== Top Bar ===== */
.vn-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: var(--app-pt, 12px) 14px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.vn-topbar > * {
  pointer-events: auto;
}

/* Glass circle button (back button) */
.vn-glass-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.88);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.22s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.vn-glass-circle:active {
  transform: scale(0.88);
  background: rgba(99, 102, 241, 0.45);
  border-color: rgba(99, 102, 241, 0.35);
}

/* Scene pill */
.vn-scene-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 18px;
  border-radius: 22px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  max-width: 52%;
}

.vn-scene-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.vn-gen-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.9);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
  animation: vnGenPulse 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes vnGenPulse {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px rgba(99, 102, 241, 0.6); }
  50% { opacity: 0.45; transform: scale(0.75); box-shadow: 0 0 4px rgba(99, 102, 241, 0.3); }
}

/* ===== Input Bar ===== */
.vn-input-area {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 42;
  padding: 0 14px calc(var(--app-pb, 8px) + 12px);
  pointer-events: none;
}

.vn-input-glass {
  pointer-events: auto;
  max-width: 540px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 5px 5px 18px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(24px) saturate(170%);
  -webkit-backdrop-filter: blur(24px) saturate(170%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.vn-input-field {
  flex: 1;
  background: transparent;
  outline: none;
  color: rgba(20, 20, 40, 0.85);
  font-size: 14px;
  min-width: 0;
  border: none;
}

.vn-input-field::placeholder {
  color: rgba(20, 20, 40, 0.3);
}

.vn-input-send {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(129, 140, 248, 0.9));
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  border: none;
  transition: all 0.18s ease;
  box-shadow: 0 3px 12px rgba(99, 102, 241, 0.35);
}

.vn-input-send:active {
  transform: scale(0.9);
}

.vn-input-send:disabled {
  opacity: 0.35;
  box-shadow: none;
}

/* Input transition */
.vn-input-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.vn-input-leave-active { transition: all 0.2s ease-in; }
.vn-input-enter-from,
.vn-input-leave-to { opacity: 0; transform: translateY(20px); }

/* ===== Panel transition ===== */
.vn-panel-enter-active { transition: opacity 0.3s ease; }
.vn-panel-leave-active { transition: opacity 0.2s ease; }
.vn-panel-enter-from,
.vn-panel-leave-to { opacity: 0; }

/* ===== Menu Bottom Sheet ===== */
.vn-menu-backdrop {
  position: absolute;
  inset: 0;
  z-index: 70;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 20px 16px;
}

.vn-menu-sheet {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(36px) saturate(190%);
  -webkit-backdrop-filter: blur(36px) saturate(190%);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 24px;
  box-shadow:
    0 -4px 30px rgba(0, 0, 0, 0.1),
    0 16px 56px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  padding: 6px 8px 8px;
}

.vn-menu-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.12);
  margin: 6px auto 10px;
}

.vn-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(20, 20, 40, 0.82);
  cursor: pointer;
  border: none;
  background: transparent;
  transition: background 0.15s ease;
}

.vn-menu-item:hover {
  background: rgba(99, 102, 241, 0.06);
}

.vn-menu-item:active {
  background: rgba(99, 102, 241, 0.12);
}

.vn-menu-item i {
  font-size: 20px;
  color: rgba(99, 102, 241, 0.7);
}

.vn-menu-item.danger {
  color: #ef4444;
}

.vn-menu-item.danger i {
  color: #ef4444;
}

.vn-menu-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 4px 18px;
}

.vn-menu-cancel {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: rgba(20, 20, 40, 0.45);
  cursor: pointer;
  border: none;
  background: transparent;
  transition: background 0.15s ease;
}

.vn-menu-cancel:active {
  background: rgba(0, 0, 0, 0.05);
}

/* Menu transition */
.vn-menu-enter-active { transition: opacity 0.28s ease; }
.vn-menu-leave-active { transition: opacity 0.2s ease; }
.vn-menu-enter-from,
.vn-menu-leave-to { opacity: 0; }

.vn-menu-enter-active .vn-menu-sheet {
  transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
}
.vn-menu-leave-active .vn-menu-sheet {
  transition: transform 0.22s ease-in;
}
.vn-menu-enter-from .vn-menu-sheet {
  transform: translateY(100%);
}
.vn-menu-leave-to .vn-menu-sheet {
  transform: translateY(30%);
}

/* ===== Start Overlay ===== */
.vn-start-overlay {
  position: absolute;
  inset: 0;
  z-index: 65;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.vn-start-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(36px) saturate(190%);
  -webkit-backdrop-filter: blur(36px) saturate(190%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 28px;
  box-shadow:
    0 16px 56px rgba(0, 0, 0, 0.12),
    0 2px 12px rgba(99, 102, 241, 0.08);
  padding: 40px 30px 30px;
  text-align: center;
  overflow: hidden;
}

.vn-start-glow {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 120px;
  background: radial-gradient(ellipse, rgba(99, 102, 241, 0.15), transparent 70%);
  pointer-events: none;
}

.vn-start-deco {
  position: relative;
  color: rgba(99, 102, 241, 0.25);
  font-size: 16px;
  letter-spacing: 0.5em;
  margin-bottom: 18px;
}

.vn-start-title {
  position: relative;
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 26px;
  font-weight: 700;
  color: rgba(20, 20, 40, 0.9);
  letter-spacing: 0.06em;
  background: linear-gradient(135deg, rgba(20, 20, 40, 0.9), rgba(99, 102, 241, 0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.vn-start-desc {
  position: relative;
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.75;
  color: rgba(20, 20, 40, 0.48);
}

.vn-start-actions {
  position: relative;
  margin-top: 28px;
  display: flex;
  gap: 12px;
}

.vn-start-btn {
  flex: 1;
  height: 48px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: none;
  transition: all 0.2s ease;
}

.vn-start-btn:active {
  transform: scale(0.96);
}

.vn-start-btn:disabled {
  opacity: 0.35;
}

.vn-start-btn.secondary {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(20, 20, 40, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.07);
}

.vn-start-btn.secondary:active {
  background: rgba(0, 0, 0, 0.08);
}

.vn-start-btn.primary {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(129, 140, 248, 0.95));
  color: #fff;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
}

.vn-start-btn.primary:active {
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.25);
}

/* Start overlay transition */
.vn-start-enter-active { transition: opacity 0.45s ease; }
.vn-start-leave-active { transition: opacity 0.3s ease; }
.vn-start-enter-from,
.vn-start-leave-to { opacity: 0; }

.vn-start-enter-active .vn-start-card {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
}
.vn-start-enter-from .vn-start-card {
  opacity: 0;
  transform: scale(0.92) translateY(20px);
}
</style>
