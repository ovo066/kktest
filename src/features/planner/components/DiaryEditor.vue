<template>
  <div class="diary-editor">
    <!-- Main textarea -->
    <textarea
      class="content-input"
      :value="content"
      placeholder="今天发生了什么……"
      rows="8"
      @input="$emit('update:content', $event.target.value)"
    />

    <!-- Mood -->
    <div class="field-row">
      <label class="field-label">
        <span class="material-symbols-outlined" style="font-size:16px">mood</span>
        心情
      </label>
      <div class="chip-row">
        <button
          v-for="m in moods"
          :key="m"
          class="chip"
          :class="{ active: mood === m }"
          @click="$emit('update:mood', m === mood ? '' : m)"
        >{{ m }}</button>
      </div>
    </div>

    <!-- Weather -->
    <div class="field-row">
      <label class="field-label">
        <span class="material-symbols-outlined" style="font-size:16px">sunny</span>
        天气
      </label>
      <div class="chip-row">
        <button
          v-for="w in weathers"
          :key="w"
          class="chip"
          :class="{ active: weather === w }"
          @click="$emit('update:weather', w === weather ? '' : w)"
        >{{ w }}</button>
      </div>
    </div>

    <!-- Images -->
    <div class="field-row">
      <label class="field-label">
        <span class="material-symbols-outlined" style="font-size:16px">image</span>
        图片
      </label>
      <div class="images-row">
        <div v-for="(img, i) in images" :key="i" class="thumb-wrap">
          <img :src="img" class="thumb" alt="" />
          <button class="thumb-del" @click="removeImage(i)">
            <span class="material-symbols-outlined" style="font-size:14px">close</span>
          </button>
        </div>
        <label class="add-img-btn">
          <input type="file" accept="image/*" multiple class="hidden-input" @change="addImages" />
          <span class="material-symbols-outlined" style="font-size:22px">add_photo_alternate</span>
        </label>
      </div>
    </div>

    <!-- Share with AI -->
    <div class="field-row">
      <label class="field-label">
        <span class="material-symbols-outlined" style="font-size:16px">smart_toy</span>
        告知 AI
      </label>
      <button class="toggle" :class="{ on: shareAI }" @click="$emit('update:shareAi', !shareAI)">
        <span class="toggle-knob" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  initialContent: { type: String, default: '' },
  initialMood: { type: String, default: '' },
  initialWeather: { type: String, default: '' },
  initialImages: { type: Array, default: () => [] },
  initialShareAi: { type: Boolean, default: true }
})

const emit = defineEmits(['update:content', 'update:mood', 'update:weather', 'update:images', 'update:shareAi'])

const content = computed(() => props.initialContent)
const mood = computed(() => props.initialMood)
const weather = computed(() => props.initialWeather)
const images = computed(() => props.initialImages)
const shareAI = computed(() => props.initialShareAi)

const moods = ['开心', '惬意', '平静', '焦虑', '难过', '疲惫', '充实']
const weathers = ['晴朗', '多云', '阴天', '小雨', '大雨', '雪天']

function removeImage(i) {
  const newImages = [...images.value]
  newImages.splice(i, 1)
  emit('update:images', newImages)
}

function addImages(e) {
  const files = Array.from(e.target.files)
  const promises = files.map(f => new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = ev => resolve(ev.target.result)
    reader.readAsDataURL(f)
  }))
  Promise.all(promises).then(results => {
    emit('update:images', [...images.value, ...results])
  })
  e.target.value = ''
}
</script>

<style scoped>
.diary-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 0 16px;
}

.content-input {
  width: 100%;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-color, #5c4a4d);
  caret-color: var(--text-color, #5c4a4d);
  background: transparent;
  resize: none;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.content-input::placeholder {
  color: var(--text-muted, #a89f9e);
}

.content-input:focus { border-color: var(--planner-accent, #ffb6b9); }

.field-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #a89f9e);
  min-width: 64px;
  padding-top: 6px;
  flex-shrink: 0;
}

.chip-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.chip {
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

.chip.active {
  background: rgba(255,182,185,0.2);
  border-color: var(--planner-accent, #ffb6b9);
  color: var(--text-color, #5c4a4d);
}

/* Images row */
.images-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.thumb-wrap {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: visible;
}

.thumb {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  object-fit: cover;
}

.thumb-del {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-img-btn {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  border: 1.5px dashed rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted, #a89f9e);
  transition: border-color 0.15s;
}

.add-img-btn:hover { border-color: var(--planner-accent, #ffb6b9); }

.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
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
</style>
