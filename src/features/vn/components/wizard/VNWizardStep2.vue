<template>
  <div class="px-4 py-2">
    <div class="flex flex-col items-center text-center mb-6">
      <div class="w-16 h-16 rounded-[24px] bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-100 mb-4">
        <i class="ph ph-users-three text-3xl text-white"></i>
      </div>
      <h2 class="text-xl font-bold text-slate-900">选择角色</h2>
      <p class="text-slate-500 text-sm">选择将出现在故事中的角色</p>
    </div>

    <!-- Contact list -->
    <div class="space-y-3 mb-6">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">可选角色</span>
        <span v-if="characters.length > 0" class="text-xs font-bold text-indigo-600">已选 {{ characters.length }} 个</span>
      </div>

      <div v-if="selectableContacts.length === 0" class="text-slate-400 text-[13px] py-10 text-center">
        暂无可用联系人，请先在聊天中添加角色
      </div>

      <div v-else class="space-y-2 max-h-[280px] overflow-y-auto no-scrollbar">
        <div
          v-for="c in selectableContacts"
          :key="c.id"
          class="p-4 rounded-[20px] bg-white border transition-all cursor-pointer flex items-center gap-4"
          :class="isSelected(c.id) ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-gray-100'"
          @click="toggleCharacter(c)"
        >
          <div
            class="w-11 h-11 rounded-xl bg-cover bg-center shrink-0 overflow-hidden"
            :style="{ backgroundImage: c.avatar ? `url('${c.avatar}')` : '' }"
          >
            <div v-if="!c.avatar" class="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-50 flex items-center justify-center">
              <i class="ph ph-user text-slate-400 text-lg"></i>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-slate-900 text-[15px] font-medium truncate">{{ c.name || c.id }}</div>
            <div class="text-slate-400 text-[12px] truncate">{{ c.prompt?.slice(0, 40) || '无描述' }}</div>
          </div>
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
            :class="isSelected(c.id) ? 'bg-indigo-500 text-white' : 'border-2 border-gray-200'"
          >
            <i v-if="isSelected(c.id)" class="ph ph-check text-sm font-bold"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected character editor -->
    <div v-if="characters.length > 0" class="space-y-3 pt-4 border-t border-gray-100">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">配置角色属性</span>
        <button
          v-if="characters.length > 1"
          :disabled="batchGenerating"
          class="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40"
          @click="batchGenerateAll"
        >
          <i class="ph ph-sparkle"></i>
          {{ batchGenerating ? `生成中 ${batchProgress.current}/${batchProgress.total}` : 'AI 补全描述' }}
        </button>
      </div>

      <div class="space-y-3 max-h-[240px] overflow-y-auto no-scrollbar">
        <div
          v-for="ch in characters"
          :key="ch.contactId"
          class="p-5 rounded-[20px] bg-white border border-gray-100 shadow-sm space-y-3"
        >
          <div class="flex items-center gap-3">
            <input
              v-model="ch.vnName"
              type="text"
              class="flex-1 h-9 px-3 rounded-xl bg-gray-50 border border-gray-100 text-slate-900 text-[14px] outline-none focus:border-indigo-400 transition-colors"
              placeholder="显示名称"
            >
            <select
              v-model="ch.role"
              class="h-9 px-2 rounded-xl bg-gray-50 border border-gray-100 text-slate-700 text-[13px] outline-none"
            >
              <option value="protagonist">主角</option>
              <option value="heroine">女主</option>
              <option value="support">配角</option>
            </select>
            <input
              v-model="ch.nameColor"
              type="color"
              class="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer"
              title="名字颜色"
            >
          </div>

          <div class="flex items-center gap-2">
            <select
              v-model="ch.voiceId"
              class="flex-1 h-9 px-2 rounded-xl bg-gray-50 border border-gray-100 text-slate-700 text-[13px] outline-none"
            >
              <option v-for="v in EDGE_VOICES" :key="v.id" :value="v.id">
                {{ v.name }} · {{ v.desc }}
              </option>
            </select>
            <button
              class="h-9 px-3 rounded-xl bg-red-50 text-red-500 text-[12px] font-medium active:scale-95 transition-all"
              @click="removeCharacter(ch.contactId)"
            >
              移除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useContactsStore } from '../../../../stores/contacts'
import { useCharacterGen } from '../../../../composables/useCharacterGen'
import { useTTS } from '../../../../composables/useTTS'

const props = defineProps({
  characters: { type: Array, default: () => [] },
  worldSetting: { type: String, default: '' }
})

const emit = defineEmits(['update:characters', 'next'])

const contactsStore = useContactsStore()
const { batchGeneratePrompts } = useCharacterGen()
const { EDGE_VOICES } = useTTS()

const batchGenerating = ref(false)
const batchProgress = ref({ current: 0, total: 0 })

const selectableContacts = computed(() => {
  const list = contactsStore.contacts || []
  return Array.isArray(list) ? list.filter(c => c && c.id && c.type !== 'group') : []
})

function isSelected(contactId) {
  return props.characters.some(c => c.contactId === contactId)
}

function cleanPrompt(prompt) {
  if (!prompt) return ''
  return String(prompt)
    .replace(/你正在.*?手机聊天.*?\n?/g, '')
    .replace(/输出规则[：:][\s\S]*?(?=\n\n|$)/g, '')
    .replace(/每一行必须.*?\n?/g, '')
    .trim()
}

function toggleCharacter(contact) {
  const list = [...props.characters]
  const idx = list.findIndex(x => x.contactId === contact.id)

  if (idx !== -1) {
    list.splice(idx, 1)
  } else {
    list.push({
      contactId: contact.id,
      vnName: contact.name || contact.id,
      nameColor: '#ffffff',
      role: 'support',
      vnDescription: cleanPrompt(contact.prompt || ''),
      voiceId: EDGE_VOICES?.[0]?.id || 'zh-CN-XiaoxiaoNeural',
      spritePrompt: ''
    })
  }

  emit('update:characters', list)
}

function removeCharacter(contactId) {
  const list = props.characters.filter(x => x.contactId !== contactId)
  emit('update:characters', list)
}

async function batchGenerateAll() {
  if (batchGenerating.value || props.characters.length === 0) return
  batchGenerating.value = true
  batchProgress.value = { current: 0, total: props.characters.length }

  try {
    const results = await batchGeneratePrompts(
      props.characters,
      props.worldSetting,
      (current, total, name) => {
        batchProgress.value = { current, total, name }
      }
    )

    const list = [...props.characters]
    results.forEach(r => {
      if (!r.success) return
      const ch = list.find(c => c.contactId === r.contactId)
      if (!ch) return
      if (r.vnDescription) ch.vnDescription = r.vnDescription
      if (r.spritePrompt) ch.spritePrompt = r.spritePrompt
    })
    emit('update:characters', list)
  } catch (e) {
    console.error('批量生成失败:', e)
  } finally {
    batchGenerating.value = false
  }
}
</script>
