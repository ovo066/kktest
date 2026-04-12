// 预设主题列表
export const presetThemes = [
  {
    id: 'default',
    name: '默认 (iMessage)',
    preview: {
      bg: '#fff',
      userBubble: '#007AFF',
      aiBubble: '#E9E9EB'
    },
    data: null // null 表示使用默认/重置
  },
  {
    id: 'line',
    name: 'LINE',
    preview: {
      bg: '#7494C0',
      userBubble: '#8DE055',
      aiBubble: '#FFFFFF'
    },
    data: {
      inputPlaceholder: 'Aa',
      showEmojiButton: true,
      emojiButtonPosition: 'inside',
      plusButtonPosition: 'left',
      showCameraButton: true,
      showImageButton: true,
      showMicButton: false,
      headerActions: ['video', 'search', 'list'],
      bubbleShowAvatar: true,
      bubbleTailStyle: 'line',

      primaryColor: '#06C755',
      backgroundColor: '#7494C0',
      navbarBg: 'rgba(240, 240, 240, 0.92)',
      navbarBlur: '10px',
      navbarBorder: 'rgba(0,0,0,0.1)',

      bubbleUserBg: '#8DE055',
      bubbleUserText: '#000000',
      bubbleAiBg: '#FFFFFF',
      bubbleAiText: '#000000',
      bubbleRadius: '18px',
      bubbleShadow: '0 1px 1px rgba(0,0,0,0.1)',

      inputBg: '#F3F3F3',
      inputBorder: 'transparent',
      inputRadius: '20px',

      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
      fontImport: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',

      customCSS: `/* LINE 主题 */

/* 聊天背景 */
.chat-messages {
  background-color: #7494C0 !important;
}

/* 头部样式 */
.chat-header {
  background: rgba(240, 240, 240, 0.92) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  min-height: 100px !important;
}
.chat-header-back {
  color: #000 !important;
}
.chat-header-actions {
  color: #000 !important;
}
.chat-header-avatar {
  display: none !important;
}
.chat-header-name-text {
  font-size: 17px !important;
  font-weight: 700 !important;
}
.chat-header-name-arrow {
  display: none !important;
}

/* 统一气泡尾巴与圆角，避免最后一条和中间条样式不一致 */
.bubble-user,
.bubble-user.has-tail {
  border-top-right-radius: 4px !important;
  border-bottom-right-radius: var(--bubble-radius) !important;
  margin-right: 0 !important;
  position: relative !important;
}
.bubble-ai,
.bubble-ai.has-tail {
  border-top-left-radius: 4px !important;
  border-bottom-left-radius: var(--bubble-radius) !important;
  margin-left: 0 !important;
  position: relative !important;
}

/* LINE 风格顶部尾巴 - 用户(右) */
.bubble-user::before,
.bubble-user.has-tail::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  top: 0 !important;
  right: -6px !important;
  left: auto !important;
  bottom: auto !important;
  width: 10px !important;
  height: 12px !important;
  background-color: var(--bubble-user-bg, #8DE055) !important;
  clip-path: path('M 0 0 L 8 0 Q 4 5 0 10 Z') !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}
.bubble-user::after,
.bubble-user.has-tail::after {
  display: none !important;
}

/* LINE 风格顶部尾巴 - AI(左) */
.bubble-ai::before,
.bubble-ai.has-tail::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  top: 0 !important;
  left: -6px !important;
  right: auto !important;
  bottom: auto !important;
  width: 10px !important;
  height: 12px !important;
  background-color: var(--bubble-ai-bg, #FFFFFF) !important;
  clip-path: path('M 10 0 L 2 0 Q 6 5 10 10 Z') !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}
.bubble-ai::after,
.bubble-ai.has-tail::after {
  display: none !important;
}

/* 彻底抹平 has-tail / in-group 差异，最后一条与其他条保持同形态 */
.bubble-user.in-group,
.bubble-ai.in-group {
  margin-bottom: 0 !important;
}
.bubble-user.has-tail {
  border-radius: var(--bubble-radius) !important;
  border-top-right-radius: 4px !important;
}
.bubble-ai.has-tail {
  border-radius: var(--bubble-radius) !important;
  border-top-left-radius: 4px !important;
}

/* 头像开启时贴近气泡，间距更接近原版 LINE */
.chat-message-user .avatar-right.avatar-visible {
  margin-left: 4px !important;
}
.chat-message-ai .avatar-left.avatar-visible {
  margin-right: 4px !important;
}
.chat-message-row .avatar-slot.avatar-visible {
  align-self: flex-start !important;
  margin-top: 2px !important;
}
.chat-message-row .chat-avatar {
  width: 30px !important;
  height: 30px !important;
}
.chat-message-row .avatar-slot {
  width: 30px !important;
}

/* 时间戳样式 */
.chat-timestamp {
  background: rgba(0,0,0,0.15) !important;
  color: #fff !important;
  font-size: 11px !important;
  padding: 4px 12px !important;
  border-radius: 20px !important;
  backdrop-filter: blur(4px) !important;
}

/* 消息时间/已读 - 在蓝色背景上用深色 */
.msg-meta {
  color: #3d5a73 !important;
}

/* 旁白样式 - 在蓝色背景上更清晰 */
.narration {
  background: rgba(255,255,255,0.85) !important;
  color: #333 !important;
  backdrop-filter: blur(8px) !important;
}

/* 输入区域 */
.glass-input-area {
  background: #fff !important;
  border-top: 1px solid rgba(0,0,0,0.1) !important;
}
.chat-input-field {
  background: #F3F3F3 !important;
  border: none !important;
}
.chat-input-left {
  color: #1E2329 !important;
}
.chat-input-plus,
.chat-input-camera,
.chat-input-image {
  color: #1E2329 !important;
}
.chat-input-emoji-inside {
  color: #888 !important;
}
.chat-input-mic {
  color: #1E2329 !important;
}

/* 发送按钮 LINE 风格 */
.chat-input-send-icon {
  background: #06C755 !important;
  color: #fff !important;
}

/* 深色模式覆盖 */
.dark .chat-messages {
  background-color: #1a1a2e !important;
}
.dark .chat-header {
  background: rgba(30, 30, 30, 0.92) !important;
}
.dark .chat-header-back,
.dark .chat-header-actions,
.dark .chat-header-name-text {
  color: #fff !important;
}
.dark .msg-meta {
  color: #a0b0c0 !important;
}
.dark .narration {
  background: rgba(0,0,0,0.5) !important;
  color: #ddd !important;
}
.dark .glass-input-area {
  background: #1c1c1e !important;
}
.dark .chat-input-field {
  background: #2c2c2e !important;
}
.dark .chat-input-plus,
.dark .chat-input-camera,
.dark .chat-input-image,
.dark .chat-input-mic {
  color: #fff !important;
}`
    }
  },
  {
    id: 'pixel',
    name: '像素梦核',
    preview: {
      bg: '#E0D8EA',
      userBubble: '#FF69B4',
      aiBubble: '#00FFFF'
    },
    data: {
      primaryColor: '#FF00FF',
      backgroundColor: '#E0D8EA',
      cardBackground: '#FFFFFF',
      textPrimary: '#2D004F',
      textSecondary: '#6A4A93',
      borderColor: '#2D004F',
      bubbleUserBg: '#FF69B4',
      bubbleUserText: '#FFFFFF',
      bubbleAiBg: '#00FFFF',
      bubbleAiText: '#000000',
      bubbleRadius: '0px',
      bubbleShadow: '4px 4px 0px rgba(0,0,0,0.5)',
      bubbleBorder: '2px solid #2D004F',
      navbarBg: '#E0D8EA',
      navbarBlur: '0px',
      navbarBorder: '2px solid #2D004F',
      inputBg: '#FFFFFF',
      inputBorder: '2px solid #2D004F',
      inputRadius: '0px',
      buttonRadius: '0px',
      fontFamily: 'DotGothic16, sans-serif',
      fontImport: 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap',
      fontSize: '16px',
      globalRadius: '0px',
      headerActions: ['video'],
      customCSS: `/* 像素梦核 - 布局重构版 */

/* === 1. 全局基础 === */
* { border-radius: 0 !important; }
.glass-panel, .glass-input-area { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

/* === 2. 聊天头部 (Header) 重构 === */
/* 容器：改为弹性布局，内容两端对齐 */
.chat-header-inner {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding-left: 8px !important;
  padding-right: 8px !important;
}

/* 中间区域：取消绝对定位，改为靠左排列 */
.chat-header-center {
  position: static !important;
  flex: 1 !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  padding: 0 !important;
  margin-left: 8px !important;
  pointer-events: auto !important;
}

/* 头像：方形、加框、调整大小 */
.chat-header-avatar,
.chat-header-avatar-group {
  width: 32px !important;
  height: 32px !important;
  margin: 0 10px 0 0 !important;
  border: 2px solid #2D004F !important;
  background: #FFF !important;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.2) !important;
}

/* 名字：调整字号 */
.chat-header-name-text {
  font-size: 16px !important;
  font-weight: bold !important;
}

/* 隐藏不需要的元素 */
.chat-header-subtitle { display: none !important; }
.chat-header-name-arrow { display: none !important; }
.chat-watermark { display: none; }

/* 右侧按钮区保留通话入口 */
.chat-header-actions {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

/* === 3. 气泡与消息 === */
/* 去除气泡小尾巴 */
.bubble::before, .bubble::after { display: none !important; }

.bubble {
  border: 2px solid #2D004F !important;
  padding: 10px 14px !important;
  image-rendering: pixelated;
}

/* 消息行头像：方形 */
.chat-avatar {
  border: 2px solid #2D004F !important;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.2) !important;
}

/* === 4. 输入区与菜单 === */
/* 扩展菜单 (Plus Menu) 改为 Grid 布局 */
.chat-input-menu-left {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px !important;
  width: auto !important;
  min-width: 180px;
  background: #E0D8EA !important;
  border: 2px solid #2D004F !important;
  box-shadow: 4px 4px 0px #2D004F !important;
  padding: 10px !important;
  bottom: 70px !important;
  left: 10px !important;
}

.chat-input-menu-item {
  flex-direction: column !important;
  background: #FFF !important;
  border: 2px solid #2D004F !important;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.2) !important;
  padding: 8px !important;
}
.chat-input-menu-item:active {
  transform: translate(2px, 2px);
  box-shadow: none !important;
}

/* 菜单图标去圆角 */
.chat-input-menu-icon {
  background: transparent !important;
  width: 32px !important;
  height: 32px !important;
  box-shadow: none !important;
  ring: 0 !important;
}

/* 底部输入框样式 */
.chat-input-wrapper {
  border-top: 3px solid #2D004F !important;
  background: #D4C5E8 !important;
}
.chat-input-field {
  border: 2px solid #2D004F !important;
  background: #FFF !important;
  box-shadow: inset 2px 2px 0px rgba(0,0,0,0.1) !important;
}
.chat-input-send-icon {
  background: #FF00FF !important;
  border: 2px solid #2D004F !important;
  color: #FFF !important;
  box-shadow: 2px 2px 0px #000 !important;
}
.chat-input-send-icon:active {
  transform: translate(2px, 2px);
  box-shadow: none !important;
}

/* 底部加号和表情按钮 */
.chat-input-plus, .chat-input-emoji {
  border: 1px dashed transparent;
}
.chat-input-plus:hover, .chat-input-emoji:hover {
  border: 1px dashed #2D004F;
  background: rgba(255,255,255,0.3);
}`
    }
  }
]

export default presetThemes
