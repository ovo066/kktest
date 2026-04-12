<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="overlay-fade">
      <div v-if="open" class="drawer-overlay" @click="$emit('close')"></div>
    </Transition>

    <!-- Drawer -->
    <Transition name="drawer-slide">
      <aside v-if="open" class="drawer-panel">
        <div class="drawer-title">设置菜单</div>

        <nav class="drawer-nav">
          <button class="nav-item" @click="$emit('open-presets')">
            <i class="ph ph-sliders-horizontal"></i> 预设管理
          </button>
          <button class="nav-item" @click="$emit('open-regex')">
            <i class="ph ph-code"></i> 正则规则
          </button>
          <button class="nav-item" @click="$emit('open-themes')">
            <i class="ph ph-palette"></i> 主题切换
          </button>
          <button class="nav-item" @click="$emit('open-archives')">
            <i class="ph ph-floppy-disk"></i> 存档读档
          </button>

          <!-- Memory toggles -->
          <div class="toggle-section">
            <div class="toggle-row">
              <span class="toggle-label">保留线下历史</span>
              <label class="ios-toggle">
                <input type="checkbox" :checked="keepHistory" @change="$emit('update:keepHistory', $event.target.checked)" />
                <span class="toggle-track"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">注入总结到主聊天记忆</span>
              <label class="ios-toggle">
                <input type="checkbox" :checked="injectToChat" @change="$emit('update:injectToChat', $event.target.checked)" />
                <span class="toggle-track"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">检索主聊天记忆</span>
              <label class="ios-toggle">
                <input type="checkbox" :checked="retrieveMainMemory" @change="$emit('update:retrieveMainMemory', $event.target.checked)" />
                <span class="toggle-track"></span>
              </label>
            </div>
          </div>
        </nav>

        <div class="drawer-footer">
          <button class="nav-item item-danger" @click="$emit('end-session')">
            <i class="ph ph-flag-banner"></i> 结束会话
          </button>
          <button class="nav-item" @click="$emit('back')">
            <i class="ph ph-arrow-left"></i> 返回聊天
          </button>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  keepHistory: { type: Boolean, default: true },
  injectToChat: { type: Boolean, default: false },
  retrieveMainMemory: { type: Boolean, default: false }
})
defineEmits(['close', 'back', 'end-session', 'open-presets', 'open-regex', 'open-themes', 'open-archives', 'update:keepHistory', 'update:injectToChat', 'update:retrieveMainMemory'])
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 200;
}

.drawer-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 75%;
  max-width: 300px;
  height: 100%;
  background: #fff;
  border-right: var(--off-border-w) solid var(--off-border);
  z-index: 201;
  display: flex;
  flex-direction: column;
  padding: 0 20px 24px 20px;
  padding-top: max(var(--app-pt, 48px), 24px);
}

.drawer-title {
  font-weight: 800;
  font-size: 20px;
  color: var(--off-text);
  padding-bottom: 16px;
  margin-bottom: 20px;
  border-bottom: var(--off-border-w) solid var(--off-border);
}

.drawer-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  min-height: 0;
  padding-bottom: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: var(--off-radius);
  box-shadow: var(--off-shadow-sm);
  font-weight: 700;
  font-size: 14px;
  background: #fff;
  color: var(--off-text);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  width: 100%;
  text-align: left;
}
.nav-item:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.nav-item i {
  font-size: 18px;
}

.drawer-footer {
  flex-shrink: 0;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-danger {
  background: var(--off-danger);
  color: #fff;
  border-color: var(--off-danger);
}

.toggle-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: var(--off-radius);
  box-shadow: var(--off-shadow-sm);
  overflow: hidden;
  background: #fff;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
}

.toggle-row + .toggle-row {
  border-top: 1px solid rgba(17, 17, 17, 0.1);
}

.toggle-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--off-text);
}

.ios-toggle {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.ios-toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  display: block;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #ccc;
  transition: background 0.2s;
  position: relative;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}

.ios-toggle input:checked + .toggle-track {
  background: var(--off-accent, #111);
}

.ios-toggle input:checked + .toggle-track::after {
  transform: translateX(20px);
}

/* Transitions */
.overlay-fade-enter-active, .overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}
.overlay-fade-enter-from, .overlay-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active, .drawer-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-slide-enter-from, .drawer-slide-leave-to {
  transform: translateX(-100%);
}
</style>
