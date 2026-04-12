<template>
  <div class="absolute inset-0 z-20 bg-[var(--bg-color)] flex flex-col">
    <template v-if="currentPage === 'hub'">
      <div class="pt-app-lg pb-2 px-4 flex items-end justify-between">
        <h1 class="text-3xl font-bold text-[var(--text-primary)]">设置</h1>
        <button class="text-[var(--primary-color)] font-semibold text-[17px]" @click="handleDone">完成</button>
      </div>
    </template>
    <template v-else>
      <div class="pt-app-lg pb-2 px-4 flex items-center justify-between relative">
        <button class="text-[var(--primary-color)] text-[17px] flex items-center gap-0.5" @click="goBack">
          <i class="ph ph-caret-left text-[20px]"></i>
          <span>设置</span>
        </button>
        <span class="text-[17px] font-semibold text-[var(--text-primary)] absolute left-1/2 -translate-x-1/2">{{ pageTitle }}</span>
        <button class="text-[var(--primary-color)] font-semibold text-[17px]" @click="handleDone">完成</button>
      </div>
    </template>

    <div class="flex-1 overflow-y-auto p-4 no-scrollbar">
      <SettingsHub v-show="currentPage === 'hub'" @navigate="goTo" />
      <SettingsAppearance v-show="currentPage === 'appearance'" />
      <SettingsChat v-show="currentPage === 'chat'" />
      <SettingsAIFeatures v-show="currentPage === 'ai'" />
      <SettingsSound v-show="currentPage === 'sound'" />
      <SettingsVoice v-show="currentPage === 'voice'" />
      <SettingsLiveness v-show="currentPage === 'liveness'" />
      <SettingsPlanner v-show="currentPage === 'planner'" />
      <SettingsAccessControl v-show="currentPage === 'access'" />
      <SettingsCloudSync v-show="currentPage === 'cloudSync'" />
      <SettingsApiConfig v-show="currentPage === 'api'" ref="apiConfigRef" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SettingsAIFeatures from './settings/SettingsAIFeatures.vue'
import SettingsAccessControl from './settings/SettingsAccessControl.vue'
import SettingsApiConfig from './settings/SettingsApiConfig.vue'
import SettingsAppearance from './settings/SettingsAppearance.vue'
import SettingsChat from './settings/SettingsChat.vue'
import SettingsHub from './settings/SettingsHub.vue'
import SettingsLiveness from './settings/SettingsLiveness.vue'
import SettingsPlanner from './settings/SettingsPlanner.vue'
import SettingsSound from './settings/SettingsSound.vue'
import SettingsVoice from './settings/SettingsVoice.vue'
import SettingsCloudSync from './settings/SettingsCloudSync.vue'

const router = useRouter()
const currentPage = ref('hub')
const apiConfigRef = ref(null)

const pageTitle = computed(() => {
  const titles = {
    hub: '设置',
    appearance: '外观与显示',
    chat: '聊天',
    ai: 'AI 能力',
    sound: '声音与提示音',
    voice: '语音与通话',
    liveness: '拟真互动',
    api: 'API 配置',
    planner: '日程管理',
    access: '访问验证',
    cloudSync: '云同步'
  }
  return titles[currentPage.value] || '设置'
})

function goTo(page) {
  currentPage.value = page
}

function goBack() {
  currentPage.value = 'hub'
}

function handleDone() {
  if (currentPage.value === 'api') {
    apiConfigRef.value?.saveConfig?.()
  }
  router.push('/')
}
</script>
