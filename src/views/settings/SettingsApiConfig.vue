<template>
  <div class="space-y-6">
    <div class="space-y-2">
      <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">API 配置</span>
      <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
          <span class="text-[17px] text-[var(--text-primary)]">当前配置</span>
          <select v-model="store.activeConfigId" class="text-[var(--primary-color)] bg-transparent outline-none max-w-[150px] text-right min-w-0" @change="loadConfigInputs">
            <option v-for="c in store.configs" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="flex items-center justify-center py-3 active:bg-gray-100 dark:active:bg-[#2c2c2e] cursor-pointer text-[var(--primary-color)]" @click="addConfig">
          <i class="ph ph-plus mr-1"></i> 新增配置
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex justify-between items-end px-4">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase">编辑配置</span>
        <button class="text-[13px] text-red-500" @click="deleteConfig">删除</button>
      </div>
      <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-24 text-[17px] text-[var(--text-primary)] shrink-0">名称</span>
          <input v-model="configForm.name" type="text" class="flex-1 min-w-0 text-[17px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="配置名称">
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-24 text-[17px] text-[var(--text-primary)] shrink-0">Base URL</span>
          <input v-model="configForm.url" type="text" class="flex-1 min-w-0 text-[17px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="https://api.openai.com/v1">
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-24 text-[17px] text-[var(--text-primary)] shrink-0">API Key</span>
          <input v-model="configForm.key" type="password" class="flex-1 min-w-0 text-[17px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="sk-...">
        </div>
        <div class="flex justify-between items-center px-4 py-3">
          <div class="flex items-center shrink-0">
            <span class="text-[17px] text-[var(--text-primary)]">模型</span>
            <button class="text-[var(--primary-color)] text-sm ml-2" @click="handleFetchModels">(获取)</button>
          </div>
          <div class="flex flex-col items-end gap-1">
            <select v-model="configForm.model" class="text-[17px] text-[var(--primary-color)] bg-transparent max-w-[200px] text-right truncate min-w-0">
              <option value="">选择模型</option>
              <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
            </select>
            <input v-model="configForm.model" type="text" class="text-[15px] text-[var(--primary-color)] bg-transparent max-w-[200px] text-right truncate min-w-0 outline-none" placeholder="自定义模型ID">
          </div>
        </div>
        <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
          <span class="w-24 text-[17px] text-[var(--text-primary)] shrink-0">温度</span>
          <input v-model="configForm.temperature" type="number" step="0.1" min="0" max="2" class="flex-1 min-w-0 text-[17px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="留空使用模型默认">
        </div>
        <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
          <span class="w-24 text-[17px] text-[var(--text-primary)] shrink-0">输出上限</span>
          <input v-model="configForm.maxTokens" type="number" min="1" class="flex-1 min-w-0 text-[17px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="留空不限制输出">
        </div>
        <div class="px-4 pb-3 text-[12px] text-[var(--text-secondary)]">温度范围 0-2；输出上限对应 max_tokens。</div>
        <div v-if="modelLoading" class="px-4 py-2 text-center text-sm text-[var(--text-secondary)]">正在获取...</div>
      </div>
      <div class="px-4 pt-2">
        <button class="w-full bg-[var(--primary-color)] text-white rounded-[10px] py-3 text-[17px] font-semibold" @click="saveConfig">保存配置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useConfigsStore } from '../../stores/configs'
import { useStorage } from '../../composables/useStorage'
import { useApi } from '../../composables/useApi'
import { useToast } from '../../composables/useToast'
import { showConfirm } from '../../composables/useConfirm'
import { useApiConfigForm } from './composables/useApiConfigForm'

const store = useConfigsStore()
const { scheduleSave } = useStorage()
const { fetchModels } = useApi()
const { showToast } = useToast()
const {
  addConfig,
  configForm,
  deleteConfig,
  handleFetchModels,
  loadConfigInputs,
  modelList,
  modelLoading,
  saveConfig
} = useApiConfigForm({ fetchModels, scheduleSave, showConfirm, showToast, store })

defineExpose({ saveConfig })
</script>

