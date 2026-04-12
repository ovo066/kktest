<template>
  <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">让 AI 了解我的日程</span>
        <span class="text-[12px] text-[var(--text-secondary)]">开启后，AI 在聊天中会感知你的待办和日记</span>
      </div>
      <IosToggle v-model="store.allowPlannerAI" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex items-center border-b border-[var(--border-color)]">
      <span class="flex-1 text-[17px] text-[var(--text-primary)]">提醒方式</span>
      <select v-model="store.plannerReminderMode" class="text-[var(--primary-color)] bg-transparent outline-none text-right" @change="scheduleSave">
        <option value="none">不提醒</option>
        <option value="toast">应用内提示</option>
        <option value="notification">系统通知</option>
      </select>
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">允许 AI 自动写入日程</span>
        <span class="text-[12px] text-[var(--text-secondary)]">聊天中识别待办、长期计划或纪念日后，AI 可自动帮你记下</span>
      </div>
      <IosToggle v-model="store.allowAIPlannerCapture" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI 角色日程</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 角色拥有自己的日程，并自然融入对话</span>
      </div>
      <IosToggle v-model="store.allowCharacterSchedule" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3">
      <p class="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        日程功能让你管理待办事项、记录日记，并可选择性地让 AI 角色了解你的计划。若开启自动写入，AI 也能在合适的语境下把聊天里提到的事项先记成待办。
      </p>
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

