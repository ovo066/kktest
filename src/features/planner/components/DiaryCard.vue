<template>
  <div class="diary-card" @click="$emit('click')">
    <div class="card-date">
      <span class="date-day">{{ dayNum }}</span>
      <span class="date-info">{{ monthStr }} · {{ entry.weekday }}</span>
    </div>

    <div class="card-body">
      <div class="card-tags">
        <span v-if="entry.mood" class="tag mood-tag">{{ entry.mood }}</span>
        <span v-if="entry.weather" class="tag weather-tag">{{ entry.weather }}</span>
      </div>
      <p class="card-preview">{{ entry.content.slice(0, 80) }}{{ entry.content.length > 80 ? '…' : '' }}</p>
    </div>

    <div v-if="entry.images && entry.images.length" class="card-thumb">
      <img :src="entry.images[0]" class="thumb-img" alt="" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  entry: { type: Object, required: true }
})
defineEmits(['click'])

const dayNum = computed(() => {
  const d = new Date(props.entry.date + 'T00:00:00')
  return d.getDate()
})

const monthStr = computed(() => {
  const d = new Date(props.entry.date + 'T00:00:00')
  return `${d.getMonth() + 1}月`
})
</script>

<style scoped>
.diary-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: var(--card-bg, #fff);
  border: 1.5px solid rgba(0,0,0,0.05);
  border-radius: 20px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s;
}

.diary-card:active { transform: scale(0.98); }

.card-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}

.date-day {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-color, #5c4a4d);
  line-height: 1;
}

.date-info {
  font-size: 10px;
  color: var(--text-muted, #a89f9e);
  margin-top: 2px;
  text-align: center;
  white-space: nowrap;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}

.mood-tag {
  background: rgba(255,182,185,0.2);
  color: var(--planner-accent, #ffb6b9);
  border: 1px solid rgba(255,182,185,0.35);
}

.weather-tag {
  background: rgba(166,227,233,0.2);
  color: var(--planner-accent2, #a6e3e9);
  border: 1px solid rgba(166,227,233,0.35);
}

.card-preview {
  font-size: 13px;
  color: var(--text-muted, #a89f9e);
  line-height: 1.55;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-thumb {
  flex-shrink: 0;
}

.thumb-img {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
}
</style>
