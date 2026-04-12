<template>
  <div class="schedule-toggle">
    <button
      class="toggle-btn"
      :class="{ active: mode === 'user' }"
      @click="$emit('update:mode', 'user')"
    >
      <div class="avatar-circle">
        <img v-if="userAvatar" :src="userAvatar" class="avatar-img" alt="" />
        <span v-else class="material-symbols-outlined" style="font-size:16px">person</span>
      </div>
      <span class="toggle-label">我的</span>
    </button>
    <button
      v-if="characterName"
      class="toggle-btn"
      :class="{ active: mode === 'character' }"
      @click="$emit('update:mode', 'character')"
    >
      <div class="avatar-circle char">
        <img v-if="characterAvatar" :src="characterAvatar" class="avatar-img" alt="" />
        <span v-else class="avatar-letter">{{ characterName[0] }}</span>
        <span v-if="isBusy" class="busy-dot" />
      </div>
      <span class="toggle-label">{{ characterName.slice(0, 4) }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  mode: { type: String, default: 'user' },
  userAvatar: { type: String, default: '' },
  characterAvatar: { type: String, default: '' },
  characterName: { type: String, default: '' },
  isBusy: { type: Boolean, default: false }
})
defineEmits(['update:mode'])
</script>

<style scoped>
.schedule-toggle {
  display: flex;
  gap: 6px;
  align-items: center;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  border: 1.5px solid rgba(0,0,0,0.08);
  background: none;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-muted, #a89f9e);
}

.toggle-btn.active {
  background: rgba(255,182,185,0.15);
  border-color: var(--planner-accent, #ffb6b9);
  color: var(--text-color, #5c4a4d);
}

.avatar-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255,182,185,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.avatar-circle.char {
  background: rgba(166,227,233,0.2);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-letter {
  font-size: 12px;
  font-weight: 700;
  color: var(--planner-accent2, #a6e3e9);
}

.busy-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
  border: 1.5px solid var(--card-bg, #fff);
}

.toggle-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
