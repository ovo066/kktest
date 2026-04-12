<template>
  <div class="space-y-6">
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('appearance')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#FF9500] flex items-center justify-center text-white"><i class="ph ph-sun-dim text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">外观与显示</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ store.isDark ? '深色' : '浅色' }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between" @click="goTo('chat')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#34C759] flex items-center justify-center text-white"><i class="ph ph-chat-circle-dots text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">聊天</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">时间戳、格式</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
    </div>

    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('ai')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#5856D6] flex items-center justify-center text-white"><i class="ph ph-robot text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">AI 能力</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">已启用 {{ aiFeatureCount }} 项</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('voice')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#FF2D55] flex items-center justify-center text-white"><i class="ph ph-microphone text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">语音与通话</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ voiceSummary }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('sound')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#0A84FF] flex items-center justify-center text-white"><i class="ph ph-speaker-high text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">声音与提示音</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ soundSummary }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('liveness')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#FF3B30] flex items-center justify-center text-white"><i class="ph ph-heartbeat text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">拟真互动</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ store.allowLivenessEngine ? '已开启' : '关闭' }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('planner')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#ffb6b9] flex items-center justify-center text-white"><i class="ph ph-calendar-check text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">日程管理</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ plannerSummary }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
    </div>

    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('api')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#8E8E93] flex items-center justify-center text-white"><i class="ph ph-gear text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">API 配置</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ currentConfigName }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('cloudSync')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#30D158] flex items-center justify-center text-white"><i class="ph ph-cloud-arrow-up text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">云同步</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ cloudSyncSummary }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]" @click="goTo('access')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#5865F2] flex items-center justify-center text-white"><i class="ph ph-shield-check text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">访问验证</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-[15px] text-[var(--text-secondary)]">{{ accessSummary }}</span>
          <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
        </div>
      </button>
      <button class="w-full px-4 py-3 flex items-center justify-between" @click="router.push('/settings/storage')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center text-white"><i class="ph ph-database text-[18px]"></i></div>
          <span class="text-[17px] text-[var(--text-primary)]">存储与数据</span>
        </div>
        <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAccessControlStore } from '../../stores/accessControl'
import { useConfigsStore } from '../../stores/configs'
import { useSettingsStore } from '../../stores/settings'
import { useCloudSyncStore } from '../../stores/cloudSync'

const emit = defineEmits(['navigate'])

const router = useRouter()
const accessStore = useAccessControlStore()
const configsStore = useConfigsStore()
const store = useSettingsStore()
const syncStore = useCloudSyncStore()

const aiFeatureCount = computed(() => {
  let count = 0
  if (store.allowAIFavorite) count++
  if (store.allowAITransfer) count++
  if (store.allowAIGift) count++
  if (store.allowAIVoice) count++
  if (store.allowAIStickers) count++
  if (store.allowAIImageGeneration) count++
  if (store.syncForumToAI) count++
  if (store.allowAIEmotionTag) count++
  if (store.allowAIMockImage) count++
  if (store.allowAICall) count++
  if (store.allowAIMusicRecommend) count++
  if (store.enableWeatherContext) count++
  if (store.allowToolCalling) count++
  return count
})

const voiceSummary = computed(() => {
  const map = { simulated: '模拟', browser: '浏览器TTS', edge: 'Edge TTS', minimax: 'MiniMax' }
  return map[store.voiceTtsMode] || '模拟'
})

const soundSummary = computed(() => {
  const config = store.soundConfig || {}
  if (!config.enabled) return '关闭'
  const customCount = Array.isArray(config.customSounds) ? config.customSounds.length : 0
  return customCount > 0 ? `已开启 · ${customCount} 个自定义` : '已开启'
})

const currentConfigName = computed(() => {
  const c = configsStore.configs.find(x => x.id === configsStore.activeConfigId)
  return c?.name || '未选择'
})

const cloudSyncSummary = computed(() => {
  if (!store.cloudSyncEnabled) return '关闭'
  if (syncStore.status === 'ready') return '已就绪'
  if (syncStore.status === 'syncing') return '同步中'
  if (syncStore.status === 'error') return '出错'
  if (syncStore.status === 'needs-config') return '需配置'
  return '已开启'
})

const accessSummary = computed(() => {
  if (!accessStore.isEnabled) return '未启用'
  if (!accessStore.isConfigured) return '待配置'
  if (accessStore.isAuthenticated) return accessStore.accountLabel
  if (accessStore.isChecking) return '检查中'
  return '待验证'
})

const plannerSummary = computed(() => {
  if (store.allowPlannerAI && store.allowAIPlannerCapture) return '已知晓 + 自动记录'
  if (store.allowPlannerAI) return 'AI 已知晓'
  if (store.allowAIPlannerCapture) return '自动记录'
  return '关闭'
})

function goTo(page) {
  emit('navigate', page)
}
</script>
