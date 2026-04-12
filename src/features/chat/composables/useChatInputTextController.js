import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { haptic } from '../../../utils/haptic'
import {
  buildStickerCandidateContext,
  buildStickerSuggestionIndex,
  buildStickerUsageStats,
  extractStickerCommandQuery,
  getStickerCandidates,
  preloadStickerSearch
} from '../../../utils/stickerSearch'

const EMPTY_CANDIDATE_CONTEXT = Object.freeze({
  mode: 'keyword',
  query: '',
  directTerms: [],
  expandedTerms: [],
  intentIds: [],
  strictTerms: [],
  recentMessages: [],
  shouldSuggest: false
})

const TEXTAREA_MAX_HEIGHT = 112
const SUGGESTION_DEBOUNCE_MS_TOUCH = 140
const SUGGESTION_DEBOUNCE_MS_DESKTOP = 80

export function useChatInputTextController(options) {
  const {
    modelValue,
    showMicButton,
    inputEl,
    contactsStore,
    stickersStore,
    isTouchDevice,
    closeMenu,
    emit
  } = options

  const hasInput = computed(() => !!String(modelValue.value || '').trim())
  const selectedCandidateIdx = ref(0)
  const lastLocalModelValue = ref(null)
  const suggestionInputValue = ref('')
  const stickerSearchTick = ref(0)

  let textareaSyncFrame = 0
  let suggestionTimer = 0
  let hasLoadedStickerSearch = false

  function focusInputSoon(config = {}) {
    const el = inputEl.value
    if (!el || typeof el.focus !== 'function' || typeof window === 'undefined') return

    const allowTouch = config.allowTouch === true
    if (!allowTouch && isTouchDevice) return

    requestAnimationFrame(() => {
      try {
        el.focus({ preventScroll: true })
      } catch {
        try {
          el.focus()
        } catch {
          // ignore focus failures on unusual webviews
        }
      }
    })
  }

  function handleSendClick() {
    const hadInput = hasInput.value
    closeMenu()

    if (showMicButton.value && !hadInput) {
      emit('openVoice')
      return
    }

    haptic()
    emit('send')
    if (!hadInput) {
      inputEl.value?.blur?.()
    } else {
      focusInputSoon()
    }
  }

  const stickerIndex = computed(() => {
    const tick = stickerSearchTick.value
    void tick
    return buildStickerSuggestionIndex(stickersStore.stickers)
  })

  const stickerUsageStats = computed(() => buildStickerUsageStats(
    contactsStore.contacts,
    contactsStore.activeChat?.id || null,
    {
      maxContacts: 18,
      maxMessagesPerContact: 180
    }
  ))

  function clearSuggestionTimer() {
    if (!suggestionTimer) return
    clearTimeout(suggestionTimer)
    suggestionTimer = 0
  }

  function shouldUpdateSuggestionImmediately(value) {
    const text = String(value || '')
    if (!text.trim()) return true
    if (extractStickerCommandQuery(text) !== null) return true
    return /[\s\n\r\t,，.。!！?？:：;；)）\]】]$/.test(text)
  }

  function scheduleSuggestionInputUpdate(value, config = {}) {
    const normalized = String(value || '')
    const immediate = config.immediate === true
    if (immediate) {
      clearSuggestionTimer()
      suggestionInputValue.value = normalized
      return
    }

    clearSuggestionTimer()
    const delay = isTouchDevice ? SUGGESTION_DEBOUNCE_MS_TOUCH : SUGGESTION_DEBOUNCE_MS_DESKTOP
    suggestionTimer = setTimeout(() => {
      suggestionTimer = 0
      suggestionInputValue.value = normalized
    }, delay)
  }

  const candidateContext = computed(() => {
    const tick = stickerSearchTick.value
    void tick
    const inputValue = String(suggestionInputValue.value || '')
    const trimmed = inputValue.trim()
    if (!trimmed) return EMPTY_CANDIDATE_CONTEXT

    const commandQuery = extractStickerCommandQuery(inputValue)
    const nextContext = buildStickerCandidateContext({
      inputValue,
      activeChat: contactsStore.activeChat
    })

    const textLength = Array.from(trimmed).length
    if (
      commandQuery === null &&
      textLength < 2 &&
      !nextContext.reactionLike &&
      nextContext.intentIds.length === 0 &&
      nextContext.directTerms.length === 0
    ) {
      return EMPTY_CANDIDATE_CONTEXT
    }

    return nextContext
  })

  const candidateMode = computed(() => candidateContext.value.mode)

  const stickerCandidates = computed(() => getStickerCandidates({
    stickerIndex: stickerIndex.value,
    context: candidateContext.value,
    usageStats: stickerUsageStats.value
  }))

  watch(stickerCandidates, (list) => {
    if (!list.length) {
      selectedCandidateIdx.value = 0
      return
    }
    if (selectedCandidateIdx.value >= list.length) {
      selectedCandidateIdx.value = 0
    }
  })

  watch(suggestionInputValue, async (value) => {
    if (hasLoadedStickerSearch) return
    const loaded = await preloadStickerSearch({ sampleText: value })
    if (!loaded || hasLoadedStickerSearch) return
    hasLoadedStickerSearch = true
    stickerSearchTick.value += 1
  })

  function syncTextareaHeight() {
    const el = inputEl.value
    if (!el) return

    const current = parseInt(el.style.height) || 0
    if (!el.value && current !== 22) {
      el.style.height = '22px'
      return
    }
    if (el.scrollHeight <= current || current === 0) {
      el.style.height = '0px'
    }
    const nextHeight = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)
    el.style.height = `${Math.max(22, nextHeight)}px`
  }

  function scheduleTextareaHeightSync() {
    if (typeof window === 'undefined') {
      syncTextareaHeight()
      return
    }
    if (textareaSyncFrame) cancelAnimationFrame(textareaSyncFrame)
    textareaSyncFrame = requestAnimationFrame(() => {
      textareaSyncFrame = 0
      syncTextareaHeight()
    })
  }

  watch(modelValue, (value) => {
    if (value === lastLocalModelValue.value) {
      lastLocalModelValue.value = null
      return
    }

    lastLocalModelValue.value = null
    scheduleSuggestionInputUpdate(value, {
      immediate: shouldUpdateSuggestionImmediately(value)
    })
    if (!value) {
      syncTextareaHeight()
      return
    }
    scheduleTextareaHeightSync()
  }, { immediate: true, flush: 'post' })

  function onInput(value) {
    lastLocalModelValue.value = value
    emit('update:modelValue', value)
    scheduleSuggestionInputUpdate(value, {
      immediate: shouldUpdateSuggestionImmediately(value)
    })
    selectedCandidateIdx.value = 0
    scheduleTextareaHeightSync()
  }

  function selectCandidate(sticker) {
    haptic()
    emit('update:modelValue', '')
    emit('sendSticker', sticker.name)
    focusInputSoon()
  }

  function onKeydown(event) {
    if (event.isComposing) return

    if (stickerCandidates.value.length > 0) {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        selectedCandidateIdx.value = (selectedCandidateIdx.value - 1 + stickerCandidates.value.length) % stickerCandidates.value.length
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selectedCandidateIdx.value = (selectedCandidateIdx.value + 1) % stickerCandidates.value.length
        return
      }
      if (event.key === 'Enter' && candidateMode.value === 'command') {
        event.preventDefault()
        selectCandidate(stickerCandidates.value[selectedCandidateIdx.value])
        return
      }
      if (event.key === 'Tab' && candidateMode.value === 'command') {
        event.preventDefault()
        selectCandidate(stickerCandidates.value[selectedCandidateIdx.value])
        return
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      closeMenu()
      haptic()
      emit('send')
      focusInputSoon()
    }
  }

  onBeforeUnmount(() => {
    if (textareaSyncFrame) cancelAnimationFrame(textareaSyncFrame)
    clearSuggestionTimer()
  })

  return {
    hasInput,
    selectedCandidateIdx,
    stickerCandidates,
    focusInputSoon,
    handleSendClick,
    onInput,
    onKeydown,
    selectCandidate
  }
}
