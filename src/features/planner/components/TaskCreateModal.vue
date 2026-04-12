<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-sheet" :class="{ visible: mounted }">
        <!-- Header -->
        <div class="modal-header">
          <span class="material-symbols-outlined" style="font-size:20px;color:var(--planner-accent,#ffb6b9)">checklist</span>
          <span class="modal-header-label">添加任务</span>
        </div>

        <!-- Task form -->
        <div class="form">
          <div class="field">
            <input
              v-model="title"
              class="title-input"
              placeholder="要做什么？"
              autofocus
              @keydown.enter="submit"
            />
          </div>

          <div class="field">
            <textarea
              v-model="description"
              class="desc-input"
              placeholder="备注（可选）"
              rows="2"
            />
          </div>

          <div v-if="detectedScheduleLabel" class="smart-hint">
            <span class="material-symbols-outlined" style="font-size:16px">auto_awesome</span>
            <div class="smart-hint-copy">
              <span>已识别：{{ detectedScheduleLabel }}</span>
              <span v-if="detectedCleanTitle && detectedCleanTitle !== title.trim()">保存标题：{{ detectedCleanTitle }}</span>
            </div>
          </div>

          <!-- Category selector -->
          <div class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">category</span>
              分类
            </label>
            <div class="cat-chips">
              <button
                v-for="cat in plannerStore.categories"
                :key="cat.id"
                class="cat-chip"
                :class="{ active: category === cat.id }"
                :style="{ '--cc': cat.color }"
                @click="category = cat.id"
              >
                {{ cat.name }}
              </button>
            </div>
          </div>

          <!-- Start Date -->
          <div class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">today</span>
              日期
            </label>
            <input :value="startDate" type="date" class="date-input" @input="handleStartDateInput" />
          </div>

          <!-- Multi-day toggle + End Date -->
          <div class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">date_range</span>
              多天
            </label>
            <button type="button" class="toggle" :class="{ on: isMultiDay }" @click="toggleMultiDay">
              <span class="toggle-knob" />
            </button>
          </div>

          <div v-if="isMultiDay" class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">event</span>
              结束
            </label>
            <input :value="endDate" type="date" class="date-input" :min="startDate" @input="handleEndDateInput" />
          </div>

          <!-- All-day toggle -->
          <div class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">wb_sunny</span>
              全天
            </label>
            <button type="button" class="toggle" :class="{ on: allDay }" @click="toggleAllDay">
              <span class="toggle-knob" />
            </button>
          </div>

          <!-- Time (hidden when all-day) -->
          <template v-if="!allDay">
            <div class="field-row">
              <label class="field-label">
                <span class="material-symbols-outlined" style="font-size:16px">schedule</span>
                开始
              </label>
              <input :value="startTime" type="time" class="date-input" @input="handleStartTimeInput" />
            </div>

            <div class="field-row">
              <label class="field-label">
                <span class="material-symbols-outlined" style="font-size:16px">schedule</span>
                结束
              </label>
              <input :value="endTime" type="time" class="date-input" @input="handleEndTimeInput" />
            </div>
          </template>

          <!-- Reminder -->
          <div class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">notifications</span>
              提醒
            </label>
            <select v-model.number="reminderBefore" class="date-input">
              <option :value="0">不提醒</option>
              <option :value="15">提前 15 分钟</option>
              <option :value="30">提前 30 分钟</option>
              <option :value="60">提前 1 小时</option>
              <option :value="1440">提前 1 天</option>
            </select>
          </div>

          <!-- AI toggle -->
          <div class="field-row">
            <label class="field-label">
              <span class="material-symbols-outlined" style="font-size:16px">smart_toy</span>
              告知 AI
            </label>
            <button class="toggle" :class="{ on: shareWithAI }" @click="shareWithAI = !shareWithAI">
              <span class="toggle-knob" />
            </button>
          </div>
        </div>

        <!-- Submit button -->
        <button class="submit-btn" :disabled="!canSubmit" @click="submit">
          <span class="material-symbols-outlined" style="font-size:20px;font-variation-settings:'FILL' 1,'wght' 400">add_circle</span>
          添加任务
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { usePlannerStore } from '../../../stores/planner'
import { useStorage } from '../../../composables/useStorage'
import { toLocalDateKey } from '../../../utils/dateKey'
import {
  extractTaskScheduleFromText,
  formatTaskScheduleLabel,
  mergeTaskScheduleDetections
} from '../../../utils/taskDateTime'

const props = defineProps({
  presetDate: { type: String, default: '' }
})
const emit = defineEmits(['close', 'created'])

const plannerStore = usePlannerStore()
const { flushSaveNow } = useStorage()

const mounted = ref(false)
onMounted(() => setTimeout(() => { mounted.value = true }, 10))
const parserNow = new Date()

// Task fields
const title = ref('')
const description = ref('')
const category = ref(plannerStore.categories[0]?.id || 'personal')
const startDate = ref(props.presetDate || toLocalDateKey())
const endDate = ref(props.presetDate || toLocalDateKey())
const startTime = ref('')
const endTime = ref('')
const isMultiDay = ref(false)
const allDay = ref(false)
const reminderBefore = ref(0)
const shareWithAI = ref(true)
const fieldDirty = reactive({
  startDate: false,
  endDate: false,
  startTime: false,
  endTime: false,
  allDay: false,
  isMultiDay: false
})
const autoApplied = ref(createDefaultScheduleState())

const canSubmit = computed(() => title.value.trim().length > 0)
const titleDetection = computed(() => extractTaskScheduleFromText(title.value, { now: parserNow }))
const descriptionDetection = computed(() => extractTaskScheduleFromText(description.value, { now: parserNow }))
const detectedSchedule = computed(() => mergeTaskScheduleDetections(
  titleDetection.value,
  descriptionDetection.value,
  { fallbackTitle: title.value.trim() }
))
const detectedScheduleLabel = computed(() => formatTaskScheduleLabel(detectedSchedule.value))
const detectedCleanTitle = computed(() => titleDetection.value?.cleanedText || title.value.trim())

watch(detectedSchedule, (next) => {
  const resolved = next?.matched
    ? {
        startDate: next.startDate || createDefaultScheduleState().startDate,
        endDate: next.endDate || next.startDate || createDefaultScheduleState().endDate,
        startTime: next.allDay ? '' : (next.startTime || ''),
        endTime: next.allDay ? '' : (next.endTime || ''),
        allDay: Boolean(next.startDate) && !next.startTime,
        isMultiDay: Boolean(next.endDate && next.startDate && next.endDate !== next.startDate)
      }
    : createDefaultScheduleState()

  applyAutoValue('startDate', resolved.startDate, 'startDate', startDate)
  applyAutoValue('endDate', resolved.endDate, 'endDate', endDate)
  applyAutoValue('startTime', resolved.startTime, 'startTime', startTime)
  applyAutoValue('endTime', resolved.endTime, 'endTime', endTime)
  applyAutoValue('allDay', resolved.allDay, 'allDay', allDay)
  applyAutoValue('isMultiDay', resolved.isMultiDay, 'isMultiDay', isMultiDay)
  autoApplied.value = resolved
}, { immediate: true })

async function submit() {
  if (!canSubmit.value) return
  const finalTitle = (titleDetection.value?.cleanedText || title.value).trim() || title.value.trim()
  const finalDetection = detectedSchedule.value

  plannerStore.addEvent({
    title: finalTitle,
    description: description.value.trim(),
    category: category.value,
    startDate: startDate.value,
    endDate: isMultiDay.value ? endDate.value : startDate.value,
    startTime: allDay.value ? '' : startTime.value,
    endTime: allDay.value ? '' : endTime.value,
    allDay: allDay.value,
    reminderBefore: reminderBefore.value,
    shareWithAI: shareWithAI.value,
    kind: finalDetection.kind || 'todo'
  })

  await flushSaveNow()
  emit('created')
}

function createDefaultScheduleState() {
  const fallbackDate = props.presetDate || toLocalDateKey(parserNow)
  return {
    startDate: fallbackDate,
    endDate: fallbackDate,
    startTime: '',
    endTime: '',
    allDay: false,
    isMultiDay: false
  }
}

function applyAutoValue(key, nextValue, dirtyKey, targetRef) {
  const lastAutoValue = autoApplied.value?.[key]
  if (fieldDirty[dirtyKey] && targetRef.value !== lastAutoValue) return
  targetRef.value = nextValue
}

function handleStartDateInput(event) {
  fieldDirty.startDate = true
  startDate.value = event?.target?.value || ''
  if (!isMultiDay.value) endDate.value = startDate.value
}

function handleEndDateInput(event) {
  fieldDirty.endDate = true
  endDate.value = event?.target?.value || ''
}

function handleStartTimeInput(event) {
  fieldDirty.startTime = true
  startTime.value = event?.target?.value || ''
}

function handleEndTimeInput(event) {
  fieldDirty.endTime = true
  endTime.value = event?.target?.value || ''
}

function toggleMultiDay() {
  fieldDirty.isMultiDay = true
  isMultiDay.value = !isMultiDay.value
  if (!isMultiDay.value) {
    endDate.value = startDate.value
  }
}

function toggleAllDay() {
  fieldDirty.allDay = true
  allDay.value = !allDay.value
  if (allDay.value) {
    startTime.value = ''
    endTime.value = ''
  }
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

.smart-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--planner-accent2, #a6e3e9) 16%, transparent);
  color: var(--text-color, #5c4a4d);
}

.smart-hint-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  line-height: 1.45;
}

.title-input, .desc-input {
  width: 100%;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text-color, #5c4a4d);
  background: transparent;
  resize: none;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.title-input {
  font-size: 17px;
  font-weight: 600;
}

.title-input:focus, .desc-input:focus {
  border-color: var(--planner-accent, #ffb6b9);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #a89f9e);
  min-width: 72px;
  flex-shrink: 0;
}

.cat-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cat-chip {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1.5px solid rgba(0,0,0,0.07);
  background: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #a89f9e);
  transition: all 0.15s;
}

.cat-chip.active {
  background: color-mix(in srgb, var(--cc) 25%, transparent);
  border-color: var(--cc);
  color: var(--text-color, #5c4a4d);
}

.date-input {
  flex: 1;
  border: 1.5px solid rgba(0,0,0,0.07);
  border-radius: 12px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-color, #5c4a4d);
  background: transparent;
  outline: none;
  font-family: inherit;
}

/* Toggle */
.toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: rgba(0,0,0,0.12);
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle.on { background: var(--planner-accent, #ffb6b9); }
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  display: block;
}
.toggle.on .toggle-knob { transform: translateX(18px); }

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
