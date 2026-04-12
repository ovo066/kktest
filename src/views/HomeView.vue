<template>
  <div
    class="desktop-root"
    :class="{ 'is-dark': settingsStore.isDark }"
    :style="{ backgroundImage: bgImg }"
    @contextmenu.prevent="enterEdit"
  >
    <div class="desktop-dim"></div>

    <!-- Fixed hero (not repeated per page) -->
    <header class="hero">
      <div class="hero-date">{{ dateText }}</div>
      <h1 class="hero-greeting">{{ greetingText }}</h1>
      <div class="hero-meta">day {{ dayOfYear }} · {{ currentYear }}</div>
    </header>

    <!-- Horizontal pager -->
    <div
      ref="pagerRef"
      class="desktop-pager no-scrollbar"
      @scroll.passive="onPagerScroll"
    >
      <section
        v-for="(pageItems, pi) in pages"
        :key="'page-' + pi"
        class="desktop-page"
      >
        <div class="grid" :class="{ editing: isEdit }">
          <template v-for="(item, idx) in pageItems" :key="item.id">
            <!-- APP tile -->
            <div
              v-if="item._isApp"
              class="cell sz-app"
              :draggable="isEdit"
              @dragstart="dragStart($event, itemGlobalIndex(pi, idx))"
              @dragover.prevent
              @drop="dragDrop($event, itemGlobalIndex(pi, idx))"
            >
              <button class="glass app-tile" @click="openApp(item.route)">
                <span class="app-icon-wrap" :style="{ background: item.homeBackground }">
                  <img v-if="settingsStore.theme?.appIcons?.[item.key]" :src="settingsStore.theme.appIcons[item.key]" class="app-icon-img" alt="">
                  <i v-else :class="item.icon" class="app-icon-i"></i>
                </span>
                <span class="app-name">{{ item.label }}</span>
              </button>
              <button v-if="isEdit" class="del-btn" @click.stop="removeItem(item)"><i class="ph-bold ph-minus"></i></button>
            </div>

            <!-- WIDGET tile -->
            <div
              v-else
              class="cell"
              :class="['sz-' + (item.size || '2x1')]"
              :draggable="isEdit"
              @dragstart="dragStart($event, itemGlobalIndex(pi, idx))"
              @dragover.prevent
              @drop="dragDrop($event, itemGlobalIndex(pi, idx))"
            >
              <div class="glass widget-card" @click="onTap(item)">
                <!-- Weather -->
                <div v-if="item.type==='weather'" class="w-inner w-weather">
                  <div class="w-weather-row"><i :class="wIcon(item.config.condition)" class="w-weather-i"></i><span class="w-weather-t">{{ item.config.temp }}°</span></div>
                  <div class="w-weather-sub"><span>{{ item.config.city }}</span><span class="w-weather-cond">{{ wLabel(item.config.condition) }}</span></div>
                </div>
                <!-- Calendar -->
                <div v-else-if="item.type==='calendar'" class="w-inner w-cal">
                  <span class="w-cal-month">{{ calMonth }}</span>
                  <span class="w-cal-day">{{ calDay }}</span>
                  <span class="w-cal-week">{{ weekLabel }}</span>
                </div>
                <!-- Quote -->
                <div v-else-if="item.type==='quote'" class="w-inner w-quote">
                  <i class="ph ph-quotes w-quote-deco"></i>
                  <p class="w-quote-txt" :class="{ italic: item.config.fontStyle==='italic' }">{{ item.config.text }}</p>
                  <p v-if="item.config.author" class="w-quote-auth">— {{ item.config.author }}</p>
                </div>
                <!-- Image -->
                <div v-else-if="item.type==='image'" class="w-inner w-img">
                  <div v-if="item.config.tape!==false" class="w-img-tape" :style="{ background: item.config.tapeColor||'#d9d9d9' }"></div>
                  <div class="w-img-frame">
                    <img v-if="item.config.src" :src="item.config.src" class="w-img-pic" :style="{ transform:`rotate(${item.config.rotation||0}deg)` }">
                    <div v-else class="w-img-ph"><i class="ph ph-image-square"></i></div>
                  </div>
                  <div class="w-img-cap">{{ item.config.caption || 'memory' }}</div>
                </div>
                <!-- Todo -->
                <div v-else-if="item.type==='todo'" class="w-inner w-todo">
                  <div class="w-todo-h">{{ item.config.title || 'TO-DO' }}</div>
                  <div class="w-todo-list">
                    <div v-for="t in (item.config.items||[]).slice(0,4)" :key="t.id" class="w-todo-row">
                      <i :class="t.done?'ph-fill ph-check-circle':'ph ph-circle'" class="w-todo-ck"></i>
                      <span :class="{'w-todo-done':t.done}">{{ t.text }}</span>
                    </div>
                    <div v-if="!(item.config.items||[]).length" class="w-todo-empty">点击添加待办</div>
                  </div>
                </div>
                <!-- Clock -->
                <div v-else-if="item.type==='clock'" class="w-inner w-clock">
                  <div class="w-clock-t">{{ timeText }}</div>
                  <div v-if="item.config.showDate!==false" class="w-clock-d">{{ dateText }}</div>
                </div>
                <!-- Battery -->
                <div v-else-if="item.type==='battery'" class="w-inner w-batt">
                  <div class="w-batt-row"><i class="ph-fill ph-device-mobile"></i><span class="w-batt-pct">{{ batteryPctText }}%</span></div>
                  <div class="w-batt-lbl">当前电量</div>
                  <div class="w-batt-bar"><div class="w-batt-fill" :style="batteryFillStyle"></div></div>
                </div>
                <!-- Music -->
                <div v-else-if="item.type==='music'" class="w-inner w-music">
                  <div class="w-music-cover">
                    <img v-if="settingsStore.wallpaper" :src="settingsStore.wallpaper" alt="">
                    <i v-else class="ph-fill ph-music-notes"></i>
                  </div>
                  <div class="w-music-info">
                    <div class="w-music-title">{{ item.config.title || '我喜欢的音乐' }}</div>
                    <div class="w-music-sub">{{ item.config.artist || '未知艺术家' }}</div>
                  </div>
                  <div class="w-music-bar"><div class="w-music-fill"></div></div>
                </div>
                <!-- Stats -->
                <div v-else-if="item.type==='stats'" class="w-inner w-stats">
                  <template v-if="item.config.statsType==='year_progress'">
                    <div class="w-stats-ring">
                      <svg viewBox="0 0 36 36"><path class="ring-bg" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/><path class="ring-fg" :style="{strokeDasharray:yearProgress+',100'}" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/></svg>
                      <span class="ring-val">{{ yearProgress }}%</span>
                    </div>
                    <span class="w-stats-lbl">{{ currentYear }}</span>
                  </template>
                  <template v-else>
                    <i class="ph-fill ph-heart w-stats-heart"></i>
                    <span class="w-stats-big">{{ chatCount }}</span>
                    <span class="w-stats-lbl">对话</span>
                  </template>
                </div>
                <!-- Shortcuts -->
                <div v-else-if="item.type==='shortcuts'" class="w-inner w-sc">
                  <button v-for="(a,i) in (item.config.apps||[]).slice(0,4)" :key="i" class="w-sc-btn" @click.stop="openApp(a.route)">
                    <span class="w-sc-icon" :style="{background:a.bg||'rgba(255,255,255,0.15)'}"><i :class="a.icon"></i></span>
                    <span class="w-sc-name">{{ a.label }}</span>
                  </button>
                </div>

                <!-- Edit: delete -->
                <button v-if="isEdit" class="del-btn" @click.stop="removeItem(item)"><i class="ph-bold ph-minus"></i></button>
              </div>
            </div>
          </template>

          <!-- Add button (edit mode, last page only) -->
          <button v-if="isEdit && pi === pages.length - 1" class="cell sz-app add-btn" @click="startAdd"><i class="ph ph-plus"></i></button>
        </div>
      </section>
    </div>

    <!-- Page dots -->
    <div v-if="pages.length > 1" class="page-dots">
      <button
        v-for="(_, i) in pages"
        :key="'dot-' + i"
        type="button"
        class="page-dot"
        :class="{ active: i === activePage }"
        @click="goPage(i)"
      ></button>
    </div>

    <!-- Edit toggle -->
    <button class="edit-btn" :class="{ active: isEdit }" @click="isEdit=!isEdit">
      <i :class="isEdit?'ph-fill ph-check':'ph-fill ph-pencil-simple'"></i>
    </button>

    <WidgetEditor v-if="showEditor" :widget="editData" @close="showEditor=false" @save="onSave"/>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../stores/contacts'
import { useBootstrapStore } from '../stores/bootstrap'
import { useSettingsStore } from '../stores/settings'
import { useWidgetsStore } from '../stores/widgets'
import { useStorage } from '../composables/useStorage'
import { useBattery } from '../composables/useBattery'
import WidgetEditor from '../components/widgets/WidgetEditor.vue'
import { DESKTOP_APPS } from '../data/homeApps'

const router = useRouter()
const contactsStore = useContactsStore()
const bootstrapStore = useBootstrapStore()
const settingsStore = useSettingsStore()
const widgetsStore = useWidgetsStore()
const { scheduleSave, getCurrentSnapshotMeta } = useStorage()

const now = ref(new Date())
const { batteryPct } = useBattery()
const batteryPctText = computed(() => (typeof batteryPct.value === 'number' ? batteryPct.value : '--'))
const batteryFillStyle = computed(() => {
  const pct = typeof batteryPct.value === 'number' ? Math.max(0, Math.min(100, batteryPct.value)) : null
  if (pct == null) return { width: '100%', opacity: 0.25 }
  return { width: pct + '%' }
})
const isEdit = ref(false)
const showEditor = ref(false)
const editData = ref(null)
const pagerRef = ref(null)
const activePage = ref(0)
let timer = null
let dragIdx = -1
let hasCheckedWidgetSeeding = false

// ===== Apps definition =====
const allApps = DESKTOP_APPS

// ===== Computed =====
const bgImg = computed(() => `url('${settingsStore.wallpaper || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=800"}')`)
const currentYear = computed(() => now.value.getFullYear())
const timeText = computed(() => `${now.value.getHours()}:${now.value.getMinutes().toString().padStart(2,'0')}`)
const dateText = computed(() => { const d = now.value; const w = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六']; return `${d.getMonth()+1}月${d.getDate()}日 ${w[d.getDay()]}` })
const weekLabel = computed(() => ['周日','周一','周二','周三','周四','周五','周六'][now.value.getDay()])
const dayOfYear = computed(() => Math.floor((now.value - new Date(now.value.getFullYear(),0,0)) / 864e5))
const yearProgress = computed(() => { const t=now.value, s=new Date(t.getFullYear(),0,1), e=new Date(t.getFullYear()+1,0,1); return Math.floor((t-s)/(e-s)*100) })
const calDay = computed(() => now.value.getDate())
const calMonth = computed(() => ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.value.getMonth()])
const chatCount = computed(() => contactsStore.contacts?.length || 0)

const greetingText = computed(() => {
  const h = now.value.getHours()
  if (h < 6) return '凌晨好'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
})

// ===== Grid items: apps + widgets interleaved =====
const gridItems = computed(() => {
  const widgets = [...widgetsStore.widgets].sort((a, b) => (a.position || 0) - (b.position || 0))
  const apps = allApps.map(a => ({ ...a, _isApp: true, id: 'app_' + a.key }))
  const top3 = apps.slice(0, 3)
  const rest = apps.slice(3)
  return [...top3, ...widgets, ...rest]
})

// ===== Pagination: simulate 4-col grid row placement =====
const COLS = 4
const MAX_ROWS = 5

function getColSpan(item) {
  if (item._isApp) return 1
  return { '2x1': 2, '2x2': 2, '4x2': 4 }[item.size] || 2
}

const pages = computed(() => {
  const items = gridItems.value
  const result = []
  let page = []
  let row = 0
  let col = 0

  for (const item of items) {
    const span = getColSpan(item)

    // Doesn't fit in current row → next row
    if (col + span > COLS) {
      row++
      col = 0
    }
    // Exceeded page rows → new page
    if (row >= MAX_ROWS) {
      result.push(page)
      page = []
      row = 0
      col = 0
    }

    page.push(item)
    col += span
    if (col >= COLS) {
      row++
      col = 0
    }
  }

  if (page.length) result.push(page)
  return result.length ? result : [[]]
})

// Get the global flat index for an item across pages
function itemGlobalIndex(pageIdx, localIdx) {
  let count = 0
  for (let p = 0; p < pageIdx; p++) count += pages.value[p].length
  return count + localIdx
}

// ===== Pager scroll handling =====
function onPagerScroll(e) {
  const el = e.target
  const w = el.clientWidth || 1
  activePage.value = clampPage(Math.round(el.scrollLeft / w))
}

function goPage(idx) {
  const el = pagerRef.value
  if (!el) return
  const next = clampPage(idx)
  activePage.value = next
  el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
}

function clampPage(p) { return Math.min(Math.max(p, 0), Math.max(pages.value.length - 1, 0)) }

function syncPagerScroll() {
  const el = pagerRef.value
  if (el) el.scrollLeft = activePage.value * el.clientWidth
}

// ===== Methods =====
function openApp(r) { if (!isEdit.value) router.push(r) }
function enterEdit() { isEdit.value = true }

function onTap(w) {
  if (isEdit.value) {
    editData.value = { id: w.id, type: w.type, size: w.size, config: { ...w.config } }
    showEditor.value = true
  }
}

function startAdd() { editData.value = null; showEditor.value = true }

function removeItem(item) {
  if (item._isApp) return
  widgetsStore.removeWidget(item.id)
  scheduleSave()
}

function onSave(data) {
  if (editData.value?.id) {
    widgetsStore.updateWidget(editData.value.id, { type: data.type, size: data.size, config: data.config })
  } else {
    widgetsStore.addWidget(data.type, data.config)
  }
  scheduleSave()
  showEditor.value = false
}

function dragStart(e, i) { dragIdx = i; e.dataTransfer.effectAllowed = 'move' }
function dragDrop(e, i) {
  if (dragIdx === -1 || dragIdx === i) return
  const src = gridItems.value[dragIdx]
  const dst = gridItems.value[i]
  if (src && dst && !src._isApp && !dst._isApp) {
    widgetsStore.moveWidget(src.id, widgetsStore.widgets.indexOf(dst))
    scheduleSave()
  }
  dragIdx = -1
}

function wIcon(c) { return ({sunny:'ph-fill ph-sun',cloudy:'ph-fill ph-cloud-sun',overcast:'ph-fill ph-cloud',rainy:'ph-fill ph-cloud-rain',snowy:'ph-fill ph-snowflake',windy:'ph-fill ph-wind',foggy:'ph-fill ph-cloud-fog',thunderstorm:'ph-fill ph-cloud-lightning'})[c]||'ph-fill ph-sun' }
function wLabel(c) { return ({sunny:'晴朗',cloudy:'多云',overcast:'阴天',rainy:'小雨',snowy:'下雪',windy:'大风',foggy:'有雾',thunderstorm:'雷阵雨'})[c]||'晴朗' }

function seedDefaultsIfNeeded() {
  if (hasCheckedWidgetSeeding) return
  if (bootstrapStore.isHydrating) return
  hasCheckedWidgetSeeding = true
  if (widgetsStore.widgets.length) return
  const snapshotMeta = getCurrentSnapshotMeta()
  if (Number(snapshotMeta?.localUpdatedAt || 0) > 0) return
  widgetsStore.addWidget('weather', { city:'北京', temp:'23', condition:'sunny', unit:'celsius', slot:'weather' })
  widgetsStore.addWidget('calendar', { showFullMonth:false, highlightToday:true, slot:'calendar' })
  widgetsStore.addWidget('quote', { text:'生活不止眼前的苟且，还有诗和远方。', author:'', slot:'quote' })
  widgetsStore.addWidget('image', { src:'', caption:'memory', rotation:0, tape:true, tapeColor:'#d9d9d9', slot:'image1' })
  widgetsStore.addWidget('image', { src:'', caption:'photo', rotation:0, tape:true, tapeColor:'#d9d9d9', slot:'image2' })
  widgetsStore.addWidget('todo', { title:'TO-DO LIST', items:[], slot:'todo' })
  widgetsStore.addWidget('stats', { statsType:'year_progress' })
  widgetsStore.addWidget('stats', { statsType:'chat_count' })
  scheduleSave()
}

watch(() => bootstrapStore.isHydrating, (isHydrating) => {
  if (!isHydrating) seedDefaultsIfNeeded()
}, { immediate: true })

watch(pages, () => {
  const clamped = clampPage(activePage.value)
  if (clamped !== activePage.value) activePage.value = clamped
  syncPagerScroll()
}, { flush: 'post' })

onMounted(() => {
  now.value = new Date()
  timer = setInterval(() => { now.value = new Date() }, 1000)
  window.addEventListener('resize', syncPagerScroll)
  syncPagerScroll()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('resize', syncPagerScroll)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Caveat:wght@500;700&display=swap');

.desktop-root {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column;
  background-color: #1a1a2e; background-size: cover; background-position: center;
  overflow: hidden; color: #fff; user-select: none;
  touch-action: manipulation;
  font-family: 'Space Grotesk', var(--theme-font, system-ui), sans-serif;
  --g: rgba(255,255,255,0.12);
  --gb: rgba(255,255,255,0.18);
  --gbd: rgba(255,255,255,0.2);
  --gs: 0 8px 32px rgba(31,38,135,0.12);
  --gr: 20px;
  --blur: 20px;
}
.desktop-root.is-dark { --g: rgba(0,0,0,0.22); --gb: rgba(0,0,0,0.3); --gbd: rgba(255,255,255,0.08); }

.desktop-dim {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(circle at 12% 4%, rgba(255,255,255,0.3), transparent 34%),
    linear-gradient(180deg, rgba(10,14,22,0.38) 0%, rgba(10,14,22,0.1) 30%, rgba(10,14,22,0.36) 100%);
}
.is-dark .desktop-dim {
  background: radial-gradient(circle at 12% 4%, rgba(255,255,255,0.14), transparent 30%),
    linear-gradient(180deg, rgba(5,8,14,0.5) 0%, rgba(5,8,14,0.2) 30%, rgba(5,8,14,0.55) 100%);
}

/* ===== Hero (fixed above pager) ===== */
.hero {
  flex-shrink: 0; position: relative; z-index: 2;
  padding: var(--app-pt) 22px 10px; color: #fff;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}
.hero-date { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; }
.hero-greeting { margin: 4px 0 0; font-size: clamp(44px, 14vw, 56px); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; }
.hero-meta { margin-top: 4px; font-family: 'Caveat', cursive; font-size: 19px; opacity: 0.7; }

/* ===== Horizontal pager ===== */
.desktop-pager {
  flex: 1; position: relative; z-index: 1;
  display: flex;
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  overscroll-behavior-y: none;
}

.desktop-page {
  flex: 0 0 100%; min-width: 100%; height: 100%;
  scroll-snap-align: start; scroll-snap-stop: always;
  overflow: hidden;
  padding: 8px 22px 0;
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* ===== Page dots ===== */
.page-dots {
  flex-shrink: 0; position: relative; z-index: 3;
  display: flex; justify-content: center; gap: 8px;
  padding: 10px 0 14px;
}
.page-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: rgba(255,255,255,0.42); border: none; padding: 0;
  cursor: pointer; transition: all 180ms ease;
}
.page-dot.active { width: 18px; background: rgba(255,255,255,0.9); }

/* ===== Grid ===== */
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.grid.editing { gap: 18px; }

.cell { position: relative; }
.editing .cell { animation: jig 0.25s ease-in-out infinite alternate; cursor: grab; }
.editing .cell:nth-child(even) { animation-delay: 0.12s; }
@keyframes jig { 0%{transform:rotate(-0.5deg)} 100%{transform:rotate(0.5deg)} }

/* Sizes */
.sz-app { grid-column: span 1; }
.sz-2x1 { grid-column: span 2; }
.sz-2x2 { grid-column: span 2; }
.sz-4x2 { grid-column: span 4; }

/* ===== Glass base ===== */
.glass {
  background: var(--g); backdrop-filter: blur(var(--blur)); -webkit-backdrop-filter: blur(var(--blur));
  border: 1px solid var(--gbd); border-radius: var(--gr); box-shadow: var(--gs);
  overflow: hidden; position: relative; transition: transform 200ms, box-shadow 200ms;
}
.glass:active { transform: scale(0.96); }

/* ===== App tiles ===== */
.app-tile {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 14px 6px 10px; text-align: center; color: #fff; cursor: pointer;
}
.app-icon-wrap {
  width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 10px rgba(0,0,0,0.12);
}
.app-icon-i { font-size: 26px; color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); }
.app-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.app-name { font-size: 11px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }

/* ===== Widget card ===== */
.widget-card { width: 100%; height: 100%; min-height: 80px; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.12); }

/* ===== Delete btn ===== */
.del-btn {
  position: absolute; top: -6px; left: -6px; z-index: 10;
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255,59,48,0.92); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; border: 2px solid rgba(255,255,255,0.35);
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

/* Add btn */
.add-btn {
  border: 2px dashed rgba(255,255,255,0.25); border-radius: var(--gr);
  background: rgba(255,255,255,0.04);
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; color: rgba(255,255,255,0.4); min-height: 80px;
  animation: none !important; cursor: pointer;
}

/* ===== Widget types ===== */
.w-inner { padding: 14px; height: 100%; display: flex; flex-direction: column; }

/* Weather */
.w-weather { justify-content: space-between; }
.w-weather-row { display: flex; align-items: center; gap: 8px; }
.w-weather-i { font-size: 32px; }
.w-weather-t { font-size: 32px; font-weight: 700; letter-spacing: -2px; }
.w-weather-sub { display: flex; flex-direction: column; gap: 1px; font-size: 13px; }
.w-weather-cond { font-size: 11px; opacity: 0.7; }

/* Calendar */
.w-cal { align-items: center; justify-content: center; text-align: center; }
.w-cal-month { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; background: rgba(255,255,255,0.85); color: #111; padding: 2px 10px; border-radius: 99px; }
.w-cal-day { font-size: 42px; font-weight: 700; line-height: 1; letter-spacing: -2px; margin-top: 4px; }
.w-cal-week { font-size: 12px; opacity: 0.7; margin-top: 2px; }

/* Quote */
.w-quote { justify-content: center; padding: 16px; position: relative; }
.w-quote-deco { position: absolute; top: 12px; right: 12px; font-size: 20px; opacity: 0.25; }
.w-quote-txt { font-size: 14px; line-height: 1.6; margin: 0; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.w-quote-auth { margin-top: 8px; text-align: right; font-size: 12px; opacity: 0.6; font-style: italic; }

/* Image */
.w-img { padding: 10px 10px 32px; position: relative; }
.w-img-tape { position: absolute; top: -8px; left: 50%; width: 50px; height: 18px; transform: translateX(-50%) rotate(-2deg); border-left: 1px dashed rgba(255,255,255,0.2); border-right: 1px dashed rgba(255,255,255,0.2); opacity: 0.8; z-index: 2; }
.w-img-frame { flex: 1; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.06); }
.w-img-pic { width: 100%; height: 100%; object-fit: cover; }
.w-img-ph { width: 100%; height: 100%; min-height: 70px; display: flex; align-items: center; justify-content: center; font-size: 30px; opacity: 0.3; }
.w-img-cap { position: absolute; bottom: 8px; left: 0; width: 100%; text-align: center; font-family: 'Caveat', cursive; font-size: 16px; opacity: 0.7; }

/* Todo */
.w-todo-h { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; margin-bottom: 8px; }
.w-todo-list { display: flex; flex-direction: column; gap: 7px; }
.w-todo-row { display: flex; align-items: center; gap: 7px; font-size: 13px; }
.w-todo-ck { font-size: 14px; opacity: 0.65; flex-shrink: 0; }
.w-todo-done { text-decoration: line-through; opacity: 0.4; }
.w-todo-empty { font-size: 12px; opacity: 0.3; text-align: center; padding: 8px 0; }

/* Clock */
.w-clock { align-items: center; justify-content: center; }
.w-clock-t { font-size: 42px; font-weight: 700; letter-spacing: -2px; line-height: 1; font-variant-numeric: tabular-nums; }
.w-clock-d { font-size: 13px; opacity: 0.7; margin-top: 4px; }

/* Battery */
.w-batt { justify-content: center; gap: 4px; }
.w-batt-row { display: flex; align-items: baseline; gap: 6px; }
.w-batt-row i { font-size: 15px; opacity: 0.85; }
.w-batt-pct { font-size: 24px; font-weight: 700; letter-spacing: -0.04em; }
.w-batt-lbl { font-size: 11px; opacity: 0.65; }
.w-batt-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.2); border-radius: 99px; overflow: hidden; margin-top: 4px; }
.w-batt-fill { height: 100%; background: #fff; border-radius: 99px; box-shadow: 0 0 8px rgba(255,255,255,0.6); transition: width 0.5s; }

/* Music */
.w-music {
  padding: 14px; gap: 10px;
  background: rgba(255,255,255,0.55); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
  border-radius: inherit; color: #000; text-shadow: none;
}
.is-dark .w-music { background: rgba(40,40,40,0.65); color: #fff; }
.w-music-cover { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: rgba(200,220,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; color: rgba(0,0,0,0.25); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
.is-dark .w-music-cover { color: rgba(255,255,255,0.35); }
.w-music-cover img { width: 100%; height: 100%; object-fit: cover; }
.w-music-info { flex: 1; min-width: 0; }
.w-music-title { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-music-sub { font-size: 11px; opacity: 0.6; margin-top: 1px; }
.w-music-bar { position: absolute; bottom: 14px; left: 14px; right: 14px; height: 3px; background: rgba(0,0,0,0.12); border-radius: 99px; overflow: hidden; }
.is-dark .w-music-bar { background: rgba(255,255,255,0.15); }
.w-music-fill { width: 45%; height: 100%; background: #1f2937; border-radius: 99px; }
.is-dark .w-music-fill { background: #fff; }

/* Stats */
.w-stats { align-items: center; justify-content: center; text-align: center; gap: 3px; }
.w-stats-heart { font-size: 20px; color: #ef4444; text-shadow: none; }
.w-stats-big { font-size: 30px; font-weight: 700; line-height: 1; }
.w-stats-lbl { font-size: 11px; opacity: 0.55; letter-spacing: 0.04em; }
.w-stats-ring { position: relative; width: 58px; height: 58px; margin-bottom: 2px; }
.w-stats-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: rgba(255,255,255,0.15); stroke-width: 3; }
.ring-fg { fill: none; stroke: #a78bfa; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.5s; }
.ring-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }

/* Shortcuts */
.w-sc { flex-direction: row; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; padding: 12px; }
.w-sc-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #fff; }
.w-sc-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; color: #111; }
.w-sc-name { font-size: 10px; font-weight: 600; }

/* ===== Edit toggle ===== */
.edit-btn {
  position: absolute; top: calc(var(--app-pt) + 2px); right: 18px; z-index: 12;
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(0,0,0,0.2); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.15); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 300ms;
}
.edit-btn.active { background: #007AFF; border-color: transparent; box-shadow: 0 4px 14px rgba(0,122,255,0.4); }

/* ===== Responsive ===== */
@media (max-width: 360px) {
  .desktop-page { padding-left: 18px; padding-right: 18px; }
  .hero { padding-left: 18px; padding-right: 18px; }
  .hero-greeting { font-size: clamp(38px, 12vw, 48px); }
  .grid { gap: 10px; }
  .app-icon-wrap { width: 48px; height: 48px; }
}
</style>
