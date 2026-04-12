<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-sheet" :class="{ visible: mounted }">
        <!-- Header -->
        <div class="modal-header">
          <span class="material-symbols-outlined" style="font-size:20px;color:var(--planner-accent,#ffb6b9)">menu_book</span>
          <span class="modal-header-label">写日记</span>
        </div>

        <!-- Diary editor -->
        <div class="form">
          <DiaryEditor
            :initial-content="content"
            :initial-mood="mood"
            :initial-weather="weather"
            :initial-images="images"
            :initial-share-ai="shareAI"
            @update:content="content = $event"
            @update:mood="mood = $event"
            @update:weather="weather = $event"
            @update:images="images = $event"
            @update:share-ai="shareAI = $event"
          />
        </div>

        <!-- Submit button -->
        <button class="submit-btn" :disabled="!canSubmit" @click="submit">
          <span class="material-symbols-outlined" style="font-size:20px;font-variation-settings:'FILL' 1,'wght' 400">edit_note</span>
          保存日记
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { usePlannerStore } from '../../../stores/planner'
import { useStorage } from '../../../composables/useStorage'
import DiaryEditor from './DiaryEditor.vue'

const emit = defineEmits(['close', 'created'])

const plannerStore = usePlannerStore()
const { flushSaveNow } = useStorage()

const mounted = ref(false)
onMounted(() => {
  setTimeout(() => { mounted.value = true }, 10)
  nextTick(() => {
    const ta = document.querySelector('.diary-create-modal-ta')
    if (ta) ta.focus()
  })
})

const content = ref('')
const mood = ref('')
const weather = ref('')
const images = ref([])
const shareAI = ref(true)

const canSubmit = computed(() => content.value.trim().length > 0)

async function submit() {
  if (!canSubmit.value) return

  const entry = plannerStore.addDiaryEntry({
    content: content.value.trim(),
    mood: mood.value,
    weather: weather.value,
    images: images.value,
    shareWithAI: shareAI.value
  })

  await flushSaveNow()
  emit('created', entry.id)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-sheet {
  width: 100%;
  max-width: 430px;
  background: var(--card-bg, #fff);
  border-radius: 28px 28px 0 0;
  padding: 20px 20px calc(env(safe-area-inset-bottom, 16px) + 20px);
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 90dvh;
  overflow-y: auto;
}

.modal-sheet.visible {
  transform: translateY(0);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1.5px dashed rgba(255,182,185,0.3);
}

.modal-header-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  margin-top: 8px;
  border: none;
  border-radius: 18px;
  background: var(--planner-accent, #ffb6b9);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
