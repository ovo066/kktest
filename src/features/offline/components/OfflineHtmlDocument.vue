<template>
  <div ref="hostRef" class="offline-html-document-host"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  html: { type: String, default: '' }
})

const hostRef = ref(null)
let shadowRootRef = null

function renderShadowHtml() {
  const host = hostRef.value
  if (!host) return

  shadowRootRef = shadowRootRef || host.shadowRoot || host.attachShadow({ mode: 'open' })
  shadowRootRef.innerHTML = props.html || ''
}

watch(() => props.html, () => {
  renderShadowHtml()
})

onMounted(() => {
  renderShadowHtml()
})

onBeforeUnmount(() => {
  if (shadowRootRef) shadowRootRef.innerHTML = ''
})
</script>

<style scoped>
.offline-html-document-host {
  display: block;
  width: 100%;
  min-width: 0;
}
</style>
