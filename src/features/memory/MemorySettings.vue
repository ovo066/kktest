<template>
  <div
    v-if="visible"
    class="absolute inset-0 bg-[var(--bg-color)] z-50 flex flex-col"
  >
    <!-- iOS 风格头部 -->
    <div class="pt-app-lg pb-2 px-4 flex items-center justify-between border-b border-[var(--border-color)]">
      <button class="text-[var(--primary-color)] text-[17px] flex items-center gap-0.5" @click="$emit('back')">
        <i class="ph ph-caret-left text-[20px]"></i>
        <span>返回</span>
      </button>
      <span class="font-semibold text-[17px] text-[var(--text-primary)]">记忆设置</span>
      <div class="w-14"></div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-y-auto no-scrollbar">
      <!-- 主开关 -->
      <div class="px-4 pt-6">
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <div>
              <div class="text-[15px] text-[var(--text-primary)]">启用记忆系统</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">将记忆注入到对话上下文</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative"
              :class="settings.enabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('enabled')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
        </div>
      </div>

      <!-- 自动总结 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">自动总结</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <span class="text-[15px] text-[var(--text-primary)]">自动生成总结</span>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative"
              :class="settings.autoSummary ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('autoSummary')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.autoSummary ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <span class="text-[15px] text-[var(--text-primary)]">总结频率</span>
            <div class="flex items-center gap-1.5">
              <span class="text-[15px] text-[var(--text-secondary)]">每</span>
              <input
                v-model.number="settings.summaryFrequency"
                type="number"
                min="5"
                max="500"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">条消息</span>
            </div>
          </div>
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-[15px] text-[var(--text-primary)]">总结/自动记忆 API</span>
            <select
              v-model="settings.summaryConfigId"
              class="bg-transparent text-[var(--text-secondary)] text-[15px] outline-none text-right max-w-[140px] truncate"
              @change="save"
            >
              <option :value="null">使用主 API</option>
              <option v-for="cfg in configs" :key="cfg.id" :value="cfg.id">
                {{ cfg.name || cfg.model || 'API ' + cfg.id.slice(-4) }}
              </option>
            </select>
          </div>
          <div class="px-4 py-3 border-t border-[var(--border-color)]">
            <div class="text-[15px] text-[var(--text-primary)] mb-1">总结系统提示词</div>
            <div class="text-[12px] text-[var(--text-secondary)] mb-2">自定义前置系统提示词，会拼接在总结指令之前发送</div>
            <textarea
              v-model="settings.summarySystemPrompt"
              class="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[14px] outline-none resize-none"
              rows="3"
              placeholder="可选，留空则不添加额外提示词"
              @blur="save"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 智能上下文 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">智能上下文</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">智能上下文窗口</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">保留开头和最近消息，中间用摘要替代</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.smartContext ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('smartContext')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.smartContext ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.smartContext ? 'opacity-40 pointer-events-none' : ''"
          >
            <span class="text-[15px] text-[var(--text-primary)]">保留开头轮数</span>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.contextHeadRounds"
                type="number"
                min="0"
                max="10"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">轮</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.smartContext ? 'opacity-40 pointer-events-none' : ''"
          >
            <span class="text-[15px] text-[var(--text-primary)]">保留末尾轮数</span>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.contextTailRounds"
                type="number"
                min="2"
                max="20"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">轮</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between"
            :class="!settings.smartContext ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">自动总结中间内容</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">对跳过的中间消息生成摘要</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.contextAutoSummarize ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('contextAutoSummarize')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.contextAutoSummarize ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
        </div>
      </div>

      <!-- 关键词触发 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">关键词触发</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <div>
              <div class="text-[15px] text-[var(--text-primary)]">启用关键词触发</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">消息含触发词时自动记忆</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative"
              :class="settings.keywordTrigger ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('keywordTrigger')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.keywordTrigger ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div class="px-4 py-3">
            <div class="text-[13px] text-[var(--text-secondary)] mb-2">触发词（逗号分隔）</div>
            <input
              v-model="keywordsText"
              type="text"
              class="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] outline-none"
              placeholder="记住, 别忘了, 重要"
              @blur="saveKeywords"
            >
          </div>
        </div>
      </div>

      <!-- AI 自动记忆 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">AI 自动记忆</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">AI 自动写入记忆</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">从对话中提取长期有用信息，先写入“待整理”（默认不注入，需你确认）（会额外调用一次 API）</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.aiAutoMemory ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('aiAutoMemory')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.aiAutoMemory ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.aiAutoMemory ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">触发轮数</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">累计到该轮数才触发自动记忆，0 表示关闭该条件</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.aiAutoMemoryTriggerRounds"
                type="number"
                min="0"
                max="400"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">轮</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.aiAutoMemory ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">触发 token</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">累计新消息 token 到阈值才触发，0 表示关闭该条件</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.aiAutoMemoryTriggerTokens"
                type="number"
                min="0"
                max="50000"
                class="w-20 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">token</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.aiAutoMemory ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">兜底触发消息数</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">仅当“触发轮数”和“触发 token”都为 0 时生效</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.aiAutoMemoryMinNewMessages"
                type="number"
                min="1"
                max="30"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">条</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between"
            :class="!settings.aiAutoMemory ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">提示写入结果</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">写入/更新记忆时显示提示</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.aiAutoMemoryNotify ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('aiAutoMemoryNotify')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.aiAutoMemoryNotify ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
        </div>
      </div>

      <!-- 记忆管家 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">记忆管家</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">启用记忆管家</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">自动整理、去重、压缩核心记忆池</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.memoryManagerEnabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('memoryManagerEnabled')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.memoryManagerEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.memoryManagerEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">触发条数</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">核心记忆启用条数达到阈值后自动整理，0 表示关闭</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.memoryManagerTriggerCount"
                type="number"
                min="0"
                max="200"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">条</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.memoryManagerEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">触发 token</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">核心记忆 token 估算达到阈值后自动整理，0 表示关闭</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.memoryManagerTriggerTokens"
                type="number"
                min="0"
                max="20000"
                class="w-20 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">token</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.memoryManagerEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">最小间隔</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">防止频繁调用；满足阈值后至少间隔这么久才会再次整理</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.memoryManagerInterval"
                type="number"
                min="5"
                max="120"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">分钟</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between"
            :class="!settings.memoryManagerEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <span class="text-[15px] text-[var(--text-primary)]">记忆管家 API</span>
            <select
              v-model="settings.memoryManagerConfigId"
              class="bg-transparent text-[var(--text-secondary)] text-[15px] outline-none text-right max-w-[140px] truncate"
              @change="save"
            >
              <option :value="null">使用总结 API</option>
              <option v-for="cfg in configs" :key="cfg.id" :value="cfg.id">
                {{ cfg.name || cfg.model || 'API ' + cfg.id.slice(-4) }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 历史检索 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">历史检索</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">启用历史检索</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">自动搜索相关历史对话，注入上下文</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.historyRetrievalEnabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('historyRetrievalEnabled')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.historyRetrievalEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.historyRetrievalEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">检索模式</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">轻量关键词+上下文扩展；LLM 精排更准但多一次 API</div>
            </div>
            <select
              v-model="settings.historyRetrievalMode"
              class="bg-transparent text-[var(--text-secondary)] text-[15px] outline-none text-right max-w-[120px] shrink-0"
              @change="save"
            >
              <option value="keyword">关键词匹配</option>
              <option value="llm">LLM 精排</option>
            </select>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]"
            :class="!settings.historyRetrievalEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <span class="text-[15px] text-[var(--text-primary)]">检索条数</span>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.historyRetrievalCount"
                type="number"
                min="1"
                max="10"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">条</span>
            </div>
          </div>
          <div
            class="px-4 py-3 flex items-center justify-between"
            :class="!settings.historyRetrievalEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <span class="text-[15px] text-[var(--text-primary)]">检索 token 上限</span>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.maxRetrievalTokens"
                type="number"
                min="100"
                max="2000"
                class="w-16 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">token</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 向量检索 -->
      <div class="px-4 pt-6">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">向量检索</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
            <div class="flex-1 min-w-0 pr-3">
              <div class="text-[15px] text-[var(--text-primary)]">启用向量检索</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">用于历史对话轮次召回；失败时会自动回退到关键词检索</div>
            </div>
            <button
              class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
              :class="settings.vectorSearchEnabled ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
              @click="toggleSetting('vectorSearchEnabled')"
            >
              <div
                class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                :class="settings.vectorSearchEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
              ></div>
            </button>
          </div>
          <div
            :class="!settings.vectorSearchEnabled ? 'opacity-40 pointer-events-none' : ''"
          >
            <div class="px-4 py-3 border-b border-[var(--border-color)]">
              <div class="text-[15px] text-[var(--text-primary)] mb-1">Embedding API URL</div>
              <input
                v-model="settings.embeddingApiUrl"
                type="text"
                class="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[14px] outline-none"
                placeholder="https://api.openai.com/v1"
                @blur="save"
              >
            </div>
            <div class="px-4 py-3 border-b border-[var(--border-color)]">
              <div class="text-[15px] text-[var(--text-primary)] mb-1">Embedding API Key</div>
              <input
                v-model="settings.embeddingApiKey"
                type="password"
                class="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[14px] outline-none"
                placeholder="sk-..."
                @blur="save"
              >
            </div>
            <div class="px-4 py-3 border-b border-[var(--border-color)]">
              <div class="text-[15px] text-[var(--text-primary)] mb-1">Embedding 模型</div>
              <input
                v-model="settings.embeddingModel"
                type="text"
                class="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[14px] outline-none"
                placeholder="text-embedding-3-small"
                @blur="save"
              >
            </div>
            <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
              <div class="flex-1 min-w-0 pr-3">
                <div class="text-[15px] text-[var(--text-primary)]">索引模式</div>
                <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">实时：每次回复后自动索引；按需：检索时才索引</div>
              </div>
              <select
                v-model="settings.vectorIndexMode"
                class="bg-transparent text-[var(--text-secondary)] text-[15px] outline-none text-right max-w-[120px] shrink-0"
                @change="save"
              >
                <option value="realtime">实时增量</option>
                <option value="ondemand">按需索引</option>
              </select>
            </div>
            <div class="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)]">
              <div class="flex-1 min-w-0 pr-3">
                <div class="text-[15px] text-[var(--text-primary)]">向量维度</div>
                <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">0 表示使用模型默认维度</div>
              </div>
              <div class="flex items-center gap-1.5">
                <input
                  v-model.number="settings.embeddingDimensions"
                  type="number"
                  min="0"
                  max="8192"
                  class="w-16 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                  @change="save"
                >
              </div>
            </div>
            <div class="px-4 py-3 flex items-center gap-2">
              <button
                class="flex-1 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[14px] active:opacity-70"
                @click="testConnection"
              >
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <button
                class="flex-1 py-2.5 rounded-[10px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[14px] active:opacity-70"
                @click="rebuildVectorIndex"
              >
                {{ rebuilding ? '重建中...' : '重建索引' }}
              </button>
            </div>
            <div v-if="vectorStats" class="px-4 pb-3">
              <div class="text-[12px] text-[var(--text-secondary)]">{{ vectorStats }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 高级设置 -->
      <div class="px-4 pt-6 pb-8">
        <div class="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2 ml-1">高级</div>
        <div class="bg-[var(--card-bg)] rounded-[12px] overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <div>
              <div class="text-[15px] text-[var(--text-primary)]">小总结合并阈值</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">达到数量后合并为长期记忆</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.shortTermMergeThreshold"
                type="number"
                min="2"
                max="50"
                class="w-14 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">条</span>
            </div>
          </div>
          <div class="px-4 py-3 flex items-center justify-between border-t border-[var(--border-color)]">
            <div>
              <div class="text-[15px] text-[var(--text-primary)]">记忆注入上限</div>
              <div class="text-[12px] text-[var(--text-secondary)] mt-0.5">限制注入到对话上下文的记忆长度</div>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="settings.maxInjectTokens"
                type="number"
                min="50"
                max="5000"
                class="w-16 px-2 py-1 rounded-[8px] bg-[var(--bg-color)] text-[var(--text-primary)] text-[15px] text-center outline-none"
                @change="save"
              >
              <span class="text-[15px] text-[var(--text-secondary)]">token</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useContactsStore } from '../../stores/contacts'
import { useConfigsStore } from '../../stores/configs'
import { useStorage } from '../../composables/useStorage'
import { useMemory, DEFAULT_MEMORY_SETTINGS } from '../../composables/useMemory'

defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['back'])

const contactsStore = useContactsStore()
const configsStore = useConfigsStore()
const { scheduleSave } = useStorage()
const { initContactMemory } = useMemory()

const contact = computed(() => contactsStore.activeChat)
const configs = computed(() => configsStore.configs || [])

const settings = computed(() => {
  if (!contact.value) return { ...DEFAULT_MEMORY_SETTINGS }
  initContactMemory(contact.value)
  return contact.value.memorySettings
})

const keywordsText = ref('')
const testing = ref(false)
const rebuilding = ref(false)
const vectorStats = ref('')

watch(() => settings.value.keywords, (val) => {
  keywordsText.value = (val || []).join(', ')
}, { immediate: true })

function toggleSetting(key) {
  if (!contact.value) return
  initContactMemory(contact.value)
  contact.value.memorySettings[key] = !contact.value.memorySettings[key]
  scheduleSave()
}

function save() {
  scheduleSave()
}

function saveKeywords() {
  if (!contact.value) return
  initContactMemory(contact.value)
  contact.value.memorySettings.keywords = keywordsText.value
    .split(/[,，]/)
    .map(k => k.trim())
    .filter(k => k)
  scheduleSave()
}

async function testConnection() {
  if (testing.value || !contact.value) return
  const s = settings.value
  if (!s.embeddingApiUrl || !s.embeddingApiKey || !s.embeddingModel) {
    vectorStats.value = 'URL、Key、Model 均需填写'
    return
  }
  testing.value = true
  vectorStats.value = ''
  try {
    const { testEmbeddingConnection } = await import('../../composables/memory/embeddingApi')
    const result = await testEmbeddingConnection({
      url: s.embeddingApiUrl,
      key: s.embeddingApiKey,
      model: s.embeddingModel,
      dimensions: s.embeddingDimensions || 0
    })
    vectorStats.value = result.success
      ? `连接成功，向量维度: ${result.dimensions}`
      : `连接失败: ${result.error}`
  } catch (e) {
    vectorStats.value = '测试出错: ' + (e.message || String(e))
  } finally {
    testing.value = false
  }
}

async function rebuildVectorIndex() {
  if (rebuilding.value || !contact.value) return
  const s = settings.value
  if (!s.embeddingApiUrl || !s.embeddingApiKey || !s.embeddingModel) {
    vectorStats.value = 'URL、Key、Model 均需填写'
    return
  }
  rebuilding.value = true
  vectorStats.value = '正在重建...'
  try {
    const { createVectorStore } = await import('../../composables/memory/vectorStore')
    const vstore = createVectorStore(contact.value.id)
    await vstore.deleteByType('round')

    const { ensureRoundVectors } = await import('../../composables/retrieval/useHistorySearch')
    const config = {
      url: s.embeddingApiUrl,
      key: s.embeddingApiKey,
      model: s.embeddingModel,
      dimensions: s.embeddingDimensions || 0
    }
    const count = await ensureRoundVectors(contact.value, contact.value.msgs || [], config)
    const stats = await vstore.getStats()
    vectorStats.value = `重建完成: ${stats.rounds} 条对话轮次${count !== stats.rounds ? `（本次新增 ${count} 条）` : ''}`
    scheduleSave()
  } catch (e) {
    vectorStats.value = '重建出错: ' + (e.message || String(e))
  } finally {
    rebuilding.value = false
  }
}
</script>

