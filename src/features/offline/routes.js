export const offlineRoutes = [
  {
    path: '/offline/:contactId',
    name: 'offline',
    component: () => import('./views/OfflineView.vue')
  }
]
