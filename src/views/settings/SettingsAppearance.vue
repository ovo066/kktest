<template>
  <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <span class="text-[17px] text-[var(--text-primary)]">深色模式</span>
      <IosToggle v-model="store.isDark" @update:modelValue="handleDarkModeChange" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">聊天头像</span>
        <span class="text-[12px] text-[var(--text-secondary)]">显示用户和联系人头像</span>
      </div>
      <IosToggle v-model="store.showChatAvatars" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">显示时间戳</span>
        <span class="text-[12px] text-[var(--text-secondary)]">间隔一段时间显示日期/时间</span>
      </div>
      <IosToggle v-model="store.showChatTimestamps" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center gap-3">
      <div class="flex flex-col flex-1 min-w-0">
        <span class="text-[17px] text-[var(--text-primary)]">Token 统计胶囊</span>
        <span class="text-[12px] text-[var(--text-secondary)]">聊天页面显示用量与陪伴天数</span>
      </div>
      <IosToggle v-model="store.showTokenCapsule" class="shrink-0" @update:modelValue="scheduleSave" />
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '../../stores/settings'
import { useStorage } from '../../composables/useStorage'
import IosToggle from '../../components/common/IosToggle.vue'

const store = useSettingsStore()
const { scheduleSave } = useStorage()

function handleDarkModeChange(val) {
  store.setDarkMode(val)
  scheduleSave()
}
</script>

