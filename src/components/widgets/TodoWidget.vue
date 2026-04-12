<template>
  <div class="w-full h-full flex items-center justify-center p-2">
    <div
      class="widget-sticky relative w-full h-full"
      :style="{ backgroundColor: config.bgColor || '#fffdf0' }"
    >
      <!-- Washi tape decoration -->
      <div
        class="absolute -top-2 left-4 w-10 h-4 rounded-sm opacity-80 transform -rotate-6"
        :style="{ backgroundColor: config.tapeColor || '#90EE90' }"
      ></div>

      <!-- Title -->
      <div class="font-bold text-sm text-gray-700 mb-2 pt-3 px-3">
        {{ config.title || 'TODO' }}
      </div>

      <!-- Items -->
      <div class="px-3 space-y-1.5 overflow-y-auto max-h-[calc(100%-40px)]">
        <div
          v-for="item in config.items"
          :key="item.id"
          class="flex items-center gap-2 text-xs"
        >
          <span
            class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
            :class="item.done ? 'bg-green-500 border-green-500' : 'border-gray-400'"
          >
            <i v-if="item.done" class="ph-bold ph-check text-white text-[8px]"></i>
          </span>
          <span
            class="text-gray-700 truncate"
            :class="{ 'line-through opacity-50': item.done }"
          >
            {{ item.text }}
          </span>
        </div>

        <div v-if="!config.items?.length" class="text-xs text-gray-400 italic">
          暂无待办事项
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: {
    type: Object,
    default: () => ({ title: 'TODO', items: [], bgColor: '#fffdf0', tapeColor: '#90EE90' })
  }
})
</script>

<style scoped>
.widget-sticky {
  @apply rounded-[4px] shadow-md transform rotate-1;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
