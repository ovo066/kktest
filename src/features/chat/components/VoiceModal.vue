<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="fixed inset-0 z-[900] flex items-center justify-center" @click.self="$emit('cancel')">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('cancel')"></div>
        <div class="relative z-10 w-[300px] bg-[var(--card-bg,#fff)] rounded-2xl overflow-hidden shadow-2xl">
          <!-- Header -->
          <div class="px-5 pt-5 pb-3 text-center">
            <div class="text-[20px] font-bold text-[var(--text-primary)]">语音消息</div>
            <div class="text-[13px] text-[var(--text-secondary)] mt-1">输入要说的话</div>
          </div>

          <!-- Text Input -->
          <div class="px-5 pb-3">
            <textarea
              ref="textInput"
              v-model="text"
              placeholder="输入语音内容..."
              rows="3"
              class="w-full text-[15px] px-3 py-2.5 rounded-xl outline-none bg-[var(--bg-color,#f2f2f7)] text-[var(--text-primary)] resize-none"
              maxlength="200"
            ></textarea>
          </div>

          <!-- Preview -->
          <div v-if="text.trim()" class="px-5 pb-4">
            <div class="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <i class="ph ph-microphone"></i>
              <span>预估时长：{{ estimatedDuration }}"</span>
            </div>
            <!-- Mini waveform preview -->
            <div class="flex items-center gap-[2px] mt-2 h-5">
              <div
                v-for="(h, i) in waveformPreview"
                :key="i"
                class="w-[3px] rounded-full bg-[var(--primary-color)] opacity-50"
                :style="{ height: h + 'px' }"
              ></div>
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex border-t border-[var(--border-color)]">
            <button
              class="flex-1 py-3.5 text-[17px] text-[var(--text-secondary)] active:bg-black/5 dark:active:bg-white/5"
              @click="$emit('cancel')"
            >取消</button>
            <div class="w-[0.5px] bg-[var(--border-color)]"></div>
            <button
              class="flex-1 py-3.5 text-[17px] font-semibold text-[var(--primary-color)] active:bg-black/5 dark:active:bg-white/5"
              :class="{ 'opacity-40': !canSend }"
              :disabled="!canSend"
              @click="handleSend"
            >发送</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { generateWaveform, estimateVoiceDuration } from '../composables/useMessageParser'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['cancel', 'send'])

const text = ref('')
const textInput = ref(null)

const canSend = computed(() => text.value.trim().length > 0)
const estimatedDuration = computed(() => estimateVoiceDuration(text.value))
const waveformPreview = computed(() => generateWaveform(text.value, 30))

watch(() => props.visible, (v) => {
  if (v) {
    text.value = ''
    nextTick(() => textInput.value?.focus())
  }
})

function handleSend() {
  if (!canSend.value) return
  emit('send', { text: text.value.trim() })
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
