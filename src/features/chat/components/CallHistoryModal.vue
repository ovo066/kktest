<template>
  <Teleport to="body">
    <Transition name="ins-call-history-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[1250] flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <div class="ins-call-history-backdrop absolute inset-0" @click="closeModal"></div>

        <section
          class="ins-call-history-panel relative w-full max-w-[460px] max-h-[88vh] sm:max-h-[82vh] overflow-hidden rounded-t-[34px] sm:rounded-[34px]"
          role="dialog"
          aria-modal="true"
          aria-label="通话历史"
        >
          <header class="ins-call-history-header px-6 pt-6 pb-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="ins-kicker">call moments</p>
                <h3 class="ins-title">通话历史</h3>
                <p class="ins-subtitle truncate">{{ contactName || '当前会话' }}</p>
              </div>
              <button class="ins-close" @click="closeModal" aria-label="关闭">
                <i class="ph-bold ph-x text-[15px]"></i>
              </button>
            </div>
          </header>

          <div class="ins-call-history-list no-scrollbar">
            <div
              v-if="sortedRecords.length === 0"
              class="px-6 pb-8 pt-2 flex flex-col items-center text-center"
            >
              <div class="ins-empty-icon"><i class="ph-bold ph-phone-x text-[20px]"></i></div>
              <p class="mt-3 text-[13px] text-[var(--text-secondary)]">还没有通话记录</p>
            </div>

            <article
              v-for="(record, idx) in sortedRecords"
              :key="record.id || `${record.time || 0}-${idx}`"
              class="ins-record"
            >
              <button class="ins-record-head" @click="toggleExpand(record)">
                <div class="ins-record-main">
                  <div class="ins-record-icon" :class="record.mode === 'video' ? 'is-video' : 'is-voice'">
                    <i :class="record.mode === 'video' ? 'ph-fill ph-video-camera' : 'ph-fill ph-phone'"></i>
                  </div>

                  <div class="min-w-0 flex-1 text-left">
                    <div class="ins-record-title">
                      {{ record.mode === 'video' ? '视频通话' : '语音通话' }}
                    </div>
                    <div class="ins-record-time">{{ formatTime(record.time) }}</div>
                  </div>
                </div>

                <div class="ins-record-side">
                  <span class="ins-status" :class="statusClass(recordStatus(record))">
                    {{ statusText(recordStatus(record)) }}
                  </span>
                  <span class="ins-duration">{{ formatDuration(record.duration || 0) }}</span>
                  <i
                    v-if="record.transcript?.length"
                    class="ph ph-caret-down ins-caret"
                    :class="isExpanded(record) ? 'rotate-180' : ''"
                  ></i>
                </div>
              </button>

              <Transition name="ins-transcript-drop">
                <div v-if="isExpanded(record) && record.transcript?.length" class="ins-transcript-wrap">
                  <div
                    v-for="(line, lineIndex) in record.transcript"
                    :key="lineIndex"
                    class="ins-transcript-line"
                    :class="line.role === 'user' ? 'is-user' : 'is-ai'"
                  >
                    <div class="ins-transcript-meta">
                      <span class="ins-role">{{ line.role === 'user' ? '我' : '对方' }}</span>
                      <button
                        v-if="line.role === 'assistant'"
                        class="ins-voice-btn"
                        @click.stop="playVoice(lineText(line), record.id || record.time, lineIndex)"
                      >
                        <i
                          :class="ttsPlaying === `${record.id || record.time}-${lineIndex}` ? 'ph-fill ph-stop-circle' : 'ph ph-speaker-high'"
                          class="text-[14px]"
                        ></i>
                      </button>
                    </div>
                    <p class="ins-transcript-text">{{ lineText(line) }}</p>
                  </div>
                </div>
              </Transition>
            </article>
          </div>

          <div class="h-6 sm:h-4"></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import { useVoicePlayback } from '../../../composables/useVoicePlayback'
import { splitForCallTranscriptPlayback } from '../../../utils/ttsSegmentation'
import { formatBeijingLocale } from '../../../utils/beijingTime'

const props = defineProps({
  visible: { type: Boolean, default: false },
  contactName: { type: String, default: '' },
  records: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

const settingsStore = useSettingsStore()
const voicePlayer = useVoicePlayback()
const expandedId = ref(null)
const ttsPlaying = ref(null)
let playToken = 0

const sortedRecords = computed(() => {
  const list = Array.isArray(props.records) ? props.records.slice() : []
  return list.sort((a, b) => Number(b?.time || 0) - Number(a?.time || 0))
})

function recordStatus(record) {
  const raw = String(record?.status || '').toLowerCase()
  if (raw === 'completed' || raw === 'missed' || raw === 'cancelled') return raw
  return Number(record?.duration || 0) > 0 ? 'completed' : 'missed'
}

function statusText(status) {
  if (status === 'completed') return '已接通'
  if (status === 'cancelled') return '已取消'
  return '未接通'
}

function statusClass(status) {
  if (status === 'completed') return 'is-success'
  if (status === 'cancelled') return 'is-warn'
  return 'is-danger'
}

function formatDuration(seconds) {
  const n = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(n / 60)
  const s = Math.floor(n % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(ts) {
  if (!ts) return '--'
  try {
    return formatBeijingLocale(new Date(ts), {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '--'
  }
}

function lineText(line) {
  return String(line?.text || line?.content || '').trim()
}

function toggleExpand(record) {
  if (!record?.transcript?.length) return
  const id = record.id || record.time
  if (expandedId.value === id) {
    expandedId.value = null
    stopVoice()
    return
  }
  expandedId.value = id
}

function isExpanded(record) {
  return expandedId.value === (record.id || record.time)
}

async function playVoice(text, recordId, lineIdx) {
  const cleanText = String(text || '').trim()
  if (!cleanText) return

  const playId = `${recordId}-${lineIdx}`
  if (ttsPlaying.value === playId) {
    stopVoice()
    return
  }

  voicePlayer.stop()
  playToken += 1
  const currentToken = playToken
  ttsPlaying.value = playId
  const parts = splitForCallTranscriptPlayback(cleanText, settingsStore.voiceTtsMode)
  const queue = parts.length > 0 ? parts : [cleanText]

  try {
    for (let i = 0; i < queue.length; i++) {
      if (playToken !== currentToken) break
      const segment = queue[i]
      await new Promise((resolve, reject) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          resolve()
        }
        voicePlayer.play({
          msgId: `${recordId}-${lineIdx}-${i}`,
          isUser: false,
          text: segment,
          emotion: 'normal',
          stableTimbre: true,
          durationSec: Math.max(1, Math.round(segment.length / 4)),
          onEnded: finish
        }).catch((error) => {
          if (settled) return
          settled = true
          reject(error)
        })
      })
    }
  } catch {
    // Ignore playback errors and reset UI state below.
  } finally {
    if (playToken === currentToken) {
      ttsPlaying.value = null
    }
  }
}

function stopVoice() {
  playToken += 1
  voicePlayer.stop()
  ttsPlaying.value = null
}

function closeModal() {
  expandedId.value = null
  stopVoice()
  emit('close')
}

watch(() => props.visible, (visible) => {
  if (visible) return
  expandedId.value = null
  stopVoice()
})

onBeforeUnmount(() => {
  stopVoice()
})
</script>

<style scoped>
.ins-call-history-backdrop {
  background:
    radial-gradient(65% 45% at 30% 20%, rgba(255, 170, 200, 0.25), transparent 70%),
    radial-gradient(55% 40% at 80% 80%, rgba(255, 204, 170, 0.22), transparent 72%),
    rgba(9, 10, 16, 0.35);
  backdrop-filter: blur(6px) saturate(125%);
  -webkit-backdrop-filter: blur(6px) saturate(125%);
}

.ins-call-history-panel {
  border: 1px solid rgba(255, 255, 255, 0.55);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.8), rgba(255, 246, 250, 0.62)),
    radial-gradient(130% 100% at 90% -15%, rgba(255, 161, 196, 0.22), transparent 60%),
    radial-gradient(120% 90% at 5% 120%, rgba(255, 191, 145, 0.2), transparent 60%);
  box-shadow: 0 26px 60px rgba(20, 12, 20, 0.28);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
}

:global(.dark) .ins-call-history-panel {
  border-color: rgba(255, 255, 255, 0.16);
  background:
    linear-gradient(145deg, rgba(25, 23, 32, 0.9), rgba(32, 28, 40, 0.76)),
    radial-gradient(120% 85% at 90% -20%, rgba(255, 110, 173, 0.19), transparent 58%),
    radial-gradient(130% 90% at 5% 125%, rgba(255, 170, 110, 0.16), transparent 64%);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.ins-call-history-header {
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
}

:global(.dark) .ins-call-history-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.ins-kicker {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(96, 103, 126, 0.68);
  margin: 0;
}

.ins-title {
  margin: 3px 0 0;
  font-size: 21px;
  line-height: 1.1;
  font-weight: 700;
  color: var(--text-primary, #171923);
}

.ins-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #7f8698);
}

.ins-close {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #7f8698);
  background: rgba(17, 24, 39, 0.05);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.ins-close:active {
  transform: scale(0.92);
}

:global(.dark) .ins-close {
  background: rgba(255, 255, 255, 0.1);
}

.ins-call-history-list {
  max-height: calc(82vh - 120px);
  overflow-y: auto;
  padding: 8px 16px 6px;
}

.ins-record {
  margin-bottom: 10px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.58);
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.ins-record:last-child {
  margin-bottom: 0;
}

:global(.dark) .ins-record {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.ins-record-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
}

.ins-record-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.ins-record-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.ins-record-icon.is-video {
  color: #d63384;
  background: linear-gradient(135deg, rgba(214, 51, 132, 0.14), rgba(255, 128, 175, 0.2));
}

.ins-record-icon.is-voice {
  color: #fb6f43;
  background: linear-gradient(135deg, rgba(251, 111, 67, 0.14), rgba(255, 176, 126, 0.22));
}

.ins-record-title {
  font-size: 14px;
  line-height: 1.25;
  font-weight: 650;
  color: var(--text-primary, #171923);
}

.ins-record-time {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary, #7f8698);
}

.ins-record-side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ins-status {
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.06);
  color: var(--text-secondary, #7f8698);
}

.ins-status.is-success {
  background: rgba(30, 170, 130, 0.14);
  color: #178f6e;
}

.ins-status.is-warn {
  background: rgba(255, 170, 40, 0.17);
  color: #c87800;
}

.ins-status.is-danger {
  background: rgba(255, 94, 111, 0.16);
  color: #d74057;
}

.ins-duration {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #7f8698);
  font-variant-numeric: tabular-nums;
}

.ins-caret {
  color: var(--text-secondary, #7f8698);
  font-size: 12px;
  opacity: 0.72;
  transition: transform 0.2s ease;
}

.ins-transcript-wrap {
  border-top: 1px solid rgba(17, 24, 39, 0.06);
  padding: 9px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

:global(.dark) .ins-transcript-wrap {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.ins-transcript-line {
  padding: 6px 8px;
  border-radius: 12px;
}

.ins-transcript-line.is-user {
  background: rgba(17, 24, 39, 0.03);
}

.ins-transcript-line.is-ai {
  background: rgba(214, 51, 132, 0.06);
}

:global(.dark) .ins-transcript-line.is-user {
  background: rgba(255, 255, 255, 0.05);
}

:global(.dark) .ins-transcript-line.is-ai {
  background: rgba(255, 114, 179, 0.12);
}

.ins-transcript-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ins-role {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary, #7f8698);
  font-weight: 650;
}

.ins-voice-btn {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d63384;
  background: rgba(214, 51, 132, 0.12);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.ins-voice-btn:active {
  transform: scale(0.88);
  background: rgba(214, 51, 132, 0.2);
}

.ins-transcript-text {
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-primary, #171923);
  word-break: break-word;
}

.ins-empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #7f8698);
  background: rgba(17, 24, 39, 0.06);
}

:global(.dark) .ins-empty-icon {
  background: rgba(255, 255, 255, 0.1);
}

.ins-call-history-fade-enter-active,
.ins-call-history-fade-leave-active {
  transition: opacity 0.26s ease;
}

.ins-call-history-fade-enter-from,
.ins-call-history-fade-leave-to {
  opacity: 0;
}

.ins-call-history-fade-enter-active .ins-call-history-panel,
.ins-call-history-fade-leave-active .ins-call-history-panel {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}

.ins-call-history-fade-enter-from .ins-call-history-panel,
.ins-call-history-fade-leave-to .ins-call-history-panel {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

@media (max-width: 639px) {
  .ins-call-history-fade-enter-from .ins-call-history-panel,
  .ins-call-history-fade-leave-to .ins-call-history-panel {
    transform: translateY(40px);
  }
}

.ins-transcript-drop-enter-active,
.ins-transcript-drop-leave-active {
  transition: all 0.24s ease;
}

.ins-transcript-drop-enter-from,
.ins-transcript-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
