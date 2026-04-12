<template>
  <div class="w-full h-full flex items-center justify-center p-2">
    <div
      class="widget-polaroid relative"
      :style="{ transform: `rotate(${config.rotation || 0}deg)` }"
    >
      <!-- Tape decoration -->
      <div
        v-if="config.tape"
        class="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 rounded-sm opacity-80 z-10"
        :style="{ backgroundColor: config.tapeColor || '#ffc0cb' }"
      ></div>

      <!-- Photo area -->
      <div class="w-full aspect-square bg-gray-100 overflow-hidden">
        <img
          v-if="config.src"
          :src="config.src"
          class="w-full h-full object-cover"
          alt="polaroid"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center text-gray-300"
        >
          <i class="ph ph-image text-4xl"></i>
        </div>
      </div>

      <!-- Caption -->
      <div
        v-if="config.caption"
        class="text-center text-sm text-gray-600 mt-2 font-handwriting truncate px-1"
      >
        {{ config.caption }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: {
    type: Object,
    default: () => ({ src: '', caption: '', rotation: 0, tape: true, tapeColor: '#ffc0cb' })
  }
})
</script>

<style scoped>
.widget-polaroid {
  @apply bg-white p-2 pb-6 rounded shadow-lg;
  max-width: 140px;
}

.font-handwriting {
  font-family: 'Comic Sans MS', cursive, sans-serif;
}
</style>
