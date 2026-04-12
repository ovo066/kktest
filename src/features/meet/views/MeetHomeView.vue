<template>
  <div class="meet-home">
    <!-- Noise overlay -->
    <div class="meet-noise"></div>

    <!-- Header -->
    <header class="meet-header">
      <button class="meet-sys-btn" @click="router.push('/')">
        <span>返回</span>
      </button>
      <div class="meet-header-center">
        <h1 class="meet-title">见 面</h1>
      </div>
      <button class="meet-sys-btn" @click="router.push('/meet/presets')">
        <span>预设</span>
      </button>
    </header>

    <div class="meet-body">
      <!-- Empty state -->
      <div v-if="soloContacts.length === 0" class="meet-empty">
        <div class="meet-empty-line"></div>
        <p class="meet-empty-text">尚无角色</p>
        <p class="meet-empty-hint">先在聊天中创建角色</p>
        <div class="meet-empty-line"></div>
      </div>

      <!-- Contact list - VN chapter select style -->
      <div class="contact-list">
        <div
          v-for="c in soloContacts"
          :key="c.id"
          class="contact-entry"
          @click="onContactClick(c)"
        >
          <div class="contact-avatar-box">
            <img v-if="c.avatarType === 'image' && c.avatar" :src="c.avatar" class="avatar-img" />
            <span v-else class="avatar-placeholder">{{ (c.name || '?')[0] }}</span>
          </div>
          <div class="contact-info">
            <div class="contact-name">{{ c.name }}</div>
            <div v-if="getMeetingCount(c.id) > 0" class="contact-meetings-count">
              {{ getMeetingCount(c.id) }} 段见面
            </div>
            <div v-else class="contact-meetings-count">新的相遇</div>
          </div>
          <div class="contact-arrow">&#9654;</div>
        </div>
      </div>
    </div>

    <!-- Continue / New meeting dialog -->
    <Transition name="meet-sheet">
      <div v-if="showSheet" class="sheet-backdrop" @click="showSheet = false">
        <div class="sheet-panel" @click.stop>
          <div class="sheet-header">
            <div class="sheet-avatar-box">
              <img v-if="selectedContact?.avatarType === 'image' && selectedContact?.avatar" :src="selectedContact.avatar" class="avatar-img" />
              <span v-else class="avatar-placeholder">{{ (selectedContact?.name || '?')[0] }}</span>
            </div>
            <div class="sheet-name">{{ selectedContact?.name }}</div>
          </div>

          <!-- Existing meetings -->
          <div v-if="contactMeetings.length > 0" class="sheet-section">
            <div class="sheet-label">已有见面</div>
            <div
              v-for="m in contactMeetings"
              :key="m.id"
              class="sheet-meeting"
            >
              <div class="sheet-meeting-info">
                <div class="sheet-meeting-name">{{ m.name }}</div>
                <div class="sheet-meeting-meta">
                  <span v-if="m.location">{{ m.location }}</span>
                  <span>{{ formatTime(m.updatedAt) }}</span>
                </div>
              </div>
              <div class="sheet-meeting-actions">
                <button class="sheet-btn play" @click="goPlay(m.id)">
                  <i class="ph ph-play-fill"></i>
                </button>
                <button class="sheet-btn edit" @click="goSetup(m.id)">
                  <i class="ph ph-gear-six"></i>
                </button>
                <button class="sheet-btn del" @click="removeMeeting(m.id)">
                  <i class="ph ph-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <button class="sheet-new-btn" @click="createForContact">
            + 新的见面
          </button>
          <button class="sheet-cancel" @click="showSheet = false">取消</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMeetStore } from '../../../stores/meet'
import { useContactsStore } from '../../../stores/contacts'
import { useStorage } from '../../../composables/useStorage'

const router = useRouter()
const meetStore = useMeetStore()
const contactsStore = useContactsStore()
const { scheduleSave } = useStorage()

const showSheet = ref(false)
const selectedContact = ref(null)

const soloContacts = computed(() =>
  (contactsStore.contacts || []).filter(c => !c.isGroup)
)

const contactMeetings = computed(() => {
  if (!selectedContact.value) return []
  const cid = selectedContact.value.id
  return (meetStore.meetings || [])
    .filter(m => m.contactId === cid || (m.characters || []).some(ch => ch.contactId === cid))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
})

function getMeetingCount(contactId) {
  return (meetStore.meetings || []).filter(
    m => m.contactId === contactId || (m.characters || []).some(ch => ch.contactId === contactId)
  ).length
}

function onContactClick(contact) {
  selectedContact.value = contact
  const meetings = (meetStore.meetings || []).filter(
    m => m.contactId === contact.id || (m.characters || []).some(ch => ch.contactId === contact.id)
  )
  if (meetings.length === 0) {
    createForContact()
  } else {
    showSheet.value = true
  }
}

function createForContact() {
  const c = selectedContact.value
  if (!c) return
  const meeting = meetStore.createMeeting({
    name: `与${c.name}的见面`,
    contactId: c.id,
    characters: [{
      contactId: c.id,
      vnName: c.name,
      vnDescription: '',
      role: 'lead',
      nameColor: '#fff'
    }]
  })
  scheduleSave()
  showSheet.value = false
  router.push(`/meet/setup/${meeting.id}`)
}

function goPlay(id) {
  meetStore.setCurrentMeeting(id)
  showSheet.value = false
  router.push(`/meet/play/${id}`)
}

function goSetup(id) {
  showSheet.value = false
  router.push(`/meet/setup/${id}`)
}

function removeMeeting(id) {
  meetStore.deleteMeeting(id)
  scheduleSave()
  if (contactMeetings.value.length === 0) showSheet.value = false
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Date.now() - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.meet-home {
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

.meet-noise {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.06'/%3E%3C/svg%3E");
  pointer-events: none;
}

/* Header */
.meet-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-pt-lg, 48px) 20px 20px;
  border-bottom: 2px solid #333;
  position: relative;
  z-index: 1;
}

.meet-header-center {
  flex: 1;
  text-align: center;
}

.meet-title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 12px;
  color: #fff;
}

.meet-sys-btn {
  background: #000;
  color: #fff;
  border: 2px solid #444;
  padding: 8px 16px;
  font-size: 13px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}

.meet-sys-btn:hover { background: #333; }
.meet-sys-btn:active { background: #444; }

/* Body */
.meet-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  position: relative;
  z-index: 1;
}

.meet-body::-webkit-scrollbar { display: none; }

/* Empty state */
.meet-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 40px;
  color: rgba(255, 255, 255, 0.3);
}

.meet-empty-line {
  width: 60px;
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
}

.meet-empty-text {
  font-size: 1.1rem;
  letter-spacing: 6px;
  font-weight: 700;
}

.meet-empty-hint {
  font-size: 0.8rem;
  letter-spacing: 2px;
  opacity: 0.6;
}

/* Contact list */
.contact-list {
  display: flex;
  flex-direction: column;
}

.contact-entry {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.2s;
}

.contact-entry:hover {
  background: rgba(255, 255, 255, 0.04);
}

.contact-entry:active {
  background: rgba(255, 255, 255, 0.08);
}

.contact-avatar-box {
  width: 56px;
  height: 56px;
  border: 2px solid #444;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: #111;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 1.2rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-meetings-count {
  margin-top: 4px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 1px;
}

.contact-arrow {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

/* ===== Bottom Sheet ===== */
.sheet-backdrop {
  position: absolute;
  inset: 0;
  z-index: 70;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-panel {
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  background: rgba(20, 20, 20, 0.96);
  border: 2px solid #333;
  border-bottom: none;
  padding: 24px 24px 32px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.sheet-panel::-webkit-scrollbar { display: none; }

.sheet-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sheet-avatar-box {
  width: 52px;
  height: 52px;
  border: 2px solid #444;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: #111;
}

.sheet-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 3px;
}

.sheet-section {
  padding: 18px 0;
}

.sheet-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 4px;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 12px;
}

.sheet-meeting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 10px;
  transition: background 0.2s;
}

.sheet-meeting-info { min-width: 0; flex: 1; }

.sheet-meeting-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 1px;
}

.sheet-meeting-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 1px;
}

.sheet-meeting-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.sheet-btn {
  width: 36px;
  height: 36px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #444;
  background: #000;
  color: #fff;
  transition: all 0.2s;
}

.sheet-btn:active { transform: scale(0.9); }
.sheet-btn:hover { background: #333; }

.sheet-btn.play { border-color: #666; }
.sheet-btn.edit { color: rgba(255, 255, 255, 0.5); }
.sheet-btn.del { color: rgba(200, 100, 100, 0.7); border-color: rgba(200, 100, 100, 0.3); }

.sheet-new-btn {
  width: 100%;
  padding: 14px;
  margin-top: 8px;
  background: #000;
  border: 2px solid #555;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.sheet-new-btn:hover { background: #222; border-color: #777; }
.sheet-new-btn:active { transform: scale(0.98); }

.sheet-cancel {
  width: 100%;
  padding: 14px;
  margin-top: 8px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.9rem;
  font-weight: 700;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  cursor: pointer;
}

/* Sheet transition */
.meet-sheet-enter-active { transition: opacity 0.3s ease; }
.meet-sheet-leave-active { transition: opacity 0.2s ease; }
.meet-sheet-enter-from, .meet-sheet-leave-to { opacity: 0; }
.meet-sheet-enter-active .sheet-panel { transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
.meet-sheet-leave-active .sheet-panel { transition: transform 0.25s ease-in; }
.meet-sheet-enter-from .sheet-panel { transform: translateY(100%); }
.meet-sheet-leave-to .sheet-panel { transform: translateY(30%); }
</style>

