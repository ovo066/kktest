<template>
  <ReaderBookshelf
    :visible="bookshelfVisible"
    :books="books"
    @close="emit('close-bookshelf')"
    @import-file="emit('import-file')"
    @open-book="emit('open-book', $event)"
    @delete-book="emit('delete-book', $event)"
  />

  <ReaderView
    :visible="readerVisible"
    :mode="mode"
    @close="emit('close-reader')"
    @toggle-mode="emit('toggle-mode')"
  />
</template>

<script setup>
import { ReaderBookshelf, ReaderView } from '../../../features/reader/ui'

defineProps({
  bookshelfVisible: { type: Boolean, default: false },
  books: { type: Array, default: () => [] },
  readerVisible: { type: Boolean, default: false },
  mode: { type: String, default: 'window' }
})

const emit = defineEmits([
  'close-bookshelf',
  'import-file',
  'open-book',
  'delete-book',
  'close-reader',
  'toggle-mode'
])
</script>
