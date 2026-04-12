// 旧论坛路由兼容重定向
export const legacyRoutes = [
  {
    path: '/forum',
    redirect: '/moments'
  },
  {
    path: '/forum/board/:boardId',
    redirect: '/moments'
  },
  {
    path: '/forum/post/:postId',
    redirect: to => ({ path: '/moments/' + to.params.postId })
  },
  {
    path: '/forum/profile',
    redirect: '/moments'
  }
]

