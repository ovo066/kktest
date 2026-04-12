<template>
  <div v-if="images.length > 0" class="px-3 py-2">
    <div class="flex gap-2 overflow-x-auto no-scrollbar">
      <div v-for="(img, index) in images" :key="img + index" class="relative flex-shrink-0">
        <img :src="img" class="w-16 h-16 object-cover rounded-lg">
        <button class="absolute -top-1 -right-1 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs" @click="$emit('remove', index)">
          <i class="ph-bold ph-x"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  images: { type: Array, default: () => [] }
})

defineEmits(['remove'])
</script>
