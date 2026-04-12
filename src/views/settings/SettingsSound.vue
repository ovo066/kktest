<template>
  <div class="space-y-6">
    <!-- Master toggle + volume -->
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">启用提示音</span>
          <span class="text-[12px] text-[var(--text-secondary)]">只影响聊天提示音，不影响音乐、BGM 和语音</span>
        </div>
        <IosToggle :model-value="soundConfig.enabled" @update:modelValue="soundEffects.setEnabled" />
      </div>
      <div class="px-4 py-3">
        <div class="flex items-center justify-between mb-3 gap-3">
          <div class="flex flex-col min-w-0">
            <span class="text-[16px] text-[var(--text-primary)]">提示音音量</span>
            <span class="text-[12px] text-[var(--text-secondary)]">当前 {{ volumePercent }}%</span>
          </div>
          <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)] shrink-0" @click="previewCurrentNotification">
            试听
          </button>
        </div>
        <input
          :value="soundConfig.volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="w-full accent-[var(--primary-color)]"
          @input="handleVolumeInput"
          @change="handleVolumeInput"
        >
      </div>
    </div>

    <!-- Sound kit selector -->
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)]">
        <div class="text-[17px] text-[var(--text-primary)]">音效主题</div>
        <div class="text-[12px] text-[var(--text-secondary)] mt-1">选择一套整体音效风格，所有内置音效会跟随切换</div>
      </div>
      <div v-for="kit in kitDefinitions" :key="kit.id" class="border-b border-[var(--border-color)] last:border-b-0">
        <button
          class="w-full px-4 py-3 flex items-center gap-3 text-left"
          @click="handleKitChange(kit.id)"
        >
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
            :class="soundConfig.kit === kit.id
              ? 'border-[var(--primary-color)]'
              : 'border-[var(--border-color)]'"
          >
            <div
              v-if="soundConfig.kit === kit.id"
              class="w-2.5 h-2.5 rounded-full bg-[var(--primary-color)]"
            />
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-[16px] text-[var(--text-primary)]">{{ kit.label }}</span>
            <span class="text-[12px] text-[var(--text-secondary)]">{{ kit.description }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Per-event config -->
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)]">
        <div class="text-[17px] text-[var(--text-primary)]">事件音效</div>
        <div class="text-[12px] text-[var(--text-secondary)] mt-1">每类事件可以单独开关，也可以选择不同的音效</div>
      </div>
      <div v-for="event in eventDefinitions" :key="event.key" class="border-b border-[var(--border-color)] last:border-b-0">
        <div class="px-4 py-3 flex justify-between items-center gap-3">
          <div class="flex flex-col min-w-0">
            <span class="text-[16px] text-[var(--text-primary)]">{{ event.label }}</span>
            <span class="text-[12px] text-[var(--text-secondary)]">{{ event.description }}</span>
          </div>
          <IosToggle :model-value="getEventConfig(event.key).enabled" @update:modelValue="(value) => soundEffects.setEventEnabled(event.key, value)" />
        </div>
        <div class="px-4 py-3 flex items-center gap-3 border-t border-[var(--border-color)]">
          <span class="w-16 shrink-0 text-[15px] text-[var(--text-secondary)]">音效</span>
          <select
            :value="getEventConfig(event.key).soundId"
            class="flex-1 min-w-0 text-[15px] outline-none bg-transparent text-[var(--primary-color)]"
            @change="(evt) => handleEventSoundChange(event.key, evt)"
          >
            <optgroup label="内置">
              <option v-for="item in soundOptions.builtin" :key="item.id" :value="item.id">{{ item.label }}</option>
            </optgroup>
            <optgroup v-if="soundOptions.custom.length > 0" label="自定义">
              <option v-for="item in soundOptions.custom" :key="item.id" :value="item.id">{{ item.label }}</option>
            </optgroup>
          </select>
          <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[13px] text-[var(--primary-color)] shrink-0" @click="previewEvent(event.key)">
            试听
          </button>
        </div>
      </div>
    </div>

    <!-- Custom sounds -->
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)]">
        <div class="text-[17px] text-[var(--text-primary)]">自定义音效</div>
        <div class="text-[12px] text-[var(--text-secondary)] mt-1">
          推荐使用短音效，尽量控制在 5 秒内、{{ maxCustomSizeLabel }} 内。自定义音效会随本地存档一起保存。
        </div>
      </div>
      <div class="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-color)]">
        <div class="text-[14px] text-[var(--text-secondary)]">{{ customSummary }}</div>
        <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)] shrink-0" @click="fileInput?.click()">
          导入音效
        </button>
        <input ref="fileInput" type="file" class="hidden" accept="audio/*" @change="handleFileChange">
      </div>
      <div v-if="customSounds.length === 0" class="px-4 py-6 text-[14px] text-[var(--text-secondary)]">
        暂无自定义音效
      </div>
      <div v-for="item in customSounds" :key="item.id" class="px-4 py-3 border-b border-[var(--border-color)] last:border-b-0">
        <div class="flex items-center gap-3">
          <input
            :value="item.name"
            type="text"
            class="flex-1 min-w-0 text-[15px] outline-none bg-transparent text-[var(--text-primary)]"
            placeholder="音效名称"
            @change="(evt) => handleRename(item.id, evt)"
          >
          <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[13px] text-[var(--primary-color)] shrink-0" @click="soundEffects.previewSound(item.id)">
            试听
          </button>
          <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[13px] text-[#FF3B30] shrink-0" @click="handleRemove(item.id)">
            删除
          </button>
        </div>
        <div class="mt-2 text-[12px] text-[var(--text-secondary)]">
          {{ formatSoundMeta(item) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import IosToggle from '../../components/common/IosToggle.vue'
import { useSettingsStore } from '../../stores/settings'
import { useToast } from '../../composables/useToast'
import { useSoundEffects } from '../../composables/useSoundEffects'
import {
  MAX_CUSTOM_SOUND_SIZE_BYTES,
  SOUND_EVENT_DEFINITIONS,
  getKitDefinitions,
  listSoundOptions
} from '../../utils/soundEffects'

const store = useSettingsStore()
const { showToast } = useToast()
const soundEffects = useSoundEffects()
const fileInput = ref(null)

const soundConfig = computed(() => store.soundConfig || { enabled: false, volume: 0.65, kit: 'snd01', customSounds: [], events: {} })
const customSounds = computed(() => Array.isArray(soundConfig.value.customSounds) ? soundConfig.value.customSounds : [])
const soundOptions = computed(() => listSoundOptions(customSounds.value))
const kitDefinitions = getKitDefinitions()
const eventDefinitions = SOUND_EVENT_DEFINITIONS
const volumePercent = computed(() => Math.round((Number(soundConfig.value.volume || 0) || 0) * 100))
const maxCustomSizeLabel = `${Math.round(MAX_CUSTOM_SOUND_SIZE_BYTES / 1024)} KB`
const customSummary = computed(() => {
  const count = customSounds.value.length
  return count > 0 ? `已导入 ${count} 个自定义音效` : '导入后可在上面的事件里直接选择'
})

function getEventConfig(eventKey) {
  return soundConfig.value.events?.[eventKey] || { enabled: false, soundId: '' }
}

function handleVolumeInput(event) {
  soundEffects.setVolume(event?.target?.value)
}

function handleKitChange(kitId) {
  soundEffects.setKit(kitId)
  // Preview the notification sound in the new kit
  soundEffects.previewSound('notification')
}

function handleEventSoundChange(eventKey, event) {
  soundEffects.setEventSound(eventKey, event?.target?.value)
}

function previewEvent(eventKey) {
  const soundId = getEventConfig(eventKey).soundId
  if (!soundId) return
  soundEffects.previewSound(soundId)
}

function previewCurrentNotification() {
  const soundId = getEventConfig('notification').soundId
  if (!soundId) return
  soundEffects.previewSound(soundId)
}

async function handleFileChange(event) {
  const input = event?.target
  const file = input?.files?.[0]
  if (!file) return

  try {
    const result = await soundEffects.addCustomSoundFromFile(file)
    if (result.ok && result.item?.id) {
      showToast('已导入音效')
      soundEffects.previewSound(result.item.id)
    } else if (result.error) {
      showToast(result.error)
    }
  } catch {
    showToast('导入音效失败')
  } finally {
    if (input) input.value = ''
  }
}

function handleRename(soundId, event) {
  soundEffects.renameCustomSound(soundId, event?.target?.value)
}

function handleRemove(soundId) {
  soundEffects.removeCustomSound(soundId)
  showToast('已删除音效')
}

function formatSoundMeta(item) {
  const size = Math.max(0, Number(item?.size || 0) || 0)
  if (!size) return '已保存在本地存档'
  if (size < 1024) return `${size} B`
  return `${Math.round(size / 1024)} KB`
}
</script>
