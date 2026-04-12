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
      <h1 class="text-xl font-black text-gray-900">资源准备</h1>
      <button @click="skipAndPlay" class="text-gray-400 text-sm font-medium">跳过</button>
    </header>

    <main class="flex-1 overflow-y-auto p-5 pb-32 space-y-6 no-scrollbar">
      <!-- Progress card -->
      <div class="p-6 rounded-[28px] bg-white border border-gray-100 shadow-lg shadow-gray-100/50">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-bold text-gray-800">{{ projectName }}</h2>
          <span class="text-xs font-bold text-indigo-600">{{ completedCount }} / {{ totalCount }}</span>
        </div>
        <VNProgressBar :value="completedCount" :max="totalCount" />

        <div v-if="currentTask" class="mt-4 flex items-center gap-2 text-indigo-600 font-medium text-sm">
          <i class="ph ph-circle-notch vn-spin"></i>
          {{ currentTask }}
        </div>
      </div>

      <!-- Backgrounds -->
      <section class="space-y-4">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
          <i class="ph ph-image mr-1"></i>
          背景 ({{ backgrounds.length }})
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="bg in backgrounds"
            :key="bg.name"
            class="rounded-[20px] overflow-hidden border border-gray-100 bg-white shadow-sm"
          >
            <div
              class="h-20 bg-cover bg-center relative"
              :style="bg.url ? { backgroundImage: `url('${bg.url}')` } : {}"
            >
              <div v-if="!bg.url" class="absolute inset-0 bg-gray-50 flex items-center justify-center">
                <i v-if="bg.status === 'pending'" class="ph ph-clock text-xl text-gray-200"></i>
                <i v-else-if="bg.status === 'generating'" class="ph ph-circle-notch vn-spin text-xl text-indigo-500"></i>
                <i v-else-if="bg.status === 'error'" class="ph ph-warning text-xl text-red-400"></i>
              </div>
              <div v-if="bg.url" class="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                <i class="ph ph-check text-white text-[10px]"></i>
              </div>
            </div>
            <div class="px-3 py-2">
              <div class="text-gray-800 text-[11px] font-bold truncate">{{ bg.name }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Sprites -->
      <section class="space-y-4">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
          <i class="ph ph-user-circle mr-1"></i>
          立绘 ({{ sprites.length }})
        </h3>
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="sp in sprites"
            :key="sp.key"
            class="rounded-[20px] overflow-hidden border border-gray-100 bg-white shadow-sm"
          >
            <div class="h-24 flex items-center justify-center relative bg-gray-50">
              <img v-if="sp.url" :src="sp.url" class="h-full w-auto object-contain" alt="">
              <template v-else>
                <i v-if="sp.status === 'pending'" class="ph ph-user text-2xl text-gray-200"></i>
                <i v-else-if="sp.status === 'generating'" class="ph ph-circle-notch vn-spin text-xl text-indigo-500"></i>
                <i v-else-if="sp.status === 'error'" class="ph ph-warning text-xl text-red-400"></i>
              </template>
              <div v-if="sp.url" class="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <i class="ph ph-check text-white text-[8px]"></i>
              </div>
            </div>
            <div class="px-2 py-1.5">
              <div class="text-gray-800 text-[10px] font-bold truncate">{{ sp.characterName }}</div>
              <div class="text-gray-400 text-[9px]">{{ sp.expression }}</div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Bottom action -->
    <div class="vn-theme-bottom-fade fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc] to-transparent">
      <button
        v-if="!isGenerating && completedCount < totalCount"
        class="w-full h-14 rounded-2xl bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
        @click="startGeneration"
      >
        <i class="ph ph-play"></i>
        开始生成
      </button>

      <button
        v-else-if="isGenerating"
        class="w-full h-14 rounded-2xl bg-gray-100 text-gray-400 font-bold flex items-center justify-center gap-3"
        disabled
      >
        <i class="ph ph-circle-notch vn-spin"></i>
        生成中...
      </button>

      <button
        v-else
        class="w-full h-14 rounded-2xl bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
        @click="startPlay"
      >
        <i class="ph ph-play"></i>
        开始游戏
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'
import { useCharacterGen } from '../../../composables/useCharacterGen'
import { useImageGen } from '../../../composables/useImageGen'

import VNProgressBar from '../components/VNProgressBar.vue'
import '../vn-animations.css'

const router = useRouter()
const route = useRoute()
const vnStore = useVNStore()
const { scheduleSave } = useStorage()
const { analyzeResourceNeeds } = useCharacterGen()
const { generateBackground, generateSprite } = useImageGen()

const projectId = computed(() => String(route.params.projectId || ''))
const project = computed(() => {
  const list = vnStore.projects || []
  return Array.isArray(list) ? list.find(p => p.id === projectId.value) : null
})
const projectName = computed(() => project.value?.name || 'VN 项目')

// Resource state
const backgrounds = reactive([])
const sprites = reactive([])
const isGenerating = ref(false)
const currentTask = ref('')

const totalCount = computed(() => backgrounds.length + sprites.length)
const completedCount = computed(() => {
  const bgDone = backgrounds.filter(b => b.url).length
  const spDone = sprites.filter(s => s.url).length
  return bgDone + spDone
})

onMounted(async () => {
  if (!project.value) {
    router.replace('/vn')
    return
  }

  vnStore.setCurrentProject(projectId.value)

  const existingBgs = project.value.resources?.backgrounds || {}
  const existingSprites = project.value.resources?.sprites || {}

  try {
    currentTask.value = '分析项目资源需求...'
    const plan = await analyzeResourceNeeds(
      project.value.worldSetting,
      project.value.characters
    )

    if (plan.backgrounds) {
      plan.backgrounds.forEach(bg => {
        const existing = existingBgs[bg.name]
        backgrounds.push({
          name: bg.name,
          prompt: bg.prompt,
          url: existing?.url || null,
          status: existing?.url ? 'done' : 'pending'
        })
      })
    }

    if (plan.sprites) {
      plan.sprites.forEach(sp => {
        const char = project.value.characters.find(c => c.vnName === sp.characterName)
        if (!char) return

        ;(sp.expressions || ['normal']).forEach(expr => {
          const key = `${char.contactId}_${expr}`
          const existing = existingSprites[key]
          sprites.push({
            key,
            characterName: sp.characterName,
            contactId: char.contactId,
            expression: expr,
            url: existing?.url || null,
            status: existing?.url ? 'done' : 'pending'
          })
        })
      })
    }

    currentTask.value = ''
  } catch (e) {
    console.error('分析资源失败:', e)
    project.value.characters.forEach(char => {
      ['normal', 'happy', 'sad'].forEach(expr => {
        const key = `${char.contactId}_${expr}`
        const existing = existingSprites[key]
        sprites.push({
          key,
          characterName: char.vnName,
          contactId: char.contactId,
          expression: expr,
          url: existing?.url || null,
          status: existing?.url ? 'done' : 'pending'
        })
      })
    })
    currentTask.value = ''
  }
})

async function startGeneration() {
  if (isGenerating.value) return
  isGenerating.value = true

  try {
    for (const bg of backgrounds) {
      if (bg.url) continue
      bg.status = 'generating'
      currentTask.value = `生成背景: ${bg.name}`

      try {
        const url = await generateBackground(bg.name, bg.prompt)
        bg.url = url
        bg.status = 'done'
        scheduleSave()
      } catch (e) {
        console.error('生成背景失败:', bg.name, e)
        bg.status = 'error'
      }

      await sleep(500)
    }

    for (const sp of sprites) {
      if (sp.url) continue
      sp.status = 'generating'
      currentTask.value = `生成立绘: ${sp.characterName} - ${sp.expression}`

      try {
        const char = project.value.characters.find(c => c.contactId === sp.contactId)
        if (char) {
          const url = await generateSprite(char, sp.expression)
          sp.url = url
          sp.status = 'done'
          scheduleSave()
        }
      } catch (e) {
        console.error('生成立绘失败:', sp.key, e)
        sp.status = 'error'
      }

      await sleep(500)
    }

    currentTask.value = ''
  } finally {
    isGenerating.value = false
  }
}

function skipAndPlay() {
  router.push(`/vn/play/${projectId.value}`)
}

function startPlay() {
  router.push(`/vn/play/${projectId.value}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
</script>
