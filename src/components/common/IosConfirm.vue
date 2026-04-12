<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center backdrop-blur-sm p-4"
      @click.self="handleCancel"
    >
      <div class="bg-[var(--card-bg)] backdrop-blur-xl rounded-2xl w-full max-w-[270px] overflow-hidden shadow-2xl">
        <div class="px-4 pt-5 pb-4 text-center">
          <div v-if="title" class="font-semibold text-[17px] text-[var(--text-primary)] mb-1">{{ title }}</div>
          <div class="text-[13px] text-[var(--text-secondary)]">{{ message }}</div>
        </div>
        <div class="flex border-t border-[var(--border-color)]">
          <button
            class="flex-1 py-[11px] text-[var(--primary-color)] text-[17px] border-r border-[var(--border-color)] active:bg-gray-200/50 dark:active:bg-gray-700/50"
            @click="handleCancel"
          >
            {{ cancelText }}
          </button>
          <button
            class="flex-1 py-[11px] text-[17px] font-semibold active:bg-gray-200/50 dark:active:bg-gray-700/50"
            :class="destructive ? 'text-red-500' : 'text-[var(--primary-color)]'"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '确定执行此操作？' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  destructive: { type: Boolean, default: false }
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

function handleConfirm() {
  emit('confirm')
  emit('update:visible', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>
