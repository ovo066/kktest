<script setup>
import { computed } from 'vue'

const props = defineProps({
  preset: { type: Object, required: true }
})

const emit = defineEmits(['edit', 'delete', 'select'])

const promptEntryCount = computed(() =>
  Array.isArray(props.preset?.promptEntries) ? props.preset.promptEntries.length : 0
)

const enabledEntryCount = computed(() =>
  Array.isArray(props.preset?.promptEntries)
    ? props.preset.promptEntries.filter(entry => entry?.enabled !== false).length
    : 0
)

const maxTokensLabel = computed(() =>
  props.preset?.maxTokens != null ? props.preset.maxTokens : '无限制'
)
</script>

<template>
  <div class="meet-preset-card" @click="emit('select', preset)">
    <div class="preset-header">
      <div class="preset-name">{{ preset.name }}</div>
      <span class="preset-badge" :class="preset.source">
        {{ preset.source === 'sillytavern' ? 'ST' : '自定义' }}
      </span>
    </div>
    <div class="preset-meta">
      <span>Temp: {{ preset.temperature }}</span>
      <span>MaxTok: {{ maxTokensLabel }}</span>
      <span v-if="promptEntryCount > 0">Entries: {{ enabledEntryCount }}/{{ promptEntryCount }}</span>
    </div>
    <div class="preset-actions">
      <button class="preset-btn" @click.stop="emit('edit', preset)">
        <i class="ph ph-pencil-simple"></i>
      </button>
      <button class="preset-btn danger" @click.stop="emit('delete', preset)">
        <i class="ph ph-trash"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.meet-preset-card {
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #333;
  padding: 18px 20px;
  cursor: pointer;
  transition: all 0.25s;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-preset-card:hover {
  border-color: #555;
  background: rgba(255, 255, 255, 0.04);
}

.meet-preset-card:active {
  transform: scale(0.98);
}

.preset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.preset-name {
  font-weight: 700;
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 2px;
}

.preset-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #444;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
}

.preset-badge.sillytavern {
  border-color: #666;
  color: rgba(255, 255, 255, 0.7);
}

.preset-meta {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 14px;
  letter-spacing: 1px;
}

.preset-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.preset-btn {
  background: #000;
  border: 1px solid #444;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s;
}

.preset-btn:hover { background: #333; }
.preset-btn:active { transform: scale(0.9); }

.preset-btn.danger {
  color: rgba(200, 100, 100, 0.6);
  border-color: rgba(200, 100, 100, 0.3);
}

.preset-btn.danger:hover {
  background: rgba(200, 100, 100, 0.1);
}
</style>
