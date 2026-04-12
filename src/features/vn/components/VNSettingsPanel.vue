<template>
  <Transition name="vn-panel" appear>
    <div class="vn-panel-overlay" @click.stop>
      <div class="vn-panel-bar">
        <h2 class="vn-panel-title">设定</h2>
        <button class="vn-panel-close" @click.stop="emit('close')">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="vn-panel-scroll">
        <!-- Text Speed -->
        <div class="vn-setting-card">
          <div class="vn-setting-header">
            <i class="ph ph-text-aa"></i>
            <span>文字速度</span>
            <span class="vn-setting-val">{{ player.textSpeed }}ms</span>
          </div>
          <div class="vn-slider-row">
            <span class="vn-slider-label">快</span>
            <input v-model.number="player.textSpeed" type="range" min="10" max="80" step="2" class="vn-slider">
            <span class="vn-slider-label">慢</span>
          </div>
        </div>

        <!-- Auto Play Delay -->
        <div class="vn-setting-card">
          <div class="vn-setting-header">
            <i class="ph ph-timer"></i>
            <span>自动播放延迟</span>
            <span class="vn-setting-val">{{ Math.round(player.autoPlayDelay / 100) / 10 }}s</span>
          </div>
          <div class="vn-slider-row">
            <span class="vn-slider-label">短</span>
            <input v-model.number="player.autoPlayDelay" type="range" min="500" max="6000" step="250" class="vn-slider">
            <span class="vn-slider-label">长</span>
          </div>
        </div>

        <!-- TTS -->
        <div class="vn-setting-card">
          <div class="vn-setting-header">
            <i class="ph ph-speaker-high"></i>
            <span>语音 (TTS)</span>
          </div>

          <div class="vn-toggle-row">
            <span>启用语音</span>
            <button
              class="vn-toggle-switch"
              :class="{ active: tts.enabled }"
              @click="tts.enabled = !tts.enabled; saveTts()"
            >
              <div class="vn-toggle-knob"></div>
            </button>
          </div>

          <template v-if="tts.enabled">
            <div class="vn-field">
              <div class="vn-field-label">Edge TTS Endpoint</div>
              <input
                v-model="tts.endpoint"
                type="text"
                class="vn-text-input"
                placeholder="https://your-tts.example.com/api/tts"
                @change="saveTts"
              >
            </div>

            <div class="vn-slider-row vn-mt">
              <span class="vn-slider-label">静</span>
              <input v-model.number="player.volume.voice" type="range" min="0" max="1" step="0.05" class="vn-slider">
              <span class="vn-slider-label">响</span>
              <span class="vn-setting-val">{{ Math.round(player.volume.voice * 100) }}%</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'

const emit = defineEmits(['close'])
const vnStore = useVNStore()
const { scheduleSave } = useStorage()

const player = vnStore.player
const tts = vnStore.ttsConfig

function saveTts() { scheduleSave() }
</script>

<style scoped>
.vn-panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: rgba(8, 8, 20, 0.82);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
}

.vn-panel-bar {
  padding: var(--app-pt-lg, 52px) 20px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.vn-panel-title {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.04em;
}

.vn-panel-close {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.vn-panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.vn-panel-scroll::-webkit-scrollbar { display: none; }

/* Setting cards */
.vn-setting-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 14px;
}

.vn-setting-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.vn-setting-header i {
  font-size: 18px;
  color: rgba(99, 102, 241, 0.7);
}

.vn-setting-val {
  margin-left: auto;
  font-size: 12px;
  color: rgba(99, 102, 241, 0.8);
  font-family: monospace;
}

/* Slider */
.vn-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vn-slider-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.vn-slider {
  flex: 1;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
}

.vn-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

/* Toggle */
.vn-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 14px;
}

.vn-toggle-switch {
  width: 48px;
  height: 26px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.vn-toggle-switch.active {
  background: rgba(99, 102, 241, 0.7);
}

.vn-toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform 0.3s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.vn-toggle-switch.active .vn-toggle-knob {
  transform: translateX(22px);
}

/* Text input */
.vn-field { margin-top: 8px; }

.vn-field-label {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.vn-text-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 14px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  outline: none;
}

.vn-text-input::placeholder { color: rgba(255, 255, 255, 0.2); }
.vn-text-input:focus { border-color: rgba(99, 102, 241, 0.4); }

.vn-mt { margin-top: 14px; }

/* Panel transition */
.vn-panel-enter-active { transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1); }
.vn-panel-leave-active { transition: all 0.25s ease; }
.vn-panel-enter-from { opacity: 0; transform: translateX(40px); }
.vn-panel-leave-to { opacity: 0; }
</style>
