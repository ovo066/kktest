<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="fixed inset-0 z-[900] flex items-center justify-center" @click.self="$emit('cancel')">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('cancel')"></div>
        <div class="relative z-10 w-[320px] overflow-hidden rounded-xl shadow-2xl" :style="{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }">
          <!-- Header -->
          <div class="px-6 pt-6 pb-2 text-center">
            <div class="flex items-center justify-center gap-2 text-[22px] font-medium opacity-90">
              <i class="ph-fill ph-map-pin text-[#30D158]"></i>
              <span>线下邀约</span>
            </div>
            <div class="text-[12px] mt-1 opacity-40 tracking-widest uppercase">Meet Invitation</div>
          </div>

          <!-- Location (required) -->
          <div class="px-6 pt-4 pb-2">
            <label class="text-[13px] font-medium mb-1.5 block" :style="{ color: 'var(--text-secondary)' }">地点 *</label>
            <input
              ref="locationInput"
              v-model="location"
              type="text"
              placeholder="咖啡厅、公园、商场..."
              maxlength="50"
              class="w-full px-4 py-2.5 rounded-xl border outline-none text-[15px]"
              :style="{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }"
              @keydown.enter="handleSend"
            >
          </div>

          <!-- Time (optional) -->
          <div class="px-6 pb-2">
            <label class="text-[13px] font-medium mb-1.5 block" :style="{ color: 'var(--text-secondary)' }">时间</label>
            <input
              v-model="time"
              type="text"
              placeholder="明天下午3点..."
              maxlength="30"
              class="w-full px-4 py-2.5 rounded-xl border outline-none text-[15px]"
              :style="{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }"
              @keydown.enter="handleSend"
            >
          </div>

          <!-- Note (optional) -->
          <div class="px-6 pb-5">
            <label class="text-[13px] font-medium mb-1.5 block" :style="{ color: 'var(--text-secondary)' }">备注</label>
            <input
              v-model="note"
              type="text"
              placeholder="一起喝杯咖啡吧..."
              maxlength="50"
              class="w-full px-4 py-2.5 rounded-xl border outline-none text-[15px]"
              :style="{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }"
              @keydown.enter="handleSend"
            >
          </div>

          <!-- Buttons -->
          <div class="flex border-t" :style="{ borderColor: 'var(--border-color)' }">
            <button
              class="flex-1 py-4 text-[16px] opacity-50 active:opacity-30 transition-opacity"
              @click="$emit('cancel')"
            >取消</button>
            <div class="w-[1px]" :style="{ backgroundColor: 'var(--border-color)' }"></div>
            <button
              class="flex-1 py-4 text-[16px] font-medium tracking-wide active:opacity-70 transition-opacity"
              :style="{ color: canSend ? '#30D158' : 'gray' }"
              :disabled="!canSend"
              @click="handleSend"
            >发送邀约</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['cancel', 'send'])

const location = ref('')
const time = ref('')
const note = ref('')
const locationInput = ref(null)

const canSend = computed(() => location.value.trim().length > 0)

watch(() => props.visible, (v) => {
  if (v) {
    location.value = ''
    time.value = ''
    note.value = ''
    nextTick(() => locationInput.value?.focus())
  }
})

function handleSend() {
  if (!canSend.value) return
  emit('send', {
    location: location.value.trim(),
    time: time.value.trim(),
    note: note.value.trim()
  })
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .relative, .modal-fade-leave-to .relative { transform: scale(0.95); }
</style>
