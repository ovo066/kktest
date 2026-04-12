<template>
  <div class="diary-detail">
    <!-- Header -->
    <header class="detail-header">
      <button class="back-btn" @click="$router.back()">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <div style="flex:1" />
      <button v-if="!editMode" class="menu-btn" @click="showMenu = !showMenu">
        <span class="material-symbols-outlined">more_horiz</span>
      </button>
      <button v-else class="save-btn" @click="saveEdit">保存</button>
    </header>

    <!-- Dot menu -->
    <div v-if="showMenu" class="dot-menu">
      <button @click="startEdit">
        <span class="material-symbols-outlined" style="font-size:18px">edit</span>编辑
      </button>
      <button @click="confirmDelete" class="danger">
        <span class="material-symbols-outlined" style="font-size:18px">delete</span>删除
      </button>
    </div>

    <div v-if="!entry" class="not-found">
      <p>日记不存在</p>
    </div>

    <template v-else>
      <!-- View mode -->
      <div v-if="!editMode" class="scroll-area">
        <!-- Date -->
        <div class="date-section">
          <h1 class="date-big">{{ dayLabel }}</h1>
          <p class="weekday-label">{{ entry.weekday }}</p>
          <div class="tag-row">
            <span v-if="entry.weather" class="meta-chip">
              <span class="material-symbols-outlined" style="font-size:14px">sunny</span>
              {{ entry.weather }}
            </span>
            <span v-if="entry.mood" class="meta-chip">
              <span class="material-symbols-outlined" style="font-size:14px">mood</span>
              {{ entry.mood }}
            </span>
          </div>
        </div>

        <!-- Content paragraphs -->
        <div class="content-area">
          <p v-for="(para, i) in paragraphs" :key="i" class="para">{{ para }}</p>
        </div>

        <!-- Images (Polaroid style) -->
        <div v-if="entry.images && entry.images.length" class="images-area">
          <div v-for="(img, i) in entry.images" :key="i" class="polaroid">
            <img :src="img" class="polaroid-img" alt="" />
          </div>
        </div>

        <!-- AI Replies section -->
        <div v-if="entry.aiReplies && entry.aiReplies.length" class="ai-replies">
          <h3 class="replies-title">
            <span class="material-symbols-outlined" style="font-size:18px">auto_awesome</span>
            角色的回应
          </h3>
          <div v-for="reply in entry.aiReplies" :key="reply.contactId + reply.time" class="reply-card">
            <p class="reply-author">{{ reply.contactName }}</p>
            <p class="reply-content">{{ reply.content }}</p>
            <p class="reply-time">{{ formatRelTime(reply.time) }}</p>
          </div>
        </div>

        <!-- Action bar -->
        <div class="action-bar">
          <button class="action-btn" @click="showShareModal = true">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0,'wght' 300">people</span>
            <span>交换日记</span>
          </button>
          <button class="action-btn" :class="{ active: entry.shareWithAI }" @click="toggleShareAI">
            <span class="material-symbols-outlined" :style="{ 'font-variation-settings': entry.shareWithAI ? `'FILL' 1,'wght' 400` : `'FILL' 0,'wght' 300` }">smart_toy</span>
            <span>{{ entry.shareWithAI ? '已告知 AI' : '告知 AI' }}</span>
          </button>
          <button class="action-btn" @click="startEdit">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 0,'wght' 300">edit</span>
            <span>编辑</span>
          </button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="scroll-area">
        <DiaryEditor
          :initial-content="editContent"
          :initial-mood="editMood"
          :initial-weather="editWeather"
          :initial-images="editImages"
          :initial-share-ai="editShareAI"
          @update:content="editContent = $event"
          @update:mood="editMood = $event"
          @update:weather="editWeather = $event"
          @update:images="editImages = $event"
          @update:share-ai="editShareAI = $event"
        />
      </div>
    </template>

    <!-- Diary share modal -->
    <Teleport to="body">
      <div v-if="showShareModal" class="share-overlay" @click.self="showShareModal = false">
        <div class="share-sheet">
          <h3 class="share-title">交换日记</h3>
          <p class="share-desc">选择要分享这篇日记的角色</p>

          <div class="contact-list">
            <div
              v-for="contact in singleContacts"
              :key="contact.id"
              class="contact-row"
              @click="toggleContactShare(contact.id)"
            >
              <div class="contact-avatar">
                <img v-if="contact.avatar" :src="contact.avatar" class="avatar-img" alt="" />
                <span v-else class="avatar-text">{{ contact.name[0] }}</span>
              </div>
              <span class="contact-name">{{ contact.name }}</span>
              <div class="contact-actions">
                <label class="inject-label" @click.stop>
                  <input
                    type="checkbox"
                    :checked="injectMap[contact.id]"
                    @change="toggleInject(contact.id)"
                  />
                  <span class="inject-text">注入聊天</span>
                </label>
                <div class="share-check" :class="{ checked: sharedSet.has(contact.id) }">
                  <span v-if="sharedSet.has(contact.id)" class="material-symbols-outlined" style="font-size:16px;font-variation-settings:'FILL' 1,'wght' 500">check</span>
                </div>
              </div>
            </div>
          </div>

          <button
            class="share-confirm-btn"
            :disabled="sharingLoading"
            @click="confirmShare"
          >
            <span v-if="sharingLoading" class="material-symbols-outlined spin" style="font-size:18px">progress_activity</span>
            {{ sharingLoading ? '正在生成回复…' : '确认交换' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlannerStore } from '../../../stores/planner'
import { useContactsStore } from '../../../stores/contacts'
import { useStorage } from '../../../composables/useStorage'
import { useToast } from '../../../composables/useToast'
import DiaryEditor from '../components/DiaryEditor.vue'

const route = useRoute()
const router = useRouter()
const plannerStore = usePlannerStore()
const contactsStore = useContactsStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

const entry = computed(() => plannerStore.getDiaryById(route.params.id))

// ─── View helpers ────────────────────────────────
const dayLabel = computed(() => {
  if (!entry.value) return ''
  const d = new Date(entry.value.date + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const paragraphs = computed(() => {
  if (!entry.value) return []
  return entry.value.content.split('\n').filter(p => p.trim())
})

// ─── Menu ────────────────────────────────────────
const showMenu = ref(false)

function confirmDelete() {
  showMenu.value = false
  if (confirm('确定删除这篇日记？')) {
    plannerStore.removeDiaryEntry(entry.value.id)
    scheduleSave()
    router.back()
  }
}

// ─── Edit mode ────────────────────────────────────
const editMode = ref(false)
const editContent = ref('')
const editMood = ref('')
const editWeather = ref('')
const editImages = ref([])
const editShareAI = ref(true)

function startEdit() {
  if (!entry.value) return
  showMenu.value = false
  editContent.value = entry.value.content
  editMood.value = entry.value.mood
  editWeather.value = entry.value.weather
  editImages.value = [...(entry.value.images || [])]
  editShareAI.value = entry.value.shareWithAI
  editMode.value = true
}

function saveEdit() {
  plannerStore.updateDiaryEntry(entry.value.id, {
    content: editContent.value,
    mood: editMood.value,
    weather: editWeather.value,
    images: editImages.value,
    shareWithAI: editShareAI.value
  })
  scheduleSave()
  editMode.value = false
  showToast('日记已保存')
}

function toggleShareAI() {
  plannerStore.updateDiaryEntry(entry.value.id, { shareWithAI: !entry.value.shareWithAI })
  scheduleSave()
}

// ─── Share modal ──────────────────────────────────
const showShareModal = ref(false)
const sharingLoading = ref(false)
const sharedSet = ref(new Set())
const injectMap = ref({})

const singleContacts = computed(() =>
  contactsStore.contacts.filter(c => c.type !== 'group')
)

watch(showShareModal, (v) => {
  if (v && entry.value) {
    sharedSet.value = new Set(entry.value.sharedWithContacts || [])
    const m = {}
    for (const id of sharedSet.value) m[id] = entry.value.injectToChat !== false
    injectMap.value = m
  }
})

function toggleContactShare(id) {
  const s = new Set(sharedSet.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  sharedSet.value = s
  if (!injectMap.value[id]) injectMap.value[id] = true
}

function toggleInject(id) {
  injectMap.value[id] = !injectMap.value[id]
}

async function confirmShare() {
  if (!entry.value) return
  sharingLoading.value = true

  const newlyShared = [...sharedSet.value].filter(
    id => !(entry.value.sharedWithContacts || []).includes(id)
  )

  // Save sharing state
  plannerStore.updateDiaryEntry(entry.value.id, {
    sharedWithContacts: [...sharedSet.value],
    injectToChat: Object.values(injectMap.value).some(Boolean)
  })
  scheduleSave()

  // Generate AI replies for newly shared contacts
  if (newlyShared.length > 0) {
    try {
      const { generateDiaryReply } = await import('../../../composables/usePlannerContext')
      for (const contactId of newlyShared) {
        const contact = contactsStore.contacts.find(c => c.id === contactId)
        if (!contact) continue
        const reply = await generateDiaryReply(contact, entry.value)
        if (reply) {
          const current = entry.value.aiReplies || []
          plannerStore.updateDiaryEntry(entry.value.id, {
            aiReplies: [...current, { contactId, contactName: contact.name, content: reply, time: Date.now() }]
          })
          scheduleSave()
        }
      }
      showToast(`已交换给 ${newlyShared.length} 个角色`)
    } catch {
      showToast('生成回复失败，日记已分享')
    }
  }

  sharingLoading.value = false
  showShareModal.value = false
}

// ─── Utils ────────────────────────────────────────
function formatRelTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}
</script>

<style scoped>
.diary-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color, #fffdfa);
  position: relative;
}

.detail-header {
  display: flex;
  align-items: center;
  padding: 52px 16px 8px;
  gap: 8px;
  position: relative;
  z-index: 10;
}

.back-btn, .menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #a89f9e);
  display: flex;
  padding: 4px;
}

.save-btn {
  background: var(--planner-accent, #ffb6b9);
  color: #fff;
  border: none;
  border-radius: 16px;
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* Dot menu */
.dot-menu {
  position: absolute;
  top: 100px;
  right: 16px;
  background: var(--card-bg, #fff);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  overflow: hidden;
  z-index: 100;
}

.dot-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color, #5c4a4d);
  text-align: left;
}

.dot-menu button.danger { color: #f87171; }
.dot-menu button:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.06); }

.not-found {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #a89f9e);
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 24px 120px;
}

/* Date section */
.date-section { margin-bottom: 28px; }

.date-big {
  font-size: 34px;
  font-weight: 800;
  color: var(--text-color, #5c4a4d);
  line-height: 1.1;
}

.weekday-label {
  font-size: 14px;
  color: var(--text-muted, #a89f9e);
  margin-top: 4px;
}

.tag-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(255,182,185,0.15);
  color: var(--text-muted, #a89f9e);
  border: 1px solid rgba(255,182,185,0.3);
}

/* Content */
.content-area { margin-bottom: 24px; }

.para {
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-color, #5c4a4d);
  margin-bottom: 14px;
}

/* Polaroid images */
.images-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 28px;
}

.polaroid {
  background: #fff;
  padding: 10px 10px 32px;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  transform: rotate(-1deg);
  margin: 0 auto;
  max-width: 280px;
}

.polaroid:nth-child(even) { transform: rotate(1.5deg); }

.polaroid-img {
  width: 100%;
  border-radius: 2px;
  display: block;
}

/* AI replies */
.ai-replies { margin-bottom: 24px; }

.replies-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
  margin-bottom: 12px;
}

.reply-card {
  background: rgba(166,227,233,0.12);
  border: 1px solid rgba(166,227,233,0.3);
  border-radius: 16px;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.reply-author {
  font-size: 12px;
  font-weight: 700;
  color: var(--planner-accent2, #a6e3e9);
  margin-bottom: 6px;
}

.reply-content {
  font-size: 14px;
  color: var(--text-color, #5c4a4d);
  line-height: 1.6;
}

.reply-time {
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
  margin-top: 6px;
  text-align: right;
}

/* Action bar */
.action-bar {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid rgba(0,0,0,0.06);
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #a89f9e);
  font-size: 11px;
  padding: 8px 12px;
  border-radius: 14px;
  transition: all 0.15s;
}

.action-btn .material-symbols-outlined { font-size: 24px; }

.action-btn.active {
  color: var(--planner-accent2, #a6e3e9);
}

.action-btn:hover {
  background: rgba(0,0,0,0.05);
}

/* Share modal */
.share-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.share-sheet {
  width: 100%;
  max-width: 430px;
  background: var(--card-bg, #fff);
  border-radius: 28px 28px 0 0;
  padding: 24px 20px calc(env(safe-area-inset-bottom, 16px) + 20px);
  max-height: 75dvh;
  overflow-y: auto;
}

.share-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color, #5c4a4d);
  margin-bottom: 4px;
}

.share-desc {
  font-size: 13px;
  color: var(--text-muted, #a89f9e);
  margin-bottom: 16px;
}

.contact-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }

.contact-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.contact-row:hover { background: rgba(0,0,0,0.04); }

.contact-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255,182,185,0.2);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-text { font-size: 16px; font-weight: 700; color: var(--planner-accent, #ffb6b9); }

.contact-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #5c4a4d);
}

.contact-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.inject-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-muted, #a89f9e);
}

.inject-label input { width: 14px; height: 14px; accent-color: var(--planner-accent2, #a6e3e9); }
.inject-text { white-space: nowrap; }

.share-check {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.share-check.checked {
  background: var(--planner-accent, #ffb6b9);
  border-color: var(--planner-accent, #ffb6b9);
  color: #fff;
}

.share-confirm-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 18px;
  background: var(--planner-accent, #ffb6b9);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.share-confirm-btn:disabled { opacity: 0.5; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin { animation: spin 1s linear infinite; display: inline-block; }
</style>
