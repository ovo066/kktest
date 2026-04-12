export const meetRoutes = [
  {
    path: '/meet',
    name: 'meet-home',
    component: () => import('./views/MeetHomeView.vue')
  },
  {
    path: '/meet/setup/:id?',
    name: 'meet-setup',
    component: () => import('./views/MeetSetupView.vue')
  },
  {
    path: '/meet/play/:id',
    name: 'meet-player',
    component: () => import('./views/MeetPlayerView.vue')
  },
  {
    path: '/meet/presets',
    name: 'meet-presets',
    component: () => import('./views/MeetPresetView.vue')
  }
]

