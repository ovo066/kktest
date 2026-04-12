<template>
  <Transition name="slide-up">
    <div v-if="visible" class="fixed inset-0 z-[800] flex flex-col justify-end">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="$emit('close')"></div>

      <!-- Panel -->
      <div
        class="relative w-full max-h-[70vh] flex flex-col rounded-t-[20px] shadow-2xl overflow-hidden"
        :style="{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b" :style="{ borderColor: 'var(--border-color)' }">
          <div class="flex items-center gap-2">
            <button
              v-if="selectedGift || showAddForm"
              class="p-1 -ml-1 hover:opacity-70 transition-opacity"
              @click="goBack"
            >
              <i class="ph ph-arrow-left text-xl"></i>
            </button>
            <h3 class="text-[17px] font-bold">
              {{ showAddForm ? '添加自定义礼物' : selectedGift ? '礼物详情' : '礼物商城' }}
            </h3>
          </div>
          <button class="p-1 hover:opacity-70 transition-opacity" @click="$emit('close')">
            <i class="ph ph-x text-xl"></i>
          </button>
        </div>

        <!-- Main Content -->
        <div class="flex-1 overflow-hidden flex flex-col">
          <!-- Add Custom Gift Form -->
          <template v-if="showAddForm">
            <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 no-scrollbar">
              <!-- Image Upload -->
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
                  :style="{ borderColor: newGift.image ? 'transparent' : 'var(--border-color)', background: 'rgba(0,0,0,0.03)' }"
                  @click="triggerImageUpload"
                >
                  <img v-if="newGift.image" :src="newGift.image" class="w-full h-full object-cover">
                  <div v-else class="flex flex-col items-center gap-1 text-[var(--text-secondary)]">
                    <i class="ph ph-camera text-2xl"></i>
                    <span class="text-[11px]">上传图片</span>
                  </div>
                </div>
                <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload">
              </div>

              <!-- Name -->
              <div>
                <label class="text-[13px] font-medium mb-1 block" :style="{ color: 'var(--text-secondary)' }">名称 *</label>
                <input
                  v-model="newGift.name"
                  type="text"
                  placeholder="礼物名称"
                  maxlength="20"
                  class="w-full px-4 py-2.5 rounded-xl border outline-none text-[15px]"
                  :style="{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }"
                >
                <div v-if="newGiftNameError" class="mt-1 text-[12px]" style="color: #ff3b30;">{{ newGiftNameError }}</div>
              </div>

              <!-- Description -->
              <div>
                <label class="text-[13px] font-medium mb-1 block" :style="{ color: 'var(--text-secondary)' }">描述</label>
                <input
                  v-model="newGift.description"
                  type="text"
                  placeholder="一句话描述"
                  maxlength="50"
                  class="w-full px-4 py-2.5 rounded-xl border outline-none text-[15px]"
                  :style="{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }"
                >
              </div>

              <!-- Price -->
              <div>
                <label class="text-[13px] font-medium mb-1 block" :style="{ color: 'var(--text-secondary)' }">价格</label>
                <input
                  v-model="newGift.price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full px-4 py-2.5 rounded-xl border outline-none text-[15px]"
                  :style="{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }"
                >
              </div>

              <button
                class="w-full py-3 rounded-2xl font-bold text-[16px] text-white shadow-lg active:scale-[0.98] transition-transform mt-2"
                :style="{ backgroundColor: canAddGift ? 'var(--primary-color, #007AFF)' : 'gray' }"
                :disabled="!canAddGift"
                @click="confirmAddGift"
              >
                添加礼物
              </button>
            </div>
          </template>

          <!-- Gift List -->
          <template v-else-if="!selectedGift">
            <!-- Categories Tab Bar -->
            <div class="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0">
              <button
                v-for="cat in allCategories"
                :key="cat.id"
                class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm transition-all shrink-0"
                :style="activeCategory === cat.id ? activeTabStyle : inactiveTabStyle"
                @click="activeCategory = cat.id"
              >
                <i :class="['ph', cat.icon, 'text-base']"></i>
                <span>{{ cat.name }}</span>
              </button>
            </div>

            <!-- Gift List Grid -->
            <div class="flex-1 overflow-y-auto px-4 pb-6 no-scrollbar">
              <div class="grid grid-cols-2 gap-3">
                <!-- Add Custom Gift Card (shown in custom category or all) -->
                <div
                  v-if="activeCategory === 'custom' || activeCategory === 'all'"
                  class="flex flex-col rounded-xl border overflow-hidden transition-transform active:scale-[0.97] cursor-pointer"
                  :style="{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }"
                  @click="showAddForm = true"
                >
                  <div class="aspect-square flex items-center justify-center p-4" style="background: rgba(0,0,0,0.03);">
                    <div class="flex flex-col items-center gap-2 text-[var(--text-secondary)]">
                      <i class="ph ph-plus-circle text-4xl"></i>
                      <span class="text-[13px]">添加自定义礼物</span>
                    </div>
                  </div>
                  <div class="p-3 border-t" :style="{ borderColor: 'var(--border-color)' }">
                    <div class="text-[15px] font-bold" :style="{ color: 'var(--text-primary)' }">自定义</div>
                    <div class="text-[12px] mt-0.5" :style="{ color: 'var(--text-secondary)' }">创建你的专属礼物</div>
                  </div>
                </div>

                <div
                  v-for="gift in filteredGifts"
                  :key="gift.id"
                  class="relative flex flex-col rounded-xl border overflow-hidden transition-transform active:scale-[0.97]"
                  :style="{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }"
                  @click="selectGift(gift)"
                >
                  <!-- Delete button for custom gifts -->
                  <button
                    v-if="gift.category === 'custom'"
                    class="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white"
                    @click.stop="deleteCustomGift(gift.id)"
                  >
                    <i class="ph ph-x text-xs"></i>
                  </button>

                  <!-- Image Area -->
                  <div class="aspect-square flex items-center justify-center p-4" style="background: rgba(0,0,0,0.03);">
                    <img
                      v-if="gift.image"
                      :src="gift.image"
                      :alt="gift.name"
                      class="w-16 h-16 object-contain rounded-lg"
                    >
                    <img
                      v-else
                      :src="'/gifts/' + gift.id + '.svg'"
                      :alt="gift.name"
                      class="w-16 h-16 object-contain"
                      @error="(e) => e.target.style.display='none'"
                    >
                  </div>
                  <!-- Info Area -->
                  <div class="p-3 border-t" :style="{ borderColor: 'var(--border-color)' }">
                    <div class="text-[15px] font-bold truncate" :style="{ color: 'var(--text-primary)' }">{{ gift.name }}</div>
                    <div class="text-[12px] truncate mt-0.5" :style="{ color: 'var(--text-secondary)' }">{{ gift.description }}</div>
                    <div v-if="gift.price != null" class="text-[15px] font-bold mt-1" style="color: #FF6B35;">¥{{ gift.price }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Detail View -->
          <template v-else>
            <div class="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center no-scrollbar">
              <div class="w-32 h-32 flex items-center justify-center rounded-2xl mb-5 overflow-hidden" style="background: rgba(0,0,0,0.03);">
                <img
                  v-if="selectedGift.image"
                  :src="selectedGift.image"
                  :alt="selectedGift.name"
                  class="w-24 h-24 object-contain rounded-xl"
                >
                <img
                  v-else
                  :src="'/gifts/' + selectedGift.id + '.svg'"
                  :alt="selectedGift.name"
                  class="w-24 h-24 object-contain"
                >
              </div>

              <div class="text-center w-full">
                <h2 class="text-[20px] font-bold mb-1" :style="{ color: 'var(--text-primary)' }">{{ selectedGift.name }}</h2>
                <div v-if="selectedGift.price != null" class="text-[22px] font-bold mb-2" style="color: #FF6B35;">¥{{ selectedGift.price }}</div>
                <p v-if="selectedGift.description" class="text-[14px] leading-relaxed mb-6" :style="{ color: 'var(--text-secondary)' }">{{ selectedGift.description }}</p>
              </div>

              <!-- Message Input -->
              <div class="w-full mb-5">
                <input
                  ref="messageInput"
                  v-model="giftMessage"
                  type="text"
                  placeholder="写一句祝福语..."
                  maxlength="50"
                  class="w-full px-4 py-3 rounded-xl border outline-none text-[15px]"
                  :style="{
                    backgroundColor: 'transparent',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }"
                  @keyup.enter="handleSend"
                >
              </div>

              <!-- Send Button -->
              <button
                class="w-full py-3.5 rounded-2xl font-bold text-[16px] text-white shadow-lg active:scale-[0.98] transition-transform"
                :style="{ backgroundColor: 'var(--primary-color, #007AFF)' }"
                @click="handleSend"
              >
                送出礼物
              </button>
            </div>
          </template>
        </div>

        <!-- Bottom Safety Area -->
        <div class="h-[env(safe-area-inset-bottom,8px)]"></div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { getAllGifts, GIFT_CATEGORIES } from '../composables/useMessageParser'
import { createGiftSnapshot } from '../../../data/gifts'
import { useGiftsStore } from '../../../stores/gifts'
import { useStorage } from '../../../composables/useStorage'
import { makeId } from '../../../utils/id'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close', 'send'])

const giftsStore = useGiftsStore()
const { scheduleSave } = useStorage()

const activeCategory = ref('all')
const selectedGift = ref(null)
const giftMessage = ref('')
const messageInput = ref(null)
const showAddForm = ref(false)
const imageInput = ref(null)

const newGift = ref({ name: '', description: '', price: '', image: '' })

const CUSTOM_GIFT_NAME_FORBIDDEN_REGEX = /[%:：()[\]（）【】\r\n]/

const newGiftNameError = computed(() => {
  const name = String(newGift.value.name || '').trim()
  if (!name) return ''
  if (CUSTOM_GIFT_NAME_FORBIDDEN_REGEX.test(name)) {
    return '名称不能包含 %、冒号或括号'
  }
  const normalized = name.toLowerCase()
  const exists = getAllGifts().some(g => String(g?.name || '').trim().toLowerCase() === normalized)
  return exists ? '礼物名称已存在' : ''
})

const canAddGift = computed(() => newGift.value.name.trim().length > 0 && !newGiftNameError.value)

const allCategories = computed(() => [
  { id: 'all', name: '全部', icon: 'ph-squares-four' },
  ...GIFT_CATEGORIES,
  { id: 'custom', name: '自定义', icon: 'ph-star' }
])

const filteredGifts = computed(() => {
  const all = getAllGifts()
  if (activeCategory.value === 'all') return all
  return all.filter(g => g.category === activeCategory.value)
})

const activeTabStyle = computed(() => ({
  backgroundColor: 'var(--primary-color, #007AFF)',
  color: 'white'
}))

const inactiveTabStyle = computed(() => ({
  backgroundColor: 'rgba(128, 128, 128, 0.1)',
  color: 'var(--text-secondary)'
}))

watch(() => props.visible, (v) => {
  if (!v) {
    setTimeout(() => {
      selectedGift.value = null
      giftMessage.value = ''
      activeCategory.value = 'all'
      showAddForm.value = false
      resetNewGift()
    }, 300)
  }
})

function goBack() {
  if (showAddForm.value) {
    showAddForm.value = false
    resetNewGift()
  } else {
    selectedGift.value = null
  }
}

function resetNewGift() {
  newGift.value = { name: '', description: '', price: '', image: '' }
}

function selectGift(gift) {
  selectedGift.value = gift
  giftMessage.value = ''
  nextTick(() => messageInput.value?.focus())
}

function triggerImageUpload() {
  imageInput.value?.click()
}

function handleImageUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    newGift.value.image = reader.result
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function confirmAddGift() {
  if (!canAddGift.value) return
  const price = newGift.value.price ? parseFloat(newGift.value.price) : null
  const gift = {
    id: makeId('gift'),
    name: newGift.value.name.trim(),
    description: newGift.value.description.trim() || '',
    price: (price != null && !isNaN(price) && price >= 0) ? price : null,
    image: newGift.value.image || '',
    category: 'custom',
    aliases: []
  }
  giftsStore.addCustomGift(gift)
  scheduleSave()
  showAddForm.value = false
  resetNewGift()
  activeCategory.value = 'custom'
}

function deleteCustomGift(id) {
  giftsStore.removeCustomGift(id)
  scheduleSave()
}

function handleSend() {
  if (!selectedGift.value) return
  emit('send', {
    item: selectedGift.value.name,
    message: giftMessage.value.trim(),
    giftSnapshot: createGiftSnapshot(selectedGift.value.name) || {
      id: String(selectedGift.value.id || '').trim(),
      name: String(selectedGift.value.name || '').trim(),
      description: String(selectedGift.value.description || ''),
      price: selectedGift.value.price ?? null,
      image: String(selectedGift.value.image || ''),
      category: String(selectedGift.value.category || '').trim() || null
    }
  })
  emit('close')
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
/* Hide number input spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
</style>
