<template>
  <div
    v-if="visible"
    class="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--card-bg)]/80 backdrop-blur-md z-30"
  >
    <div class="flex items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar p-1">
      <button
        v-for="member in members"
        :key="member.id"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium shrink-0 transition-all border border-transparent"
        :class="selectedMemberId === member.id ? 'text-white shadow-md scale-105' : 'text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'"
        :style="{ backgroundColor: selectedMemberId === member.id ? 'var(--primary-color, #007AFF)' : 'var(--avatar-bg, #E9E9EB)' }"
        @click="$emit('update:selectedMemberId', member.id)"
      >
        <div
          class="w-5 h-5 rounded-full flex items-center justify-center text-xs overflow-hidden ring-1 ring-black/5"
          :class="selectedMemberId === member.id ? 'bg-white/20' : 'bg-white dark:bg-gray-600'"
        >
          <img v-if="member.avatarType === 'image'" :src="member.avatar" class="w-full h-full object-cover">
          <span v-else>{{ member.avatar }}</span>
        </div>
        <span>{{ member.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  members: { type: Array, default: () => [] },
  selectedMemberId: { type: String, default: '' }
})

defineEmits(['update:selectedMemberId'])
</script>

