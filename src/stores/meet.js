import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { makeId } from '../utils/id'
import { useCharacterResourcesStore } from './characterResources'
import { formatBeijingLocale } from '../utils/beijingTime'
import { clampNumber, normalizePromptEntries, parseOptionalInteger } from '../utils/presetNormalization'

function defaultMeetingVoiceConfig(data = {}) {
  return {
    ttsEnabled: data.ttsEnabled === true
  }
}

function defaultPlayerState() {
  return {
    // Display
    currentBg: null, // { name, url }
    currentCg: null, // { name, url, prompt }
    currentBgm: null, // reserved
    sprites: [], // [{ characterId, vnName, expression, position, animation, url, isExiting }]

    // Meet Specific
    currentLocation: '',
    currentTimeOfDay: '',
    moodValues: {},

    // Current text / choices
    currentDialog: null, // { characterId, vnName, text, nameColor, isNarration }
    currentChoices: null, // [{ text, effect }]

    // Playback flags
    isPlaying: false,
    isAutoPlay: false,
    isSkipping: false,
    isWaitingInput: false,
    isGenerating: false,
    isGeneratingImage: false,
    isSpeaking: false,

    // Instruction queue
    instructionQueue: [],
    instructionIndex: 0,

    // Settings
    textSpeed: 30,
    autoPlayDelay: 2000,
    volume: {
      bgm: 0.7,
      voice: 1.0,
      sfx: 0.8
    },

    // Runtime-only
    currentAudio: null,
    _resolveWait: null
  }
}

export const useMeetStore = defineStore('meet', () => {
  // ===== State =====
  const meetings = ref([])
  const presets = ref([])
  const currentMeetingId = ref(null)

  const player = reactive(defaultPlayerState())

  const assetSources = reactive({
    backgroundUrls: [],
    spriteUrls: [],
    bgmUrls: [],
    sfxUrls: [],
    enableJamendoBgm: true,
    jamendoClientId: '',
    jamendoInstrumentalOnly: true,
    jamendoSearchLimit: 10,
    enableSafebooru: true,
    enableRealtimeGeneration: true,
    enableSpriteAutoCutout: true,
    generationMinDelayMs: 1400,
    generationMaxDelayMs: 5200,
    generationJitterMs: 600,
    generationMaxRetries: 3,
    safebooruProxy: '',
    safebooruTimeoutMs: 8000,
    imageProxy: '',
    audioProxy: ''
  })

  // ===== Computed =====
  const currentMeeting = computed(() => {
    return meetings.value.find(m => m.id === currentMeetingId.value) || null
  })

  // ===== Methods: Meetings =====
  function createMeeting(data = {}) {
    const meeting = {
      id: makeId('meet'),
      name: data.name || '新见面',
      contactId: data.contactId || null,
      presetId: data.presetId || null,
      location: data.location || '',
      worldSetting: data.worldSetting || '',
      voice: defaultMeetingVoiceConfig(data.voice),
      characters: Array.isArray(data.characters) ? data.characters : [],
      resources: {
        backgrounds: {},
        cgs: {},
        sprites: {},
        bgm: {},
        sfx: {}
      },
      history: [],
      variables: {},
      llmContext: [],
      saves: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    meetings.value.push(meeting)
    currentMeetingId.value = meeting.id
    return meeting
  }

  function updateMeeting(meetingId, patch = {}) {
    const m = meetings.value.find(x => x.id === meetingId)
    if (!m) return false
    Object.assign(m, patch)
    m.updatedAt = Date.now()
    return true
  }

  function deleteMeeting(meetingId) {
    const idx = meetings.value.findIndex(m => m.id === meetingId)
    if (idx !== -1) meetings.value.splice(idx, 1)
    if (currentMeetingId.value === meetingId) currentMeetingId.value = null
  }

  function setCurrentMeeting(meetingId) {
    currentMeetingId.value = meetingId || null
  }

  // ===== Methods: Presets =====
  function createPreset(data = {}) {
    const preset = {
      id: makeId('preset'),
      name: data.name || '新预设',
      source: data.source || 'custom',
      systemPrompt: data.systemPrompt || '',
      jailbreakPrompt: data.jailbreakPrompt || '',
      temperature: clampNumber(data.temperature, 0.8, { min: 0, max: 2 }),
      maxTokens: parseOptionalInteger(data.maxTokens, { min: 1, max: 65535, clamp: true }),
      topP: clampNumber(data.topP, 1.0, { min: 0, max: 1 }),
      frequencyPenalty: clampNumber(data.frequencyPenalty, 0, { min: -2, max: 2 }),
      presencePenalty: clampNumber(data.presencePenalty, 0, { min: -2, max: 2 }),
      promptEntries: normalizePromptEntries(data.promptEntries)
    }
    presets.value.push(preset)
    return preset
  }

  function updatePreset(presetId, patch = {}) {
    const p = presets.value.find(x => x.id === presetId)
    if (!p) return false
    const nextPatch = { ...patch }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'temperature')) {
      nextPatch.temperature = clampNumber(nextPatch.temperature, p.temperature ?? 0.8, { min: 0, max: 2 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'maxTokens')) {
      nextPatch.maxTokens = parseOptionalInteger(nextPatch.maxTokens, { min: 1, max: 65535, clamp: true })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'topP')) {
      nextPatch.topP = clampNumber(nextPatch.topP, p.topP ?? 1, { min: 0, max: 1 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'frequencyPenalty')) {
      nextPatch.frequencyPenalty = clampNumber(nextPatch.frequencyPenalty, p.frequencyPenalty ?? 0, { min: -2, max: 2 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'presencePenalty')) {
      nextPatch.presencePenalty = clampNumber(nextPatch.presencePenalty, p.presencePenalty ?? 0, { min: -2, max: 2 })
    }
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'promptEntries')) {
      nextPatch.promptEntries = normalizePromptEntries(nextPatch.promptEntries)
    }
    Object.assign(p, nextPatch)
    return true
  }

  function deletePreset(presetId) {
    const idx = presets.value.findIndex(p => p.id === presetId)
    if (idx !== -1) presets.value.splice(idx, 1)
  }

  // ===== Methods: Resources & Runtime =====
  function getResource(type, key) {
    if (!currentMeeting.value) return null
    const meetingResource = currentMeeting.value.resources?.[type]?.[key] || null
    if (meetingResource) return meetingResource

    // Fallback to unified character resources for sprites
    if (type === 'sprites' && key) {
      const charResStore = useCharacterResourcesStore()
      const sepIdx = key.lastIndexOf('_')
      if (sepIdx > 0) {
        const contactId = key.slice(0, sepIdx)
        const expression = key.slice(sepIdx + 1)
        const url = charResStore.getSprite(contactId, expression)
        if (url) return { url }
      }
    }

    return null
  }

  function setResource(type, key, data) {
    if (!currentMeeting.value) return
    if (!currentMeeting.value.resources[type]) currentMeeting.value.resources[type] = {}
    currentMeeting.value.resources[type][key] = {
      ...data,
      createdAt: Date.now()
    }
    currentMeeting.value.updatedAt = Date.now()
  }

  function addToHistory(instruction) {
    if (!currentMeeting.value) return
    const snapshot = {
      ...instruction,
      timestamp: Date.now()
    }
    currentMeeting.value.history.push(JSON.parse(JSON.stringify(snapshot)))
    currentMeeting.value.updatedAt = Date.now()
  }

  function setVariable(key, value) {
    if (!currentMeeting.value) return
    currentMeeting.value.variables[key] = value
    currentMeeting.value.updatedAt = Date.now()
  }

  function getVariable(key, defaultValue = null) {
    if (!currentMeeting.value) return defaultValue
    return currentMeeting.value.variables[key] ?? defaultValue
  }

  function resetPlayer() {
    const next = defaultPlayerState()
    Object.keys(next).forEach(k => {
      player[k] = next[k]
    })
  }

  function saveGame(slotName) {
    if (!currentMeeting.value) return null

    const snapshot = {
      history: JSON.parse(JSON.stringify(currentMeeting.value.history)),
      variables: JSON.parse(JSON.stringify(currentMeeting.value.variables)),
      llmContext: JSON.parse(JSON.stringify(currentMeeting.value.llmContext)),
      playerSnapshot: {
        currentBg: player.currentBg,
        currentCg: player.currentCg,
        currentBgm: player.currentBgm,
        sprites: JSON.parse(JSON.stringify(player.sprites)),
        currentLocation: player.currentLocation,
        currentTimeOfDay: player.currentTimeOfDay,
        moodValues: JSON.parse(JSON.stringify(player.moodValues)),
        currentDialog: player.currentDialog ? { ...player.currentDialog } : null,
        currentChoices: JSON.parse(JSON.stringify(player.currentChoices || []))
      }
    }

    const save = {
      id: makeId('save'),
      name: slotName || ('存档 ' + formatBeijingLocale(new Date())),
      timestamp: Date.now(),
      snapshot
    }
    currentMeeting.value.saves.push(save)
    currentMeeting.value.updatedAt = Date.now()
    return save
  }

  function loadGame(saveId) {
    if (!currentMeeting.value) return false
    const save = currentMeeting.value.saves.find(s => s.id === saveId)
    if (!save) return false

    currentMeeting.value.history = JSON.parse(JSON.stringify(save.snapshot.history || []))
    currentMeeting.value.variables = JSON.parse(JSON.stringify(save.snapshot.variables || {}))
    currentMeeting.value.llmContext = JSON.parse(JSON.stringify(save.snapshot.llmContext || []))

    resetPlayer()
    player.currentBg = save.snapshot.playerSnapshot?.currentBg || null
    player.currentCg = save.snapshot.playerSnapshot?.currentCg || null
    player.currentBgm = save.snapshot.playerSnapshot?.currentBgm || null
    player.sprites = JSON.parse(JSON.stringify(save.snapshot.playerSnapshot?.sprites || []))
    player.currentLocation = save.snapshot.playerSnapshot?.currentLocation || ''
    player.currentTimeOfDay = save.snapshot.playerSnapshot?.currentTimeOfDay || ''
    player.moodValues = JSON.parse(JSON.stringify(save.snapshot.playerSnapshot?.moodValues || {}))
    player.currentDialog = save.snapshot.playerSnapshot?.currentDialog || null
    const restoredChoices = JSON.parse(JSON.stringify(save.snapshot.playerSnapshot?.currentChoices || []))
    player.currentChoices = restoredChoices.length > 0 ? restoredChoices : null
    return true
  }

  return {
    meetings,
    presets,
    currentMeetingId,
    currentMeeting,
    player,
    assetSources,

    createMeeting,
    updateMeeting,
    deleteMeeting,
    setCurrentMeeting,
    createPreset,
    updatePreset,
    deletePreset,
    getResource,
    setResource,
    addToHistory,
    setVariable,
    getVariable,
    resetPlayer,
    saveGame,
    loadGame
  }
})
