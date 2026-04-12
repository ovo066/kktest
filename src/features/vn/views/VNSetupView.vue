<template>
  <div class="vn-theme-page absolute inset-0 z-20 bg-[#f8fafc] flex flex-col">
    <!-- Header -->
    <header
      class="vn-theme-header bg-white/80 backdrop-blur-xl px-5 flex items-center justify-between border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <button @click="router.push('/vn')" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-gray-50 active:scale-90 transition-transform">
        <i class="ph-bold ph-caret-left"></i>
      </button>
      <h1 class="text-xl font-black text-gray-900">项目设置</h1>
      <button @click="saveAndPlay" class="text-indigo-600 font-bold text-[15px] px-2">完成</button>
    </header>

    <main class="flex-1 overflow-y-auto p-5 space-y-6 pb-24 no-scrollbar">
      <!-- Basic info -->
      <div class="vn-cfg-card space-y-4">
        <div class="flex items-center gap-2 mb-1">
          <i class="ph ph-info text-indigo-500 text-lg"></i>
          <h2 class="font-bold text-gray-800">基础信息</h2>
        </div>
        <div class="vn-cfg-group">
          <label>项目名称</label>
          <input v-model="form.name" type="text" class="vn-cfg-input" placeholder="例如：校园恋爱物语">
        </div>
        <div class="vn-cfg-group">
          <label>世界观 / 故事大纲</label>
          <textarea v-model="form.worldSetting" rows="5" class="vn-cfg-input resize-none" placeholder="写下世界观、时间地点、主线冲突等…"></textarea>
        </div>
      </div>

      <!-- Characters -->
      <div class="vn-cfg-card space-y-4">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <i class="ph ph-users text-indigo-500 text-lg"></i>
            <h2 class="font-bold text-gray-800">参演角色</h2>
          </div>
          <button
            v-if="characters.length > 1"
            :disabled="batchGenerating"
            class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full active:scale-95 transition-all disabled:opacity-40"
            @click="batchGenerateAll"
          >
            {{ batchGenerating ? `生成中 ${batchProgress.current}/${batchProgress.total}` : '批量 AI 生成' }}
          </button>
        </div>

        <!-- Selectable contacts -->
        <div class="space-y-2">
          <div
            v-for="c in selectableContacts"
            :key="c.id"
            class="flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer"
            :class="selectedIds.has(c.id) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50 border-gray-100'"
            @click="toggleCharacter(c)"
          >
            <div class="min-w-0 flex-1">
              <div class="text-gray-900 text-[15px] font-medium truncate">{{ c.name || c.id }}</div>
              <div class="text-gray-400 text-[11px] truncate">{{ c.prompt?.slice(0, 50) || '' }}</div>
            </div>
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
              :class="selectedIds.has(c.id) ? 'bg-indigo-500 text-white' : 'border-2 border-gray-200'"
            >
              <i v-if="selectedIds.has(c.id)" class="ph ph-check text-sm"></i>
            </div>
          </div>
        </div>

        <!-- Selected character editors -->
        <div v-if="characters.length > 0" class="space-y-3 pt-3 border-t border-gray-100">
          <div v-for="ch in characters" :key="ch.contactId" class="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-gray-800 text-[14px] truncate">{{ ch.vnName || '角色' }}</span>
              <div class="flex items-center gap-2">
                <button
                  :disabled="generatingCharId === ch.contactId"
                  class="text-[10px] font-bold text-indigo-600 px-2.5 py-1.5 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center gap-1 active:scale-95 disabled:opacity-40"
                  @click="generateForCharacter(ch)"
                >
                  <i class="ph ph-sparkle"></i>
                  {{ generatingCharId === ch.contactId ? '生成中...' : 'AI 生成' }}
                </button>
                <button class="text-red-400 text-[12px] font-semibold" @click="removeCharacter(ch.contactId)">移除</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="vn-cfg-group">
                <label>VN 显示名</label>
                <input v-model="ch.vnName" type="text" class="vn-cfg-input">
              </div>
              <div class="vn-cfg-group">
                <label>角色定位</label>
                <select v-model="ch.role" class="vn-cfg-input">
                  <option value="protagonist">主角</option>
                  <option value="heroine">女主</option>
                  <option value="support">配角</option>
                </select>
              </div>
              <div class="vn-cfg-group">
                <label>名字颜色</label>
                <input v-model="ch.nameColor" type="color" class="w-full h-[42px] rounded-xl bg-gray-50 border border-gray-200 px-2">
              </div>
              <div class="vn-cfg-group">
                <label>语音音色</label>
                <select v-model="ch.voiceId" class="vn-cfg-input">
                  <option v-for="v in EDGE_VOICES" :key="v.id" :value="v.id">{{ v.name }} · {{ v.id }}</option>
                </select>
              </div>
            </div>

            <div class="vn-cfg-group">
              <label>VN 专用描述</label>
              <textarea v-model="ch.vnDescription" rows="3" class="vn-cfg-input resize-none" placeholder="外貌、性格、说话风格、习惯…"></textarea>
            </div>

            <div class="vn-cfg-group">
              <label>立绘基础提示词（英文）</label>
              <textarea v-model="ch.spritePrompt" rows="2" class="vn-cfg-input resize-none font-mono text-[12px]" placeholder="anime style, upper body, character sprite, white background, ..."></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Image Gen -->
      <div class="vn-cfg-card space-y-4">
        <div class="flex items-center gap-2 mb-1">
          <i class="ph ph-palette text-indigo-500 text-lg"></i>
          <h2 class="font-bold text-gray-800">图像生成</h2>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="vn-cfg-group">
            <label>Provider</label>
            <select v-model="imageGen.provider" class="vn-cfg-input" @change="saveGlobalConfigs">
              <option value="nanobanana">NanoBanana</option>
              <option value="novelai">NovelAI</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="vn-cfg-group">
            <label>差分策略</label>
            <select v-model="imageGen.spriteStrategy" class="vn-cfg-input" @change="saveGlobalConfigs">
              <option value="img2img">图生图差分</option>
              <option value="full">完整生成</option>
            </select>
          </div>
        </div>

        <div v-if="imageGen.provider === 'nanobanana'" class="space-y-3">
          <div class="vn-cfg-group">
            <label>接口模式</label>
            <select v-model="imageGen.nanobanana.apiMode" class="vn-cfg-input" @change="saveGlobalConfigs">
              <option value="gemini">Gemini 原生</option>
              <option value="openai_chat">OpenAI Chat</option>
              <option value="openai_images">OpenAI Images</option>
            </select>
          </div>
          <div class="vn-cfg-group">
            <label>鉴权方式</label>
            <select v-model="imageGen.nanobanana.apiKeyMode" class="vn-cfg-input" @change="saveGlobalConfigs">
              <option value="query">Query ?key=</option>
              <option value="bearer">Bearer</option>
              <option value="x-goog-api-key">x-goog-api-key</option>
              <option value="x-api-key">x-api-key</option>
              <option value="none">无鉴权</option>
            </select>
          </div>
          <div class="vn-cfg-group">
            <label>API Key</label>
            <input v-model="imageGen.nanobanana.apiKey" type="password" class="vn-cfg-input" @change="saveGlobalConfigs">
          </div>
          <div class="vn-cfg-group">
            <label>Endpoint（可选）</label>
            <input
              v-model="imageGen.nanobanana.endpoint"
              type="text"
              class="vn-cfg-input"
              :placeholder="imageGen.nanobanana.apiMode === 'gemini'
                ? 'https://generativelanguage.googleapis.com/v1beta'
                : 'https://your-openai-compatible-api/v1'"
              @change="saveGlobalConfigs"
            >
          </div>
          <div class="vn-cfg-group">
            <label>Model</label>
            <input v-model="imageGen.nanobanana.model" type="text" class="vn-cfg-input" @change="saveGlobalConfigs">
          </div>
        </div>

        <div v-else-if="imageGen.provider === 'novelai'" class="space-y-3">
          <div class="vn-cfg-group">
            <label>NovelAI API Key</label>
            <input v-model="imageGen.novelai.apiKey" type="password" class="vn-cfg-input" @change="saveGlobalConfigs">
          </div>
          <div class="vn-cfg-group">
            <label>Model</label>
            <input v-model="imageGen.novelai.model" type="text" class="vn-cfg-input" @change="saveGlobalConfigs">
          </div>
        </div>

        <div v-else class="space-y-3">
          <div class="vn-cfg-group">
            <label>Endpoint</label>
            <input v-model="imageGen.custom.endpoint" type="text" class="vn-cfg-input" @change="saveGlobalConfigs">
          </div>
          <div class="vn-cfg-group">
            <label>API Key (optional)</label>
            <input v-model="imageGen.custom.apiKey" type="password" class="vn-cfg-input" @change="saveGlobalConfigs">
          </div>
          <div class="vn-cfg-group">
            <label>Request Template (JSON)</label>
            <textarea v-model="imageGen.custom.requestTemplate" rows="3" class="vn-cfg-input resize-none font-mono text-[12px]" @change="saveGlobalConfigs" placeholder='{"prompt":"{{prompt}}"}'></textarea>
          </div>
          <div class="vn-cfg-group">
            <label>Response Path</label>
            <input v-model="imageGen.custom.responsePath" type="text" class="vn-cfg-input" @change="saveGlobalConfigs" placeholder='images[0] 或 data.images[0].base64'>
          </div>
        </div>
      </div>

      <!-- TTS -->
      <div class="vn-cfg-card space-y-4">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <i class="ph ph-speaker-high text-indigo-500 text-lg"></i>
            <h2 class="font-bold text-gray-800">语音合成</h2>
          </div>
          <button
            class="vn-toggle"
            :class="{ active: tts.enabled }"
            @click="tts.enabled = !tts.enabled; saveGlobalConfigs()"
          >
            <div class="vn-toggle-dot"></div>
          </button>
        </div>

        <template v-if="tts.enabled">
          <div class="vn-cfg-group">
            <label>Edge TTS Endpoint（可选）</label>
            <input v-model="tts.endpoint" type="text" class="vn-cfg-input" @change="saveGlobalConfigs" placeholder="例如: https://your-tts.example.com/api/tts">
            <div class="text-gray-400 text-[11px] mt-1">未填写时将使用浏览器语音合成作为兜底</div>
          </div>

          <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span class="text-[13px] font-medium text-gray-700">旁白语音</span>
            <button
              class="vn-toggle"
              :class="{ active: tts.narratorEnabled }"
              @click="tts.narratorEnabled = !tts.narratorEnabled; saveGlobalConfigs()"
            >
              <div class="vn-toggle-dot"></div>
            </button>
          </div>

          <div v-if="tts.narratorEnabled" class="vn-cfg-group">
            <label>旁白音色</label>
            <select v-model="tts.narratorVoiceId" class="vn-cfg-input" @change="saveGlobalConfigs">
              <option v-for="v in EDGE_VOICES" :key="v.id" :value="v.id">{{ v.name }} · {{ v.desc }}</option>
            </select>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'
import { useTTS } from '../../../composables/useTTS'
import { useCharacterGen } from '../../../composables/useCharacterGen'

const router = useRouter()
const route = useRoute()
const contactsStore = useContactsStore()
const vnStore = useVNStore()
const { scheduleSave } = useStorage()
const { EDGE_VOICES } = useTTS()
const { generateCharacterPrompts, batchGeneratePrompts } = useCharacterGen()

const generatingCharId = ref(null)
const batchGenerating = ref(false)
const batchProgress = ref({ current: 0, total: 0, name: '' })
const suspendProjectAutoSave = ref(true)
const suspendGlobalConfigAutoSave = ref(true)

const form = reactive({
  name: '',
  worldSetting: '',
  characters: []
})

const projectId = computed(() => String(route.params.projectId || ''))

const selectableContacts = computed(() => {
  const list = contactsStore.contacts || []
  return Array.isArray(list) ? list.filter(c => c && c.id && c.type !== 'group') : []
})

const selectedIds = computed(() => new Set((form.characters || []).map(c => c.contactId)))

const characters = computed(() => form.characters)

const imageGen = vnStore.imageGenConfig
const tts = vnStore.ttsConfig

function ensureImageGenDefaults() {
  if (!imageGen.novelai || typeof imageGen.novelai !== 'object') imageGen.novelai = {}
  if (!imageGen.nanobanana || typeof imageGen.nanobanana !== 'object') imageGen.nanobanana = {}
  if (!imageGen.custom || typeof imageGen.custom !== 'object') imageGen.custom = {}

  const novelaiDefaults = {
    apiKey: '',
    model: 'nai-diffusion-4-5-full'
  }
  Object.entries(novelaiDefaults).forEach(([k, v]) => {
    if (imageGen.novelai[k] === undefined) imageGen.novelai[k] = v
  })

  const nanobananaDefaults = {
    apiKey: '',
    model: 'gemini-2.5-flash-image-preview',
    apiMode: 'gemini',
    endpoint: '',
    apiKeyMode: 'query',
    aspectRatio: '',
    imageSize: '',
    openaiSize: '',
    temperature: 1.0,
    extraBody: ''
  }
  Object.entries(nanobananaDefaults).forEach(([k, v]) => {
    if (imageGen.nanobanana[k] === undefined) imageGen.nanobanana[k] = v
  })

  const customDefaults = {
    endpoint: '',
    apiKey: '',
    requestTemplate: '',
    responsePath: ''
  }
  Object.entries(customDefaults).forEach(([k, v]) => {
    if (imageGen.custom[k] === undefined) imageGen.custom[k] = v
  })

  if (!imageGen.provider) imageGen.provider = 'nanobanana'
  if (!imageGen.spriteStrategy) imageGen.spriteStrategy = 'img2img'
}

onMounted(() => {
  ensureImageGenDefaults()

  if (projectId.value) {
    const p = (vnStore.projects || []).find(x => x.id === projectId.value)
    if (!p) {
      router.replace('/vn')
      return
    }
    form.name = p.name || ''
    form.worldSetting = p.worldSetting || ''
    form.characters = Array.isArray(p.characters) ? JSON.parse(JSON.stringify(p.characters)) : []
  } else {
    form.name = ''
    form.worldSetting = ''
    form.characters = []
  }

  queueMicrotask(() => {
    suspendProjectAutoSave.value = false
    suspendGlobalConfigAutoSave.value = false
  })
})

watch(
  () => imageGen.nanobanana?.apiMode,
  (mode) => {
    if (!imageGen.nanobanana) return
    if (mode === 'openai_chat' || mode === 'openai_images') {
      if (!imageGen.nanobanana.endpoint) {
        imageGen.nanobanana.endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai'
      }
      if (!imageGen.nanobanana.apiKeyMode || imageGen.nanobanana.apiKeyMode === 'query') {
        imageGen.nanobanana.apiKeyMode = 'bearer'
      }
      return
    }
    if (mode === 'gemini' && (!imageGen.nanobanana.apiKeyMode || imageGen.nanobanana.apiKeyMode === 'bearer')) {
      imageGen.nanobanana.apiKeyMode = 'query'
    }
  },
  { immediate: true }
)

function cleanPrompt(prompt) {
  if (!prompt) return ''
  return String(prompt)
    .replace(/你正在.*?手机聊天.*?\n?/g, '')
    .replace(/输出规则[：:][\s\S]*?(?=\n\n|$)/g, '')
    .replace(/每一行必须.*?\n?/g, '')
    .replace(/心理描写.*?包裹.*?\n?/g, '')
    .replace(/不要输出说明.*?\n?/g, '')
    .replace(/不要代替.*?发言.*?\n?/g, '')
    .replace(/保持口语化.*?\n?/g, '')
    .replace(/引用回复.*?\n?/g, '')
    .replace(/\[quote.*?\].*?\n?/g, '')
    .trim()
}

function makeDefaultCharacter(contact) {
  return {
    contactId: contact.id,
    vnName: contact.name || contact.id,
    nameColor: '#ffffff',
    role: 'support',
    vnDescription: cleanPrompt(contact.prompt || ''),
    voiceId: EDGE_VOICES?.[0]?.id || 'zh-CN-XiaoxiaoNeural',
    spritePrompt: ''
  }
}

function toggleCharacter(contact) {
  const idx = form.characters.findIndex(x => x.contactId === contact.id)
  if (idx !== -1) {
    form.characters.splice(idx, 1)
  } else {
    form.characters.push(makeDefaultCharacter(contact))
  }
}

function removeCharacter(contactId) {
  const idx = form.characters.findIndex(x => x.contactId === contactId)
  if (idx !== -1) form.characters.splice(idx, 1)
}

function saveGlobalConfigs() {
  scheduleSave()
}

function buildProjectPayload() {
  return {
    name: form.name.trim() || '未命名项目',
    worldSetting: form.worldSetting || '',
    characters: JSON.parse(JSON.stringify(form.characters || []))
  }
}

function saveAndPlay() {
  const payload = buildProjectPayload()

  let id = projectId.value
  if (id) {
    vnStore.updateProject(id, payload)
  } else {
    const p = vnStore.createProject(payload)
    id = p.id
  }

  vnStore.setCurrentProject(id)
  scheduleSave()
  router.push(`/vn/play/${id}`)
}

watch(
  form,
  () => {
    if (suspendProjectAutoSave.value) return
    if (!projectId.value) return
    vnStore.updateProject(projectId.value, buildProjectPayload())
    scheduleSave()
  },
  { deep: true }
)

watch(
  () => imageGen,
  () => {
    if (suspendGlobalConfigAutoSave.value) return
    scheduleSave()
  },
  { deep: true }
)

watch(
  () => tts,
  () => {
    if (suspendGlobalConfigAutoSave.value) return
    scheduleSave()
  },
  { deep: true }
)

async function generateForCharacter(ch) {
  if (generatingCharId.value) return
  generatingCharId.value = ch.contactId

  try {
    const result = await generateCharacterPrompts(ch, form.worldSetting)
    if (result.vnDescription) ch.vnDescription = result.vnDescription
    if (result.spritePrompt) ch.spritePrompt = result.spritePrompt
  } catch (e) {
    alert('生成失败: ' + e.message)
  } finally {
    generatingCharId.value = null
  }
}

async function batchGenerateAll() {
  if (batchGenerating.value || form.characters.length === 0) return
  batchGenerating.value = true
  batchProgress.value = { current: 0, total: form.characters.length, name: '' }

  try {
    const results = await batchGeneratePrompts(
      form.characters,
      form.worldSetting,
      (current, total, name) => {
        batchProgress.value = { current, total, name }
      }
    )

    results.forEach(r => {
      if (!r.success) return
      const ch = form.characters.find(c => c.contactId === r.contactId)
      if (!ch) return
      if (r.vnDescription) ch.vnDescription = r.vnDescription
      if (r.spritePrompt) ch.spritePrompt = r.spritePrompt
    })
  } catch (e) {
    alert('批量生成失败: ' + e.message)
  } finally {
    batchGenerating.value = false
  }
}
</script>

<style scoped>
.vn-cfg-card {
  background: white;
  border: 1px solid #eef2f6;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.vn-cfg-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vn-cfg-group label {
  font-size: 10px;
  font-weight: 800;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding-left: 4px;
}

.vn-cfg-input {
  width: 100%;
  background: #f9fafb;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 14px;
  color: #111827;
  outline: none;
  transition: border-color 0.2s;
}

.vn-cfg-input:focus {
  border-color: rgba(99, 102, 241, 0.4);
}

.vn-cfg-input::placeholder {
  color: #d1d5db;
}

.vn-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #e5e7eb;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.vn-toggle.active {
  background: #6366f1;
}

.vn-toggle-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform 0.3s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

.vn-toggle.active .vn-toggle-dot {
  transform: translateX(20px);
}

select { -webkit-appearance: none; appearance: none; }
</style>
