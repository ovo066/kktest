<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="fixed inset-0 z-[900] flex items-center justify-center" @click.self="$emit('cancel')">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('cancel')"></div>
        <div class="relative z-10 w-[320px] overflow-hidden rounded-xl shadow-2xl transfer-modal-card">
          <!-- Decorative gold accent line -->
          <div class="h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent"></div>

          <!-- Header -->
          <div class="px-6 pt-6 pb-2 text-center">
            <div class="transfer-serif text-[22px] font-medium tracking-tight opacity-90">转账</div>
            <div class="text-[12px] mt-1 opacity-40 tracking-widest uppercase">Transfer</div>
          </div>

          <!-- Amount -->
          <div class="px-6 py-6">
            <div class="flex items-baseline justify-center gap-1">
              <span class="transfer-serif text-[22px] font-normal transfer-gold-text opacity-80">¥</span>
              <input
                ref="amountInput"
                v-model="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="transfer-serif text-[42px] font-medium text-center outline-none bg-transparent transfer-gold-text w-full max-w-[200px] tracking-tight caret-[#D4AF37]"
                inputmode="decimal"
                @keydown.enter="handleSend"
              >
            </div>
            <div class="mt-3 h-[1px] bg-gradient-to-r from-transparent via-current to-transparent opacity-8"></div>
          </div>

          <!-- Note -->
          <div class="px-6 pb-5">
            <input
              v-model="note"
              type="text"
              placeholder="添加备注..."
              class="w-full text-[14px] px-4 py-2.5 rounded-lg outline-none transfer-modal-input tracking-wide"
              maxlength="50"
              @keydown.enter="handleSend"
            >
          </div>

          <!-- Buttons -->
          <div class="flex">
            <button
              class="flex-1 py-4 text-[16px] opacity-50 transfer-modal-btn-cancel active:opacity-30 transition-opacity"
              @click="$emit('cancel')"
            >取消</button>
            <div class="w-[1px] transfer-modal-divider"></div>
            <button
              class="flex-1 py-4 text-[16px] transfer-serif font-medium transfer-gold-text tracking-wide active:opacity-70 transition-opacity"
              :class="{ 'opacity-25': !canSend }"
              :disabled="!canSend"
              @click="handleSend"
            >确认转账</button>
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

const amount = ref('')
const note = ref('')
const amountInput = ref(null)

const canSend = computed(() => {
  const num = parseFloat(amount.value)
  return !isNaN(num) && num > 0
})

watch(() => props.visible, (v) => {
  if (v) {
    amount.value = ''
    note.value = ''
    nextTick(() => amountInput.value?.focus())
  }
})

function handleSend() {
  if (!canSend.value) return
  const num = parseFloat(amount.value)
  emit('send', {
    amount: String(num),
    note: note.value.trim()
  })
}
</script>

<style scoped>
.transfer-serif {
  font-family: "Noto Serif SC", Georgia, "Times New Roman", serif;
}
.transfer-gold-text {
  color: #D4AF37;
}
.transfer-modal-card {
  background: #1A1A1A;
  color: #F9F9F7;
}
.transfer-modal-input {
  background: rgba(255, 255, 255, 0.06);
  color: #F9F9F7;
  border: 1px solid rgba(212, 175, 55, 0.12);
}
.transfer-modal-input::placeholder {
  color: rgba(249, 249, 247, 0.25);
}
.transfer-modal-input:focus {
  border-color: rgba(212, 175, 55, 0.3);
}
.transfer-modal-btn-cancel {
  color: #F9F9F7;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.transfer-modal-divider {
  background: rgba(255, 255, 255, 0.06);
}

/* Hide number input spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .relative, .modal-fade-leave-to .relative { transform: scale(0.95); }
</style>
