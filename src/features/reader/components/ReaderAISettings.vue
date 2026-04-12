<template>
  <Teleport to="body">
    <Transition name="ai-settings-sheet">
      <div v-if="visible" class="fixed inset-0 z-[972]">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/25" @click="$emit('close')"></div>

        <!-- Panel -->
        <div class="absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-[24px] bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-white/30 dark:border-white/8 flex flex-col overflow-hidden pb-app">
          <!-- Handle -->
          <div class="flex justify-center pt-3 pb-1 shrink-0">
            <div class="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20"></div>
          </div>

          <!-- Title -->
          <div class="flex items-center justify-between px-5 pb-3 shrink-0">
            <h2 class="text-[16px] font-semibold text-[var(--text-primary)]">{{ roleName ? roleName + ' 伴读设置' : '伴读设置' }}</h2>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
              @click="$emit('close')"
            >
              <i class="ph ph-x text-[17px] text-[var(--text-secondary)]"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 pb-6 space-y-5">

            <!-- 记忆共享 -->
            <section>
              <div class="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 ml-1">记忆共享</div>
              <div class="rounded-[14px] bg-black/[0.03] dark:bg-white/[0.04] overflow-hidden">
                <!-- 共享主聊天记忆 -->
                <div class="px-4 py-3 flex items-center justify-between">
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="text-[14px] text-[var(--text-primary)]">共享主聊天记忆</div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">让伴读角色了解主聊天中的人物关系和偏好</div>
                  </div>
                  <button
                    class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
                    :class="settings.shareMemory ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="toggle('shareMemory')"
                  >
                    <div
                      class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                      :class="settings.shareMemory ? 'translate-x-[22px]' : 'translate-x-[2px]'"
                    ></div>
                  </button>
                </div>

                <!-- 伴读窗口保留记忆 -->
                <div class="px-4 py-3 border-t border-black/5 dark:border-white/5">
                  <div class="text-[14px] text-[var(--text-primary)]">注入主聊天记录</div>
                  <div class="text-[11px] text-[var(--text-secondary)] mt-0.5 mb-2">将主聊天最近的消息注入伴读上下文，让角色知道之前聊了什么</div>
                  <div class="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/8 w-fit max-w-full overflow-x-auto no-scrollbar"
                    :class="!settings.shareMemory ? 'opacity-40 pointer-events-none' : ''"
                  >
                    <button
                      v-for="opt in chatHistoryOptions"
                      :key="opt.value"
                      class="px-3 py-1 rounded-full text-[11px] transition-colors whitespace-nowrap"
                      :class="settings.shareChatHistoryCount === opt.value
                        ? 'bg-white dark:bg-[#1f1f21] text-[var(--text-primary)] font-semibold shadow-sm'
                        : 'text-[var(--text-secondary)]'"
                      @click="setField('shareChatHistoryCount', opt.value)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <!-- 伴读窗口保留记忆 -->
                <div class="px-4 py-3 border-t border-black/5 dark:border-white/5">
                  <div class="text-[14px] text-[var(--text-primary)]">伴读窗口保留记忆</div>
                  <div class="text-[11px] text-[var(--text-secondary)] mt-0.5 mb-2">控制每次请求保留的历史条数；全部表示不压缩删除</div>
                  <div class="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/8 w-fit max-w-full overflow-x-auto no-scrollbar">
                    <button
                      v-for="opt in chatMemoryKeepOptions"
                      :key="opt.value"
                      class="px-3 py-1 rounded-full text-[11px] transition-colors whitespace-nowrap"
                      :class="settings.chatWindowMemoryKeepCount === opt.value
                        ? 'bg-white dark:bg-[#1f1f21] text-[var(--text-primary)] font-semibold shadow-sm'
                        : 'text-[var(--text-secondary)]'"
                      @click="setField('chatWindowMemoryKeepCount', opt.value)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <!-- 共享世界书 -->
                <div class="px-4 py-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="text-[14px] text-[var(--text-primary)]">共享世界书</div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">将主聊天绑定的世界书条目注入伴读上下文</div>
                  </div>
                  <button
                    class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
                    :class="settings.shareLorebook ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="toggle('shareLorebook')"
                  >
                    <div
                      class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                      :class="settings.shareLorebook ? 'translate-x-[22px]' : 'translate-x-[2px]'"
                    ></div>
                  </button>
                </div>
              </div>
            </section>

            <!-- 系统提示词 -->
            <section>
              <div class="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 ml-1">系统提示词</div>
              <div class="rounded-[14px] bg-black/[0.03] dark:bg-white/[0.04] px-4 py-3">
                <div class="text-[14px] text-[var(--text-primary)]">伴读自定义系统提示词</div>
                <div class="text-[11px] text-[var(--text-secondary)] mt-0.5 mb-2">
                  角色人设始终保留；此处填写的内容作为额外偏好/格式指令追加到系统提示词，不会覆盖人设。
                </div>
                <textarea
                  :value="settings.customSystemPrompt || ''"
                  class="w-full min-h-[120px] rounded-[12px] border border-black/8 dark:border-white/10 bg-white/85 dark:bg-black/12 px-3 py-2.5 text-[13px] leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none resize-y"
                  placeholder="例如：你是一个耐心、善于提问的阅读搭档，优先帮助我理解当前页的人物动机与伏笔。"
                  @input="setCustomSystemPrompt($event.target?.value || '')"
                ></textarea>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-[10px] text-[var(--text-secondary)]">当前 {{ customPromptLength }} 字</span>
                  <button
                    class="text-[11px] text-[var(--text-secondary)] active:text-[var(--text-primary)] transition-colors disabled:opacity-40"
                    :disabled="!settings.customSystemPrompt"
                    @click="setCustomSystemPrompt('')"
                  >
                    清空
                  </button>
                </div>
              </div>
            </section>

            <!-- 章节摘要 -->
            <section>
              <div class="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 ml-1">章节摘要</div>
              <div class="rounded-[14px] bg-black/[0.03] dark:bg-white/[0.04] overflow-hidden">
                <!-- 自动生成章节摘要 -->
                <div class="px-4 py-3 flex items-center justify-between border-b border-black/5 dark:border-white/5">
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="text-[14px] text-[var(--text-primary)]">自动章节摘要</div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">切换章节时自动为上一章生成摘要</div>
                  </div>
                  <button
                    class="w-[51px] h-[31px] rounded-full transition-colors relative shrink-0"
                    :class="settings.autoChapterSummary ? 'bg-[var(--primary-color)]' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="toggle('autoChapterSummary')"
                  >
                    <div
                      class="absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-sm transition-transform duration-200"
                      :class="settings.autoChapterSummary ? 'translate-x-[22px]' : 'translate-x-[2px]'"
                    ></div>
                  </button>
                </div>

                <!-- 注入摘要章数 -->
                <div
                  class="px-4 py-3 flex items-center justify-between"
                  :class="!settings.autoChapterSummary ? 'opacity-40 pointer-events-none' : ''"
                >
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="text-[14px] text-[var(--text-primary)]">注入最近摘要</div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">对话中注入最近几章的摘要</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                      @click="adjustNumber('maxSummaryChapters', -1, 1, 10)"
                    >
                      <i class="ph ph-minus text-[12px] text-[var(--text-secondary)]"></i>
                    </button>
                    <span class="text-[14px] font-semibold text-[var(--text-primary)] w-5 text-center tabular-nums">{{ settings.maxSummaryChapters }}</span>
                    <button
                      class="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                      @click="adjustNumber('maxSummaryChapters', 1, 1, 10)"
                    >
                      <i class="ph ph-plus text-[12px] text-[var(--text-secondary)]"></i>
                    </button>
                    <span class="text-[12px] text-[var(--text-secondary)]">章</span>
                  </div>
                </div>
              </div>

              <!-- 已生成摘要统计 -->
              <div v-if="summaryCount > 0" class="mt-2 flex items-center justify-between px-1">
                <span class="text-[11px] text-[var(--text-secondary)]">
                  已生成 {{ summaryCount }} 章摘要
                </span>
                <button
                  class="text-[11px] text-red-400 active:text-red-500 transition-colors"
                  @click="$emit('clear-summaries')"
                >
                  清除全部
                </button>
              </div>
            </section>

            <!-- 快捷操作 -->
            <section>
              <div class="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 ml-1">快捷操作</div>
              <div class="rounded-[14px] bg-black/[0.03] dark:bg-white/[0.04] overflow-hidden">
                <!-- 翻译目标语言 -->
                <div class="px-4 py-3 flex items-center justify-between border-b border-black/5 dark:border-white/5">
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="text-[14px] text-[var(--text-primary)]">翻译目标语言</div>
                  </div>
                  <div class="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/8">
                    <button
                      v-for="opt in translateOptions"
                      :key="opt.value"
                      class="px-2.5 py-1 rounded-full text-[11px] transition-colors"
                      :class="settings.translateTarget === opt.value
                        ? 'bg-white dark:bg-[#1f1f21] text-[var(--text-primary)] font-semibold shadow-sm'
                        : 'text-[var(--text-secondary)]'"
                      @click="setField('translateTarget', opt.value)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <!-- 快捷操作 API -->
                <div class="px-4 py-3 flex items-center justify-between">
                  <div class="flex-1 min-w-0 pr-3">
                    <div class="text-[14px] text-[var(--text-primary)]">快捷操作 API</div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">解释/总结/翻译使用的 API</div>
                  </div>
                  <select
                    :value="settings.quickActionConfigId"
                    class="bg-transparent text-[var(--text-secondary)] text-[13px] outline-none text-right max-w-[130px] truncate"
                    @change="setField('quickActionConfigId', $event.target.value || null)"
                  >
                    <option value="">跟随角色</option>
                    <option v-for="cfg in configs" :key="cfg.id" :value="cfg.id">
                      {{ cfg.name || cfg.model || 'API ' + cfg.id.slice(-4) }}
                    </option>
                  </select>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useConfigsStore } from '../../../stores/configs'
import { useReaderStore } from '../../../stores/reader'
import { useStorage } from '../../../composables/useStorage'

defineProps({
  visible: { type: Boolean, default: false },
  roleName: { type: String, default: '' }
})

defineEmits(['close', 'clear-summaries'])

const configsStore = useConfigsStore()
const readerStore = useReaderStore()
const { scheduleSave } = useStorage()

const settings = computed(() => readerStore.readerAISettings)
const configs = computed(() => configsStore.configs || [])

const summaryCount = computed(() => {
  const book = readerStore.activeBook
  return book?.chapterSummaries?.length || 0
})
const customPromptLength = computed(() => String(settings.value?.customSystemPrompt || '').length)

const translateOptions = [
  { value: 'auto', label: '自动' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'EN' },
  { value: 'ja', label: '日本語' }
]

const chatMemoryKeepOptions = [
  { value: 12, label: '12 条' },
  { value: 20, label: '20 条' },
  { value: 30, label: '30 条' },
  { value: 50, label: '50 条' },
  { value: 0, label: '全部' }
]

const chatHistoryOptions = [
  { value: 0, label: '不注入' },
  { value: 10, label: '10 条' },
  { value: 20, label: '20 条' },
  { value: 30, label: '30 条' }
]

function toggle(key) {
  readerStore.readerAISettings[key] = !readerStore.readerAISettings[key]
  scheduleSave()
}

function setField(key, value) {
  readerStore.readerAISettings[key] = value
  scheduleSave()
}

function setCustomSystemPrompt(value) {
  setField('customSystemPrompt', typeof value === 'string' ? value : '')
}

function adjustNumber(key, delta, min, max) {
  const current = readerStore.readerAISettings[key] || 0
  readerStore.readerAISettings[key] = Math.max(min, Math.min(max, current + delta))
  scheduleSave()
}
</script>

<style scoped>
.ai-settings-sheet-enter-active {
  transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.ai-settings-sheet-leave-active {
  transition: all 0.25s ease-in;
}
.ai-settings-sheet-enter-from,
.ai-settings-sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>

