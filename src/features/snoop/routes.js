export const snoopRoutes = [
  {
    path: '/snoop/:contactId',
    name: 'snoop',
    component: () => import('./views/SnoopPhoneView.vue')
  }
]
