<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-[1100] flex items-end justify-center"
        @click.self="$emit('cancel')"
      >
        <!-- 背景遮罩 -->
        <div class="absolute inset-0 bg-black/30 backdrop-blur-md" @click="$emit('cancel')"></div>

        <!-- 弹窗内容 - 液态玻璃 -->
        <div class="relative w-full max-w-lg memory-edit-glass rounded-t-[24px] overflow-hidden">
          <!-- 拖动指示条 -->
          <div class="flex justify-center pt-3 pb-1">
            <div class="w-10 h-[3px] rounded-full bg-[var(--text-secondary)]/15"></div>
          </div>

          <!-- 头部 -->
          <div class="flex justify-between items-center px-5 pb-3">
            <button
              class="text-[var(--text-secondary)] text-[16px] w-14 opacity-70 active:opacity-40 transition-opacity"
              @click="$emit('cancel')"
            >
              取消
            </button>
            <span class="font-medium text-[17px] text-[var(--text-primary)] tracking-wide">
              {{ memory ? '编辑记忆' : '添加记忆' }}
            </span>
            <button
              class="text-[var(--primary-color)] text-[16px] font-semibold w-14 text-right active:opacity-60 transition-opacity"
              :class="{ 'opacity-25': !content.trim() }"
              :disabled="!content.trim()"
              @click="handleConfirm"
            >
              保存
            </button>
          </div>

          <!-- 内容输入 -->
          <div class="px-5 pb-4">
            <textarea
              ref="textareaRef"
              v-model="content"
              class="w-full h-28 p-4 rounded-2xl memory-edit-input text-[var(--text-primary)] text-[15px] leading-relaxed resize-none outline-none transition-all duration-200"
              placeholder="输入要记住的内容..."
            ></textarea>
          </div>

          <!-- 优先级选择 -->
          <div v-if="showPriority" class="px-5 pb-6">
            <div class="text-[12px] text-[var(--text-secondary)] mb-2.5 font-medium tracking-wide opacity-60 uppercase">优先级</div>
            <div class="flex gap-2">
              <button
                v-for="p in priorities"
                :key="p.value"
                class="flex-1 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 flex items-center justify-center gap-1.5"
                :class="priority === p.value
                  ? 'memory-priority-active text-white'
                  : 'memory-priority-inactive text-[var(--text-primary)]'"
                @click="priority = p.value"
              >
                <i v-if="p.value === 'high'" class="ph-fill ph-star text-[12px]"></i>
                {{ p.label }}
              </button>
            </div>
          </div>

          <!-- 底部安全区 -->
          <div class="h-6"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  memory: { type: Object, default: null },
  showPriority: { type: Boolean, default: true }
})

const emit = defineEmits(['cancel', 'confirm'])

const content = ref('')
const priority = ref('normal')
const textareaRef = ref(null)

const priorities = [
  { value: 'high', label: '重要' },
  { value: 'normal', label: '普通' },
  { value: 'low', label: '次要' }
]

watch(() => props.visible, (val) => {
  if (val) {
    content.value = props.memory?.content || ''
    priority.value = props.memory?.priority || 'normal'
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }
})

function handleConfirm() {
  if (!content.value.trim()) return
  emit('confirm', content.value, priority.value)
}
</script>

<style scoped>
.memory-edit-glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(40px) saturate(1.5);
  -webkit-backdrop-filter: blur(40px) saturate(1.5);
  border-top: 0.5px solid rgba(255, 255, 255, 0.6);
}
.dark .memory-edit-glass {
  background: rgba(30, 30, 30, 0.88);
  border-top-color: rgba(255, 255, 255, 0.1);
}
.memory-edit-input {
  background: rgba(0, 0, 0, 0.03);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
}
.memory-edit-input:focus {
  background: rgba(0, 0, 0, 0.02);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color), 0.08);
}
.dark .memory-edit-input {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}
.dark .memory-edit-input:focus {
  background: rgba(255, 255, 255, 0.07);
  border-color: var(--primary-color);
}
.memory-edit-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.4;
}
.memory-priority-active {
  background: var(--primary-color);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
.memory-priority-inactive {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 0.5px solid rgba(255, 255, 255, 0.3);
}
.dark .memory-priority-inactive {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(100%);
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
