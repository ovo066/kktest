<template>
  <div class="absolute inset-0 z-20 bg-[#F2F2F7] dark:bg-black flex flex-col">
    <div class="pt-app-lg pb-2 px-4 flex items-end justify-between">
      <h1 class="text-3xl font-bold text-black dark:text-white">面具</h1>
      <button class="text-[#007AFF] font-semibold text-[17px]" @click="router.push('/')">完成</button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <div class="bg-white dark:bg-[#1c1c1e] rounded-[10px] overflow-hidden">
        <button class="w-full px-4 py-3 text-[#007AFF] flex items-center justify-center gap-2" @click="openModal()">
          <i class="ph ph-plus-circle text-xl"></i>
          <span>新建面具</span>
        </button>
      </div>

      <!-- Default Persona -->
      <div class="space-y-2">
        <span class="text-[13px] text-[#8E8E93] uppercase ml-4">全局默认</span>
        <div class="bg-white dark:bg-[#1c1c1e] rounded-[10px] p-4">
          <div v-if="defaultPersona" class="flex items-center gap-3 cursor-pointer" @click="openModal(defaultPersona.id)">
            <div class="w-12 h-12 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-2xl overflow-hidden">
              <img v-if="defaultPersona.avatarType === 'image'" :src="defaultPersona.avatar" class="w-full h-full object-cover">
              <template v-else>{{ defaultPersona.avatar }}</template>
            </div>
            <div class="flex-1">
              <div class="font-semibold text-[17px] text-black dark:text-white">{{ defaultPersona.name }}</div>
              <div v-if="defaultPersona.description" class="text-[13px] text-[#8E8E93]">{{ defaultPersona.description }}</div>
            </div>
            <i class="ph-bold ph-caret-right text-[#C7C7CC]"></i>
          </div>
          <div v-else class="text-center text-[#8E8E93]">未设置默认面具</div>
        </div>
      </div>

      <!-- All Personas -->
      <div class="space-y-2">
        <span class="text-[13px] text-[#8E8E93] uppercase ml-4">所有面具</span>
        <div v-if="store.personas.length === 0" class="bg-white dark:bg-[#1c1c1e] rounded-[10px] p-4 text-center text-[#8E8E93]">
          暂无面具，点击上方创建
        </div>
        <div
          v-for="persona in store.personas"
          :key="persona.id"
          class="bg-white dark:bg-[#1c1c1e] rounded-[10px] p-4 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 flex items-center gap-3"
          @click="openModal(persona.id)"
        >
          <div class="w-12 h-12 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
            <img v-if="persona.avatarType === 'image'" :src="persona.avatar" class="w-full h-full object-cover">
            <template v-else>{{ persona.avatar }}</template>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-[17px] text-black dark:text-white truncate">{{ persona.name }}</div>
            <div v-if="persona.description" class="text-[13px] text-[#8E8E93] truncate">{{ persona.description }}</div>
            <div v-if="persona.id === store.defaultPersonaId" class="text-[11px] text-[#AF52DE]">✓ 全局默认</div>
          </div>
          <i class="ph-bold ph-caret-right text-[#C7C7CC]"></i>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <IosModal
      :visible="modalVisible"
      :title="store.editingPersonaId ? '编辑面具' : '新建面具'"
      :show-delete="!!store.editingPersonaId"
      height="70%"
      @close="closeModal"
      @done="savePersona"
      @delete="deletePersona"
    >
      <div class="p-4 space-y-4">
        <div class="flex flex-col items-center gap-4">
          <input ref="avatarInput" type="file" class="hidden" accept="image/*" @change="handleAvatarChange">
          <div
            class="w-24 h-24 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-4xl relative overflow-hidden cursor-pointer active:scale-95 transition-transform"
            @click="avatarInput?.click()"
          >
            <img v-if="tempAvatar" :src="tempAvatar" class="absolute inset-0 w-full h-full object-cover">
            <span v-else>{{ form.avatar }}</span>
            <div class="absolute bottom-0 w-full text-[10px] text-center bg-black/30 py-1 text-white">编辑</div>
          </div>
          <div class="flex items-center gap-2 text-[#8E8E93]">
            <span class="text-xs">或输入 Emoji:</span>
            <input v-model="form.avatar" type="text" class="w-12 border-b border-gray-300 dark:border-gray-600 bg-transparent text-center outline-none dark:text-white text-xl" maxlength="2" @input="tempAvatar = null">
          </div>
          <button
            class="px-3 py-1.5 rounded-full text-[12px] text-[#007AFF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/20"
            @click="handleAvatarUrlInput"
          >
            头像填URL
          </button>
        </div>
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <input v-model="form.name" type="text" placeholder="面具名称 (必填)" class="w-full px-4 py-3 text-[17px] outline-none border-b border-[#E5E5EA] dark:border-gray-700 bg-transparent dark:text-white">
          <textarea v-model="form.description" rows="3" placeholder="描述（可选，如：我的工作身份）" class="w-full px-4 py-3 text-[15px] outline-none resize-none bg-transparent dark:text-white"></textarea>
        </div>
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <div class="px-4 py-3 flex justify-between items-center">
            <span class="text-[17px] text-black dark:text-white">设为全局默认</span>
            <IosToggle v-model="form.isDefault" active-color="#AF52DE" />
          </div>
        </div>
      </div>
    </IosModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePersonasStore } from '../stores/personas'
import { useStorage } from '../composables/useStorage'
import { useToast } from '../composables/useToast'
import { compressImage } from '../composables/useImage'
import { showConfirm } from '../composables/useConfirm'
import { normalizeImageUrlInput } from '../utils/mediaUrl'
import IosModal from '../components/common/IosModal.vue'
import IosToggle from '../components/common/IosToggle.vue'

const router = useRouter()
const store = usePersonasStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

const modalVisible = ref(false)
const avatarInput = ref(null)
const tempAvatar = ref(null)

const form = reactive({
  name: '',
  description: '',
  avatar: '😊',
  isDefault: false
})

const defaultPersona = computed(() => {
  if (store.defaultPersonaId) {
    return store.personas.find(p => p.id === store.defaultPersonaId)
  }
  return null
})

async function handleAvatarChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    tempAvatar.value = await compressImage(file, 200)
  }
  e.target.value = ''
}

function handleAvatarUrlInput() {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return
  const raw = window.prompt('请输入头像图床 URL（支持 http/https）', tempAvatar.value || '')
  if (raw === null) return
  const url = normalizeImageUrlInput(raw)
  if (url === null) {
    showToast('请输入有效的图片 URL')
    return
  }
  tempAvatar.value = url || null
}

function openModal(personaId = null) {
  store.editingPersonaId = personaId
  tempAvatar.value = null

  if (personaId) {
    const persona = store.personas.find(p => p.id === personaId)
    if (persona) {
      form.name = persona.name
      form.description = persona.description || ''
      form.avatar = persona.avatar || '😊'
      form.isDefault = persona.id === store.defaultPersonaId
      if (persona.avatarType === 'image') {
        tempAvatar.value = persona.avatar
      }
    }
  } else {
    form.name = ''
    form.description = ''
    form.avatar = '😊'
    form.isDefault = false
  }

  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
}

function savePersona() {
  if (!form.name.trim()) {
    showToast('请输入面具名称')
    return
  }

  let avatar = form.avatar.trim() || '😊'
  let avatarType = 'emoji'
  if (tempAvatar.value) {
    avatar = tempAvatar.value
    avatarType = 'image'
  }

  if (store.editingPersonaId) {
    const persona = store.personas.find(p => p.id === store.editingPersonaId)
    if (persona) {
      persona.name = form.name.trim()
      persona.description = form.description.trim()
      persona.avatar = avatar
      persona.avatarType = avatarType
      persona.updatedAt = Date.now()
    }

    if (form.isDefault) {
      store.defaultPersonaId = store.editingPersonaId
    } else if (store.defaultPersonaId === store.editingPersonaId) {
      store.defaultPersonaId = null
    }

    showToast('已更新')
  } else {
    const newPersona = {
      id: 'persona_' + Date.now(),
      name: form.name.trim(),
      description: form.description.trim(),
      avatar,
      avatarType,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    store.personas.push(newPersona)

    if (form.isDefault) {
      store.defaultPersonaId = newPersona.id
    }

    showToast('已创建')
  }

  scheduleSave()
  closeModal()
}

async function deletePersona() {
  if (!store.editingPersonaId) return
  const confirmed = await showConfirm({ message: '确定删除此面具？', destructive: true })
  if (!confirmed) return

  if (store.defaultPersonaId === store.editingPersonaId) {
    store.defaultPersonaId = null
  }

  store.personas = store.personas.filter(p => p.id !== store.editingPersonaId)
  scheduleSave()
  closeModal()
  showToast('已删除')
}
</script>
