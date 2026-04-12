<template>
  <div class="fixed inset-0 z-50 bg-[#F2F2F7] dark:bg-black flex flex-col">
    <!-- Header -->
    <div class="pt-app-lg pb-2 px-4 flex items-end justify-between border-b border-[#E5E5EA] dark:border-gray-700">
      <h1 class="text-xl font-bold text-black dark:text-white">桌面小组件</h1>
      <button class="text-[#007AFF] font-semibold text-[17px]" @click="emit('close')">完成</button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <!-- 预设布局说明 -->
      <div class="bg-[#E8F4FD] dark:bg-[#1a3a4a] rounded-xl p-4">
        <div class="text-[14px] text-[#0066CC] dark:text-[#4DA6FF]">
          <i class="ph ph-info mr-1"></i>
          预设布局模式
        </div>
        <div class="text-[13px] text-[#0066CC]/80 dark:text-[#4DA6FF]/80 mt-1">
          首页采用固定美化布局，点击各组件直接编辑内容。以下是各个预设位置的配置状态。
        </div>
      </div>

      <!-- 预设槽位列表 -->
      <div class="space-y-3">
        <div class="text-[13px] text-[#8E8E93] uppercase ml-1">预设组件位置</div>

        <div
          v-for="slot in presetSlots"
          :key="slot.id"
          class="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 flex items-center gap-4"
        >
          <!-- 图标 -->
          <div class="w-12 h-12 rounded-xl flex items-center justify-center"
            :class="getSlotWidget(slot.id) ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'"
          >
            <span class="text-2xl">{{ slot.icon }}</span>
          </div>

          <!-- 信息 -->
          <div class="flex-1 min-w-0">
            <div class="text-[15px] font-medium text-black dark:text-white">
              {{ slot.name }}
            </div>
            <div class="text-[13px] text-[#8E8E93]">
              {{ slot.description }}
            </div>
          </div>

          <!-- 状态 -->
          <div class="flex items-center gap-2">
            <span
              class="text-[12px] px-2 py-1 rounded-full"
              :class="getSlotWidget(slot.id)
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
            >
              {{ getSlotWidget(slot.id) ? '已配置' : '默认' }}
            </span>
            <button
              v-if="getSlotWidget(slot.id)"
              class="w-8 h-8 flex items-center justify-center text-red-500 active:bg-red-50 dark:active:bg-red-900/20 rounded-full"
              @click="resetSlot(slot.id)"
            >
              <i class="ph ph-arrow-counter-clockwise text-lg"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 添加名言组件 -->
      <div class="space-y-3">
        <div class="text-[13px] text-[#8E8E93] uppercase ml-1">可选组件</div>

        <div class="bg-white dark:bg-[#1c1c1e] rounded-xl p-4 flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center"
            :class="getSlotWidget('quote') ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'"
          >
            <span class="text-2xl">💬</span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="text-[15px] font-medium text-black dark:text-white">名言卡片</div>
            <div class="text-[13px] text-[#8E8E93]">显示在便签下方的名言引用</div>
          </div>

          <button
            v-if="!getSlotWidget('quote')"
            class="px-3 py-1.5 bg-[#007AFF] text-white text-[13px] rounded-full"
            @click="addQuote"
          >
            添加
          </button>
          <button
            v-else
            class="px-3 py-1.5 bg-red-500 text-white text-[13px] rounded-full"
            @click="resetSlot('quote')"
          >
            移除
          </button>
        </div>
      </div>

      <div class="h-8"></div>
    </div>
  </div>
</template>

<script setup>
import { useWidgetsStore } from '../../stores/widgets'
import { useStorage } from '../../composables/useStorage'
import { useToast } from '../../composables/useToast'
import { showConfirm } from '../../composables/useConfirm'

const emit = defineEmits(['close'])

const widgetsStore = useWidgetsStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

const presetSlots = [
  { id: 'weather', name: '天气组件', icon: '☀️', description: '显示城市和温度' },
  { id: 'clock', name: '时钟组件', icon: '🕐', description: '左上角小图标' },
  { id: 'calendar', name: '日历组件', icon: '📅', description: '右上角小图标' },
  { id: 'image1', name: '照片1', icon: '📷', description: '左侧拍立得照片' },
  { id: 'image2', name: '照片2', icon: '📷', description: '右侧拍立得照片' },
  { id: 'todo', name: '便签组件', icon: '📝', description: 'TODO 待办清单' }
]

function getSlotWidget(slotId) {
  return widgetsStore.widgets.find(w => w.config?.slot === slotId) || null
}

async function resetSlot(slotId) {
  const confirmed = await showConfirm({ message: '确定重置此组件为默认?', destructive: true })
  if (!confirmed) return

  const widget = getSlotWidget(slotId)
  if (widget) {
    widgetsStore.removeWidget(widget.id)
    scheduleSave()
    showToast('已重置')
  }
}

function addQuote() {
  widgetsStore.addWidget('quote', {
    text: '生活不止眼前的苟且，还有诗和远方。',
    author: '',
    fontStyle: 'normal',
    slot: 'quote'
  })
  scheduleSave()
  showToast('已添加名言组件')
}
</script>


