<template>
  <div class="meet-setup">
    <header class="setup-header">
      <button class="setup-back" @click="router.push('/meet')">
        <i class="ph ph-caret-left"></i>
      </button>
      <span class="setup-title">{{ meeting ? '编辑见面' : '新建见面' }}</span>
      <button class="setup-save" @click="onSave">保存</button>
    </header>

    <div v-if="form" class="setup-body">
      <!-- Name -->
      <label class="field-label">名称</label>
      <input v-model="form.name" class="field-input" placeholder="约会名称">

      <!-- Location -->
      <label class="field-label">地点</label>
      <input v-model="form.location" class="field-input" placeholder="咖啡厅 / 公园 / 商场...">

      <!-- World Setting -->
      <label class="field-label">世界观设定</label>
      <textarea v-model="form.worldSetting" class="field-textarea" rows="4" placeholder="描述故事背景、角色关系..."></textarea>

      <!-- Preset -->
      <label class="field-label">选择预设</label>
      <select v-model="form.presetId" class="field-select">
        <option :value="null">不使用预设</option>
        <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>

      <!-- Characters -->
      <label class="field-label">角色 ({{ form.characters.length }})</label>
      <div class="char-list">
        <div v-for="(char, ci) in form.characters" :key="ci" class="char-item">
          <div class="char-info">
            <input v-model="char.vnName" class="char-name-input" placeholder="角色名">
            <select v-model="char.contactId" class="char-select">
              <option :value="null">选择联系人</option>
              <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="char-row">
            <input v-model="char.nameColor" type="color" class="char-color" title="名牌颜色">
            <select v-model="char.role" class="char-role">
              <option value="lead">主角</option>
              <option value="support">配角</option>
            </select>
          </div>
          <textarea v-model="char.vnDescription" class="char-desc" rows="2" placeholder="角色描述（可选，留空将使用联系人设定）"></textarea>
          <button class="char-remove" @click="form.characters.splice(ci, 1)">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <button class="add-char-btn" @click="addCharacter">
          <i class="ph ph-plus"></i> 添加角色
        </button>
      </div>

      <div class="resources-section">
        <label class="field-label">
          <i class="ph ph-speaker-high"></i> 见面 TTS
        </label>
        <p class="field-hint">开启后仅朗读 AI 角色对白；语音引擎与音色沿用全局“设置 - 语音”配置</p>
        <button
          class="toggle-chip"
          :class="{ active: form.voiceTtsEnabled }"
          @click="form.voiceTtsEnabled = !form.voiceTtsEnabled"
        >
          <i :class="form.voiceTtsEnabled ? 'ph-fill ph-speaker-high' : 'ph ph-speaker-slash'"></i>
          {{ form.voiceTtsEnabled ? '已开启' : '已关闭' }}
        </button>
      </div>

      <!-- Online Resources -->
      <div class="resources-section">
        <label class="field-label">
          <i class="ph ph-image"></i> 背景图资源
        </label>
        <p class="field-hint">添加自定义背景图 URL，AI 也会自动从 Safebooru 获取</p>
        <div v-for="(bg, bi) in form.backgrounds" :key="bi" class="resource-row">
          <input v-model="bg.name" class="resource-name" placeholder="名称 (如: 咖啡厅)">
          <input v-model="bg.url" class="resource-url" placeholder="图片 URL">
          <button class="resource-del" @click="form.backgrounds.splice(bi, 1)">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <button class="add-resource-btn" @click="form.backgrounds.push({ name: '', url: '' })">
          <i class="ph ph-plus"></i> 添加背景图
        </button>
      </div>

      <div class="resources-section">
        <label class="field-label">
          <i class="ph ph-music-note"></i> BGM 资源
        </label>
        <p class="field-hint">本地 BGM 优先；未命中时可回退到 Jamendo 公共曲库自动配乐</p>
        <div v-for="(bgm, mi) in form.bgmList" :key="mi" class="resource-row">
          <input v-model="bgm.name" class="resource-name" placeholder="名称 (如: romantic)">
          <input v-model="bgm.url" class="resource-url" placeholder="音频 URL">
          <button class="resource-del" @click="form.bgmList.splice(mi, 1)">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <button class="add-resource-btn" @click="form.bgmList.push({ name: '', url: '' })">
          <i class="ph ph-plus"></i> 添加 BGM
        </button>

        <div class="provider-card">
          <div class="provider-row">
            <div>
              <div class="provider-title">Jamendo 公共源</div>
              <p class="field-hint provider-hint">全局设置。未命中本地 BGM 时，见面会按地点/情绪关键词自动检索公开曲库</p>
            </div>
            <button
              class="toggle-chip"
              :class="{ active: form.useJamendoBgm }"
              @click="form.useJamendoBgm = !form.useJamendoBgm"
            >
              <i :class="form.useJamendoBgm ? 'ph-fill ph-waveform' : 'ph ph-waveform'"></i>
              {{ form.useJamendoBgm ? '已启用' : '已关闭' }}
            </button>
          </div>

          <div class="provider-row">
            <div>
              <div class="provider-title">仅偏向纯音乐</div>
              <p class="field-hint provider-hint">适合作为剧情 BGM，尽量避免自动配到带歌词曲目</p>
            </div>
            <button
              class="toggle-chip"
              :class="{ active: form.jamendoInstrumentalOnly }"
              @click="form.jamendoInstrumentalOnly = !form.jamendoInstrumentalOnly"
            >
              <i :class="form.jamendoInstrumentalOnly ? 'ph-fill ph-music-note-simple' : 'ph ph-microphone'"></i>
              {{ form.jamendoInstrumentalOnly ? '纯音乐优先' : '允许人声' }}
            </button>
          </div>

          <label class="field-label provider-label">Jamendo Client ID（可选）</label>
          <p class="field-hint provider-hint">留空时使用环境变量或内置测试 ID。若你有自己的 Jamendo 应用，建议填自己的 client_id</p>
          <input
            v-model="form.jamendoClientId"
            class="field-input"
            placeholder="例如：your_jamendo_client_id"
          >
        </div>
      </div>

      <div class="resources-section">
        <label class="field-label">
          <i class="ph ph-speaker-high"></i> 音效资源
        </label>
        <p class="field-hint">用于 [sfx:名称] 指令，支持环境音/UI音效/动作音效</p>
        <div v-for="(sfx, si) in form.sfxList" :key="si" class="resource-row">
          <input v-model="sfx.name" class="resource-name" placeholder="名称 (如: door_open)">
          <input v-model="sfx.url" class="resource-url" placeholder="音效 URL">
          <button class="resource-del" @click="form.sfxList.splice(si, 1)">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <button class="add-resource-btn" @click="form.sfxList.push({ name: '', url: '' })">
          <i class="ph ph-plus"></i> 添加音效
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMeetStore } from '../../../stores/meet'
import { useContactsStore } from '../../../stores/contacts'
import { useStorage } from '../../../composables/useStorage'

const router = useRouter()
const route = useRoute()
const meetStore = useMeetStore()
const contactsStore = useContactsStore()
const { scheduleSave } = useStorage()

const meetingId = computed(() => route.params.id || null)
const meeting = computed(() =>
  meetingId.value ? meetStore.meetings.find(m => m.id === meetingId.value) : null
)

const contacts = computed(() => (contactsStore.contacts || []).filter(c => !c.isGroup))
const presets = computed(() => meetStore.presets || [])

const form = ref(null)

onMounted(() => {
  const assetSources = meetStore.assetSources || {}
  if (meeting.value) {
    const bgResources = meeting.value.resources?.backgrounds || {}
    const bgmResources = meeting.value.resources?.bgm || {}
    const sfxResources = meeting.value.resources?.sfx || {}

    form.value = {
      name: meeting.value.name || '',
      location: meeting.value.location || '',
      worldSetting: meeting.value.worldSetting || '',
      voiceTtsEnabled: meeting.value.voice?.ttsEnabled === true,
      useJamendoBgm: assetSources.enableJamendoBgm !== false,
      jamendoInstrumentalOnly: assetSources.jamendoInstrumentalOnly !== false,
      jamendoClientId: assetSources.jamendoClientId || '',
      presetId: meeting.value.presetId || null,
      characters: (meeting.value.characters || []).map(c => ({
        ...c,
        nameColor: c.nameColor || '#fff'
      })),
      backgrounds: Object.entries(bgResources).map(([name, data]) => ({
        name,
        url: data?.url || ''
      })),
      bgmList: Object.entries(bgmResources).map(([name, data]) => ({
        name,
        url: data?.url || ''
      })),
      sfxList: Object.entries(sfxResources).map(([name, data]) => ({
        name,
        url: data?.url || ''
      }))
    }
  } else {
    if (!meetingId.value) {
      const m = meetStore.createMeeting()
      scheduleSave()
      router.replace(`/meet/setup/${m.id}`)
      return
    }
    form.value = {
      name: '',
      location: '',
      worldSetting: '',
      voiceTtsEnabled: false,
      useJamendoBgm: assetSources.enableJamendoBgm !== false,
      jamendoInstrumentalOnly: assetSources.jamendoInstrumentalOnly !== false,
      jamendoClientId: assetSources.jamendoClientId || '',
      presetId: null,
      characters: [],
      backgrounds: [],
      bgmList: [],
      sfxList: []
    }
  }
})

function addCharacter() {
  form.value.characters.push({
    contactId: null,
    vnName: '',
    vnDescription: '',
    role: 'support',
    nameColor: '#fff'
  })
}

function onSave() {
  if (!meetingId.value || !form.value) return

  const bgObj = {}
  for (const bg of form.value.backgrounds) {
    if (bg.name && bg.url) {
      bgObj[bg.name] = { url: bg.url, createdAt: Date.now() }
    }
  }

  const bgmObj = {}
  for (const bgm of form.value.bgmList) {
    if (bgm.name && bgm.url) {
      bgmObj[bgm.name] = { url: bgm.url, createdAt: Date.now() }
    }
  }

  const sfxObj = {}
  for (const sfx of form.value.sfxList) {
    if (sfx.name && sfx.url) {
      sfxObj[sfx.name] = { url: sfx.url, createdAt: Date.now() }
    }
  }

  const existing = meeting.value
  const existingResources = existing?.resources || {}
  Object.assign(meetStore.assetSources, {
    enableJamendoBgm: form.value.useJamendoBgm === true,
    jamendoInstrumentalOnly: form.value.jamendoInstrumentalOnly !== false,
    jamendoClientId: String(form.value.jamendoClientId || '').trim()
  })

  meetStore.updateMeeting(meetingId.value, {
    name: form.value.name,
    location: form.value.location,
    worldSetting: form.value.worldSetting,
    voice: {
      ttsEnabled: form.value.voiceTtsEnabled === true
    },
    presetId: form.value.presetId,
    characters: form.value.characters,
    resources: {
      ...existingResources,
      backgrounds: { ...(existingResources.backgrounds || {}), ...bgObj },
      bgm: { ...(existingResources.bgm || {}), ...bgmObj },
      sfx: { ...(existingResources.sfx || {}), ...sfxObj }
    }
  })
  scheduleSave()
  router.push('/meet')
}
</script>

<style scoped>
.meet-setup {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #1a1a1a;
  color: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.setup-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--app-pt, 12px) 20px 14px;
  border-bottom: 2px solid #333;
}

.setup-back {
  background: #000;
  border: 2px solid #444;
  color: #fff;
  padding: 8px 14px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.setup-back:hover { background: #333; }
.setup-back:active { background: #444; }

.setup-title {
  flex: 1;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 4px;
}

.setup-save {
  padding: 10px 22px;
  background: #000;
  color: #fff;
  border: 2px solid #555;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  transition: all 0.2s;
}

.setup-save:hover { background: #333; border-color: #777; }
.setup-save:active { transform: scale(0.95); }

.setup-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 80px;
}

.setup-body::-webkit-scrollbar { display: none; }

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 3px;
  margin-top: 24px;
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.field-label:first-child { margin-top: 0; }

.field-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.25);
  margin-top: -6px;
  margin-bottom: 12px;
  letter-spacing: 1px;
}

.field-input, .field-select {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #333;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
  transition: border-color 0.2s;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 1px;
}

.field-input:focus, .field-select:focus {
  border-color: #666;
}

.field-input::placeholder { color: rgba(255, 255, 255, 0.2); }

.field-textarea {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #333;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.9rem;
  resize: vertical;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
  transition: border-color 0.2s;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 1px;
}

.field-textarea:focus { border-color: #666; }
.field-textarea::placeholder { color: rgba(255, 255, 255, 0.2); }

.char-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.char-item {
  border: 2px solid #333;
  padding: 16px;
  position: relative;
  background: rgba(0, 0, 0, 0.3);
}

.char-info {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.char-name-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 2px;
}

.char-name-input::placeholder { color: rgba(255, 255, 255, 0.2); }
.char-name-input:focus { border-color: #666; }

.char-select {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.char-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.char-color {
  width: 44px;
  height: 38px;
  border: 1px solid #444;
  background: transparent;
  cursor: pointer;
  padding: 3px;
}

.char-role {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.char-desc {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #333;
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.85rem;
  resize: vertical;
  color: rgba(255, 255, 255, 0.8);
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.char-desc::placeholder { color: rgba(255, 255, 255, 0.15); }
.char-desc:focus { border-color: #555; }

.char-remove {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(200, 100, 100, 0.1);
  border: 1px solid rgba(200, 100, 100, 0.3);
  font-size: 16px;
  cursor: pointer;
  color: rgba(200, 100, 100, 0.6);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.char-remove:active { background: rgba(200, 100, 100, 0.2); transform: scale(0.9); }

.add-char-btn {
  padding: 14px;
  border: 2px dashed #444;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 2px;
  transition: all 0.2s;
}

.add-char-btn:hover { border-color: #666; color: rgba(255, 255, 255, 0.6); }
.add-char-btn:active { background: rgba(255, 255, 255, 0.04); }

/* ===== Resources Section ===== */
.resources-section {
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid #333;
}

.provider-card {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.provider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.provider-row:last-of-type {
  margin-bottom: 10px;
}

.provider-title {
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.92);
}

.provider-label {
  margin-top: 8px;
}

.provider-hint {
  margin-top: 4px;
  margin-bottom: 0;
}

.toggle-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.28);
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.85rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-chip.active {
  border-color: rgba(230, 230, 230, 0.45);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.96);
}

.resource-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.resource-name {
  width: 100px;
  flex-shrink: 0;
  padding: 10px 12px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.resource-name::placeholder { color: rgba(255, 255, 255, 0.2); }

.resource-url {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.resource-url::placeholder { color: rgba(255, 255, 255, 0.2); }

.resource-del {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: rgba(200, 100, 100, 0.1);
  border: 1px solid rgba(200, 100, 100, 0.3);
  font-size: 16px;
  cursor: pointer;
  color: rgba(200, 100, 100, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.resource-del:active { background: rgba(200, 100, 100, 0.2); transform: scale(0.9); }

.add-resource-btn {
  width: 100%;
  padding: 12px;
  border: 2px dashed #444;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.85rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 2px;
  transition: all 0.2s;
}

.add-resource-btn:hover { border-color: #666; color: rgba(255, 255, 255, 0.5); }
.add-resource-btn:active { background: rgba(255, 255, 255, 0.03); }

@media (max-width: 640px) {
  .provider-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

