import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { installIosContextMenuPolyfill } from './bootstrap/installIosContextMenuPolyfill'
import { installViewportSync } from './bootstrap/installViewportSync'
import { registerServiceWorker } from './bootstrap/registerServiceWorker'
import { useAccessControl } from './composables/useAccessControl'
import { useBootstrapStore } from './stores/bootstrap'
import { useStorage } from './composables/useStorage'
import { useGiftsStore } from './stores/gifts'
import { registerCustomGiftSource } from './data/gifts'
import { useCloudSync } from './composables/useCloudSync'
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/bold'
import '@phosphor-icons/web/fill'
import './style.css'

installIosContextMenuPolyfill()
installViewportSync()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
const storageApi = useStorage()
const bootstrapStore = useBootstrapStore()
const giftsStore = useGiftsStore()
registerCustomGiftSource(() => giftsStore.customGifts)
app.mount('#app')
registerServiceWorker()

async function bootstrap() {
  try {
    const { bootstrapAccessControl } = useAccessControl()
    const canAccessApp = await bootstrapAccessControl()
    if (!canAccessApp) {
      bootstrapStore.finishHydration()
      return
    }
  } catch (err) {
    console.warn('Access control bootstrap failed:', err)
    bootstrapStore.finishHydration(err)
    return
  }

  try {
    await storageApi.loadAll()
  } catch (err) {
    console.warn('Initial app data load failed:', err)
  }

  // Bootstrap cloud sync after mount (non-blocking)
  try {
    const { bootstrapCloudSync } = useCloudSync(storageApi)
    void bootstrapCloudSync()
  } catch (err) {
    console.warn('Cloud sync bootstrap failed:', err)
  }
}

void bootstrap()
