<template>
  <Transition name="resource-panel">
    <div v-if="visible" class="absolute inset-0 z-50 flex flex-col bg-[#0a0a0a]">
      <!-- 头部 -->
      <div class="absolute top-0 left-0 right-0 z-20 px-4 pt-app pb-2 pointer-events-none">
        <div class="pointer-events-auto flex items-center justify-between glass-panel rounded-2xl px-4 py-3">
          <button class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/60 active:scale-90 active:bg-white/15 transition-all" @click="$emit('close')">
            <i class="ph ph-arrow-left text-base"></i>
          </button>
          <div class="flex flex-col items-center">
            <span class="text-white/90 text-[14px] font-semibold">素材管理</span>
            <span class="text-[9px] text-white/30 font-medium tracking-wider uppercase">Resources</span>
          </div>
          <div class="w-8"></div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-8 pt-[calc(var(--app-pt)+76px)] no-scrollbar space-y-5">

        <!-- ======== 角色资源工作室入口 ======== -->
        <section class="glass-panel rounded-[20px] p-4 relative overflow-hidden">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
              <i class="ph ph-magic-wand text-lg text-purple-300"></i>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-white/85 text-[13px] font-semibold">角色资源工作室</h3>
              <div class="text-[10px] text-white/35 mt-0.5">
                {{ hasCharacterResources ? '已有立绘，点击管理' : '用 AI 批量生成立绘和表情' }}
              </div>
            </div>
            <button
              class="h-8 px-4 rounded-xl bg-purple-500/15 border border-purple-500/20 text-purple-300 text-[11px] font-medium active:scale-95 transition-all"
              @click="goToStudio"
            >
              前往
            </button>
          </div>
        </section>

        <!-- ======== 角色形象（模拟视频用） ======== -->
        <section class="glass-panel rounded-[20px] p-4 relative overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/8">
                <i class="ph ph-user-focus text-white/60 text-sm"></i>
              </div>
              <div>
                <h3 class="text-white/85 text-[13px] font-semibold">角色形象</h3>
                <div class="text-[10px] text-white/35">模拟视频通话的画面</div>
              </div>
            </div>
            <button
              class="h-7 px-3 rounded-full bg-white/5 border border-white/8 text-[11px] text-white/60 flex items-center gap-1 active:scale-95 hover:bg-white/10 transition-all"
              @click="addCharacterImage"
            >
              <i class="ph-bold ph-plus text-[10px]"></i>
              <span>设置</span>
            </button>
          </div>

          <div v-if="!characterImageUrl" class="flex flex-col items-center justify-center py-8 border border-dashed border-white/8 rounded-2xl bg-white/[0.02]">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <i class="ph ph-video-camera text-xl text-white/15"></i>
            </div>
            <p class="text-white/30 text-xs mb-0.5">暂未设置角色形象</p>
            <p class="text-white/15 text-[10px]">设置后用作模拟视频画面</p>
          </div>

          <div v-else class="relative group">
            <div class="aspect-[3/4] max-w-[200px] mx-auto rounded-2xl overflow-hidden bg-black/30 border border-white/8 shadow-lg">
              <img :src="characterImageUrl" class="w-full h-full object-cover" @error="handleImgError">
            </div>
            <button
              class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white active:scale-90"
              @click="removeCharImage"
            >
              <i class="ph-bold ph-x text-[9px]"></i>
            </button>
            <div class="text-center text-[10px] text-white/35 mt-2">视频通话主画面</div>
          </div>
        </section>

        <!-- ======== 角色立绘（Galgame 用） ======== -->
        <section class="glass-panel rounded-[20px] p-4 relative overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/8">
                <i class="ph ph-user-rectangle text-white/60 text-sm"></i>
              </div>
              <div>
                <h3 class="text-white/85 text-[13px] font-semibold">角色立绘</h3>
                <div class="text-[10px] text-white/35">{{ spriteEntries.length }} 个表情</div>
              </div>
            </div>
            <button
              class="h-7 px-3 rounded-full bg-white/5 border border-white/8 text-[11px] text-white/60 flex items-center gap-1 active:scale-95 hover:bg-white/10 transition-all"
              @click="addSprite"
            >
              <i class="ph-bold ph-plus text-[10px]"></i>
              <span>添加</span>
            </button>
          </div>

          <div v-if="spriteEntries.length === 0" class="flex flex-col items-center justify-center py-8 border border-dashed border-white/8 rounded-2xl bg-white/[0.02]">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <i class="ph ph-mask-happy text-xl text-white/15"></i>
            </div>
            <p class="text-white/30 text-xs mb-0.5">暂无立绘</p>
            <p class="text-white/15 text-[10px]">Galgame 模式使用</p>
          </div>

          <div v-else class="grid grid-cols-3 gap-2.5">
            <div
              v-for="[expression, url] in spriteEntries"
              :key="expression"
              class="relative group"
            >
              <div class="aspect-[3/4] rounded-xl overflow-hidden bg-black/20 border border-white/8 transition-all duration-300 hover:scale-[1.02] hover:border-white/15">
                <img :src="url" class="w-full h-full object-cover" @error="handleImgError">
                <button
                  class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white active:scale-90"
                  @click="removeSprite(expression)"
                >
                  <i class="ph-bold ph-x text-[8px]"></i>
                </button>
              </div>
              <div class="text-center text-[10px] text-white/40 mt-1.5 truncate px-0.5">{{ expression }}</div>
            </div>
          </div>
        </section>

        <!-- ======== 背景图片 ======== -->
        <section class="glass-panel rounded-[20px] p-4 relative overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/8">
                <i class="ph ph-image text-white/60 text-sm"></i>
              </div>
              <div>
                <h3 class="text-white/85 text-[13px] font-semibold">通话背景</h3>
                <div class="text-[10px] text-white/35">{{ backgrounds.length }} 张</div>
              </div>
            </div>
            <button
              class="h-7 px-3 rounded-full bg-white/5 border border-white/8 text-[11px] text-white/60 flex items-center gap-1 active:scale-95 hover:bg-white/10 transition-all"
              @click="addBackground"
            >
              <i class="ph-bold ph-plus text-[10px]"></i>
              <span>添加</span>
            </button>
          </div>

          <div v-if="backgrounds.length === 0" class="flex flex-col items-center justify-center py-8 border border-dashed border-white/8 rounded-2xl bg-white/[0.02]">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <i class="ph ph-images text-xl text-white/15"></i>
            </div>
            <p class="text-white/30 text-xs">暂无背景</p>
          </div>

          <div v-else class="grid grid-cols-2 gap-2.5">
            <div
              v-for="(url, idx) in backgrounds"
              :key="idx"
              class="relative group cursor-pointer"
              @click="selectBg(url)"
            >
              <div
                class="aspect-video rounded-xl overflow-hidden bg-black/20 border transition-all duration-300"
                :class="url === selectedBg
                  ? 'border-white/25 shadow-[0_0_12px_-3px_rgba(255,255,255,0.15)]'
                  : 'border-white/8 group-hover:border-white/15'"
              >
                <img :src="url" class="w-full h-full object-cover" @error="handleImgError">
                <div v-if="url === selectedBg" class="absolute top-1.5 left-1.5 h-4 px-1.5 rounded bg-white/20 backdrop-blur-md text-white text-[9px] font-medium flex items-center gap-1">
                  <span class="w-1 h-1 rounded-full bg-white/80"></span>
                  使用中
                </div>
              </div>
              <button
                class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white active:scale-90 z-20"
                @click.stop="removeBg(url)"
              >
                <i class="ph-bold ph-x text-[8px]"></i>
              </button>
            </div>
          </div>
        </section>

        <!-- ======== 批量导入 ======== -->
        <section class="glass-panel rounded-[20px] p-4 relative overflow-hidden">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/8">
              <i class="ph ph-download-simple text-white/60 text-sm"></i>
            </div>
            <h3 class="text-white/85 text-[13px] font-semibold">批量导入</h3>
          </div>

          <textarea
            v-model="batchText"
            class="w-full h-24 glass-input rounded-xl px-3 py-2.5 text-white/80 text-[12px] placeholder-white/20 outline-none resize-none leading-relaxed font-mono"
            placeholder="格式：&#10;表情名:图片URL&#10;直接粘贴URL为背景图"
          ></textarea>

          <button
            class="mt-3 w-full h-10 rounded-xl bg-white/5 border border-white/8 text-white/60 text-[12px] font-medium active:scale-[0.98] hover:bg-white/8 transition-all flex items-center justify-center gap-1.5"
            @click="handleBatchImport"
          >
            <i class="ph-bold ph-arrow-down-to-line text-xs"></i>
            执行导入
          </button>
        </section>
      </div>

      <!-- 隐藏文件输入 -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileSelected"
      >
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCallState } from '../composables/useCallState'
import { useCharacterResourcesStore } from '../../../stores/characterResources'

const props = defineProps({
  visible: { type: Boolean, default: false },
  contactId: { type: String, default: '' }
})

const emit = defineEmits(['close'])
const router = useRouter()
const charResStore = useCharacterResourcesStore()

const {
  getContactResources, setSprite, removeSprite: removeCallSprite,
  addBackground: addCallBg, removeBackground: removeCallBg,
  setCharacterImage, removeCharacterImage,
  currentBgUrl
} = useCallState()

const batchText = ref('')
const fileInput = ref(null)
const pendingAction = ref(null)

const resources = computed(() => getContactResources(props.contactId))

// Merge call sprites with character resources sprites
const spriteEntries = computed(() => {
  const callSprites = Object.entries(resources.value?.sprites || {})
  const charEntry = charResStore.getEntry(props.contactId)
  if (!charEntry) return callSprites

  // Build merged map: call resources take priority
  const merged = new Map()
  // Add character resources first (base + expressions)
  if (charEntry.baseImage?.url) {
    merged.set('normal', charEntry.baseImage.url)
  }
  if (charEntry.expressions) {
    for (const [name, data] of Object.entries(charEntry.expressions)) {
      if (data?.url) merged.set(name, data.url)
    }
  }
  // Call resources override
  for (const [name, url] of callSprites) {
    merged.set(name, url)
  }
  return Array.from(merged.entries())
})

const backgrounds = computed(() => resources.value?.backgrounds || [])
const selectedBg = computed(() => currentBgUrl.value)
const characterImageUrl = computed(() => resources.value?.characterImage || '')

const hasCharacterResources = computed(() => {
  const entry = charResStore.getEntry(props.contactId)
  return !!(entry?.baseImage?.url)
})

function goToStudio() {
  emit('close')
  router.push(`/vn/studio/${props.contactId}`)
}

function addCharacterImage() {
  pendingAction.value = { type: 'character' }
  const url = prompt('粘贴角色形象图片URL（或点取消选择本地图片）：')
  if (url && url.trim()) {
    setCharacterImage(props.contactId, url.trim())
    pendingAction.value = null
  } else {
    fileInput.value?.click()
  }
}

function removeCharImage() {
  removeCharacterImage(props.contactId)
}

function addSprite() {
  const expression = prompt('输入表情名称（如 normal, happy, sad, angry...）：')
  if (!expression) return
  pendingAction.value = { type: 'sprite', expression: expression.trim().toLowerCase() }

  const url = prompt('粘贴图片URL（或点取消选择本地图片）：')
  if (url && url.trim()) {
    setSprite(props.contactId, expression.trim().toLowerCase(), url.trim())
    pendingAction.value = null
  } else {
    fileInput.value?.click()
  }
}

function removeSprite(expression) {
  removeCallSprite(props.contactId, expression)
}

function addBackground() {
  pendingAction.value = { type: 'background' }
  const url = prompt('粘贴背景图片URL（或点取消选择本地图片）：')
  if (url && url.trim()) {
    addCallBg(props.contactId, url.trim())
    pendingAction.value = null
  } else {
    fileInput.value?.click()
  }
}

function removeBg(url) {
  removeCallBg(props.contactId, url)
}

function selectBg(url) {
  currentBgUrl.value = url
}

function handleFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) {
    pendingAction.value = null
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result
    if (pendingAction.value?.type === 'character') {
      setCharacterImage(props.contactId, dataUrl)
    } else if (pendingAction.value?.type === 'sprite') {
      setSprite(props.contactId, pendingAction.value.expression, dataUrl)
    } else if (pendingAction.value?.type === 'background') {
      addCallBg(props.contactId, dataUrl)
    }
    pendingAction.value = null
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function handleBatchImport() {
  const text = batchText.value.trim()
  if (!text) return

  let count = 0
  const lines = text.split('\n').filter(l => l.trim())
  for (const line of lines) {
    const trimmed = line.trim()
    const colonIdx = trimmed.indexOf(':')
    const cnColonIdx = trimmed.indexOf('：')
    let sepIdx = -1

    if (colonIdx !== -1 && cnColonIdx !== -1) {
      sepIdx = Math.min(colonIdx, cnColonIdx)
    } else {
      sepIdx = colonIdx !== -1 ? colonIdx : cnColonIdx
    }

    if (sepIdx !== -1 && trimmed.charAt(sepIdx + 1) === '/' && trimmed.charAt(sepIdx + 2) === '/') {
      addCallBg(props.contactId, trimmed)
      count++
      continue
    }

    if (sepIdx !== -1 && sepIdx > 0) {
      const expression = trimmed.slice(0, sepIdx).trim().toLowerCase()
      const url = trimmed.slice(sepIdx + 1).trim()
      if (expression && url) {
        setSprite(props.contactId, expression, url)
        count++
        continue
      }
    }

    if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
      addCallBg(props.contactId, trimmed)
      count++
    }
  }

  if (count > 0) {
    batchText.value = ''
  }
}

function handleImgError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.resource-panel-enter-active,
.resource-panel-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.resource-panel-enter-from,
.resource-panel-leave-to {
  transform: translateY(100%) scale(0.95);
  opacity: 0;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
