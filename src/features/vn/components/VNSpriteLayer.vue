<template>
  <div class="absolute inset-0 pointer-events-none z-10 overflow-hidden">
    <VNSprite
      v-for="sp in sprites"
      :key="sp.characterId"
      :character-id="sp.characterId"
      :vn-name="sp.vnName"
      :expression="sp.expression"
      :position="sp.position"
      :animation="sp.animation"
      :image-url="sp.url"
      :is-exiting="!!sp.isExiting"
    />
  </div>
</template>

<script setup>
import VNSprite from '../../../components/media/VNSprite.vue'

defineProps({
  sprites: { type: Array, default: () => [] }
})
</script>
