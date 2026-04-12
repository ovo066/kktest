<template>
  <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">启用拟真互动</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI会主动发消息、模拟已读/打字、有情绪状态</span>
      </div>
      <IosToggle v-model="store.allowLivenessEngine" @update:modelValue="scheduleSave" />
    </div>
    <template v-if="store.allowLivenessEngine">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">模拟已读状态</span>
          <span class="text-[12px] text-[var(--text-secondary)]">AI可能已读不回</span>
        </div>
        <IosToggle v-model="store.livenessConfig.simulateReadReceipt" @update:modelValue="scheduleSave" />
      </div>
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">模拟打字中</span>
          <span class="text-[12px] text-[var(--text-secondary)]">AI 回复前会先显示"对方正在输入"</span>
        </div>
        <IosToggle v-model="store.livenessConfig.simulateTypingIndicator" @update:modelValue="scheduleSave" />
      </div>
      <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">心跳间隔</span>
        <select v-model.number="store.livenessConfig.heartbeatInterval" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="scheduleSave">
          <option :value="300000">5 分钟</option>
          <option :value="600000">10 分钟</option>
          <option :value="900000">15 分钟</option>
          <option :value="1800000">30 分钟</option>
          <option :value="3600000">1 小时</option>
        </select>
      </div>
      <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">消息冷却</span>
        <select v-model.number="store.livenessConfig.proactiveCooldown" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="scheduleSave">
          <option :value="600000">10 分钟</option>
          <option :value="1800000">30 分钟</option>
          <option :value="3600000">1 小时</option>
          <option :value="7200000">2 小时</option>
        </select>
      </div>
      <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">延迟范围</span>
        <span class="flex-1 flex items-center justify-end gap-1 text-[14px] text-[var(--text-secondary)]">
          <input v-model.number="store.livenessConfig.proactiveDelayMin" type="number" min="1" max="600" class="w-14 text-center bg-transparent outline-none text-[var(--text-primary)] border-b border-[var(--border-color)]" @change="scheduleSave">秒 ~
          <input v-model.number="store.livenessConfig.proactiveDelayMax" type="number" min="1" max="600" class="w-14 text-center bg-transparent outline-none text-[var(--text-primary)] border-b border-[var(--border-color)]" @change="scheduleSave">秒
        </span>
      </div>
      <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">免打扰</span>
        <span class="text-[14px] text-[var(--text-secondary)]">
          <input v-model.number="store.livenessConfig.quietHoursStart" type="number" min="0" max="23" class="w-10 text-center bg-transparent outline-none text-[var(--text-primary)] border-b border-[var(--border-color)]" @change="scheduleSave">时 ~
          <input v-model.number="store.livenessConfig.quietHoursEnd" type="number" min="0" max="23" class="w-10 text-center bg-transparent outline-none text-[var(--text-primary)] border-b border-[var(--border-color)]" @change="scheduleSave">时
        </span>
      </div>
      <div class="flex items-center px-4 py-3">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">决策API</span>
        <select v-model="store.livenessConfig.decisionConfigId" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right min-w-0" @change="scheduleSave">
          <option value="">跟随联系人配置</option>
          <option v-for="c in configsStore.configs" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="px-4 py-3 flex justify-between items-center border-t border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">允许已读不回</span>
          <span class="text-[12px] text-[var(--text-secondary)]">AI可能不回复你的消息</span>
        </div>
        <IosToggle v-model="store.livenessConfig.allowChatReadOnly" @update:modelValue="scheduleSave" />
      </div>
      <div v-if="store.livenessConfig.allowChatReadOnly" class="px-4 py-3 flex justify-between items-center border-t border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">显示已读不回原因</span>
          <span class="text-[12px] text-[var(--text-secondary)]">弹出提示告诉你为什么没有回复</span>
        </div>
        <IosToggle v-model="store.livenessConfig.showReadOnlyReasonToast" @update:modelValue="scheduleSave" />
      </div>
      <div class="px-4 py-3 flex justify-between items-center border-t border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">允许主动发动态</span>
          <span class="text-[12px] text-[var(--text-secondary)]">AI角色会自己发朋友圈</span>
        </div>
        <IosToggle v-model="store.livenessConfig.allowProactiveMoments" @update:modelValue="scheduleSave" />
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">通知方式</span>
        <select v-model="store.livenessConfig.notifyMode" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="scheduleSave">
          <option value="island">灵动岛</option>
          <option value="browser">浏览器通知</option>
          <option value="both">灵动岛 + 浏览器</option>
          <option value="none">关闭</option>
        </select>
      </div>
      <div class="px-4 py-3 flex justify-between items-center border-t border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">后台保活（实验）</span>
          <span class="text-[12px] text-[var(--text-secondary)]">尝试让应用在后台保持运行，效果因设备而异</span>
        </div>
        <IosToggle v-model="store.livenessConfig.backgroundKeepAlive" @update:modelValue="scheduleSave" />
      </div>
      <div class="px-4 py-3 flex justify-between items-center border-t border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">启用 Web Push</span>
          <span class="text-[12px] text-[var(--text-secondary)]">即使关闭页面也能收到 AI 的消息通知</span>
        </div>
        <IosToggle v-model="store.livenessConfig.pushEnabled" @update:modelValue="scheduleSave" />
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">推送地址</span>
        <input v-model="store.livenessConfig.pushApiBase" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="/api" @change="scheduleSave">
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">推送密钥</span>
        <input v-model="store.livenessConfig.pushAuthToken" type="password" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="可选" @change="scheduleSave">
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">推送订阅</span>
        <div class="flex items-center justify-end gap-2 flex-1 min-w-0">
          <span class="text-[12px] text-[var(--text-secondary)]">{{ pushSubscriptionLabel }}</span>
          <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)] disabled:opacity-60" :disabled="pushBusy || !pushSupported" @click="handleTogglePushSubscription">{{ pushSubscribed ? '取消' : '订阅' }}</button>
        </div>
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">推送测试</span>
        <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)] disabled:opacity-60" :disabled="pushBusy || !pushSupported" @click="handleTestServerPush">发送</button>
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">通知权限</span>
        <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)]" @click="handleRequestNotificationPermission">{{ notificationPermissionLabel }}</button>
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">测试通知</span>
        <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)]" @click="handleTestNotification">发送</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useConfigsStore } from '../../stores/configs'
import { useSettingsStore } from '../../stores/settings'
import { useStorage } from '../../composables/useStorage'
import { useToast } from '../../composables/useToast'
import IosToggle from '../../components/common/IosToggle.vue'
import { usePushSettings } from './composables/usePushSettings'

const configsStore = useConfigsStore()
const store = useSettingsStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()
const {
  handleRequestNotificationPermission,
  handleTestNotification,
  handleTestServerPush,
  handleTogglePushSubscription,
  notificationPermissionLabel,
  pushBusy,
  pushSubscribed,
  pushSubscriptionLabel,
  pushSupported
} = usePushSettings({ showToast, store })
</script>

