export const chatRoutes = [
  {
    path: '/favorites/:contactId/:msgId',
    name: 'favorite-detail',
    component: () => import('./views/FavoriteDetailView.vue')
  },
  {
    path: '/messages',
    name: 'messages',
    component: () => import('./views/MessagesView.vue')
  },
  {
    path: '/chat/:contactId',
    name: 'chat',
    component: () => import('./views/ChatView.vue')
  }
]
