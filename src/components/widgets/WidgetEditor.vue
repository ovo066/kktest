<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-xl rounded-2xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-white/20">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
        <button class="text-[#007AFF] text-[17px]" @click="emit('close')">取消</button>
        <span class="text-[17px] font-semibold text-black dark:text-white">{{ title }}</span>
        <button class="text-[#007AFF] text-[17px] font-semibold" @click="handleSave">保存</button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Widget type selector -->
        <div v-if="!isPresetSlot" class="space-y-2">
          <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">组件类型</label>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="type in widgetTypes"
              :key="type.value"
              class="flex flex-col items-center p-2 rounded-xl transition-all"
              :class="localType === type.value
                ? 'bg-[#007AFF]/10 ring-2 ring-[#007AFF]'
                : 'bg-gray-100 dark:bg-gray-800'"
              @click="selectType(type.value)"
            >
              <span class="text-xl mb-0.5">{{ type.icon }}</span>
              <span class="text-[10px] text-black dark:text-white">{{ type.name }}</span>
            </button>
          </div>
        </div>

        <!-- Size selector -->
        <div v-if="!isPresetSlot" class="space-y-2">
          <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">组件大小</label>
          <div class="flex gap-2">
            <button
              v-for="size in availableSizes"
              :key="size.value"
              class="flex-1 py-2 rounded-lg text-[14px] transition-all"
              :class="localSize === size.value
                ? 'bg-[#007AFF] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'"
              @click="localSize = size.value"
            >
              {{ size.label }}
            </button>
          </div>
        </div>

        <!-- Type-specific config -->
        <div class="space-y-3">
          <!-- Clock -->
          <template v-if="localType === 'clock'">
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">时钟样式</label>
              <div class="flex gap-2">
                <button
                  v-for="style in ['digital', 'analog']"
                  :key="style"
                  class="flex-1 py-2 rounded-lg text-[14px]"
                  :class="localConfig.style === style ? 'bg-[#007AFF] text-white' : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'"
                  @click="localConfig.style = style"
                >
                  {{ style === 'digital' ? '数字' : '模拟' }}
                </button>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[15px] text-black dark:text-white">显示秒</span>
              <input type="checkbox" v-model="localConfig.showSeconds" class="w-5 h-5 accent-[#007AFF]">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[15px] text-black dark:text-white">显示日期</span>
              <input type="checkbox" v-model="localConfig.showDate" class="w-5 h-5 accent-[#007AFF]">
            </div>
          </template>

          <!-- Weather -->
          <template v-if="localType === 'weather'">
            <InputRow label="城市" v-model="localConfig.city" placeholder="北京" />
            <InputRow label="温度" v-model="localConfig.temp" placeholder="25" />
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">天气状况</label>
              <select
                v-model="localConfig.condition"
                class="w-full p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-[14px] outline-none"
              >
                <option value="sunny">☀️ 晴</option>
                <option value="cloudy">⛅ 多云</option>
                <option value="overcast">☁️ 阴</option>
                <option value="rainy">🌧️ 雨</option>
                <option value="snowy">❄️ 雪</option>
                <option value="windy">💨 大风</option>
                <option value="foggy">🌫️ 雾</option>
                <option value="thunderstorm">⛈️ 雷雨</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button
                v-for="unit in ['celsius', 'fahrenheit']"
                :key="unit"
                class="flex-1 py-2 rounded-lg text-[14px]"
                :class="localConfig.unit === unit ? 'bg-[#007AFF] text-white' : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white'"
                @click="localConfig.unit = unit"
              >
                {{ unit === 'celsius' ? '°C' : '°F' }}
              </button>
            </div>
          </template>

          <!-- Image -->
          <template v-if="localType === 'image'">
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">图片</label>
              <div
                class="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden cursor-pointer flex items-center justify-center relative group"
                @click="imageInput?.click()"
              >
                <img v-if="localConfig.src" :src="localConfig.src" class="w-full h-full object-cover" />
                <div v-else class="text-gray-400 flex flex-col items-center">
                  <i class="ph ph-image text-3xl"></i>
                  <span class="text-[12px] mt-1">点击上传图片</span>
                </div>
              </div>
              <input ref="imageInput" type="file" class="hidden" accept="image/*" @change="handleImageUpload">
            </div>
            <InputRow label="标题" v-model="localConfig.caption" placeholder="我的照片" />
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">旋转角度: {{ localConfig.rotation }}°</label>
              <input type="range" v-model.number="localConfig.rotation" min="-15" max="15" class="w-full accent-[#007AFF]">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[15px] text-black dark:text-white">显示胶带</span>
              <input type="checkbox" v-model="localConfig.tape" class="w-5 h-5 accent-[#007AFF]">
            </div>
            <ColorRow v-if="localConfig.tape" label="胶带颜色" v-model="localConfig.tapeColor" />
          </template>

          <!-- Todo -->
          <template v-if="localType === 'todo'">
            <InputRow label="标题" v-model="localConfig.title" placeholder="TODO" />
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">待办事项</label>
              <div class="space-y-2">
                <div v-for="(item, i) in localConfig.items" :key="item.id" class="flex items-center gap-2">
                  <input type="checkbox" v-model="item.done" class="w-4 h-4 accent-[#007AFF]" />
                  <input v-model="item.text" class="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-[14px]" />
                  <button class="text-red-500 p-1" @click="localConfig.items.splice(i, 1)"><i class="ph ph-trash text-lg"></i></button>
                </div>
              </div>
              <button class="w-full py-2 text-[#007AFF] text-[14px] bg-gray-100 dark:bg-gray-800 rounded-lg" @click="addTodoItem">+ 添加待办</button>
            </div>
            <ColorRow label="背景色" v-model="localConfig.bgColor" />
            <ColorRow label="胶带颜色" v-model="localConfig.tapeColor" />
          </template>

          <!-- Quote -->
          <template v-if="localType === 'quote'">
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">名言内容</label>
              <textarea
                v-model="localConfig.text"
                class="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-[14px] resize-none"
                rows="3"
                placeholder="输入名言内容..."
              ></textarea>
            </div>
            <InputRow label="作者" v-model="localConfig.author" placeholder="作者名" />
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">字体样式</label>
              <div class="flex gap-2">
                <button
                  v-for="style in ['normal', 'italic']"
                  :key="style"
                  class="flex-1 py-2 rounded-lg text-[14px]"
                  :class="[
                    localConfig.fontStyle === style ? 'bg-[#007AFF] text-white' : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white',
                    style === 'italic' ? 'italic' : ''
                  ]"
                  @click="localConfig.fontStyle = style"
                >
                  {{ style === 'normal' ? '常规' : '斜体' }}
                </button>
              </div>
            </div>
          </template>

          <!-- Calendar -->
          <template v-if="localType === 'calendar'">
            <div class="flex items-center justify-between">
              <span class="text-[15px] text-black dark:text-white">显示完整月份</span>
              <input type="checkbox" v-model="localConfig.showFullMonth" class="w-5 h-5 accent-[#007AFF]">
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[15px] text-black dark:text-white">高亮今天</span>
              <input type="checkbox" v-model="localConfig.highlightToday" class="w-5 h-5 accent-[#007AFF]">
            </div>
          </template>

          <!-- Battery -->
          <template v-if="localType === 'battery'">
            <div class="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[13px]">
              <i class="ph-fill ph-info mr-1"></i>
              电量组件会自动读取设备电量信息，无需额外配置。
            </div>
          </template>

          <!-- Music -->
          <template v-if="localType === 'music'">
            <InputRow label="歌曲名" v-model="localConfig.title" placeholder="我喜欢的音乐" />
            <InputRow label="艺术家" v-model="localConfig.artist" placeholder="未知艺术家" />
            <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[13px]">
              <i class="ph-fill ph-info mr-1"></i>
              音乐组件封面使用当前壁纸，类似锁屏播放器样式。
            </div>
          </template>

          <!-- Stats -->
          <template v-if="localType === 'stats'">
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">数据类型</label>
              <div class="flex flex-col gap-2">
                <label
                  class="flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all"
                  :class="localConfig.statsType === 'chat_count'
                    ? 'bg-[#007AFF]/5 border-[#007AFF]'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-transparent'"
                >
                  <input type="radio" v-model="localConfig.statsType" value="chat_count" class="hidden">
                  <div class="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center"><i class="ph-fill ph-heart"></i></div>
                  <div class="flex-1">
                    <div class="text-[14px] font-medium text-black dark:text-white">对话统计</div>
                    <div class="text-[11px] text-gray-500">显示联系人数量</div>
                  </div>
                </label>
                <label
                  class="flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all"
                  :class="localConfig.statsType === 'year_progress'
                    ? 'bg-[#007AFF]/5 border-[#007AFF]'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-transparent'"
                >
                  <input type="radio" v-model="localConfig.statsType" value="year_progress" class="hidden">
                  <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center"><i class="ph-fill ph-hourglass"></i></div>
                  <div class="flex-1">
                    <div class="text-[14px] font-medium text-black dark:text-white">年度进度</div>
                    <div class="text-[11px] text-gray-500">显示今年已过去的百分比</div>
                  </div>
                </label>
              </div>
            </div>
          </template>

          <!-- Shortcuts -->
          <template v-if="localType === 'shortcuts'">
            <div class="space-y-2">
              <label class="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">应用捷径</label>
              <div class="space-y-2">
                <div v-for="(app, i) in localConfig.apps" :key="i" class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-lg" :style="{ backgroundColor: app.bg || '#eee' }">
                    <i :class="app.icon"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <input v-model="app.label" class="w-full bg-transparent text-[13px] font-medium text-black dark:text-white outline-none" placeholder="名称">
                    <input v-model="app.route" class="w-full bg-transparent text-[11px] text-gray-500 outline-none" placeholder="路由 (如 /messages)">
                  </div>
                  <button class="text-gray-400 hover:text-red-500" @click="localConfig.apps.splice(i, 1)"><i class="ph-fill ph-minus-circle"></i></button>
                </div>
              </div>
              <button class="w-full py-2 text-[#007AFF] text-[14px] bg-gray-100 dark:bg-gray-800 rounded-lg" @click="addShortcut">+ 添加捷径</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, h } from 'vue'
import { compressImage } from '../../composables/useImage'

const props = defineProps({
  widget: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save'])

const imageInput = ref(null)

const widgetTypes = [
  { value: 'clock', name: '时钟', icon: '🕐' },
  { value: 'weather', name: '天气', icon: '☀️' },
  { value: 'calendar', name: '日历', icon: '📅' },
  { value: 'image', name: '照片', icon: '📷' },
  { value: 'todo', name: '便签', icon: '📝' },
  { value: 'quote', name: '名言', icon: '💬' },
  { value: 'stats', name: '数据', icon: '📊' },
  { value: 'battery', name: '电量', icon: '🔋' },
  { value: 'music', name: '音乐', icon: '🎵' },
  { value: 'shortcuts', name: '捷径', icon: '🚀' }
]

const defaultConfigs = {
  clock: { style: 'digital', showSeconds: false, showDate: true },
  weather: { city: '北京', temp: '25', condition: 'sunny', unit: 'celsius' },
  image: { src: '', caption: '', rotation: 0, tape: true, tapeColor: '#ffc0cb' },
  todo: { title: 'TODO', items: [], bgColor: '#fffdf0', tapeColor: '#90EE90' },
  quote: { text: '生活不止眼前的苟且，还有诗和远方。', author: '', fontStyle: 'normal' },
  calendar: { showFullMonth: false, highlightToday: true },
  battery: {},
  music: { title: '我喜欢的音乐', artist: '未知艺术家' },
  stats: { statsType: 'chat_count' },
  shortcuts: { apps: [
    { label: '消息', route: '/messages', icon: 'ph-fill ph-chat-circle-dots', bg: '#E3F2FD' },
    { label: '设置', route: '/settings', icon: 'ph-fill ph-gear', bg: '#F3E5F5' }
  ]}
}

const defaultSizes = {
  clock: '2x1',
  weather: '2x1',
  image: '2x2',
  todo: '2x2',
  quote: '4x2',
  calendar: '2x1',
  battery: '2x1',
  music: '4x2',
  stats: '2x1',
  shortcuts: '2x1'
}

const localType = ref(props.widget?.type || 'clock')
const localSize = ref(props.widget?.size || defaultSizes[localType.value])
const localConfig = reactive(props.widget?.config
  ? JSON.parse(JSON.stringify(props.widget.config))
  : JSON.parse(JSON.stringify(defaultConfigs[localType.value]))
)

const title = computed(() => props.widget ? '编辑组件' : '添加组件')
const isPresetSlot = computed(() => !!props.widget?.config?.slot)

const availableSizes = [
  { value: '2x1', label: '小' },
  { value: '2x2', label: '中' },
  { value: '4x2', label: '大' }
]

function selectType(type) {
  localType.value = type
  localSize.value = defaultSizes[type]
  const fresh = JSON.parse(JSON.stringify(defaultConfigs[type]))
  // Clear old keys, apply new
  Object.keys(localConfig).forEach(k => { if (!(k in fresh)) delete localConfig[k] })
  Object.assign(localConfig, fresh)
}

function addTodoItem() {
  if (!localConfig.items) localConfig.items = []
  localConfig.items.push({ id: Date.now().toString(), text: '', done: false })
}

function addShortcut() {
  if (!localConfig.apps) localConfig.apps = []
  localConfig.apps.push({ label: '新应用', route: '/', icon: 'ph-fill ph-app-window', bg: '#f0f0f0' })
}

async function handleImageUpload(e) {
  const file = e.target.files?.[0]
  if (file) {
    const b64 = await compressImage(file, 300)
    localConfig.src = b64
  }
  e.target.value = ''
}

function handleSave() {
  emit('save', {
    type: localType.value,
    size: localSize.value,
    config: { ...localConfig }
  })
}

// Input row component
const InputRow = (props, { emit }) => {
  return h('div', { class: 'space-y-1' }, [
    h('label', { class: 'text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider' }, props.label),
    h('input', {
      type: 'text',
      value: props.modelValue,
      placeholder: props.placeholder,
      class: 'w-full p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-[14px] outline-none',
      onInput: (e) => emit('update:modelValue', e.target.value)
    })
  ])
}
InputRow.props = ['label', 'modelValue', 'placeholder']
InputRow.emits = ['update:modelValue']

// Color row component
const ColorRow = (props, { emit }) => {
  return h('div', { class: 'flex items-center justify-between' }, [
    h('span', { class: 'text-[15px] text-black dark:text-white' }, props.label),
    h('div', { class: 'flex items-center gap-2' }, [
      h('input', {
        type: 'color',
        value: props.modelValue || '#000000',
        class: 'w-8 h-8 rounded cursor-pointer',
        onInput: (e) => emit('update:modelValue', e.target.value)
      }),
      h('input', {
        type: 'text',
        value: props.modelValue,
        class: 'w-20 p-1 text-[13px] bg-gray-100 dark:bg-gray-800 rounded text-black dark:text-white',
        onInput: (e) => emit('update:modelValue', e.target.value)
      })
    ])
  ])
}
ColorRow.props = ['label', 'modelValue']
ColorRow.emits = ['update:modelValue']
</script>
