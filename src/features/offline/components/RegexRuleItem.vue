<template>
  <div class="rule-item">
    <button
      class="check-circle"
      :class="{ checked: rule.enabled }"
      @click="$emit('toggle')"
    >
      <i v-if="rule.enabled" class="ph-bold ph-check text-[10px]"></i>
    </button>

    <div class="rule-main">
      <div class="rule-top">
        <span class="rule-name">{{ rule.name || '未命名规则' }}</span>
        <span class="scope-badge" :class="'scope-' + (rule.scope || 'display')">{{ scopeLabel }}</span>
      </div>
      <div class="rule-meta">
        <span>排序 {{ rule.order ?? 0 }}</span>
        <span class="pattern-preview">{{ rule.pattern || '未填写正则' }}</span>
      </div>
    </div>

    <button class="icon-btn" @click="$emit('edit')">
      <i class="ph ph-pencil-simple"></i>
    </button>
    <button class="icon-btn icon-danger" @click="$emit('delete')">
      <i class="ph ph-trash"></i>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rule: { type: Object, required: true }
})

defineEmits(['toggle', 'edit', 'delete'])

const scopeLabel = computed(() => {
  const scope = props.rule.scope || 'display'
  return scope === 'display' ? '显示' : scope === 'prompt' ? '发送' : '双向'
})
</script>

<style scoped>
.rule-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: var(--off-radius, 14px);
  box-shadow: var(--off-shadow-sm, 2px 2px 0 #111);
  background: var(--off-surface, #fff);
}

.check-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--off-text-sec, #888);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: transparent;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
}
.check-circle.checked {
  border-color: var(--off-accent, #111);
  background: var(--off-accent, #111);
  color: var(--off-surface, #fff);
}

.rule-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rule-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rule-name {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: var(--off-text, #111);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 11px;
  color: var(--off-text-sec, #777);
}

.pattern-preview {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
}

.scope-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
  flex-shrink: 0;
}
.scope-display { background: #ccfbf1; color: #0d9488; }
.scope-prompt { background: #ffedd5; color: #ea580c; }
.scope-both { background: #e0e7ff; color: #4f46e5; }

.icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.04);
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  color: var(--off-text-sec, #888);
  cursor: pointer;
  font-size: 14px;
}

.icon-danger {
  color: var(--off-danger, #d32f2f);
}
</style>
