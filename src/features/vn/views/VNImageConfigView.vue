<template>
  <div class="vn-theme-page absolute inset-0 z-20 bg-[#f8fafc] flex flex-col">
    <!-- Header -->
    <header
      class="vn-theme-header bg-white/80 backdrop-blur-xl px-5 flex items-center gap-3 border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <button @click="router.back()" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-gray-50 active:scale-90 transition-transform">
        <i class="ph-bold ph-caret-left"></i>
      </button>
      <h1 class="text-xl font-black text-gray-900">画笔配置</h1>
    </header>

    <main class="flex-1 overflow-y-auto p-5 space-y-6 pb-24 no-scrollbar">
      <!-- Provider selector -->
      <div class="flex p-1 bg-gray-100 rounded-2xl">
        <button
          v-for="p in providers" :key="p.id"
          @click="vnStore.imageGenConfig.provider = p.id"
          class="flex-1 py-2.5 text-[12px] font-bold rounded-xl transition-all"
          :class="vnStore.imageGenConfig.provider === p.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'"
        >
          {{ p.name }}
        </button>
      </div>

      <!-- Strategy toggle -->
      <div class="bg-white border border-gray-100 rounded-[24px] p-5 flex items-center justify-between">
        <div>
          <div class="text-gray-800 text-[14px] font-bold">生成策略</div>
          <div class="text-gray-400 text-[10px] mt-0.5 uppercase tracking-tight">立绘表情差分的生成方式</div>
        </div>
        <div class="flex bg-gray-100 rounded-xl p-1">
          <button
            @click="vnStore.imageGenConfig.spriteStrategy = 'full'"
            class="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all"
            :class="vnStore.imageGenConfig.spriteStrategy === 'full' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-400'"
          >
            直接生成
          </button>
          <button
            @click="vnStore.imageGenConfig.spriteStrategy = 'img2img'"
            class="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all"
            :class="vnStore.imageGenConfig.spriteStrategy === 'img2img' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-400'"
          >
            重绘
          </button>
        </div>
      </div>

      <!-- Provider config -->
      <transition name="fade" mode="out-in">
        <div :key="vnStore.imageGenConfig.provider" class="space-y-4">

          <!-- NovelAI -->
          <template v-if="vnStore.imageGenConfig.provider === 'novelai'">
            <div class="vn-cfg-card">
              <div class="vn-cfg-group">
                <label>API KEY</label>
                <input v-model="vnStore.imageGenConfig.novelai.apiKey" type="password" placeholder="pst-..." class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>模型</label>
                <input v-model="vnStore.imageGenConfig.novelai.model" placeholder="nai-diffusion-4-5-full" class="vn-cfg-input" />
              </div>
            </div>

            <div class="vn-cfg-card grid grid-cols-2 gap-4">
              <div class="vn-cfg-group">
                <label>采样步数</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.steps" type="number" min="1" max="60" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>引导比例</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.scale" type="number" step="0.5" min="0" max="50" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>宽度</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.width" type="number" step="64" min="64" max="4096" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>高度</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.height" type="number" step="64" min="64" max="4096" class="vn-cfg-input" />
              </div>
            </div>

            <div class="vn-cfg-card space-y-4">
              <div class="vn-cfg-group">
                <label>采样器</label>
                <div class="relative">
                  <select v-model="vnStore.imageGenConfig.novelai.sampler" class="vn-cfg-input appearance-none pr-10">
                    <option v-for="s in samplers" :key="s" :value="s">{{ s }}</option>
                  </select>
                  <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
              <div class="vn-cfg-group">
                <label>负面预设</label>
                <div class="relative">
                  <select v-model.number="vnStore.imageGenConfig.novelai.ucPreset" class="vn-cfg-input appearance-none pr-10">
                    <option :value="4">Heavy (重度)</option>
                    <option :value="5">Light (轻度)</option>
                    <option :value="6">Human Focus (人像)</option>
                    <option :value="3">None (无)</option>
                  </select>
                  <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
              <div class="vn-cfg-group">
                <label>负面提示词</label>
                <textarea v-model="vnStore.imageGenConfig.novelai.negative_prompt" rows="3" class="vn-cfg-input resize-none"></textarea>
              </div>
            </div>

            <div class="vn-cfg-card space-y-1">
              <div class="flex items-center justify-between py-3">
                <span class="text-[13px] font-medium text-gray-700">SMEA</span>
                <button class="vn-toggle" :class="{ active: vnStore.imageGenConfig.novelai.sm }" @click="vnStore.imageGenConfig.novelai.sm = !vnStore.imageGenConfig.novelai.sm">
                  <div class="vn-toggle-dot"></div>
                </button>
              </div>
              <div class="flex items-center justify-between py-3 border-t border-gray-100">
                <span class="text-[13px] font-medium text-gray-700">Dynamic SMEA</span>
                <button class="vn-toggle" :class="{ active: vnStore.imageGenConfig.novelai.sm_dyn }" @click="vnStore.imageGenConfig.novelai.sm_dyn = !vnStore.imageGenConfig.novelai.sm_dyn">
                  <div class="vn-toggle-dot"></div>
                </button>
              </div>
              <div class="flex items-center justify-between py-3 border-t border-gray-100">
                <span class="text-[13px] font-medium text-gray-700">自动添加质量词</span>
                <button class="vn-toggle" :class="{ active: vnStore.imageGenConfig.novelai.qualityToggle }" @click="vnStore.imageGenConfig.novelai.qualityToggle = !vnStore.imageGenConfig.novelai.qualityToggle">
                  <div class="vn-toggle-dot"></div>
                </button>
              </div>
            </div>

            <div class="vn-cfg-card grid grid-cols-2 gap-4">
              <div class="vn-cfg-group">
                <label>CFG Rescale</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.cfg_rescale" type="number" step="0.1" min="0" max="1" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>Uncond Scale</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.uncond_scale" type="number" step="0.5" min="0" max="10" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>重绘强度</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.strength" type="number" step="0.05" min="0" max="1" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>重绘噪声</label>
                <input v-model.number="vnStore.imageGenConfig.novelai.noise" type="number" step="0.05" min="0" max="1" class="vn-cfg-input" />
              </div>
            </div>
          </template>

          <!-- NanoBanana (Gemini) -->
          <template v-else-if="vnStore.imageGenConfig.provider === 'nanobanana'">
            <div class="vn-cfg-card grid grid-cols-2 gap-4">
              <div class="vn-cfg-group">
                <label>接口模式</label>
                <div class="relative">
                  <select v-model="vnStore.imageGenConfig.nanobanana.apiMode" class="vn-cfg-input appearance-none pr-10">
                    <option v-for="item in nanobananaApiModes" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
              <div class="vn-cfg-group">
                <label>鉴权方式</label>
                <div class="relative">
                  <select v-model="vnStore.imageGenConfig.nanobanana.apiKeyMode" class="vn-cfg-input appearance-none pr-10">
                    <option v-for="item in nanobananaApiKeyModes" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <div class="vn-cfg-card space-y-4">
              <div class="vn-cfg-group">
                <label>API Key</label>
                <input v-model="vnStore.imageGenConfig.nanobanana.apiKey" type="password" placeholder="输入 API Key" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>Endpoint / Base URL（可选）</label>
                <input
                  v-model="vnStore.imageGenConfig.nanobanana.endpoint"
                  :placeholder="vnStore.imageGenConfig.nanobanana.apiMode === 'gemini'
                    ? 'https://generativelanguage.googleapis.com/v1beta'
                    : 'https://your-openai-compatible-api/v1'"
                  class="vn-cfg-input"
                />
              </div>
              <div class="vn-cfg-group">
                <label>模型</label>
                <input v-model="vnStore.imageGenConfig.nanobanana.model" placeholder="gemini-2.5-flash-image-preview" class="vn-cfg-input" />
              </div>
            </div>

            <div class="vn-cfg-card grid grid-cols-2 gap-4">
              <div class="vn-cfg-group">
                <label>Aspect Ratio</label>
                <div class="relative">
                  <select v-model="vnStore.imageGenConfig.nanobanana.aspectRatio" class="vn-cfg-input appearance-none pr-10">
                    <option value="">自动（按宽高推断）</option>
                    <option v-for="ratio in nanobananaAspectRatios" :key="ratio" :value="ratio">{{ ratio }}</option>
                  </select>
                  <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
              <div class="vn-cfg-group">
                <label>Image Size（Gemini 3）</label>
                <div class="relative">
                  <select v-model="vnStore.imageGenConfig.nanobanana.imageSize" class="vn-cfg-input appearance-none pr-10">
                    <option value="">自动</option>
                    <option v-for="size in nanobananaImageSizes" :key="size" :value="size">{{ size }}</option>
                  </select>
                  <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>
              </div>
              <div class="vn-cfg-group">
                <label>OpenAI Size（可选）</label>
                <input v-model="vnStore.imageGenConfig.nanobanana.openaiSize" placeholder="1024x1024" class="vn-cfg-input" />
              </div>
              <div class="vn-cfg-group">
                <label>温度</label>
                <input v-model.number="vnStore.imageGenConfig.nanobanana.temperature" type="number" step="0.1" min="0" max="2" class="vn-cfg-input" />
              </div>
            </div>

            <div v-if="vnStore.imageGenConfig.nanobanana.apiMode === 'openai_chat'" class="vn-cfg-card space-y-3">
              <div class="vn-cfg-group">
                <label>extra_body（可选 JSON）</label>
                <textarea
                  v-model="vnStore.imageGenConfig.nanobanana.extraBody"
                  rows="4"
                  placeholder='{"google":{"response_modalities":["IMAGE"],"image_config":{"aspect_ratio":"1:1"}}}'
                  class="vn-cfg-input resize-none font-mono text-[12px]"
                ></textarea>
              </div>
            </div>
          </template>

          <!-- Custom -->
          <div v-else-if="vnStore.imageGenConfig.provider === 'custom'" class="vn-cfg-card space-y-4">
            <div class="vn-cfg-group">
              <label>Endpoint</label>
              <input v-model="vnStore.imageGenConfig.custom.endpoint" placeholder="https://api.example.com/v1/..." class="vn-cfg-input" />
            </div>
            <div class="vn-cfg-group">
              <label>API Key</label>
              <input v-model="vnStore.imageGenConfig.custom.apiKey" type="password" class="vn-cfg-input" />
            </div>
            <div class="vn-cfg-group">
              <label>请求模板 (JSON)</label>
              <textarea v-model="vnStore.imageGenConfig.custom.requestTemplate" rows="5" placeholder='{"prompt": "{{prompt}}"}' class="vn-cfg-input resize-none font-mono text-[12px]"></textarea>
            </div>
            <div class="vn-cfg-group">
              <label>响应路径</label>
              <input v-model="vnStore.imageGenConfig.custom.responsePath" placeholder="data[0].url" class="vn-cfg-input" />
            </div>
          </div>
        </div>
      </transition>

      <!-- Test button -->
      <button
        class="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[14px] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-xl"
        :disabled="isTesting"
        @click="testGeneration"
      >
        <i v-if="isTesting" class="ph ph-circle-notch animate-spin"></i>
        <i v-else class="ph ph-lightning-fill"></i>
        {{ isTesting ? '生成中...' : '测试接口' }}
      </button>

      <!-- Test result -->
      <div v-if="testResult" class="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wide">测试结果</span>
          <button @click="testResult = null" class="text-gray-300"><i class="ph ph-x"></i></button>
        </div>
        <div class="aspect-square bg-gray-50 relative">
          <img :src="testResult" class="w-full h-full object-contain" />
        </div>
      </div>

      <div v-if="testError" class="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-red-500 text-[13px]">
        {{ testError }}
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useVNStore } from '../../../stores/vn'
import { useImageGen } from '../../../composables/useImageGen'
import { useStorage } from '../../../composables/useStorage'

const router = useRouter()
const vnStore = useVNStore()
const { generateImage } = useImageGen()
const { scheduleSave } = useStorage()

const isTesting = ref(false)
const testResult = ref(null)
const testError = ref('')

const providers = [
  { id: 'novelai', name: 'NovelAI' },
  { id: 'nanobanana', name: 'NanoBanana' },
  { id: 'custom', name: '自定义' }
]

const samplers = [
  'k_euler', 'k_euler_ancestral', 'k_dpmpp_2m',
  'k_dpmpp_sde', 'k_dpmpp_2s_ancestral', 'ddim'
]

const nanobananaApiModes = [
  { value: 'gemini', label: 'Gemini 原生' },
  { value: 'openai_chat', label: 'OpenAI Chat' },
  { value: 'openai_images', label: 'OpenAI Images' }
]

const nanobananaApiKeyModes = [
  { value: 'query', label: 'Query ?key=' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'x-goog-api-key', label: 'x-goog-api-key' },
  { value: 'x-api-key', label: 'x-api-key' },
  { value: 'none', label: '无鉴权' }
]

const nanobananaAspectRatios = [
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
  '1:4', '4:1', '1:8', '8:1'
]

const nanobananaImageSizes = ['512px', '1K', '2K', '4K']

function ensureNanobananaDefaults(cfg) {
  if (!cfg.nanobanana || typeof cfg.nanobanana !== 'object') cfg.nanobanana = {}
  const defaults = {
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
  Object.entries(defaults).forEach(([k, v]) => {
    if (cfg.nanobanana[k] === undefined) cfg.nanobanana[k] = v
  })
}

onMounted(() => {
  const cfg = vnStore.imageGenConfig

  if (!cfg.novelai) cfg.novelai = {}
  const naiDefaults = {
    apiKey: '', model: 'nai-diffusion-4-5-full',
    steps: 28, sampler: 'k_euler', scale: 5,
    width: 1024, height: 1024, negative_prompt: '',
    sm: false, sm_dyn: false, qualityToggle: true,
    ucPreset: 4, cfg_rescale: 0, uncond_scale: 1,
    strength: 0.6, noise: 0.2
  }
  Object.entries(naiDefaults).forEach(([k, v]) => {
    if (cfg.novelai[k] === undefined) cfg.novelai[k] = v
  })

  ensureNanobananaDefaults(cfg)
  if (!cfg.custom) cfg.custom = { endpoint: '', apiKey: '', requestTemplate: '', responsePath: '' }
  if (!cfg.spriteStrategy) cfg.spriteStrategy = 'img2img'
})

watch(
  () => vnStore.imageGenConfig?.nanobanana?.apiMode,
  (mode) => {
    const nano = vnStore.imageGenConfig?.nanobanana
    if (!nano) return

    if (mode === 'openai_chat' || mode === 'openai_images') {
      if (!nano.endpoint) nano.endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai'
      if (!nano.apiKeyMode || nano.apiKeyMode === 'query') nano.apiKeyMode = 'bearer'
      return
    }

    if (mode === 'gemini' && (!nano.apiKeyMode || nano.apiKeyMode === 'bearer')) {
      nano.apiKeyMode = 'query'
    }
  },
  { immediate: true }
)

watch(() => vnStore.imageGenConfig, () => {
  scheduleSave()
}, { deep: true })

async function testGeneration() {
  if (isTesting.value) return
  isTesting.value = true
  testError.value = ''
  testResult.value = null

  try {
    const url = await generateImage('1girl, upper body, white background, anime style, test', {
      width: 512,
      height: 512,
      seed: Math.floor(Math.random() * 4294967295)
    })
    testResult.value = url
  } catch (e) {
    testError.value = e.message || '测试失败'
  } finally {
    isTesting.value = false
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
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from { opacity: 0; transform: translateY(8px); }
.fade-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
