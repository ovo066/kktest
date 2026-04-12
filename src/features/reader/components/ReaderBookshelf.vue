<template>
  <Teleport to="body">
    <Transition name="bookshelf">
      <div
        v-if="visible"
        class="fixed inset-0 z-[900] flex flex-col px-2 sm:px-4"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')"></div>

        <!-- Panel -->
        <div class="relative mt-[max(32px,env(safe-area-inset-top,0px))] sm:mt-12 w-full max-w-[680px] mx-auto flex-1 flex flex-col bg-white/80 dark:bg-[#1c1c1e]/85 backdrop-blur-2xl rounded-t-[26px] sm:rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.15)] overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            <h2 class="text-[20px] sm:text-[22px] font-bold text-[var(--text-primary)] tracking-tight">一起读</h2>
            <button
              class="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
              @click="$emit('close')"
            >
              <i class="ph-bold ph-x text-[14px] text-[var(--text-secondary)]"></i>
            </button>
          </div>

          <!-- Continue Reading Card -->
          <div v-if="lastReadBook" class="mx-3 sm:mx-4 mb-3 sm:mb-4">
            <button
              class="w-full flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-[var(--primary-color)]/10 dark:bg-[var(--primary-color)]/15 active:scale-[0.98] transition-transform"
              @click="$emit('open-book', lastReadBook.id)"
            >
              <div class="w-11 h-14 sm:w-12 sm:h-16 rounded-lg bg-[var(--primary-color)]/20 flex items-center justify-center overflow-hidden shrink-0">
                <img v-if="lastReadBook.cover" :src="lastReadBook.cover" class="w-full h-full object-cover">
                <i v-else class="ph-fill ph-book-open text-[22px] sm:text-[24px] text-[var(--primary-color)]"></i>
              </div>
              <div class="flex-1 min-w-0 text-left">
                <div class="text-[13px] sm:text-[14px] font-semibold text-[var(--text-primary)] truncate">{{ lastReadBook.title }}</div>
                <div class="text-[11px] sm:text-[12px] text-[var(--text-secondary)] mt-0.5">已读 {{ Math.round(lastReadBook.progress?.percentage || 0) }}%</div>
                <div class="w-full h-1 rounded-full bg-black/5 dark:bg-white/10 mt-1.5 overflow-hidden">
                  <div class="h-full rounded-full bg-[var(--primary-color)] transition-all" :style="{ width: (lastReadBook.progress?.percentage || 0) + '%' }"></div>
                </div>
              </div>
              <i class="ph-bold ph-arrow-right text-[15px] sm:text-[16px] text-[var(--primary-color)] shrink-0"></i>
            </button>
          </div>

          <!-- Book Grid -->
          <div class="flex-1 overflow-y-auto px-3 sm:px-4 pb-8 no-scrollbar">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <!-- Import Card -->
              <button
                class="flex flex-col items-center gap-1.5 sm:gap-2 aspect-[4/5] sm:aspect-[3/4] rounded-2xl border-2 border-dashed border-[var(--border-color)] active:scale-95 transition-transform active:border-[var(--primary-color)]"
                @click="$emit('import-file')"
              >
                <div class="flex-1 flex items-center justify-center">
                  <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center">
                    <i class="ph ph-plus text-[20px] sm:text-[24px] text-[var(--primary-color)]"></i>
                  </div>
                </div>
                <span class="text-[11px] sm:text-[12px] text-[var(--text-secondary)] font-medium pb-2">导入新书</span>
              </button>

              <!-- Book Cards -->
              <div
                v-for="book in books"
                :key="book.id"
                class="relative group"
                @click="$emit('open-book', book.id)"
                @contextmenu.prevent="showDeleteMenu(book.id)"
              >
                <div class="flex flex-col items-center gap-1.5 aspect-[4/5] sm:aspect-[3/4] rounded-2xl bg-white/60 dark:bg-white/5 shadow-sm active:scale-95 transition-transform overflow-hidden cursor-pointer border border-white/40 dark:border-white/5">
                  <!-- Cover -->
                  <div class="flex-1 w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--primary-color)]/5 to-[var(--primary-color)]/15">
                    <img v-if="book.cover" :src="book.cover" class="w-full h-full object-cover">
                    <i v-else class="ph-fill ph-book-open text-[28px] sm:text-[32px] text-[var(--primary-color)]/40"></i>
                  </div>
                  <!-- Info -->
                  <div class="w-full px-2 pb-2 text-center">
                    <div class="text-[11px] sm:text-[12px] font-medium text-[var(--text-primary)] truncate leading-tight">{{ book.title }}</div>
                    <div v-if="book.author" class="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{{ book.author }}</div>
                  </div>
                </div>

                <!-- Delete overlay -->
                <Transition name="fade">
                  <div
                    v-if="deletingBookId === book.id"
                    class="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center"
                    @click.stop
                  >
                    <button
                      class="px-4 py-2 rounded-full bg-red-500 text-white text-[13px] font-semibold active:scale-90 transition-transform shadow-lg"
                      @click.stop="confirmDelete(book.id)"
                    >
                      删除
                    </button>
                    <button
                      class="ml-2 px-4 py-2 rounded-full bg-white/20 text-white text-[13px] font-medium active:scale-90 transition-transform"
                      @click.stop="deletingBookId = null"
                    >
                      取消
                    </button>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="books.length === 0" class="flex flex-col items-center justify-center pt-12 sm:pt-16 opacity-60">
              <i class="ph ph-books text-[44px] sm:text-[48px] text-[var(--text-secondary)]"></i>
              <p class="text-[13px] sm:text-[14px] text-[var(--text-secondary)] mt-3">还没有导入书籍</p>
              <p class="text-[12px] text-[var(--text-secondary)] mt-1">支持 TXT、EPUB 格式</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  books: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'import-file', 'open-book', 'delete-book'])

const deletingBookId = ref(null)

const lastReadBook = computed(() => {
  if (props.books.length === 0) return null
  const sorted = [...props.books].sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
  return sorted[0]?.progress?.percentage > 0 ? sorted[0] : null
})

function showDeleteMenu(bookId) {
  deletingBookId.value = bookId
}

function confirmDelete(bookId) {
  emit('delete-book', bookId)
  deletingBookId.value = null
}
</script>

<style scoped>
.bookshelf-enter-active,
.bookshelf-leave-active {
  transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.bookshelf-enter-from,
.bookshelf-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
