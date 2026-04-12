<template>
  <div class="flex flex-col items-center text-center max-w-sm mx-auto px-4 py-2">
    <div class="w-20 h-20 rounded-[28px] bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-100 mb-8">
      <i class="ph ph-note-pencil text-4xl text-white"></i>
    </div>

    <h2 class="text-2xl font-bold text-slate-900 mb-2">给项目起个名字</h2>
    <p class="text-slate-500 text-sm mb-10">一个好听的名字是故事成功的开始</p>

    <input
      :value="name"
      @input="$emit('update:name', $event.target.value)"
      type="text"
      class="w-full h-16 px-6 rounded-2xl bg-gray-50 border border-gray-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-lg font-medium"
      placeholder="输入项目名称..."
      autofocus
      @keydown.enter="name.trim() && $emit('next')"
    >

    <div class="mt-10 w-full">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 text-left">灵感推荐</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex"
          class="px-4 py-2 rounded-full bg-white border border-gray-100 text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 active:scale-95 transition-all"
          @click="$emit('update:name', ex)"
        >
          {{ ex }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  name: { type: String, default: '' }
})

defineEmits(['update:name', 'next'])

const examples = [
  '校园恋爱物语',
  '异世界冒险记',
  '都市悬疑录',
  '青春日记'
]
</script>
