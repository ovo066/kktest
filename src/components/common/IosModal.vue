<template>
  <Teleport to="#app">
    <div
      v-if="visible"
      class="absolute inset-0 bg-black/40 z-40 flex items-end backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div
        ref="modalInner"
        class="bg-[var(--bg-color)] dark:bg-[var(--card-bg)] w-full rounded-t-[14px] flex flex-col transition-transform duration-300"
        :class="innerClass"
        :style="{ height: height }"
      >
        <div class="flex justify-between items-center px-4 py-3 border-b border-[var(--border-color)] shrink-0">
          <button
            v-if="showDelete"
            class="text-red-500 text-[17px] w-16"
            @click="$emit('delete')"
          >
            删除
          </button>
          <button
            v-else
            class="text-[var(--primary-color)] text-[17px] w-16"
            @click="$emit('close')"
          >
            取消
          </button>
          <span class="font-semibold text-[17px] text-[var(--text-primary)]">{{ title }}</span>
          <button
            class="text-[var(--primary-color)] font-semibold text-[17px] w-16 text-right"
            @click="$emit('done')"
          >
            完成
          </button>
        </div>
        <div class="flex-1 overflow-y-auto no-scrollbar">
          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  height: {
    type: String,
    default: '85%'
  },
  showDelete: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close', 'done', 'delete'])

const modalInner = ref(null)
const innerClass = ref('translate-y-full')

watch(() => props.visible, async (val) => {
  if (val) {
    innerClass.value = 'translate-y-full'
    await nextTick()
    setTimeout(() => {
      innerClass.value = ''
    }, 10)
  } else {
    innerClass.value = 'translate-y-full'
  }
}, { immediate: true })
</script>
