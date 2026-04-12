export const momentsRoutes = [
  {
    path: '/moments',
    name: 'moments',
    component: () => import('./views/MomentsView.vue')
  },
  {
    path: '/moments/:id',
    name: 'moment-detail',
    component: () => import('./views/MomentDetailView.vue')
  }
]
