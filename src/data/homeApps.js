export const DESKTOP_APPS = [
  {
    key: 'messages',
    label: '消息',
    route: '/messages',
    icon: 'ph-fill ph-chat-circle-dots',
    homeBackground: 'rgba(59,130,246,0.2)',
    previewBackground: 'linear-gradient(180deg, #34C759 0%, #1FA447 100%)'
  },
  {
    key: 'persona',
    label: '面具',
    route: '/persona',
    icon: 'ph-fill ph-mask-happy',
    homeBackground: 'rgba(168,85,247,0.2)',
    previewBackground: 'linear-gradient(180deg, #AF52DE 0%, #8944AB 100%)'
  },
  {
    key: 'settings',
    label: '设置',
    route: '/settings',
    icon: 'ph-fill ph-gear',
    homeBackground: 'rgba(249,115,22,0.2)',
    previewBackground: 'linear-gradient(180deg, #A1A1A6 0%, #636366 100%)'
  },
  {
    key: 'lorebook',
    label: '世界书',
    route: '/lorebook',
    icon: 'ph-fill ph-book-open',
    homeBackground: 'rgba(34,197,94,0.2)',
    previewBackground: 'linear-gradient(180deg, #FF9500 0%, #FF6B00 100%)'
  },
  {
    key: 'forum',
    label: '动态',
    route: '/moments',
    icon: 'ph-fill ph-shooting-star',
    homeBackground: 'rgba(156,163,175,0.2)',
    previewBackground: 'linear-gradient(180deg, #8E8E93 0%, #636366 100%)'
  },
  {
    key: 'theme',
    label: '美化',
    route: '/theme',
    icon: 'ph-fill ph-paint-brush',
    homeBackground: 'rgba(244,114,182,0.2)',
    previewBackground: 'linear-gradient(180deg, #FF2D55 0%, #D91A45 100%)'
  },
  {
    key: 'album',
    label: '相册',
    route: '/album',
    icon: 'ph-fill ph-images-square',
    homeBackground: 'rgba(255,149,0,0.2)',
    previewBackground: 'linear-gradient(180deg, #FFB340 0%, #FF7A00 100%)'
  },
  {
    key: 'vn',
    label: 'VN',
    route: '/vn',
    icon: 'ph-fill ph-game-controller',
    homeBackground: 'rgba(99,102,241,0.2)',
    previewBackground: 'linear-gradient(180deg, #00C2A8 0%, #009B83 100%)'
  },
  {
    key: 'meet',
    label: '见面',
    route: '/meet',
    icon: 'ph-fill ph-heart',
    homeBackground: 'rgba(236,72,153,0.2)',
    previewBackground: 'linear-gradient(180deg, #FF5D8F 0%, #E23370 100%)'
  },
  {
    key: 'planner',
    label: '日程',
    route: '/planner',
    icon: 'ph-fill ph-calendar-check',
    homeBackground: 'rgba(255,182,185,0.2)',
    previewBackground: 'linear-gradient(180deg, #FFB6B9 0%, #FF8A8F 100%)'
  },
  {
    key: 'favorites',
    label: '收藏',
    route: '/favorites',
    icon: 'ph-fill ph-star',
    homeBackground: 'rgba(251,191,36,0.2)',
    previewBackground: 'linear-gradient(180deg, #FFD95A 0%, #FFB300 100%)'
  }
]

export const DESKTOP_APP_KEYS = DESKTOP_APPS.map((app) => app.key)
