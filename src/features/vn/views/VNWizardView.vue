<template>
  <div class="vn-theme-page absolute inset-0 z-20 bg-[#f8fafc] flex flex-col">
    <!-- Header -->
    <header
      class="vn-theme-header bg-white/80 backdrop-blur-xl px-5 flex items-center gap-3 border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <button @click="handleBack" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 bg-gray-50 active:scale-90 transition-transform">
        <i class="ph-bold ph-caret-left"></i>
      </button>
      <h1 class="text-xl font-black text-gray-900">新建项目</h1>
    </header>

    <!-- Step Indicator -->
    <div class="px-8 py-6 flex items-center justify-between relative">
      <div class="absolute top-1/2 left-12 right-12 h-[2px] bg-gray-100 -translate-y-1/2 z-0"></div>

      <div v-for="s in steps" :key="s.num" class="relative z-10 flex flex-col items-center gap-2">
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300"
          :class="stepClass(s.num)"
        >
          <i v-if="step > s.num" class="ph ph-check text-sm font-bold"></i>
          <span v-else>{{ s.num }}</span>
        </div>
        <span
          class="text-[10px] font-medium absolute top-11 whitespace-nowrap transition-colors"
          :class="step === s.num ? 'text-indigo-600 font-bold' : 'text-gray-400'"
        >
          {{ s.label }}
        </span>
      </div>
    </div>

    <!-- Step Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar pt-4">
      <transition name="step-fade" mode="out-in">
        <VNWizardStep1
          v-if="step === 1"
          :key="1"
          v-model:name="form.name"
          @next="step = 2"
        />
        <VNWizardStep2
          v-else-if="step === 2"
          :key="2"
          :characters="form.characters"
          :world-setting="form.worldSetting"
          @update:characters="form.characters = $event"
          @next="step = 3"
        />
        <VNWizardStep3
          v-else-if="step === 3"
          :key="3"
          v-model:world-setting="form.worldSetting"
          @next="step = 4"
        />
        <VNWizardStep4
          v-else-if="step === 4"
          :key="4"
          :form="form"
          @create="createAndContinue"
          @create-with-prepare="createAndPrepare"
        />
      </transition>
    </div>

    <!-- Bottom Nav -->
    <div class="vn-theme-bottom-fade px-5 pb-8 pt-4 flex items-center gap-3 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent">
      <button
        v-if="step > 1"
        class="flex-1 h-14 rounded-2xl border border-gray-200 bg-white font-semibold text-gray-600 active:scale-[0.97] transition-all"
        @click="step--"
      >
        上一步
      </button>
      <button
        v-if="step < 4"
        class="h-14 rounded-2xl font-semibold text-white shadow-lg shadow-indigo-100 active:scale-[0.97] transition-all disabled:opacity-40"
        :class="step > 1 ? 'flex-[2]' : 'flex-1'"
        :style="{ background: canNext ? 'linear-gradient(to right, #818cf8, #6366f1)' : '' }"
        :disabled="!canNext"
        @click="step++"
      >
        下一步
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'

import VNWizardStep1 from '../components/wizard/VNWizardStep1.vue'
import VNWizardStep2 from '../components/wizard/VNWizardStep2.vue'
import VNWizardStep3 from '../components/wizard/VNWizardStep3.vue'
import VNWizardStep4 from '../components/wizard/VNWizardStep4.vue'

const router = useRouter()
const vnStore = useVNStore()
const { scheduleSave } = useStorage()

const step = ref(1)

const steps = [
  { num: 1, label: '项目名称' },
  { num: 2, label: '选择角色' },
  { num: 3, label: '故事设定' },
  { num: 4, label: '确认开始' }
]

const form = reactive({
  name: '',
  worldSetting: '',
  characters: []
})

const canNext = computed(() => {
  if (step.value === 1) return form.name.trim().length > 0
  if (step.value === 2) return form.characters.length > 0
  return true
})

function stepClass(num) {
  if (step.value > num) return 'bg-indigo-500 text-white'
  if (step.value === num) return 'bg-indigo-500/20 text-indigo-600 ring-2 ring-indigo-500/40'
  return 'bg-white border-2 border-gray-200 text-gray-400'
}

function handleBack() {
  if (step.value > 1) {
    step.value--
  } else {
    router.push('/vn')
  }
}

function createProject() {
  const payload = {
    name: form.name.trim() || '未命名项目',
    worldSetting: form.worldSetting || '',
    characters: JSON.parse(JSON.stringify(form.characters || []))
  }
  const p = vnStore.createProject(payload)
  scheduleSave()
  return p.id
}

function createAndContinue() {
  const id = createProject()
  vnStore.setCurrentProject(id)
  router.push(`/vn/play/${id}`)
}

function createAndPrepare() {
  const id = createProject()
  vnStore.setCurrentProject(id)
  router.push(`/vn/prepare/${id}`)
}
</script>

<style scoped>
.step-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.step-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.step-fade-enter-from { opacity: 0; transform: translateY(8px); }
.step-fade-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
