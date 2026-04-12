import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useCharacterResourcesStore } from './characterResources'
import { formatBeijingLocale } from '../utils/beijingTime'

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function defaultPlayerState() {
  return {
    // Display
    currentBg: null, // { name, url }
    currentBgm: null, // reserved
    sprites: [], // [{ characterId, vnName, expression, position, animation, url, isExiting }]

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

function defaultImageGenConfig() {
  return {
    provider: 'nanobanana', // 'novelai' | 'nanobanana' | 'custom'

    novelai: {
      apiKey: '',
      model: 'nai-diffusion-4-5-full'
    },

    nanobanana: {
      apiKey: '',
      model: 'gemini-2.5-flash-image-preview',
      apiMode: 'gemini', // 'gemini' | 'openai_chat' | 'openai_images'
      endpoint: '',
      apiKeyMode: 'query', // 'query' | 'bearer' | 'x-goog-api-key' | 'x-api-key'
      aspectRatio: '',
      imageSize: '',
      openaiSize: '',
      temperature: 1.0,
      extraBody: ''
    },

    custom: {
      endpoint: '',
      apiKey: '',
      requestTemplate: '',
      // JSON path to the image field, e.g. "data[0].b64_json" or "images[0].url"
      responsePath: ''
    },

    spriteStrategy: 'img2img' // 'full' | 'img2img'
  }
}

export const useVNStore = defineStore('vn', () => {
  // ===== Projects =====
  const projects = ref([])
  const currentProjectId = ref(null)

  const currentProject = computed(() => {
    return projects.value.find(p => p.id === currentProjectId.value) || null
  })

  // ===== Runtime player state (not persisted) =====
  const player = reactive(defaultPlayerState())

  // ===== Global configs (persisted) =====
  const imageGenConfig = reactive(defaultImageGenConfig())
  const ttsConfig = reactive({
    provider: 'edge', // 'edge' | 'none'
    enabled: true,
    endpoint: '',
    narratorEnabled: true,
    narratorVoiceId: 'zh-CN-YunxiNeural'
  })

  function createProject(data = {}) {
    const project = {
      id: makeId('vn'),
      name: data.name || '未命名项目',
      worldSetting: data.worldSetting || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // Characters reference contacts.
      characters: Array.isArray(data.characters) ? data.characters : [],

      resources: {
        backgrounds: {},
        sprites: {},
        bgm: {}
      },

      history: [],
      variables: {},
      llmContext: [],
      saves: []
    }

    projects.value.push(project)
    currentProjectId.value = project.id
    return project
  }

  function updateProject(projectId, patch = {}) {
    const p = projects.value.find(x => x.id === projectId)
    if (!p) return false
    Object.assign(p, patch)
    p.updatedAt = Date.now()
    return true
  }

  function deleteProject(projectId) {
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx !== -1) projects.value.splice(idx, 1)
    if (currentProjectId.value === projectId) currentProjectId.value = null
  }

  function setCurrentProject(projectId) {
    currentProjectId.value = projectId || null
  }

  function getResource(type, key) {
    if (!currentProject.value) return null
    const projectResource = currentProject.value.resources?.[type]?.[key] || null
    if (projectResource) return projectResource

    // Fallback to unified character resources for sprites
    if (type === 'sprites' && key) {
      const charResStore = useCharacterResourcesStore()
      // key format: contactId_expression
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
    if (!currentProject.value) return
    if (!currentProject.value.resources[type]) currentProject.value.resources[type] = {}
    currentProject.value.resources[type][key] = {
      ...data,
      createdAt: Date.now()
    }
    currentProject.value.updatedAt = Date.now()
  }

  function addToHistory(instruction) {
    if (!currentProject.value) return
    currentProject.value.history.push({
      ...instruction,
      timestamp: Date.now()
    })
    currentProject.value.updatedAt = Date.now()
  }

  function setVariable(key, value) {
    if (!currentProject.value) return
    currentProject.value.variables[key] = value
    currentProject.value.updatedAt = Date.now()
  }

  function getVariable(key, defaultValue = null) {
    if (!currentProject.value) return defaultValue
    return currentProject.value.variables[key] ?? defaultValue
  }

  function resetPlayer() {
    const next = defaultPlayerState()
    Object.keys(next).forEach(k => {
      player[k] = next[k]
    })
  }

  function saveGame(slotName) {
    if (!currentProject.value) return null

    const snapshot = {
      history: JSON.parse(JSON.stringify(currentProject.value.history)),
      variables: JSON.parse(JSON.stringify(currentProject.value.variables)),
      llmContext: JSON.parse(JSON.stringify(currentProject.value.llmContext)),
      playerSnapshot: {
        currentBg: player.currentBg,
        sprites: JSON.parse(JSON.stringify(player.sprites))
      }
    }

    const save = {
      id: makeId('save'),
      name: slotName || ('存档 ' + formatBeijingLocale(new Date())),
      timestamp: Date.now(),
      snapshot
    }
    currentProject.value.saves.push(save)
    currentProject.value.updatedAt = Date.now()
    return save
  }

  function loadGame(saveId) {
    if (!currentProject.value) return false
    const save = currentProject.value.saves.find(s => s.id === saveId)
    if (!save) return false

    currentProject.value.history = JSON.parse(JSON.stringify(save.snapshot.history || []))
    currentProject.value.variables = JSON.parse(JSON.stringify(save.snapshot.variables || {}))
    currentProject.value.llmContext = JSON.parse(JSON.stringify(save.snapshot.llmContext || []))

    resetPlayer()
    player.currentBg = save.snapshot.playerSnapshot?.currentBg || null
    player.sprites = JSON.parse(JSON.stringify(save.snapshot.playerSnapshot?.sprites || []))
    return true
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    player,
    imageGenConfig,
    ttsConfig,

    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    resetPlayer,
    getResource,
    setResource,
    addToHistory,
    setVariable,
    getVariable,
    saveGame,
    loadGame
  }
})
