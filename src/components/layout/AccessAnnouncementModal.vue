<template>
  <Teleport to="#app">
    <div v-if="visible && announcement" class="access-announcement-backdrop">
      <div class="access-announcement-card">
        <div class="access-announcement-header">
          <p class="access-announcement-eyebrow">公告</p>
          <h2 class="access-announcement-title">{{ announcement.title || '公告' }}</h2>
          <p v-if="announcement.publishedAt" class="access-announcement-date">{{ announcement.publishedAt }}</p>
        </div>

        <div class="access-announcement-body">
          <p v-if="announcement.body" class="access-announcement-copy">{{ announcement.body }}</p>
          <div v-if="announcement.changelog?.length" class="access-announcement-changelog">
            <p class="access-announcement-section">更新内容</p>
            <ul>
              <li v-for="item in announcement.changelog" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>

        <button class="access-announcement-button" @click="$emit('acknowledge')">
          {{ announcement.buttonText || '我知道了' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  announcement: {
    type: Object,
    default: null
  }
})

defineEmits(['acknowledge'])
</script>

<style scoped>
.access-announcement-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.access-announcement-card {
  width: min(100%, 360px);
  border-radius: 26px;
  padding: 22px 18px 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(246, 249, 252, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
}

.dark .access-announcement-card {
  background:
    linear-gradient(180deg, rgba(30, 34, 40, 0.96), rgba(18, 21, 26, 0.98));
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.42);
}

.access-announcement-header {
  display: grid;
  gap: 6px;
}

.access-announcement-eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.access-announcement-title {
  font-size: 24px;
  line-height: 1.15;
  font-weight: 800;
  color: var(--text-primary);
}

.access-announcement-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.access-announcement-body {
  display: grid;
  gap: 16px;
  margin-top: 18px;
}

.access-announcement-copy {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}

.access-announcement-section {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.access-announcement-changelog ul {
  margin-top: 8px;
  display: grid;
  gap: 8px;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.access-announcement-button {
  width: 100%;
  min-height: 46px;
  margin-top: 18px;
  border-radius: 16px;
  color: white;
  font-size: 15px;
  font-weight: 700;
  background: linear-gradient(135deg, #007aff, #21c4ff);
}
</style>
