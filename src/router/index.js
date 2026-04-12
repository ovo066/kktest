/**
 * Vue Router 配置
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { appRoutes } from './routes/appRoutes'
import { legacyRoutes } from './routes/legacyRoutes'
import { chatRoutes } from '../features/chat'
import { vnRoutes } from '../features/vn'
import { meetRoutes } from '../features/meet'
import { offlineRoutes } from '../features/offline'
import { plannerRoutes } from '../features/planner'
import { momentsRoutes } from '../features/moments'
import { snoopRoutes } from '../features/snoop'

const routes = [
  ...appRoutes,
  ...chatRoutes,
  ...vnRoutes,
  ...meetRoutes,
  ...offlineRoutes,
  ...plannerRoutes,
  ...momentsRoutes,
  ...snoopRoutes,
  ...legacyRoutes
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
