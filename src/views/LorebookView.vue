<template>
  <div class="absolute inset-0 z-20 bg-[#F2F2F7] dark:bg-black flex flex-col">
    <div class="pt-app-lg pb-2 px-4 flex items-end justify-between">
      <button
        v-if="store.lorebook.currentBookId"
        class="text-[#007AFF] text-[17px] flex items-center"
        @click="showBookList"
      >
        <i class="ph ph-caret-left"></i> 返回
      </button>
      <h1 class="text-3xl font-bold text-black dark:text-white">{{ title }}</h1>
      <button class="text-[#007AFF] font-semibold text-[17px]" @click="router.push('/')">完成</button>
    </div>

    <!-- Book List View -->
    <div v-if="!store.lorebook.currentBookId" class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <div class="bg-white dark:bg-[#1c1c1e] rounded-[10px] overflow-hidden">
        <button class="w-full px-4 py-3 text-[#007AFF] flex items-center justify-center gap-2" @click="openBookModal()">
          <i class="ph ph-folder-plus text-xl"></i>
          <span>新建世界书</span>
        </button>
      </div>
      <div class="space-y-2">
        <div v-if="store.lorebook.books.length === 0" class="text-center text-[#8E8E93] py-8">暂无世界书</div>
        <div
          v-for="book in store.lorebook.books"
          :key="book.id"
          class="bg-white dark:bg-[#1c1c1e] rounded-[10px] p-4 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 flex items-center justify-between"
          @click="showEntryList(book.id)"
        >
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="text-3xl flex-shrink-0">{{ book.icon }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-[17px] text-black dark:text-white truncate">{{ book.name }}</div>
              <div v-if="book.description" class="text-[13px] text-[#8E8E93] truncate">{{ book.description }}</div>
              <div class="text-[13px] text-[#8E8E93] mt-1">{{ book.entries?.length || 0 }} 个条目</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="p-2 text-[#007AFF]" @click.stop="openBookModal(book.id)">
              <i class="ph ph-pencil-simple text-xl"></i>
            </button>
            <i class="ph-bold ph-caret-right text-[#C7C7CC]"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- Entry List View -->
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <div class="bg-white dark:bg-[#1c1c1e] rounded-[10px] overflow-hidden">
        <button class="w-full px-4 py-3 text-[#007AFF] flex items-center justify-center gap-2" @click="openEntryModal()">
          <i class="ph ph-plus-circle text-xl"></i>
          <span>新建条目</span>
        </button>
      </div>
      <div class="space-y-2">
        <div v-if="currentBook?.entries?.length === 0" class="text-center text-[#8E8E93] py-8">暂无条目</div>
        <div
          v-for="entry in currentBook?.entries"
          :key="entry.id"
          class="bg-white dark:bg-[#1c1c1e] rounded-[10px] p-4 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
          @click="openEntryModal(entry.id)"
        >
          <div class="flex justify-between items-start mb-2">
            <span class="font-semibold text-[17px] text-black dark:text-white">{{ entry.name }}</span>
            <span class="text-[13px] text-[#8E8E93]">深度: {{ entry.insertDepth }}</span>
          </div>
          <div class="text-[15px] text-[#8E8E93] line-clamp-2 mb-2">{{ entry.content }}</div>
          <div v-if="entry.keywords?.length > 0" class="flex flex-wrap gap-1">
            <span v-for="k in entry.keywords" :key="k" class="text-[11px] bg-[#007AFF]/10 text-[#007AFF] px-2 py-1 rounded">{{ k }}</span>
          </div>
          <div v-if="entry.alwaysActive" class="text-[11px] text-[#34C759] mt-1">✓ 始终激活</div>
        </div>
      </div>
    </div>

    <!-- Book Modal -->
    <IosModal
      :visible="bookModalVisible"
      :title="store.lorebook.editingBookId ? '编辑世界书' : '新建世界书'"
      :show-delete="!!store.lorebook.editingBookId"
      height="50%"
      @close="closeBookModal"
      @done="saveBook"
      @delete="deleteBook"
    >
      <div class="p-4 space-y-4">
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <input v-model="bookForm.name" type="text" placeholder="世界书名称" class="w-full px-4 py-3 text-[17px] outline-none border-b border-[#E5E5EA] dark:border-gray-700 bg-transparent dark:text-white">
          <textarea v-model="bookForm.description" rows="3" placeholder="描述（可选）" class="w-full px-4 py-3 text-[15px] outline-none resize-none bg-transparent dark:text-white"></textarea>
        </div>
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <div class="px-4 py-3 flex justify-between items-center">
            <span class="text-[17px] text-black dark:text-white">图标</span>
            <input v-model="bookForm.icon" type="text" maxlength="2" class="w-12 text-2xl text-center outline-none bg-transparent">
          </div>
        </div>
      </div>
    </IosModal>

    <!-- Entry Modal -->
    <IosModal
      :visible="entryModalVisible"
      :title="store.lorebook.editingEntryId ? '编辑条目' : '新建条目'"
      :show-delete="!!store.lorebook.editingEntryId"
      height="90%"
      @close="closeEntryModal"
      @done="saveEntry"
      @delete="deleteEntry"
    >
      <div class="p-4 space-y-4">
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <input v-model="entryForm.name" type="text" placeholder="条目名称" class="w-full px-4 py-3 text-[17px] outline-none border-b border-[#E5E5EA] dark:border-gray-700 bg-transparent dark:text-white">
          <textarea v-model="entryForm.content" rows="6" placeholder="条目内容（会插入到对话上下文中）" class="w-full px-4 py-3 text-[15px] outline-none resize-none bg-transparent dark:text-white" style="min-height: 150px;"></textarea>
        </div>
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
            <span class="text-[13px] text-[#8E8E93] uppercase">触发设置</span>
          </div>
          <input v-model="entryForm.keywords" type="text" placeholder="关键词（用逗号分隔）" class="w-full px-4 py-3 text-[15px] outline-none border-b border-[#E5E5EA] dark:border-gray-700 bg-transparent dark:text-white">
          <div class="px-4 py-3 flex justify-between items-center">
            <span class="text-[17px] text-black dark:text-white">始终激活</span>
            <IosToggle v-model="entryForm.alwaysActive" />
          </div>
        </div>
        <div class="bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
          <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
            <span class="text-[13px] text-[#8E8E93] uppercase">插入设置</span>
          </div>
          <div class="px-4 py-3 flex justify-between items-center">
            <span class="text-[17px] text-black dark:text-white">插入深度</span>
            <input v-model.number="entryForm.insertDepth" type="number" class="w-20 text-[17px] text-right outline-none bg-transparent dark:text-white text-[#007AFF]">
          </div>
          <div class="px-4 py-2 text-[13px] text-[#8E8E93]">
            0=紧跟系统提示词，1=第1条消息前，-1=最后
          </div>
        </div>
      </div>
    </IosModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLorebookStore } from '../stores/lorebook'
import { useStorage } from '../composables/useStorage'
import { useToast } from '../composables/useToast'
import { showConfirm } from '../composables/useConfirm'
import IosModal from '../components/common/IosModal.vue'
import IosToggle from '../components/common/IosToggle.vue'

const router = useRouter()
const store = useLorebookStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

const bookModalVisible = ref(false)
const entryModalVisible = ref(false)

const bookForm = reactive({
  name: '',
  description: '',
  icon: '📁'
})

const entryForm = reactive({
  name: '',
  content: '',
  keywords: '',
  alwaysActive: false,
  insertDepth: 0
})

const title = computed(() => {
  if (store.lorebook.currentBookId) {
    const book = store.lorebook.books.find(b => b.id === store.lorebook.currentBookId)
    return book ? book.icon + ' ' + book.name : '世界书'
  }
  return '世界书'
})

const currentBook = computed(() => {
  return store.lorebook.books.find(b => b.id === store.lorebook.currentBookId)
})

function showBookList() {
  store.lorebook.currentBookId = null
}

function showEntryList(bookId) {
  store.lorebook.currentBookId = bookId
}

function openBookModal(bookId = null) {
  store.lorebook.editingBookId = bookId
  if (bookId) {
    const book = store.lorebook.books.find(b => b.id === bookId)
    if (book) {
      bookForm.name = book.name
      bookForm.description = book.description || ''
      bookForm.icon = book.icon
    }
  } else {
    bookForm.name = ''
    bookForm.description = ''
    bookForm.icon = '📁'
  }
  bookModalVisible.value = true
}

function closeBookModal() {
  bookModalVisible.value = false
}

function saveBook() {
  if (!bookForm.name.trim()) {
    showToast('请输入世界书名称')
    return
  }

  if (store.lorebook.editingBookId) {
    const book = store.lorebook.books.find(b => b.id === store.lorebook.editingBookId)
    if (book) {
      book.name = bookForm.name.trim()
      book.description = bookForm.description.trim()
      book.icon = bookForm.icon.trim() || '📁'
      book.updatedAt = Date.now()
    }
    showToast('已更新')
  } else {
    store.lorebook.books.push({
      id: 'book_' + Date.now(),
      name: bookForm.name.trim(),
      description: bookForm.description.trim(),
      icon: bookForm.icon.trim() || '📁',
      entries: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    showToast('已创建')
  }

  scheduleSave()
  closeBookModal()
}

async function deleteBook() {
  if (!store.lorebook.editingBookId) return
  const confirmed = await showConfirm({ message: '确定删除此世界书？所有条目也会被删除。', destructive: true })
  if (!confirmed) return
  store.lorebook.books = store.lorebook.books.filter(b => b.id !== store.lorebook.editingBookId)
  scheduleSave()
  closeBookModal()
  showToast('已删除')
}

function openEntryModal(entryId = null) {
  store.lorebook.editingEntryId = entryId
  if (entryId) {
    const book = currentBook.value
    const entry = book?.entries?.find(e => e.id === entryId)
    if (entry) {
      entryForm.name = entry.name
      entryForm.content = entry.content
      entryForm.keywords = entry.keywords.join(', ')
      entryForm.alwaysActive = entry.alwaysActive
      entryForm.insertDepth = entry.insertDepth
    }
  } else {
    entryForm.name = ''
    entryForm.content = ''
    entryForm.keywords = ''
    entryForm.alwaysActive = false
    entryForm.insertDepth = 0
  }
  entryModalVisible.value = true
}

function closeEntryModal() {
  entryModalVisible.value = false
}

function saveEntry() {
  const book = currentBook.value
  if (!book) return

  if (!entryForm.name.trim() || !entryForm.content.trim()) {
    showToast('请填写名称和内容')
    return
  }

  const keywords = entryForm.keywords.split(',').map(k => k.trim()).filter(k => k)

  if (store.lorebook.editingEntryId) {
    const entry = book.entries.find(e => e.id === store.lorebook.editingEntryId)
    if (entry) {
      entry.name = entryForm.name.trim()
      entry.content = entryForm.content.trim()
      entry.keywords = keywords
      entry.insertDepth = entryForm.insertDepth
      entry.alwaysActive = entryForm.alwaysActive
      entry.updatedAt = Date.now()
    }
    showToast('已更新')
  } else {
    if (!book.entries) book.entries = []
    book.entries.push({
      id: 'entry_' + Date.now(),
      name: entryForm.name.trim(),
      content: entryForm.content.trim(),
      keywords,
      insertDepth: entryForm.insertDepth,
      alwaysActive: entryForm.alwaysActive,
      enabled: true,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    showToast('已创建')
  }

  scheduleSave()
  closeEntryModal()
}

async function deleteEntry() {
  if (!store.lorebook.editingEntryId) return
  const confirmed = await showConfirm({ message: '确定删除此条目？', destructive: true })
  if (!confirmed) return
  const book = currentBook.value
  if (book) {
    book.entries = book.entries.filter(e => e.id !== store.lorebook.editingEntryId)
    scheduleSave()
    closeEntryModal()
    showToast('已删除')
  }
}
</script>
