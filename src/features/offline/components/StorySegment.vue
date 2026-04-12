<template>
  <div class="msg-row" :class="[segment.role, `layout-${resolvedLayoutMode}`, `avatar-${resolvedAvatarMode}`]">
    <template v-if="segment.role === 'user' || segment.role === 'assistant'">
      <div class="msg-layout" :class="isUser ? 'user-layout' : 'char-layout'">
        <div v-if="showSideAvatar" class="avatar-circle">
          <img v-if="showSenderImage" :src="senderAvatar" class="avatar-img" />
          <span v-else class="avatar-fallback">{{ senderAvatarText }}</span>
        </div>

        <div class="msg-body">
        <div v-if="showHeader" class="msg-header" :class="isUser ? 'user-header' : 'char-header'">
          <div class="msg-header-left">
            <div v-if="showTopAvatar" class="avatar-circle avatar-top">
              <img v-if="showSenderImage" :src="senderAvatar" class="avatar-img" />
                <span v-else class="avatar-fallback">{{ senderAvatarText }}</span>
              </div>
              <span class="sender-name">{{ senderName }}</span>
            </div>
            <span v-if="showFloorTag" class="floor-tag">#{{ floorNumber }}</span>
          </div>

          <div
            v-if="!isHtmlDocument"
            class="bubble action-toggle"
            :class="[isUser ? 'user-bubble' : 'char-bubble', { editing: isEditing }]"
            v-html="segment.html"
            @click="toggleActions"
          ></div>
          <div
            v-else
            class="bubble action-toggle html-document-bubble"
            :class="[isUser ? 'user-bubble' : 'char-bubble', { editing: isEditing }]"
            @click="toggleActions"
          >
            <OfflineHtmlDocument :html="segment.htmlDocument" />
          </div>

          <span v-if="segment.isStreaming" class="streaming-cursor"></span>

          <div v-if="statsText && !segment.isStreaming" class="msg-stats">{{ statsText }}</div>
          <div v-if="truncatedNotice && !segment.isStreaming" class="msg-warning">{{ truncatedNotice }}</div>

          <div v-if="actionsOpen && !segment.isStreaming" class="msg-actions" :class="isUser ? 'user-actions' : 'char-actions'">
            <template v-if="isUser">
              <span class="act-btn" @click.stop="$emit('edit', segment)"><i class="ph ph-pencil-simple"></i> 编辑</span>
              <span class="act-btn act-danger" @click.stop="$emit('delete', segment)"><i class="ph ph-trash"></i> 删除</span>
            </template>
            <template v-else>
              <span v-if="isLast" class="act-btn" @click.stop="$emit('reroll', segment)"><i class="ph ph-arrow-counter-clockwise"></i> 重Roll</span>
              <span class="act-btn" @click.stop="$emit('edit', segment)"><i class="ph ph-pencil-simple"></i> 编辑</span>
              <span class="act-btn" @click.stop="$emit('copy', segment)"><i class="ph ph-copy"></i> 复制</span>
              <span class="act-btn act-danger" @click.stop="$emit('delete', segment)"><i class="ph ph-trash"></i> 删除</span>
            </template>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="system-seg">
      <div v-if="!isHtmlDocument" class="system-text" v-html="segment.html"></div>
      <div v-else class="system-text system-html-text">
        <OfflineHtmlDocument :html="segment.htmlDocument" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import OfflineHtmlDocument from './OfflineHtmlDocument.vue'

const props = defineProps({
  segment: { type: Object, required: true },
  layoutMode: { type: String, default: 'classic' },
  avatarMode: { type: String, default: 'side' },
  floorNumber: { type: Number, default: 0 },
  userName: { type: String, default: '你' },
  userAvatar: { type: String, default: '' },
  userAvatarType: { type: String, default: 'emoji' },
  charName: { type: String, default: '' },
  charAvatar: { type: String, default: '' },
  charAvatarType: { type: String, default: 'emoji' },
  isLast: { type: Boolean, default: false },
  isEditing: { type: Boolean, default: false }
})

defineEmits(['reroll', 'edit', 'delete', 'copy', 'context-menu'])

const isUser = computed(() => props.segment?.role === 'user')
const resolvedLayoutMode = computed(() => {
  const val = String(props.layoutMode || 'classic')
  return ['classic', 'st', 'floor'].includes(val) ? val : 'classic'
})
const resolvedAvatarMode = computed(() => {
  const val = String(props.avatarMode || 'side')
  return ['side', 'top', 'hidden'].includes(val) ? val : 'side'
})

const senderName = computed(() => {
  if (isUser.value) return props.userName || '你'
  return props.charName || 'AI'
})
const senderAvatar = computed(() => (isUser.value ? props.userAvatar : props.charAvatar) || '')
const senderAvatarType = computed(() => (isUser.value ? props.userAvatarType : props.charAvatarType) || 'emoji')
const showSenderImage = computed(() => senderAvatarType.value === 'image' && !!String(senderAvatar.value || '').trim())
const senderAvatarText = computed(() => {
  const avatar = String(senderAvatar.value || '').trim()
  if (avatar && senderAvatarType.value !== 'image') return avatar
  return String(senderName.value || '?')[0] || '?'
})
const isHtmlDocument = computed(() => props.segment?.renderMode === 'html-document' && !!props.segment?.htmlDocument)

const showSideAvatar = computed(() => (
  resolvedAvatarMode.value === 'side' &&
  resolvedLayoutMode.value !== 'floor' &&
  resolvedAvatarMode.value !== 'hidden'
))
const showTopAvatar = computed(() => (
  resolvedAvatarMode.value !== 'hidden' &&
  (resolvedAvatarMode.value === 'top' || resolvedLayoutMode.value === 'floor')
))
const showHeader = computed(() => (
  resolvedLayoutMode.value === 'st' ||
  resolvedLayoutMode.value === 'floor' ||
  resolvedAvatarMode.value === 'top'
))
const showFloorTag = computed(() => resolvedLayoutMode.value === 'floor' && Number(props.floorNumber) > 0)

const actionsOpen = ref(false)

const statsText = computed(() => {
  const stats = props.segment?.stats
  if (!stats || isUser.value) return ''
  const parts = []
  if (stats.totalTokens != null) {
    parts.push(`${stats.totalTokens} tokens`)
  } else if (stats.completionTokens != null) {
    parts.push(`${stats.completionTokens} tokens`)
  }
  if (stats.promptTokens != null && stats.completionTokens != null) {
    parts[0] = `${stats.promptTokens} / ${stats.completionTokens} tokens`
  }
  if (stats.duration != null) {
    const sec = (stats.duration / 1000).toFixed(1)
    parts.push(`${sec}s`)
  }
  if (stats.completionTokens != null && stats.duration > 0) {
    const tps = (stats.completionTokens / (stats.duration / 1000)).toFixed(1)
    parts.push(`${tps} t/s`)
  }
  return parts.join('  ·  ')
})

const truncatedNotice = computed(() => {
  if (isUser.value) return ''
  const isTruncated =
    props.segment?.truncated === true ||
    props.segment?.stats?.truncated === true ||
    props.segment?.stats?.finishReason === 'length'
  return isTruncated ? '回复达到输出上限，已截断' : ''
})

function toggleActions() {
  if (props.segment?.isStreaming) return
  actionsOpen.value = !actionsOpen.value
}

watch(() => props.segment?.id, () => {
  actionsOpen.value = false
})
</script>

<style scoped>
.msg-row {
  padding: 8px 16px;
}

.msg-layout {
  display: flex;
  gap: 10px;
  max-width: 90%;
}

.user-layout {
  margin-left: auto;
  flex-direction: row-reverse;
}

.char-layout {
  margin-right: auto;
}

.avatar-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: var(--off-border-w) solid var(--off-border);
  box-shadow: var(--off-shadow-sm);
  background: var(--off-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: var(--off-text);
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-top {
  width: 24px;
  height: 24px;
  font-size: 11px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  line-height: 1;
}

.msg-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.msg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  padding: 0 2px;
}

.msg-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.user-header {
  justify-content: flex-end;
}

.user-header .msg-header-left {
  justify-content: flex-end;
}

.sender-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--off-text-sec);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floor-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 34px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--off-border);
  color: var(--off-text-sec);
  font-size: 11px;
  font-weight: 700;
  background: #fff;
  flex-shrink: 0;
}

.bubble {
  padding: 10px 14px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: var(--off-radius);
  font-size: 15px;
  line-height: 1.6;
  box-shadow: var(--off-shadow-sm);
  word-break: break-word;
  white-space: pre-wrap;
}

.html-document-bubble {
  padding: 0;
  white-space: normal;
  overflow: hidden;
}

.action-toggle {
  cursor: pointer;
}

.user-bubble {
  background: var(--off-user-bg);
  color: var(--off-user-text);
  border-top-right-radius: 3px;
}

.char-bubble {
  background: var(--off-char-bg);
  color: var(--off-char-text);
  border-top-left-radius: 3px;
}

.bubble.editing {
  outline: 3px dashed #f1c40f;
  background: #fff !important;
  color: #000 !important;
}

.streaming-cursor {
  display: inline-block;
  width: 6px;
  height: 16px;
  background: var(--off-accent);
  border-radius: 2px;
  margin-left: 4px;
  margin-top: 4px;
  animation: blink 0.8s infinite;
}

.msg-stats {
  font-size: 11px;
  color: var(--off-text-sec);
  opacity: 0.7;
  margin-top: 4px;
  padding: 0 2px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  user-select: none;
}

.msg-warning {
  font-size: 11px;
  color: var(--off-danger, #d32f2f);
  margin-top: 4px;
  padding: 0 2px;
  font-weight: 700;
  user-select: none;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.msg-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.user-actions {
  justify-content: flex-end;
}

.act-btn {
  font-size: 11px;
  font-weight: 600;
  color: var(--off-text-sec);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
  user-select: none;
}
.act-btn:active {
  color: var(--off-text);
}
.act-btn.act-danger:active {
  color: var(--off-danger);
}

/* SillyTavern-like layout */
.msg-row.layout-st .msg-layout {
  width: 100%;
  max-width: 100%;
  margin: 0;
  flex-direction: row;
}

.msg-row.layout-st .msg-body {
  width: 100%;
}

.msg-row.layout-st .bubble {
  background: #fff;
  color: var(--off-text);
  box-shadow: none;
  border-radius: 12px;
}

.msg-row.user.layout-st .bubble {
  border-left: 4px solid var(--off-accent);
}

.msg-row.assistant.layout-st .bubble {
  border-left: 4px solid rgba(17, 17, 17, 0.35);
}

.msg-row.layout-st .user-actions {
  justify-content: flex-start;
}

/* Floor card layout */
.msg-row.layout-floor .msg-layout {
  width: 100%;
  max-width: 100%;
  margin: 0;
  flex-direction: row;
}

.msg-row.layout-floor .msg-body {
  width: min(92%, 720px);
  max-width: 100%;
  margin: 0 auto;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: var(--off-radius);
  background: #fff;
  box-shadow: var(--off-shadow-sm);
  padding: 10px 12px;
}

.msg-row.layout-floor .msg-header {
  margin-bottom: 8px;
  padding: 0;
  width: 100%;
  justify-content: center;
  position: relative;
}

.msg-row.layout-floor .msg-header-left {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.msg-row.layout-floor .avatar-top {
  width: 36px;
  height: 36px;
  font-size: 14px;
}

.msg-row.layout-floor .sender-name {
  max-width: 100%;
  text-align: center;
}

.msg-row.layout-floor .floor-tag {
  position: absolute;
  right: 0;
  top: 0;
}

.msg-row.layout-floor .bubble {
  background: transparent;
  color: var(--off-text);
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  width: 100%;
  display: block;
}

.msg-row.layout-floor .msg-actions {
  margin-top: 8px;
  justify-content: center;
}

.msg-row.layout-floor .user-actions {
  justify-content: center;
}

.msg-row.layout-floor .streaming-cursor {
  margin-left: 0;
}

.msg-row.user.layout-floor .msg-body {
  border-color: rgba(17, 17, 17, 0.45);
}

.msg-row.assistant.layout-floor .msg-body {
  border-color: rgba(17, 17, 17, 0.25);
}

/* Top avatar mode: "one floor" style with centered avatar above content. */
.msg-row.avatar-top .msg-layout {
  width: 100%;
  max-width: 100%;
  margin: 0;
  flex-direction: row;
}

.msg-row.avatar-top .msg-body {
  width: min(92%, 720px);
  max-width: 100%;
  margin: 0 auto;
}

.msg-row.avatar-top .msg-header {
  width: 100%;
  justify-content: center;
  margin-bottom: 8px;
}

.msg-row.avatar-top .msg-header-left {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.msg-row.avatar-top .user-header,
.msg-row.avatar-top .user-header .msg-header-left {
  justify-content: center;
}

.msg-row.avatar-top .avatar-top {
  width: 36px;
  height: 36px;
  font-size: 14px;
}

.msg-row.avatar-top .sender-name {
  max-width: 100%;
  text-align: center;
}

.msg-row.avatar-top .bubble {
  width: 100%;
  display: block;
}

.msg-row.avatar-top .msg-actions,
.msg-row.avatar-top .user-actions {
  justify-content: center;
}

.system-seg {
  text-align: center;
  padding: 8px 0;
}

.system-text {
  font-size: 13px;
  color: var(--off-text-sec);
  font-style: italic;
  opacity: 0.7;
}

.system-html-text {
  font-style: normal;
  opacity: 1;
  max-width: min(92%, 720px);
  margin: 0 auto;
  text-align: left;
}

/* Rich text support */
.bubble :deep(em) {
  color: var(--off-text-sec);
  font-style: italic;
}
.bubble :deep(strong) {
  font-weight: 700;
}
.bubble :deep(h1),
.bubble :deep(h2),
.bubble :deep(h3),
.bubble :deep(h4),
.bubble :deep(h5),
.bubble :deep(h6) {
  margin: 0.65em 0 0.35em;
  line-height: 1.35;
  font-weight: 800;
}
.bubble :deep(p),
.bubble :deep(div) {
  margin: 0.45em 0;
}
.bubble :deep(h1) { font-size: 1.5em; }
.bubble :deep(h2) { font-size: 1.35em; }
.bubble :deep(h3) { font-size: 1.2em; }
.bubble :deep(h4) { font-size: 1.08em; }
.bubble :deep(h5) { font-size: 1em; }
.bubble :deep(h6) {
  font-size: 0.92em;
  opacity: 0.85;
}
.bubble :deep(hr) {
  border: none;
  border-top: 1px solid var(--off-border);
  margin: 0.8em 0;
}
.bubble :deep(ul),
.bubble :deep(ol) {
  margin: 0.45em 0;
  padding-left: 1.25em;
}
.bubble :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.55em 0;
}
.bubble :deep(th),
.bubble :deep(td) {
  border: 1px solid var(--off-border);
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
.bubble :deep(li) {
  margin: 0.2em 0;
}
.bubble :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.35em 0.75em;
  border-left: 3px solid var(--off-border);
  background: rgba(127, 127, 127, 0.08);
  border-radius: 6px;
}
.bubble :deep(pre) {
  margin: 0.55em 0;
  padding: 10px 12px;
  border: 1px solid var(--off-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.08);
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble :deep(p:first-child),
.bubble :deep(div:first-child),
.bubble :deep(h1:first-child),
.bubble :deep(h2:first-child),
.bubble :deep(h3:first-child),
.bubble :deep(h4:first-child),
.bubble :deep(h5:first-child),
.bubble :deep(h6:first-child),
.bubble :deep(ul:first-child),
.bubble :deep(ol:first-child),
.bubble :deep(blockquote:first-child),
.bubble :deep(pre:first-child),
.bubble :deep(hr:first-child) {
  margin-top: 0;
}
.bubble :deep(p:last-child),
.bubble :deep(div:last-child),
.bubble :deep(h1:last-child),
.bubble :deep(h2:last-child),
.bubble :deep(h3:last-child),
.bubble :deep(h4:last-child),
.bubble :deep(h5:last-child),
.bubble :deep(h6:last-child),
.bubble :deep(ul:last-child),
.bubble :deep(ol:last-child),
.bubble :deep(blockquote:last-child),
.bubble :deep(pre:last-child),
.bubble :deep(hr:last-child) {
  margin-bottom: 0;
}
.bubble :deep(.off-speaker-label) {
  color: var(--off-speaker-color, var(--off-accent));
  background: var(--off-speaker-bg, rgba(17, 17, 17, 0.08));
  border: 1px solid var(--off-speaker-border, rgba(17, 17, 17, 0.2));
  border-radius: 999px;
  display: inline-block;
  padding: 0 8px;
  margin-right: 4px;
  font-size: 0.9em;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.bubble :deep(.off-action-text) {
  color: var(--off-action-color, var(--off-text-sec));
  background: var(--off-action-bg, rgba(17, 17, 17, 0.06));
  border: 1px dashed var(--off-action-border, rgba(17, 17, 17, 0.2));
  border-radius: 8px;
  padding: 0 5px;
  text-shadow: var(--off-action-shadow, none);
}
.char-bubble :deep(em) {
  color: var(--off-text-sec);
}
.user-bubble :deep(em) {
  color: rgba(255,255,255,0.7);
}
.user-bubble :deep(.off-speaker-label) {
  color: var(--off-user-speaker-color, var(--off-user-text));
  background: var(--off-user-speaker-bg, rgba(255, 255, 255, 0.14));
  border-color: var(--off-user-speaker-border, rgba(255, 255, 255, 0.24));
}
.user-bubble :deep(.off-action-text) {
  color: var(--off-user-action-color, rgba(255, 255, 255, 0.92));
  background: var(--off-user-action-bg, rgba(255, 255, 255, 0.12));
  border-color: var(--off-user-action-border, rgba(255, 255, 255, 0.26));
}
/* Dialogue / quoted speech — SillyTavern-like */
.bubble :deep(.off-dialogue) {
  text-decoration: underline;
  text-decoration-style: solid;
  text-decoration-color: var(--off-dialogue-underline, rgba(17, 17, 17, 0.3));
  text-underline-offset: 2px;
  text-decoration-thickness: 1.5px;
  color: var(--off-dialogue-color, rgba(17, 17, 17, 0.65));
}
.user-bubble :deep(.off-dialogue) {
  text-decoration-color: var(--off-user-dialogue-underline, rgba(255, 255, 255, 0.5));
  color: var(--off-user-dialogue-color, rgba(255, 255, 255, 0.78));
}
</style>
