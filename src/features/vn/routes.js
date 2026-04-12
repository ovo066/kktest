export const vnRoutes = [
  {
    path: '/vn',
    name: 'vn-home',
    component: () => import('./views/VNHomeView.vue')
  },
  {
    path: '/vn/image-config',
    name: 'vn-image-config',
    component: () => import('./views/VNImageConfigView.vue')
  },
  {
    path: '/vn/studio/:contactId',
    name: 'vn-studio',
    component: () => import('./views/VNCharacterStudioView.vue')
  },
  {
    path: '/vn/wizard',
    name: 'vn-wizard',
    component: () => import('./views/VNWizardView.vue')
  },
  {
    path: '/vn/setup/:projectId?',
    name: 'vn-setup',
    component: () => import('./views/VNSetupView.vue')
  },
  {
    path: '/vn/resources/:projectId',
    name: 'vn-resources',
    component: () => import('./views/VNResourceView.vue')
  },
  {
    path: '/vn/prepare/:projectId',
    name: 'vn-prepare',
    component: () => import('./views/VNPrepareView.vue')
  },
  {
    path: '/vn/play/:projectId',
    name: 'vn-player',
    component: () => import('./views/VNPlayerView.vue')
  }
]

