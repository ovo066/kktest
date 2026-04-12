<template>
  <div class="entry-item">
    <div class="entry-row" @click="expanded = !expanded">
      <button
        class="check-circle"
        :class="{ checked: entry.enabled }"
        @click.stop="$emit('toggle')"
      >
        <i v-if="entry.enabled" class="ph-bold ph-check text-[10px]"></i>
      </button>

      <div class="entry-main">
        <div class="entry-head">
          <span class="entry-name">{{ entry.name || entry.identifier || `条目 ${index + 1}` }}</span>
          <span class="role-badge" :class="'role-' + (entry.role || 'system')">{{ roleLabel }}</span>
        </div>
        <div class="entry-meta">
          <span>ID {{ entry.identifier || entry.id }}</span>
          <span>深度 {{ entry.injectionDepth ?? 0 }}</span>
          <span>排序 {{ entry.order ?? index }}</span>
        </div>
      </div>

      <button class="icon-btn" @click.stop="expanded = !expanded">
        <i class="ph ph-caret-down expand-icon" :class="{ rotated: expanded }"></i>
      </button>
      <button class="icon-btn danger" @click.stop="$emit('delete')">
        <i class="ph ph-trash"></i>
      </button>
    </div>

    <Transition name="expand">
      <div v-if="expanded" class="entry-expand">
        <div class="entry-field">
          <label class="field-label">名称</label>
          <input
            :value="entry.name"
            class="field-input"
            placeholder="条目名称"
            @change="emitTextField('name', $event.target.value)"
          >
        </div>

        <div class="entry-field">
          <label class="field-label">Identifier</label>
          <input
            :value="entry.identifier"
            class="field-input field-mono"
            placeholder="main"
            @change="emitTextField('identifier', $event.target.value)"
          >
        </div>

        <div class="entry-grid">
          <div class="entry-field">
            <label class="field-label">角色</label>
            <select
              :value="entry.role || 'system'"
              class="field-input"
              @change="emitTextField('role', $event.target.value)"
            >
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>
          </div>

          <div class="entry-field">
            <label class="field-label">位置</label>
            <input
              :value="entry.injectionPosition || 'in_chat'"
              class="field-input"
              placeholder="in_chat"
              @change="emitTextField('injectionPosition', $event.target.value)"
            >
          </div>

          <div class="entry-field">
            <label class="field-label">深度</label>
            <input
              :value="entry.injectionDepth ?? 0"
              type="number"
              class="field-input"
              step="1"
              min="-50"
              max="50"
              @change="emitNumberField('injectionDepth', $event.target.value, 0)"
            >
          </div>

          <div class="entry-field">
            <label class="field-label">排序</label>
            <input
              :value="entry.order ?? index"
              type="number"
              class="field-input"
              step="1"
              min="-999"
              max="999"
              @change="emitNumberField('order', $event.target.value, index)"
            >
          </div>
        </div>

        <div class="entry-field">
          <label class="field-label">内容</label>
          <textarea
            :value="entry.content"
            class="entry-textarea"
            rows="6"
            placeholder="条目内容..."
            @input="emitTextField('content', $event.target.value)"
          ></textarea>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  entry: { type: Object, required: true },
  index: { type: Number, default: 0 }
})

const emit = defineEmits(['toggle', 'delete', 'update-field'])

const expanded = ref(false)

const roleLabel = computed(() => {
  const role = props.entry.role || 'system'
  return role === 'system' ? 'Sys' : role === 'user' ? 'Usr' : 'Ast'
})

function emitTextField(key, value) {
  emit('update-field', { [key]: String(value ?? '') })
}

function emitNumberField(key, value, fallback = 0) {
  const parsed = Number(value)
  emit('update-field', {
    [key]: Number.isFinite(parsed) ? parsed : fallback
  })
}
</script>

<style scoped>
.entry-item {
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  background: rgba(17, 17, 17, 0.03);
  overflow: hidden;
}

.entry-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
}

.check-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--off-text-sec, #888);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: transparent;
  flex-shrink: 0;
  cursor: pointer;
}

.check-circle.checked {
  border-color: var(--off-accent, #111);
  background: var(--off-accent, #111);
  color: var(--off-surface, #fff);
}

.entry-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.entry-name {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--off-text, #111);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 10px;
  color: var(--off-text-sec, #777);
}

.role-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 700;
  flex-shrink: 0;
}

.role-system { background: #dbeafe; color: #2563eb; }
.role-user { background: #dcfce7; color: #16a34a; }
.role-assistant { background: #f3e8ff; color: #9333ea; }

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--off-text-sec, #888);
  cursor: pointer;
  flex-shrink: 0;
}

.icon-btn.danger {
  color: var(--off-danger, #d32f2f);
}

.expand-icon {
  transition: transform 0.2s;
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

.entry-expand {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px 12px;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.entry-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--off-text-sec, #888);
}

.field-input {
  width: 100%;
  border: 1px solid rgba(17, 17, 17, 0.16);
  border-radius: 10px;
  background: #fff;
  color: var(--off-text, #111);
  padding: 8px 10px;
  font-size: 12px;
  outline: none;
}

.field-mono {
  font-family: 'Courier New', monospace;
}

.entry-textarea {
  width: 100%;
  min-height: 110px;
  background: #fff;
  color: var(--off-text, #111);
  border: 1px solid rgba(17, 17, 17, 0.16);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
}

.expand-enter-active, .expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to, .expand-leave-from {
  max-height: 800px;
  opacity: 1;
}

@media (max-width: 640px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
