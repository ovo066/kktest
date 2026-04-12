<template>
  <Teleport to="body">
    <Transition name="notes-panel">
      <div v-if="visible" class="fixed inset-0 z-[960]" @click.self="$emit('close')">
        <div class="absolute inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl bg-white/98 dark:bg-[#1c1c1e]/98 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.12)] border-t border-black/5 dark:border-white/8 flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-black/5 dark:border-white/5">
            <h2 class="text-[15px] font-semibold text-[var(--text-primary)]">读书笔记</h2>
            <div class="flex items-center gap-2">
              <button
                v-if="notes.length"
                class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--primary-color)]/10 active:bg-[var(--primary-color)]/20 transition-colors"
                @click="handleExport"
              >
                <i class="ph ph-export text-[13px] text-[var(--primary-color)]"></i>
                <span class="text-[11px] font-medium text-[var(--primary-color)]">导出</span>
              </button>
              <button
                class="w-8 h-8 flex items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10 transition-colors"
                @click="$emit('close')"
              >
                <i class="ph ph-x text-[18px] text-[var(--text-secondary)]"></i>
              </button>
            </div>
          </div>

          <!-- Notes list -->
          <div class="flex-1 overflow-y-auto overscroll-contain">
            <div v-if="!notes.length" class="flex flex-col items-center justify-center py-16 opacity-50">
              <i class="ph ph-note-blank text-[40px] text-[var(--text-secondary)] mb-3"></i>
              <span class="text-[13px] text-[var(--text-secondary)]">还没有笔记</span>
              <span class="text-[11px] text-[var(--text-secondary)] mt-1">选中文字后使用快捷操作保存笔记</span>
            </div>

            <div v-else class="px-4 py-3 space-y-4">
              <template v-for="group in groupedNotes" :key="group.chapterIndex">
                <div>
                  <div class="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                    {{ group.chapterTitle }}
                  </div>
                  <div class="space-y-2.5">
                    <div
                      v-for="note in group.notes"
                      :key="note.id"
                      class="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 group"
                    >
                      <!-- Selected text quote -->
                      <div v-if="note.selectedText" class="text-[11px] text-[var(--text-secondary)] italic border-l-2 border-[var(--primary-color)]/30 pl-2 mb-2 line-clamp-3">
                        {{ note.selectedText }}
                      </div>
                      <!-- Note content -->
                      <div class="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                        {{ note.note }}
                      </div>
                      <!-- Footer -->
                      <div class="flex items-center justify-between mt-2">
                        <span class="text-[10px] text-[var(--text-secondary)]/60">{{ formatTime(note.createdAt) }}</span>
                        <button
                          class="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full active:bg-red-500/10 transition-all"
                          @click="$emit('delete-note', note.id)"
                        >
                          <i class="ph ph-trash text-[13px] text-red-400"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  notes: { type: Array, default: () => [] },
  chapterTitles: { type: Array, default: () => [] }
})

defineEmits(['close', 'delete-note', 'export'])

const groupedNotes = computed(() => {
  const map = {}
  for (const note of props.notes) {
    const ci = note.chapterIndex ?? 0
    if (!map[ci]) {
      map[ci] = {
        chapterIndex: ci,
        chapterTitle: props.chapterTitles[ci] || `第 ${ci + 1} 章`,
        notes: []
      }
    }
    map[ci].notes.push(note)
  }
  return Object.values(map).sort((a, b) => a.chapterIndex - b.chapterIndex)
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${h}:${m}`
}

function handleExport() {
  const lines = []
  for (const group of groupedNotes.value) {
    lines.push(`## ${group.chapterTitle}`)
    lines.push('')
    for (const note of group.notes) {
      if (note.selectedText) {
        lines.push(`> ${note.selectedText}`)
        lines.push('')
      }
      lines.push(note.note)
      lines.push('')
      lines.push(`_${formatTime(note.createdAt)}_`)
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }
  const md = lines.join('\n')
  navigator.clipboard.writeText(md).catch(() => {})
}
</script>

<style scoped>
.notes-panel-enter-active {
  transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.notes-panel-leave-active {
  transition: all 0.25s ease;
}
.notes-panel-enter-from {
  transform: translateY(100%);
}
.notes-panel-leave-to {
  transform: translateY(100%);
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
