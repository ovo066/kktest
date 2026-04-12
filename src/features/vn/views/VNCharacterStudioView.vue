<template>
  <div class="vn-theme-page absolute inset-0 z-20 bg-[#f1f3f5] flex flex-col">
    <!-- Header -->
    <header
      class="vn-theme-header bg-white/80 backdrop-blur-xl px-5 flex items-center justify-between border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <div class="flex items-center gap-3">
        <button @click="goBack" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-gray-50 active:scale-90 transition-transform">
          <i class="ph-bold ph-caret-left"></i>
        </button>
        <h1 class="text-lg font-black text-gray-900 truncate max-w-[200px]">{{ contactName }}</h1>
      </div>
      <!-- Step indicator -->
      <div class="flex gap-1.5">
        <div v-for="i in 3" :key="i" class="h-1.5 rounded-full transition-all duration-300" :class="step >= i - 1 ? 'w-8 bg-indigo-500' : 'w-4 bg-gray-200'"></div>
      </div>
    </header>

    <!-- Stepper -->
    <div class="flex items-center px-5 py-3 gap-2 shrink-0 bg-white/50 border-b border-gray-100">
      <button
        v-for="(s, i) in steps" :key="i"
        @click="canGoTo(i) && (step = i)"
        class="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-[12px] font-bold"
        :class="step === i ? 'bg-white text-indigo-600 shadow-sm' : (canGoTo(i) ? 'text-gray-400' : 'text-gray-300 cursor-default')"
      >
        <span class="w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0"
          :class="step === i ? 'bg-indigo-500 text-white' : (canGoTo(i) ? 'bg-gray-100' : 'bg-gray-50')"
        >{{ i + 1 }}</span>
        <span class="truncate">{{ s }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-5 pb-24 space-y-5 pt-4 no-scrollbar">

      <!-- ========== Step 0: Configure Prompts ========== -->
      <template v-if="step === 0">
        <div class="vn-studio-card space-y-4">
          <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">01. 角色描述</h3>
          <div class="vn-field">
            <label>角色外观描述</label>
            <textarea
              v-model="entry.basePrompt"
              rows="4"
              :placeholder="isNanoBanana
                ? '自然语言描述角色外观，如: 蓝色长发、红色眼睛的少女，穿着校服，动漫风格'
                : '英文外观描述，如: 1girl, long blue hair, red eyes, school uniform, upper body, white background'"
              class="vn-input resize-none"
            ></textarea>
          </div>
          <div v-if="!isNanoBanana" class="vn-field">
            <label>画师串 (Artist Tags)</label>
            <input v-model="entry.artistTags" placeholder="artist:xxx, ..." class="vn-input" />
          </div>
          <div class="vn-field">
            <label>负面提示词 (角色级)</label>
            <textarea v-model="entry.negativePrompt" rows="2" placeholder="留空则使用全局默认" class="vn-input resize-none"></textarea>
          </div>

          <!-- Upload reference image -->
          <div>
            <input type="file" ref="refImgInput" class="hidden" accept="image/*" @change="handleRefUpload" />
            <button
              class="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400 text-[13px] font-medium active:border-indigo-300 active:text-indigo-500 transition-all"
              @click="$refs.refImgInput.click()"
            >
              <img v-if="refImage" :src="refImage" class="w-6 h-6 rounded object-cover" />
              <i v-else class="ph ph-image-square text-lg"></i>
              {{ refImage
                ? (isNanoBanana ? '参考图已上传 (点击替换)' : '基底重绘图已上传 (点击替换)')
                : (isNanoBanana ? '上传参考图 (推荐，用于 img2img)' : '上传基底重绘图 (可选)') }}
            </button>
          </div>

          <button
            class="w-full h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
            :disabled="aiGenerating"
            @click="aiGenPrompt"
          >
            <i class="ph ph-magic-wand text-base"></i>
            {{ aiGenerating ? '生成中...' : 'AI 生成提示词' }}
          </button>
        </div>

        <div v-if="!isNanoBanana" class="vn-studio-card space-y-4">
          <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">02. 生图增强</h3>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-[13px] font-bold text-gray-700">固定 Seed</div>
              <div class="text-[11px] text-gray-400">开启后每次生成使用同一个种子</div>
            </div>
            <button class="vn-toggle" :class="{ active: generationPrefs.fixedSeedEnabled }" @click="generationPrefs.fixedSeedEnabled = !generationPrefs.fixedSeedEnabled">
              <div class="vn-toggle-dot"></div>
            </button>
          </div>

          <div v-if="generationPrefs.fixedSeedEnabled" class="vn-field">
            <label>Seed</label>
            <input
              v-model.number="generationPrefs.fixedSeed"
              type="number"
              min="0"
              max="4294967295"
              class="vn-input"
              placeholder="例如：123456789"
            />
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <div class="text-[13px] font-bold text-gray-700">表情复用基底 Seed</div>
              <div class="text-[11px] text-gray-400">未固定 Seed 时生效</div>
            </div>
            <button class="vn-toggle" :class="{ active: generationPrefs.reuseBaseSeedForExpressions }" @click="generationPrefs.reuseBaseSeedForExpressions = !generationPrefs.reuseBaseSeedForExpressions">
              <div class="vn-toggle-dot"></div>
            </button>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <div class="text-[13px] font-bold text-gray-700">非角色图保留画师串</div>
              <div class="text-[11px] text-gray-400">当 image token 使用 type=... 时生效</div>
            </div>
            <button class="vn-toggle" :class="{ active: generationPrefs.keepArtistTagsOnNonCharacterImage }" @click="generationPrefs.keepArtistTagsOnNonCharacterImage = !generationPrefs.keepArtistTagsOnNonCharacterImage">
              <div class="vn-toggle-dot"></div>
            </button>
          </div>

          <div class="pt-2 border-t border-gray-100 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[13px] font-bold text-gray-700">角色参考</div>
                <div class="text-[11px] text-gray-400">对应官方角色参考图</div>
              </div>
              <button class="vn-toggle" :class="{ active: generationPrefs.characterRefEnabled }" @click="generationPrefs.characterRefEnabled = !generationPrefs.characterRefEnabled">
                <div class="vn-toggle-dot"></div>
              </button>
            </div>

            <template v-if="generationPrefs.characterRefEnabled">
              <input type="file" ref="charRefInput" class="hidden" accept="image/*" @change="handleCharacterRefUpload" />
              <div class="flex items-center gap-2">
                <button
                  class="flex-1 h-9 rounded-xl border border-gray-200 bg-gray-50 text-[12px] font-bold text-gray-600 active:scale-[0.98]"
                  @click="$refs.charRefInput.click()"
                >
                  {{ generationPrefs.characterRefImage ? '替换角色参考图' : '上传角色参考图' }}
                </button>
                <button
                  class="h-9 px-3 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-500 active:scale-[0.98] disabled:opacity-30"
                  :disabled="!generationPrefs.characterRefImage"
                  @click="clearCharacterRef"
                >
                  清除
                </button>
              </div>

              <div v-if="generationPrefs.characterRefImage" class="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <img :src="generationPrefs.characterRefImage" class="w-20 h-20 rounded-lg object-cover border border-gray-200" />
              </div>

              <div v-if="generationPrefs.characterRefImage" class="vn-field">
                <label>参考模式</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="h-8 rounded-lg border text-[12px] font-bold transition-all"
                    :class="generationPrefs.characterRefMode === 'character_only' ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-gray-200 bg-white text-gray-500'"
                    @click="generationPrefs.characterRefMode = 'character_only'"
                  >
                    仅角色
                  </button>
                  <button
                    class="h-8 rounded-lg border text-[12px] font-bold transition-all"
                    :class="generationPrefs.characterRefMode === 'character_style' ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-gray-200 bg-white text-gray-500'"
                    @click="generationPrefs.characterRefMode = 'character_style'"
                  >
                    角色+风格
                  </button>
                </div>
              </div>

              <div v-if="generationPrefs.characterRefImage" class="grid grid-cols-2 gap-3">
                <div class="vn-field">
                  <label>参考强度 {{ Number(generationPrefs.characterRefStrength || 0).toFixed(2) }}</label>
                  <input v-model.number="generationPrefs.characterRefStrength" type="range" min="0" max="1" step="0.05" />
                </div>
                <div class="vn-field">
                  <label>保真度 {{ Number(generationPrefs.characterRefFidelity || 0).toFixed(2) }}</label>
                  <input v-model.number="generationPrefs.characterRefFidelity" type="range" min="0" max="1" step="0.05" />
                </div>
              </div>
            </template>
          </div>

          <div class="pt-2 border-t border-gray-100 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[13px] font-bold text-gray-700">Vibe 垫图</div>
                <div class="text-[11px] text-gray-400">支持多张参考图混合风格</div>
              </div>
              <div class="h-6 px-2 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center">
                {{ generationPrefs.vibeReferences.length }} 张
              </div>
            </div>

            <div
              v-if="generationPrefs.characterRefEnabled && generationPrefs.characterRefImage && generationPrefs.vibeReferences.length > 0"
              class="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
            >
              与官方说明一致：角色参考与 Vibe 不混用；当前优先 Vibe。
            </div>

            <input type="file" ref="vibeInput" class="hidden" accept="image/*" multiple @change="handleVibeUpload" />
            <div class="flex items-center gap-2">
              <button
                class="flex-1 h-9 rounded-xl border border-gray-200 bg-gray-50 text-[12px] font-bold text-gray-600 active:scale-[0.98]"
                @click="$refs.vibeInput.click()"
              >
                添加 Vibe 图
              </button>
              <button
                class="h-9 px-3 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-500 active:scale-[0.98] disabled:opacity-30"
                :disabled="generationPrefs.vibeReferences.length === 0"
                @click="clearVibes"
              >
                清空
              </button>
            </div>

            <div v-if="generationPrefs.vibeReferences.length === 0" class="text-[12px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              暂未添加垫图
            </div>

            <div
              v-for="(vibe, idx) in generationPrefs.vibeReferences"
              :key="vibe.id"
              class="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2"
            >
              <div class="flex items-center gap-3">
                <img :src="vibe.image" class="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                <div class="flex-1 min-w-0">
                  <div class="text-[12px] font-bold text-gray-700 truncate">Vibe {{ idx + 1 }}</div>
                  <div class="text-[11px] text-gray-400">强度 {{ Number(vibe.strength || 0).toFixed(2) }} / 信息 {{ Number(vibe.informationExtracted || 0).toFixed(2) }}</div>
                </div>
                <button
                  class="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-400 active:scale-95"
                  @click="removeVibe(vibe.id)"
                >
                  <i class="ph ph-trash"></i>
                </button>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="vn-field">
                  <label>强度</label>
                  <input v-model.number="vibe.strength" type="range" min="0" max="1" step="0.05" />
                </div>
                <div class="vn-field">
                  <label>信息提取</label>
                  <input v-model.number="vibe.informationExtracted" type="range" min="0" max="1" step="0.05" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Expression list -->
        <div class="vn-studio-card space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">表情列表</span>
            <button class="h-7 px-3 rounded-lg bg-gray-50 text-gray-500 text-[11px] font-bold active:scale-95" @click="addExpression">
              <i class="ph ph-plus mr-1"></i>添加
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(expr, idx) in entry.customExpressions"
              :key="idx"
              class="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-50 border border-gray-100 text-[12px] text-gray-600 font-medium"
            >
              <span>{{ expr }}</span>
              <button
                v-if="expr !== 'normal'"
                class="w-4 h-4 rounded-full text-gray-300 hover:text-red-400 flex items-center justify-center"
                @click="removeExpressionFromList(idx)"
              >
                <i class="ph ph-x text-[10px]"></i>
              </button>
            </div>
          </div>
        </div>

        <button
          class="w-full h-12 rounded-2xl bg-indigo-500 text-white font-black text-[14px] active:scale-[0.98] transition-transform disabled:opacity-40 shadow-lg shadow-indigo-500/20"
          :disabled="!entry.basePrompt.trim()"
          @click="saveConfigAndNext"
        >
          下一步：生成基础立绘
        </button>
      </template>

      <!-- ========== Step 1: Generate/Upload Base Sprite ========== -->
      <template v-if="step === 1">
        <div class="vn-studio-card space-y-3">
          <div class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">完整提示词</div>
          <div class="text-gray-600 text-[13px] leading-relaxed break-all bg-gray-50 rounded-xl p-3 border border-gray-100">
            {{ fullBasePrompt }}
          </div>
        </div>

        <!-- Preview -->
        <div class="vn-studio-card overflow-hidden">
          <div v-if="baseStatus === 'pending'" class="flex flex-col items-center py-16">
            <div class="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <i class="ph ph-user-circle-plus text-4xl text-gray-200"></i>
            </div>
            <div class="text-gray-400 text-[13px]">点击下方按钮生成或上传基础立绘</div>
          </div>

          <div v-else-if="baseStatus === 'generating'" class="flex flex-col items-center py-16">
            <div class="relative">
              <div class="w-14 h-14 rounded-full border-3 border-indigo-100 border-t-indigo-500 animate-spin"></div>
              <i class="ph ph-sparkle absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 text-lg"></i>
            </div>
            <div class="text-indigo-500 text-[13px] font-bold mt-4 animate-pulse">正在绘制基准立绘...</div>
          </div>

          <div v-else-if="baseStatus === 'done' && basePreview" class="space-y-3 p-4">
            <div class="max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-gray-100 bg-gray-50" :style="spriteAspectStyle">
              <img :src="basePreview" class="w-full h-full object-cover" />
            </div>
            <div v-if="baseSeed != null" class="text-center text-gray-400 text-[11px]">
              Seed: {{ baseSeed }}
            </div>
          </div>

          <div v-else-if="baseStatus === 'error'" class="flex flex-col items-center py-12">
            <div class="text-red-400 text-[13px] mb-2">{{ baseError }}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <button
            class="h-12 rounded-2xl bg-gray-900 text-white font-bold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
            :disabled="baseStatus === 'generating'"
            @click="generateBase"
          >
            <i class="ph ph-sparkle"></i> {{ baseStatus === 'done' ? '重新生成' : 'AI 生成' }}
          </button>
          <input type="file" ref="baseUploadInput" class="hidden" accept="image/*" @change="handleBaseUpload" />
          <button
            class="h-12 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold text-[14px] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            @click="$refs.baseUploadInput.click()"
          >
            <i class="ph ph-upload-simple"></i> 上传图片
          </button>
        </div>

        <button
          v-if="baseStatus === 'done'"
          class="w-full h-12 rounded-2xl bg-indigo-500 text-white font-black text-[14px] active:scale-[0.98] transition-transform shadow-lg shadow-indigo-500/20"
          @click="confirmBase"
        >
          使用此立绘 →
        </button>
      </template>

      <!-- ========== Step 2: Expression Variants ========== -->
      <template v-if="step === 2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">表情差分</span>
          <button
            class="h-8 px-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[12px] font-bold active:scale-[0.98] disabled:opacity-40"
            :disabled="batchRunning"
            @click="batchGenerateAll"
          >
            <i class="ph ph-lightning mr-1"></i>{{ batchRunning ? '生成中...' : '全部生成' }}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="expr in expressionList"
            :key="expr.name"
            class="vn-studio-card overflow-hidden"
          >
            <div class="aspect-square bg-gray-50 relative flex items-center justify-center group">
              <img v-if="expr.url" :src="expr.url" class="w-full h-full object-cover" />
              <i v-else class="ph ph-smiley-blank text-4xl text-gray-200"></i>

              <!-- Status badge -->
              <div v-if="expr.status === 'generating'" class="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                <div class="w-8 h-8 rounded-full border-2 border-indigo-100 border-t-indigo-500 animate-spin"></div>
              </div>

              <span
                v-if="expr.status && expr.status !== 'pending'"
                class="absolute top-2 right-2 h-5 px-2 rounded-full text-[9px] font-bold flex items-center"
                :class="{
                  'bg-blue-50 text-blue-500': expr.status === 'generating',
                  'bg-green-50 text-green-500': expr.status === 'done',
                  'bg-red-50 text-red-400': expr.status === 'error'
                }"
              >
                {{ statusLabel(expr.status) }}
              </span>
            </div>

            <div class="p-3 flex items-center justify-between border-t border-gray-100">
              <span class="text-[11px] font-bold text-gray-600 uppercase">{{ expr.name }}</span>
              <div class="flex gap-1.5">
                <button
                  class="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center text-[13px] active:scale-90 disabled:opacity-30"
                  :disabled="expr.status === 'generating' || batchRunning"
                  @click="generateOneExpression(expr.name)"
                >
                  <i class="ph ph-sparkle"></i>
                </button>
                <input :ref="el => { if (el) exprFileInputs[expr.name] = el }" type="file" class="hidden" accept="image/*" @change="handleExprUpload($event, expr.name)" />
                <button
                  class="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center text-[13px] active:scale-90"
                  @click="exprFileInputs[expr.name]?.click()"
                >
                  <i class="ph ph-upload-simple"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          class="w-full h-12 rounded-2xl bg-gray-900 text-white font-black text-[14px] active:scale-[0.98] transition-transform shadow-xl"
          @click="goBack"
        >
          完成
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVNStore } from '../../../stores/vn'
import { useCharacterResourcesStore } from '../../../stores/characterResources'
import { useContactsStore } from '../../../stores/contacts'
import { useImageGen } from '../../../composables/useImageGen'
import { useCharacterGen } from '../../../composables/useCharacterGen'
import { useStorage } from '../../../composables/useStorage'
import { useVNStudioReferences } from '../composables/useVNStudioReferences'
import { useVNStudioGeneration } from '../composables/useVNStudioGeneration'

const route = useRoute()
const router = useRouter()
const vnStore = useVNStore()
const charResStore = useCharacterResourcesStore()
const contactsStore = useContactsStore()
const { generateImage } = useImageGen()
const { generateCharacterPrompts } = useCharacterGen()
const { scheduleSave } = useStorage()

const steps = ['配置提示词', '基础立绘', '表情差分']
const step = ref(0)
const exprFileInputs = reactive({})
const aiGenerating = ref(false)

const contactId = computed(() => String(route.params.contactId || ''))
const contact = computed(() => {
  if (!contactId.value) return null
  return (contactsStore.contacts || []).find((item) => item.id === contactId.value) || null
})
const contactName = computed(() => contact.value?.name || '角色工房')

const entry = reactive({
  basePrompt: '',
  artistTags: '',
  negativePrompt: '',
  customExpressions: ['normal', 'happy', 'sad', 'angry', 'surprised', 'shy']
})

const provider = computed(() => vnStore.imageGenConfig.provider)
const isNanoBanana = computed(() => provider.value === 'nanobanana')

const {
  generationPrefs,
  refImage,
  restoreGenerationPrefs,
  snapshotGenerationPrefs,
  readFileAsDataUrl,
  ensureBase64,
  buildNovelAIReferenceOptions,
  handleRefUpload,
  handleCharacterRefUpload,
  clearCharacterRef,
  handleVibeUpload,
  removeVibe,
  clearVibes
} = useVNStudioReferences({ provider })

const spriteSize = computed(() => {
  if (provider.value === 'novelai') {
    const novelai = vnStore.imageGenConfig.novelai || {}
    const width = Number(novelai.width)
    const height = Number(novelai.height)
    return {
      width: Number.isFinite(width) ? Math.max(64, Math.min(4096, Math.round(width))) : 832,
      height: Number.isFinite(height) ? Math.max(64, Math.min(4096, Math.round(height))) : 1216
    }
  }
  return { width: 832, height: 1216 }
})

const spriteAspectStyle = computed(() => ({
  aspectRatio: `${spriteSize.value.width} / ${spriteSize.value.height}`
}))

const fullBasePrompt = computed(() => {
  if (isNanoBanana.value) {
    const description = String(entry.basePrompt || '').trim()
    return description
      ? `Anime character portrait: ${description}, upper body, white background, clean illustration style`
      : 'Anime character portrait, upper body, white background, clean illustration style'
  }
  const parts = []
  if (entry.artistTags) parts.push(entry.artistTags)
  if (entry.basePrompt) parts.push(entry.basePrompt)
  parts.push('upper body, visual novel character sprite, anime style, white background')
  return parts.join(', ')
})

const {
  baseStatus,
  basePreview,
  baseSeed,
  baseError,
  exprStates,
  batchRunning,
  restoreGeneratedAssets,
  handleBaseUpload,
  handleExprUpload,
  generateBase,
  confirmBase: confirmBaseImage,
  generateOneExpression,
  batchGenerateAll: runBatchGenerateAll
} = useVNStudioGeneration({
  contactId,
  entry,
  vnStore,
  charResStore,
  generateImage,
  scheduleSave,
  spriteSize,
  fullBasePrompt,
  generationPrefs,
  refImage,
  readFileAsDataUrl,
  ensureBase64,
  buildNovelAIReferenceOptions
})

onMounted(() => {
  if (!contactId.value) {
    router.replace('/vn')
    return
  }

  const existing = charResStore.getEntry(contactId.value)
  if (!existing) return

  entry.basePrompt = existing.basePrompt || ''
  entry.artistTags = existing.artistTags || ''
  entry.negativePrompt = existing.negativePrompt || ''
  if (Array.isArray(existing.customExpressions) && existing.customExpressions.length > 0) {
    entry.customExpressions = [...existing.customExpressions]
  }
  restoreGeneratedAssets(existing)
  restoreGenerationPrefs(existing.generationPrefs)
})

const expressionList = computed(() => {
  return entry.customExpressions
    .filter((name) => name !== 'normal')
    .map((name) => {
      const state = exprStates[name] || { status: 'pending', url: null, error: '' }
      return { name, ...state }
    })
})

function canGoTo(index) {
  if (index === 0) return true
  if (index === 1) return !!entry.basePrompt.trim()
  if (index === 2) return baseStatus.value === 'done'
  return false
}

function statusLabel(status) {
  switch (status) {
    case 'pending': return '待生成'
    case 'generating': return '生成中'
    case 'done': return '完成'
    case 'error': return '失败'
    default: return status
  }
}

function addExpression() {
  const name = prompt('输入表情名称（英文，如 blush, wink, cry...）：')
  if (!name) return
  const trimmed = name.trim().toLowerCase()
  if (!trimmed || entry.customExpressions.includes(trimmed)) return
  entry.customExpressions.push(trimmed)
}

function removeExpressionFromList(index) {
  const name = entry.customExpressions[index]
  entry.customExpressions.splice(index, 1)
  if (exprStates[name]) delete exprStates[name]
  if (exprFileInputs[name]) delete exprFileInputs[name]
}

function saveConfigAndNext() {
  charResStore.updateCharacterConfig(contactId.value, {
    basePrompt: entry.basePrompt,
    artistTags: entry.artistTags,
    negativePrompt: entry.negativePrompt,
    customExpressions: [...entry.customExpressions],
    generationPrefs: snapshotGenerationPrefs()
  })
  scheduleSave()
  step.value = 1
}

async function aiGenPrompt() {
  if (aiGenerating.value) return
  aiGenerating.value = true
  try {
    const character = {
      contactId: contactId.value,
      vnName: contact.value?.name || '',
      name: contact.value?.name || '',
      prompt: contact.value?.prompt || '',
      role: 'heroine'
    }
    const result = await generateCharacterPrompts(character, '')
    if (result.spritePrompt) {
      entry.basePrompt = result.spritePrompt
    }
  } catch (error) {
    console.warn('AI prompt generation failed:', error)
  } finally {
    aiGenerating.value = false
  }
}

function confirmBase() {
  const confirmed = confirmBaseImage()
  if (confirmed) {
    step.value = 2
  }
}

async function batchGenerateAll() {
  await runBatchGenerateAll(entry.customExpressions)
}

function goBack() {
  router.back()
}
</script>

<style scoped>
.vn-studio-card {
  background: white;
  border: 1px solid #eef2f6;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.vn-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vn-field label {
  font-size: 10px;
  font-weight: 800;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding-left: 4px;
}

.vn-input {
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

.vn-input:focus {
  border-color: rgba(99, 102, 241, 0.4);
}

.vn-input::placeholder {
  color: #d1d5db;
}

.vn-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #e5e7eb;
  position: relative;
  transition: background 0.2s;
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
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.vn-toggle.active .vn-toggle-dot {
  transform: translateX(20px);
}

input[type='range'] {
  width: 100%;
  accent-color: #6366f1;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}
</style>

