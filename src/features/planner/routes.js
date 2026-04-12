export const plannerRoutes = [
  {
    path: '/planner',
    name: 'planner',
    component: () => import('./views/PlannerView.vue')
  },
  {
    path: '/planner/diary/:id',
    name: 'diary-detail',
    component: () => import('./views/DiaryDetailView.vue')
  }
]
