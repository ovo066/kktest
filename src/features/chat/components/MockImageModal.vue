<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="fixed inset-0 z-[900] flex items-center justify-center" @click.self="$emit('cancel')">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('cancel')"></div>
        <div class="relative z-10 w-[320px] bg-[var(--card-bg,#fff)] rounded-2xl overflow-hidden shadow-2xl">
          <div class="px-5 pt-5 pb-3 text-center">
            <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--primary-color,#007AFF)]/12 text-[var(--primary-color,#007AFF)] mb-2">
              <i class="ph-fill ph-camera text-[20px]"></i>
            </div>
            <div class="text-[20px] font-bold text-[var(--text-primary)]">相机</div>
            <div class="text-[13px] text-[var(--text-secondary)] mt-1">发送可翻转的模拟图片</div>
          </div>

          <div class="px-5 pb-3">
            <div class="relative rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-color,#f2f2f7)]">
              <img :src="previewUrl" alt="mock placeholder" class="w-full h-[150px] object-cover">
              <div class="absolute right-2 bottom-2 w-7 h-7 rounded-full bg-black/65 text-white flex items-center justify-center">
                <i class="ph-fill ph-camera text-[14px]"></i>
              </div>
            </div>
          </div>

          <div class="px-5 pb-4">
            <textarea
              ref="textInput"
              v-model="text"
              placeholder="输入翻转后显示的文字..."
              rows="4"
              class="w-full text-[15px] px-3 py-2.5 rounded-xl outline-none bg-[var(--bg-color,#f2f2f7)] text-[var(--text-primary)] resize-none"
              maxlength="500"
            ></textarea>
            <div class="mt-2 text-[12px] text-[var(--text-secondary)] flex items-center justify-between">
              <span>发送后点击图片即可翻转</span>
              <span>{{ text.length }}/500</span>
            </div>
          </div>

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
import { computed, nextTick, ref, watch } from 'vue'
import { resolveMockImagePlaceholder } from '../composables/mockImage'

const props = defineProps({
  visible: { type: Boolean, default: false },
  placeholderUrl: { type: String, default: '' }
})

const emit = defineEmits(['cancel', 'send'])

const text = ref('')
const textInput = ref(null)

const canSend = computed(() => text.value.trim().length > 0)
const previewUrl = computed(() => resolveMockImagePlaceholder(props.placeholderUrl))

watch(() => props.visible, (v) => {
  if (!v) return
  text.value = ''
  nextTick(() => textInput.value?.focus())
})

function handleSend() {
  if (!canSend.value) return
  emit('send', { text: text.value.trim() })
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: all 0.2s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}
</style>
