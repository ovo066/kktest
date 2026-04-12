<template>
  <div class="chat-input-wrapper">
    <!-- 顶部工具栏（可通过 CSS 控制显示） -->
    <div
      v-if="menuUiMounted"
      v-show="showMenu"
      class="chat-input-toolbar flex items-start justify-start gap-1 px-2 py-2 bg-[var(--bg-color)] dark:bg-[var(--card-bg)] border-t border-[var(--border-color)] overflow-x-auto no-scrollbar"
    >
      <button
        class="chat-input-toolbar-item chat-input-toolbar-reader flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openReader')"
      >
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center mb-1">
          <i class="ph-fill ph-book-open text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">一起读</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-memory flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openMemory')"
      >
        <div class="w-10 h-10 rounded-full bg-[#34C759] flex items-center justify-center mb-1">
          <i class="ph-fill ph-brain text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">记忆</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-camera flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openCamera')"
      >
        <div class="w-10 h-10 rounded-full bg-[#8E8E93] flex items-center justify-center mb-1">
          <i class="ph-fill ph-camera text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">相机</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-photo flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openPhoto')"
      >
        <div class="w-10 h-10 rounded-full bg-[var(--primary-color)] flex items-center justify-center mb-1">
          <i class="ph-fill ph-image text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">照片</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-transfer flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openTransfer')"
      >
        <div class="w-10 h-10 rounded-full bg-[#FF9500] flex items-center justify-center mb-1">
          <i class="ph-fill ph-currency-circle-dollar text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">转账</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-gift flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openGift')"
      >
        <div class="w-10 h-10 rounded-full bg-[#FF2D55] flex items-center justify-center mb-1">
          <i class="ph-fill ph-gift text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">礼物</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-voice flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openVoice')"
      >
        <div class="w-10 h-10 rounded-full bg-[#5AC8FA] flex items-center justify-center mb-1">
          <i class="ph-fill ph-microphone text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">语音</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-sticker flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openSticker')"
      >
        <div class="w-10 h-10 rounded-full bg-[#AF52DE] flex items-center justify-center mb-1">
          <i class="ph-fill ph-sticker text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">贴纸</span>
      </button>
      <button
        class="chat-input-toolbar-item chat-input-toolbar-music flex flex-col items-center justify-center w-14 h-14 shrink-0 rounded-lg active:bg-black/5 dark:active:bg-white/10"
        @click="emitMenuAction('openMusic')"
      >
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#FC5C7D] to-[#6A82FB] flex items-center justify-center mb-1">
          <i class="ph-fill ph-music-notes text-white text-lg"></i>
        </div>
        <span class="text-[10px] text-[var(--text-secondary)]">音乐</span>
      </button>
    </div>

    <!-- 主输入区 -->
    <div class="chat-input glass-input-area px-2 py-2 flex items-end gap-1 min-h-[50px] pb-app relative z-20">
      <!-- 左侧按钮组 -->
      <div class="chat-input-left flex items-center shrink-0">
        <!-- 左侧加号按钮 -->
        <button
          v-if="showPlusLeft"
          ref="plusButton"
          type="button"
          class="chat-input-plus chat-input-plus-left h-[36px] w-[36px] flex items-center justify-center text-[var(--text-secondary)] active:scale-90 transition-transform cursor-pointer"
          @click="handlePlusClick"
        >
          <i class="ph-fill ph-plus-circle text-[28px]"></i>
        </button>

        <!-- 相机按钮 -->
        <button
          v-if="showCameraButton"
          class="chat-input-camera h-[32px] w-[32px] flex items-center justify-center text-[var(--text-secondary)] active:scale-90 transition-transform cursor-pointer"
          @click="$emit('openPhoto')"
        >
          <i class="ph ph-camera text-[24px]"></i>
        </button>

        <!-- 图片按钮 -->
        <button
          v-if="showImageButton"
          class="chat-input-image h-[32px] w-[32px] flex items-center justify-center text-[var(--text-secondary)] active:scale-90 transition-transform cursor-pointer"
          @click="$emit('openPhoto')"
        >
          <i class="ph ph-image text-[24px]"></i>
        </button>
      </div>

      <!-- 左侧弹出菜单 -->
      <Teleport to="body">
        <Transition name="plus-menu-pop">
          <div
            v-if="menuUiMounted && showPlusLeft"
            v-show="showMenu"
            ref="plusMenu"
            class="chat-input-menu chat-input-menu-left fixed left-[10px] overflow-y-auto no-scrollbar bg-white/85 dark:bg-[#1e1e1e]/85 backdrop-blur-lg rounded-[24px] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.22)] border border-white/40 dark:border-white/10 z-[999] flex flex-col origin-bottom-left"
            :style="{ bottom: `${menuBottomPx}px`, maxHeight: `${menuMaxHeightPx}px` }"
          >
            <button
              v-for="item in primaryPlusMenuItems"
              :key="item.key"
              class="chat-input-menu-item group flex items-center gap-3 p-2 rounded-[18px] active:bg-black/5 dark:active:bg-white/10 transition-colors w-full"
              @click="emitMenuAction(item.event)"
            >
              <div
                class="chat-input-menu-icon w-[40px] h-[40px] rounded-full flex items-center justify-center shadow-sm ring-1 ring-black/5 overflow-hidden relative"
                :class="item.iconBgClass"
              >
                <i :class="[item.iconClass, item.iconColorClass]"></i>
              </div>
              <span class="chat-input-menu-label text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">{{ item.label }}</span>
            </button>

            <Transition name="plus-menu-more">
              <div
                v-if="showMoreMenu"
                class="chat-input-menu-submenu mt-1 mb-0.5 border-t border-black/5 pt-1 dark:border-white/10"
              >
                <button
                  v-for="item in visibleSecondaryPlusMenuItems"
                  :key="item.key"
                  class="chat-input-menu-item group flex items-center gap-3 p-2 rounded-[18px] active:bg-black/5 dark:active:bg-white/10 transition-colors w-full"
                  @click="emitMenuAction(item.event)"
                >
                  <div
                    class="chat-input-menu-icon w-[40px] h-[40px] rounded-full flex items-center justify-center shadow-sm ring-1 ring-black/5 overflow-hidden relative"
                    :class="item.iconBgClass"
                  >
                    <i :class="[item.iconClass, item.iconColorClass]"></i>
                  </div>
                  <span class="chat-input-menu-label text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">{{ item.label }}</span>
                </button>
              </div>
            </Transition>

            <button
              class="chat-input-menu-item chat-input-menu-more group mt-0.5 flex items-center gap-3 p-2 rounded-[18px] active:bg-black/5 dark:active:bg-white/10 transition-colors w-full"
              @click="toggleMoreMenu"
            >
              <div class="chat-input-menu-icon w-[40px] h-[40px] rounded-full bg-[#5AB2FF] flex items-center justify-center text-white shadow-sm ring-1 ring-black/5">
                <i class="ph-bold ph-caret-down text-[20px] transition-transform duration-200" :class="{ 'rotate-180': showMoreMenu }"></i>
              </div>
              <span class="chat-input-menu-label text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">更多</span>
            </button>
          </div>
        </Transition>
      </Teleport>

      <!-- 输入框 -->
      <div class="chat-input-field theme-input flex-1 min-w-0 px-3 py-[7px] flex items-center shadow-sm relative">
        <textarea
          ref="inputEl"
          :value="modelValue"
          :placeholder="placeholder"
          rows="1"
          class="chat-input-textarea flex-1 min-w-0 text-[16px] leading-[1.35] outline-none bg-transparent text-[var(--text-primary)] resize-none overflow-y-auto"
          inputmode="text"
          enterkeyhint="send"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          aria-autocomplete="none"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          @input="onInput($event.target.value)"
          @keydown="onKeydown"
        ></textarea>
        <!-- 表情按钮（输入框内） -->
        <button
          v-if="showEmojiButton && emojiButtonPosition === 'inside'"
          class="chat-input-emoji-inside flex items-center justify-center text-[var(--text-secondary)] ml-2 active:scale-90 transition-transform cursor-pointer shrink-0"
          @click="$emit('openSticker')"
        >
          <i class="ph ph-smiley text-[20px]"></i>
        </button>
        <!-- 表情包候选面板 -->
        <div
          v-if="stickerCandidates.length > 0"
          class="absolute left-0 right-0 bottom-full mb-1 bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-xl rounded-xl shadow-lg border border-[var(--border-color)] max-h-[180px] overflow-y-auto z-50 no-scrollbar"
        >
          <button
            v-for="(s, i) in stickerCandidates"
            :key="s.id"
            class="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
            :class="i === selectedCandidateIdx ? 'bg-[var(--primary-color)]/10' : 'active:bg-black/5 dark:active:bg-white/10'"
            @click="selectCandidate(s)"
          >
            <img :src="s.url" class="w-8 h-8 object-contain shrink-0 rounded">
            <span class="text-[14px] text-[var(--text-primary)] truncate">{{ s.name }}</span>
          </button>
        </div>
      </div>

      <!-- 表情按钮（输入框外） -->
      <button
        v-if="showEmojiButton && emojiButtonPosition !== 'inside'"
        class="chat-input-emoji h-[32px] w-[32px] flex items-center justify-center text-[var(--text-secondary)] active:scale-90 transition-transform cursor-pointer shrink-0"
        @click="$emit('openSticker')"
      >
        <i class="ph ph-smiley text-[24px]"></i>
      </button>

      <!-- 右侧加号按钮 -->
      <button
        v-if="showPlusRight"
        ref="plusButton"
        type="button"
        class="chat-input-plus chat-input-plus-right h-[36px] w-[36px] flex items-center justify-center text-[var(--text-secondary)] active:scale-90 transition-transform cursor-pointer shrink-0"
        @click="handlePlusClick"
      >
        <i class="ph-fill ph-plus-circle text-[28px]"></i>
      </button>

      <!-- 麦克风/发送按钮 -->
      <button class="chat-input-send h-[32px] w-[32px] flex items-center justify-center active:scale-90 transition-transform shrink-0" @click="handleSendClick">
        <!-- 麦克风（无输入时） -->
        <template v-if="showMicButton && !hasInput">
          <i class="chat-input-mic ph ph-microphone text-[24px] text-[var(--text-secondary)]"></i>
        </template>
        <!-- 文字样式 -->
        <span v-else-if="sendButtonStyle === 'text'" class="chat-input-send-text text-[var(--primary-color)] font-semibold text-[15px]">{{ sendButtonText }}</span>
        <!-- 图标样式（默认） -->
        <div v-else class="chat-input-send-icon w-[28px] h-[28px] bg-[var(--primary-color)] rounded-full flex items-center justify-center text-white">
          <i class="ph-bold ph-arrow-up text-sm"></i>
        </div>
      </button>
    </div>

    <!-- 底部弹出菜单 -->
    <Transition name="slide-up">
      <div
        v-if="menuUiMounted"
        v-show="showMenu"
        class="chat-input-popup grid grid-cols-4 gap-4 p-4 bg-[var(--bg-color)] dark:bg-[var(--card-bg)] border-t border-[var(--border-color)]"
      >
        <button
          class="chat-input-popup-item chat-input-popup-reader flex flex-col items-center gap-2"
          @click="emitMenuAction('openReader')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-book-open text-2xl text-[#8B5CF6]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">一起读</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-memory flex flex-col items-center gap-2"
          @click="emitMenuAction('openMemory')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-brain text-2xl text-[#34C759]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">记忆</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-camera flex flex-col items-center gap-2"
          @click="emitMenuAction('openCamera')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-camera text-2xl text-[#8E8E93]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">相机</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-photo flex flex-col items-center gap-2"
          @click="emitMenuAction('openPhoto')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-image text-2xl text-[var(--primary-color)]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">照片</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-transfer flex flex-col items-center gap-2"
          @click="emitMenuAction('openTransfer')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-currency-circle-dollar text-2xl text-[#FF9500]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">转账</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-gift flex flex-col items-center gap-2"
          @click="emitMenuAction('openGift')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-gift text-2xl text-[#FF2D55]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">礼物</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-voice flex flex-col items-center gap-2"
          @click="emitMenuAction('openVoice')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-microphone text-2xl text-[#5AC8FA]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">语音</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-sticker flex flex-col items-center gap-2"
          @click="emitMenuAction('openSticker')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-sticker text-2xl text-[#AF52DE]"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">贴纸</span>
        </button>
        <button
          class="chat-input-popup-item chat-input-popup-music flex flex-col items-center gap-2"
          @click="emitMenuAction('openMusic')"
        >
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-[#3c3c3e] shadow-sm flex items-center justify-center">
            <i class="ph-fill ph-music-notes text-2xl" style="background: linear-gradient(135deg, #FC5C7D, #6A82FB); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
          </div>
          <span class="text-[11px] text-[var(--text-secondary)]">音乐</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useContactsStore } from '../../../stores/contacts'
import { useSettingsStore } from '../../../stores/settings'
import { useStickersStore } from '../../../stores/stickers'
import { useChatInputMenu } from '../composables/useChatInputMenu'
import { useChatInputTextController } from '../composables/useChatInputTextController'

const props = defineProps({
  modelValue: { type: String, default: '' },
  allowSnoop: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'send', 'sendSticker', 'openPhoto', 'openCamera', 'openSticker', 'openMemory', 'openTransfer', 'openGift', 'openVoice', 'openReader', 'openMusic', 'openSearch', 'openMeet', 'openSnoop'])

const contactsStore = useContactsStore()
const settingsStore = useSettingsStore()
const stickersStore = useStickersStore()
const inputEl = ref(null)

// 从主题配置读取
const placeholder = computed(() => settingsStore.theme.inputPlaceholder || 'iMessage')
const sendButtonStyle = computed(() => settingsStore.theme.sendButtonStyle || '')
const sendButtonText = computed(() => settingsStore.theme.sendButtonText || '发送')
const showEmojiButton = computed(() => settingsStore.theme.showEmojiButton)
const emojiButtonPosition = computed(() => settingsStore.theme.emojiButtonPosition || '')
const plusButtonPosition = computed(() => settingsStore.theme.plusButtonPosition || 'left')
const showCameraButton = computed(() => settingsStore.theme.showCameraButton)
const showImageButton = computed(() => settingsStore.theme.showImageButton)
const showMicButton = computed(() => settingsStore.theme.showMicButton)
const visibleSecondaryPlusMenuItems = computed(() => (
  props.allowSnoop
    ? secondaryPlusMenuItems
    : secondaryPlusMenuItems.filter(item => item.key !== 'snoop')
))

// 根据配置决定显示
const showPlusLeft = computed(() => plusButtonPosition.value === 'left' || plusButtonPosition.value === '')
const showPlusRight = computed(() => plusButtonPosition.value === 'right')
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const {
  plusButton,
  plusMenu,
  showMenu,
  showMoreMenu,
  menuUiMounted,
  menuBottomPx,
  menuMaxHeightPx,
  primaryPlusMenuItems,
  secondaryPlusMenuItems,
  closeMenu,
  emitMenuAction,
  handlePlusClick,
  toggleMoreMenu
} = useChatInputMenu({
  emit,
  inputEl,
  isTouchDevice
})

const {
  hasInput,
  selectedCandidateIdx,
  stickerCandidates,
  focusInputSoon,
  handleSendClick,
  onInput,
  onKeydown,
  selectCandidate
} = useChatInputTextController({
  modelValue: computed(() => props.modelValue),
  showMicButton,
  inputEl,
  contactsStore,
  stickersStore,
  isTouchDevice,
  closeMenu,
  emit
})

defineExpose({ closeMenu, plusButton, plusMenu, focusInputSoon })
</script>

<style scoped>
/* 默认样式 (iMessage 风格) */

/* 默认隐藏工具栏、底部弹出（这些仍用 CSS 控制） */
.chat-input-toolbar {
  display: none;
  -webkit-overflow-scrolling: touch;
}
.chat-input-popup {
  display: none;
}

.chat-input-toolbar-item {
  width: 60px;
  height: 66px;
  gap: 4px;
}

.chat-input-toolbar-item > span {
  line-height: 1;
  white-space: nowrap;
}

/* 过渡动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.chat-input-textarea {
  min-height: 22px;
  max-height: 112px;
}
.chat-input-textarea::-webkit-scrollbar {
  display: none;
}

.chat-input-menu {
  scrollbar-width: none;
}

.chat-input-menu::-webkit-scrollbar {
  display: none;
}

.plus-menu-more-enter-active,
.plus-menu-more-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.plus-menu-more-enter-from,
.plus-menu-more-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

<style>
/* Teleported menu transitions (must be global) */
.plus-menu-pop-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.plus-menu-pop-leave-active {
  transition: all 0.15s ease-in;
}
.plus-menu-pop-enter-from,
.plus-menu-pop-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(8px);
}
</style>
