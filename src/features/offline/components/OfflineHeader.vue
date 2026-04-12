<template>
  <header class="offline-header">
    <button class="menu-btn" @click="$emit('toggle-drawer')">
      <i class="ph-bold ph-list text-lg"></i>
    </button>
    <div class="header-center">
      <span class="char-name">{{ contactName }}</span>
      <span v-if="tokenInfo" class="token-badge">{{ tokenInfo }}</span>
    </div>
    <button
      class="exit-btn"
      :class="{ armed: exitArmed }"
      title="总结并返回聊天"
      @click="$emit('exit-offline')"
    >
      <i class="ph-bold ph-door-open text-lg"></i>
    </button>
  </header>
</template>

<script setup>
defineProps({
  contactName: { type: String, default: '' },
  tokenInfo: { type: String, default: '' },
  exitArmed: { type: Boolean, default: false }
})
defineEmits(['toggle-drawer', 'exit-offline'])
</script>

<style scoped>
.offline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px 16px;
  padding-top: var(--app-pt, 48px);
  background: var(--off-surface);
  border-bottom: var(--off-border-w) solid var(--off-border);
  z-index: 10;
}

.menu-btn {
  width: 38px;
  height: 38px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  background: var(--off-surface);
  box-shadow: var(--off-shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--off-text);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.menu-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.exit-btn {
  width: 38px;
  height: 38px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  background: var(--off-surface);
  box-shadow: var(--off-shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--off-text);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s, background 0.15s, color 0.15s;
}
.exit-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.exit-btn.armed {
  background: var(--off-text);
  color: var(--off-surface);
  border-color: var(--off-text);
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.char-name {
  font-weight: 800;
  font-size: 16px;
  color: var(--off-text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-badge {
  font-size: 10px;
  font-weight: 600;
  background: var(--off-bg);
  color: var(--off-text-sec);
  padding: 1px 8px;
  border-radius: 6px;
  border: 1px solid var(--off-border);
}
</style>
