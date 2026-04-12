<template>
  <component
    :is="widgetComponent"
    v-if="widgetComponent"
    :config="widget.config"
    :class="sizeClass"
  />
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const componentMap = {
  clock: defineAsyncComponent(() => import('./ClockWidget.vue')),
  weather: defineAsyncComponent(() => import('./WeatherWidget.vue')),
  image: defineAsyncComponent(() => import('./ImageWidget.vue')),
  todo: defineAsyncComponent(() => import('./TodoWidget.vue')),
  quote: defineAsyncComponent(() => import('./QuoteWidget.vue')),
  calendar: defineAsyncComponent(() => import('./CalendarWidget.vue'))
}

const widgetComponent = computed(() => {
  return componentMap[props.widget.type] || null
})

const sizeClass = computed(() => {
  const sizeMap = {
    '2x1': 'widget-2x1',
    '2x2': 'widget-2x2',
    '4x2': 'widget-4x2'
  }
  return sizeMap[props.widget.size] || 'widget-2x2'
})
</script>

<style scoped>
.widget-2x1 {
  width: 170px;
  height: 80px;
}
.widget-2x2 {
  width: 170px;
  height: 170px;
}
.widget-4x2 {
  width: 350px;
  height: 170px;
}

@media (max-width: 400px) {
  .widget-2x1 {
    width: 150px;
    height: 70px;
  }
  .widget-2x2 {
    width: 150px;
    height: 150px;
  }
  .widget-4x2 {
    width: 310px;
    height: 150px;
  }
}
</style>
