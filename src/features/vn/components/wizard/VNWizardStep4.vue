<template>
  <div class="px-4 py-2">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-20 h-20 rounded-[28px] bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-xl shadow-cyan-100 mb-6">
        <i class="ph ph-rocket-launch text-4xl text-white"></i>
      </div>
      <h2 class="text-2xl font-bold text-slate-900">准备就绪</h2>
      <p class="text-slate-500">万事俱备，开启你的故事旅程</p>
    </div>

    <div class="space-y-4 mb-10">
      <!-- Project name -->
      <div class="p-5 rounded-[24px] bg-white border border-gray-100 shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
          <i class="ph ph-book-open text-2xl text-indigo-500"></i>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] font-bold text-slate-400 uppercase">项目名称</p>
          <h3 class="font-bold text-slate-900 truncate">{{ form.name || '未命名' }}</h3>
        </div>
      </div>

      <!-- Characters -->
      <div class="p-5 rounded-[24px] bg-white border border-gray-100 shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
            <i class="ph ph-users-three text-2xl text-violet-500"></i>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase">参演角色</p>
            <p class="font-bold text-slate-900">{{ form.characters.length }} 个角色</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="ch in form.characters"
            :key="ch.contactId"
            class="px-3 py-1.5 rounded-lg bg-gray-50 text-sm font-medium text-slate-700 flex items-center gap-1"
            :style="{ borderLeft: `3px solid ${ch.nameColor || '#6366f1'}` }"
          >
            {{ ch.vnName }}
            <span class="text-slate-400 text-[11px] ml-1">
              {{ ch.role === 'protagonist' ? '主角' : ch.role === 'heroine' ? '女主' : '配角' }}
            </span>
          </div>
        </div>
      </div>

      <!-- World setting -->
      <div class="p-5 rounded-[24px] bg-white border border-gray-100 shadow-sm">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
            <i class="ph ph-scroll text-2xl text-amber-500"></i>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase">故事设定</p>
            <p class="font-bold text-slate-900">{{ form.worldSetting ? '已填写' : '由 AI 自由发挥' }}</p>
          </div>
        </div>
        <div v-if="form.worldSetting" class="text-slate-500 text-[13px] leading-relaxed line-clamp-3 pl-[64px]">
          {{ form.worldSetting }}
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="space-y-3">
      <button
        class="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        @click="$emit('create-with-prepare')"
      >
        <i class="ph ph-images text-lg"></i>
        预生成资源后开始
      </button>

      <button
        class="w-full py-4 rounded-2xl bg-white border border-gray-200 text-slate-600 font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        @click="$emit('create')"
      >
        <i class="ph ph-play text-lg"></i>
        直接开始（按需生成）
      </button>

      <div class="text-center text-slate-400 text-[12px] pt-2">
        <i class="ph ph-info mr-1"></i>
        预生成资源可以让播放更流畅，但需要等待生成完成
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  form: { type: Object, required: true }
})

defineEmits(['create', 'create-with-prepare'])
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
