<template>
  <div class="px-4 py-2">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-16 h-16 rounded-[24px] bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-100 mb-4">
        <i class="ph ph-scroll text-3xl text-white"></i>
      </div>
      <h2 class="text-xl font-bold text-slate-900">故事设定</h2>
      <p class="text-slate-500 text-sm">描绘一个动人的背景世界</p>
    </div>

    <div class="space-y-6">
      <textarea
        :value="worldSetting"
        @input="$emit('update:worldSetting', $event.target.value)"
        rows="6"
        class="w-full p-6 rounded-[24px] bg-gray-50 border border-gray-100 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50 outline-none transition-all text-base leading-relaxed resize-none"
        placeholder="例如：

现代日本高中，樱花纷飞的四月。
主角是一名刚转学来的高二学生，在新学校遇到了青梅竹马的邻家女孩...

描述越详细，AI 生成的剧情越贴合你的想法。"
      ></textarea>

      <div>
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">推荐题材模板</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="t in templates"
            :key="t.name"
            class="p-4 rounded-2xl bg-white border border-gray-100 text-left hover:border-amber-300 hover:ring-4 hover:ring-amber-50 active:scale-[0.97] transition-all group"
            @click="$emit('update:worldSetting', t.content)"
          >
            <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-amber-50 transition-colors">
              <i :class="['ph', t.icon, 'text-lg text-slate-400 group-hover:text-amber-500']"></i>
            </div>
            <div class="font-bold text-slate-700 text-sm">{{ t.name }}</div>
            <div class="text-slate-400 text-[11px] mt-1 line-clamp-2">{{ t.preview }}</div>
          </button>
        </div>
      </div>

      <div class="flex justify-center pt-4">
        <button
          class="text-slate-400 text-sm font-medium hover:text-indigo-600 transition-colors"
          @click="$emit('update:worldSetting', ''); $emit('next')"
        >
          跳过，让 AI 自由发挥
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  worldSetting: { type: String, default: '' }
})

defineEmits(['update:worldSetting', 'next'])

const templates = [
  {
    name: '校园恋爱',
    icon: 'ph-heart',
    preview: '现代日本高中，樱花季节...',
    content: `现代日本高中，樱花纷飞的四月。

故事发生在一所普通的公立高中。主角是一名刚转学来的高二学生，性格内向但善良。

在新学校，主角遇到了各种性格迥异的同学：开朗活泼的邻座女生、冷淡傲娇的学生会长、温柔体贴的青梅竹马...

这是一个关于青春、友情与爱情的温馨故事。`
  },
  {
    name: '奇幻冒险',
    icon: 'ph-sword',
    preview: '剑与魔法的异世界...',
    content: `剑与魔法的异世界，一个名为"艾欧尼亚"的大陆。

主角是一名觉醒了特殊能力的少年/少女，被卷入了一场关乎世界存亡的冒险。

旅途中会遇到各种同伴：神秘的精灵法师、豪爽的兽人战士、可爱的龙族少女...

这是一个关于勇气、羁绊与成长的史诗故事。`
  },
  {
    name: '都市悬疑',
    icon: 'ph-detective',
    preview: '现代都市，神秘事件...',
    content: `现代都市，霓虹闪烁的夜晚。

主角是一名普通的大学生/上班族，无意中卷入了一起神秘事件。

随着调查深入，主角发现这座城市隐藏着不为人知的秘密，身边的人也各有故事...

这是一个关于真相、信任与抉择的悬疑故事。`
  },
  {
    name: '日常治愈',
    icon: 'ph-coffee',
    preview: '宁静小镇，温馨日常...',
    content: `远离喧嚣的海边小镇，四季分明，风景如画。

主角因为某些原因来到这个小镇，开始了新的生活。

在这里遇到了各种温暖的人们：开朗的面包店老板娘、沉默寡言但心地善良的邻居、总是元气满满的后辈...

这是一个关于治愈、成长与新开始的温馨故事。`
  }
]
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
