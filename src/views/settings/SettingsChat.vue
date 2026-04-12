<template>
  <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">发送时间戳给AI</span>
        <span class="text-[12px] text-[var(--text-secondary)]">让 AI 知道你发消息的时间，对话更有时间感</span>
      </div>
      <IosToggle v-model="store.sendTimestampsToAI" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center gap-3">
      <div class="flex flex-col flex-1 min-w-0">
        <span class="text-[17px] text-[var(--text-primary)]">全局启用预设系统提示</span>
        <span class="text-[12px] text-[var(--text-secondary)]">启用内置的聊天格式和生图规则预设</span>
      </div>
      <IosToggle v-model="store.globalPresetLorebookEnabled" class="shrink-0" @update:modelValue="scheduleSave" />
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '../../stores/settings'
import { useStorage } from '../../composables/useStorage'
import IosToggle from '../../components/common/IosToggle.vue'

const store = useSettingsStore()
const { scheduleSave } = useStorage()
</script>

