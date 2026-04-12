<template>
  <div class="planner-view">
    <!-- View content: user schedule or character schedule -->
    <template v-if="allowCharacterSchedule && scheduleMode === 'character' && activeCharacter">
      <CharacterScheduleView
        :contact-id="activeCharacter.id"
        :character-name="activeCharacter.name"
        :contacts="characterContacts"
        :mode="scheduleMode"
        :user-avatar="userAvatar"
        @select-contact="selectCharacter"
        @update:mode="scheduleMode = $event"
      />
    </template>
    <template v-else>
      <component :is="currentView" @open-create="openCreate" @open-diary="openDiary">
        <template #schedule-toggle>
          <ScheduleToggle
            v-if="allowCharacterSchedule && activeCharacter"
            v-model:mode="scheduleMode"
            :user-avatar="userAvatar"
            :character-avatar="activeCharacter?.avatar || ''"
            :character-name="activeCharacter?.name || ''"
            :is-busy="characterBusy"
          />
        </template>
      </component>
    </template>

    <!-- Bottom nav -->
    <PlannerNav v-if="scheduleMode !== 'character'" v-model="activeTab" />

    <!-- Floating action button (right side) -->
    <Transition name="fab-pop">
      <button
        v-if="activeTab !== 'diary' && scheduleMode === 'user'"
        class="planner-fab"
        @click="openCreate"
      >
        <span class="material-symbols-outlined" style="font-size:30px;font-variation-settings:'FILL' 1,'wght' 400">add</span>
      </button>
    </Transition>


    <!-- Create modal -->
    <TaskCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="showCreateModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { usePersonasStore } from '../../../stores/personas'
import { usePlannerStore } from '../../../stores/planner'
import { useSettingsStore } from '../../../stores/settings'
import PlannerNav from '../components/PlannerNav.vue'
import TaskCreateModal from '../components/TaskCreateModal.vue'
import ScheduleToggle from '../components/ScheduleToggle.vue'
import TodayView from './TodayView.vue'
import CalendarView from './CalendarView.vue'
import TasksView from './TasksView.vue'
import DiaryListView from './DiaryListView.vue'
import CharacterScheduleView from './CharacterScheduleView.vue'

const router = useRouter()
const contactsStore = useContactsStore()
const personasStore = usePersonasStore()
const plannerStore = usePlannerStore()
const settingsStore = useSettingsStore()

const activeTab = ref('today')
const showCreateModal = ref(false)
const scheduleMode = ref('user')
const selectedCharacterId = ref('')

const allowCharacterSchedule = computed(() => settingsStore.allowCharacterSchedule)

const characterContacts = computed(() =>
  (contactsStore.contacts || []).filter(c => c && c.type !== 'group')
)

const activeCharacter = computed(() => {
  const selected = characterContacts.value.find(c => c.id === selectedCharacterId.value)
  if (selected) return selected
  if (contactsStore.activeChat && contactsStore.activeChat.type !== 'group') return contactsStore.activeChat
  return characterContacts.value[0] || null
})

const userAvatar = computed(() => {
  const persona = personasStore.personas?.find(p => p.id === personasStore.defaultPersonaId)
  return persona?.avatar || ''
})

const characterBusy = computed(() => {
  if (!activeCharacter.value) return false
  return plannerStore.isCharacterBusy(activeCharacter.value.id)
})

const currentView = computed(() => {
  const map = {
    today: TodayView,
    calendar: CalendarView,
    tasks: TasksView,
    diary: DiaryListView
  }
  return map[activeTab.value] || TodayView
})

watch(allowCharacterSchedule, (enabled) => {
  if (!enabled && scheduleMode.value === 'character') {
    scheduleMode.value = 'user'
  }
})

watch(
  [characterContacts, () => contactsStore.activeChat?.id],
  ([contacts, activeChatId]) => {
    const hasSelected = contacts.some(contact => contact.id === selectedCharacterId.value)
    if (hasSelected) return
    const activeChatContact = contacts.find(contact => contact.id === activeChatId)
    selectedCharacterId.value = activeChatContact?.id || contacts[0]?.id || ''
  },
  { immediate: true }
)

function openCreate() {
  showCreateModal.value = true
}

function selectCharacter(contactId) {
  selectedCharacterId.value = contactId
}

function openDiary(id) {
  router.push({ name: 'diary-detail', params: { id } })
}
</script>

<style scoped>
.planner-view {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--bg-color, #fffdfa);
}

/* Floating action button */
.planner-fab {
  position: fixed;
  right: 20px;
  bottom: 90px;
  z-index: 60;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--planner-accent, #ffb6b9);
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(255,182,185,0.55);
  transition: transform 0.15s, box-shadow 0.15s;
}
.planner-fab:active {
  transform: scale(0.92);
}

/* FAB enter/leave transition */
.fab-pop-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fab-pop-leave-active { transition: all 0.15s ease-in; }
.fab-pop-enter-from,
.fab-pop-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* CSS 变量 — planner 模块强调色 (可被主题覆盖) */
:global(:root) {
  --planner-accent: #ffb6b9;
  --planner-accent2: #a6e3e9;
  --planner-accent3: #fae3d9;
  --planner-work: #b8e0d2;
  --planner-personal: #f4c2c2;
  --planner-ideas: #fff1a8;
}
</style>
