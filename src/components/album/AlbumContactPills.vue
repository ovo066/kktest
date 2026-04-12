<template>
  <div class="people-grid">
    <button
      v-for="c in contacts"
      :key="c.contactId"
      class="people-card"
      @click="$emit('select', c.contactId)"
    >
      <!-- Cover photo background -->
      <div class="people-card-cover">
        <img v-if="c.coverUrl" :src="c.coverUrl" alt="" class="people-card-cover-img" />
        <div class="people-card-overlay"></div>
      </div>
      <!-- Avatar -->
      <div class="people-card-avatar">
        <img v-if="c.avatar && !c.avatar.startsWith('#')" :src="c.avatar" alt="" />
        <span v-else class="people-card-avatar-fallback">{{ (c.contactName || '?')[0] }}</span>
      </div>
      <!-- Info -->
      <div class="people-card-name">{{ c.contactName }}</div>
      <div class="people-card-count">{{ c.count }} 张照片</div>
    </button>
  </div>
</template>

<script setup>
defineProps({
  contacts: { type: Array, default: () => [] }
})
defineEmits(['select'])
</script>

<style scoped>
.people-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
}

.people-card {
  position: relative;
  border: none;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(0,0,0,0.04);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 14px;
  transition: transform 150ms ease;
}

.dark .people-card {
  background: rgba(255,255,255,0.06);
}

.people-card:active {
  transform: scale(0.96);
}

/* Cover */
.people-card-cover {
  width: 100%;
  height: 90px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255,138,128,0.15), rgba(255,183,77,0.15));
}

.people-card-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.people-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.25) 100%);
}

/* Avatar */
.people-card-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  margin-top: -26px;
  position: relative;
  z-index: 1;
  border: 3px solid #FFF9F5;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.dark .people-card-avatar {
  border-color: #121014;
  background: #2a2a2a;
}

.people-card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.people-card-avatar-fallback {
  font-size: 20px;
  font-weight: 700;
  color: #aaa;
}

.dark .people-card-avatar-fallback {
  color: #666;
}

/* Info */
.people-card-name {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #222;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark .people-card-name {
  color: #e8e8e8;
}

.people-card-count {
  font-size: 12px;
  color: #999;
  margin-top: 1px;
}
</style>
