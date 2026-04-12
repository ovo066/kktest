# 主题自定义参考文档

本文档列出了所有可自定义的 CSS 选择器和变量，供 AI 或用户参考生成自定义主题。

**重要：所有布局元素都已渲染在 HTML 中，你只需要用 CSS 控制显示和布局！**

---

## CSS 变量

### 全局颜色
```css
--primary-color      /* 主色调（按钮、链接） */
--bg-color           /* 页面背景色 */
--card-bg            /* 卡片/面板背景色 */
--text-primary       /* 主文字颜色 */
--text-secondary     /* 次要文字颜色 */
--border-color       /* 边框颜色 */
```

### 气泡样式
```css
--bubble-user-bg     /* 用户气泡背景 */
--bubble-user-text   /* 用户气泡文字 */
--bubble-ai-bg       /* AI气泡背景 */
--bubble-ai-text     /* AI气泡文字 */
--bubble-radius      /* 气泡圆角 */
--bubble-shadow      /* 气泡阴影 */
--bubble-border      /* 气泡边框 */
--bubble-tail-display /* 气泡尾巴显示：block(显示) / none(隐藏) */
```

### 聊天区域
```css
--chat-bg            /* 聊天区域背景色（用于气泡尾巴遮罩） */
--avatar-bg          /* 头像占位背景色 */
--meta-color         /* 元信息颜色（时间戳、发送者名称等） */
```

### 徽章
```css
--badge-bg           /* 返回按钮消息数徽章背景 */
--badge-text         /* 返回按钮消息数徽章文字 */
```

### 导航栏
```css
--navbar-bg          /* 导航栏背景 */
--navbar-blur        /* 导航栏模糊 */
--navbar-border      /* 导航栏边框 */
```

### 输入框 & 按钮
```css
--input-bg           /* 输入框背景 */
--input-border       /* 输入框边框 */
--input-radius       /* 输入框圆角 */
--button-radius      /* 按钮圆角 */
```

### 字体
```css
--theme-font         /* 主字体 */
--font-size          /* 基础字号 */
```

### 其他
```css
--global-radius      /* 全局圆角基准 */
```

---

## CSS 选择器

### 聊天页面结构
```css
.chat-view                    /* 聊天页面容器 */
.chat-messages                /* 消息列表区域 */
.chat-watermark               /* 顶部水印文字 */
```

### 消息行结构

每条消息的 HTML 结构如下：
```html
<div class="chat-message-row chat-message-user/ai">
  <div class="avatar-slot avatar-left">    <!-- 左侧头像位置 -->
    <div class="chat-avatar chat-avatar-ai">...</div>
  </div>
  <div class="chat-bubble-wrapper">        <!-- 气泡包装 -->
    <div class="chat-sender-name">...</div> <!-- 发送者名称 -->
    <div class="bubble bubble-user/ai">...</div>
    <div class="msg-meta">...</div>
  </div>
  <div class="avatar-slot avatar-right">   <!-- 右侧头像位置 -->
    <div class="chat-avatar chat-avatar-user">...</div>
  </div>
</div>
```

```css
.chat-message-row             /* 消息行容器 */
.chat-message-user            /* 用户消息行 */
.chat-message-ai              /* AI消息行 */
.chat-timestamp-row           /* 时间戳行 */
.chat-narration-row           /* 旁白行 */

/* 头像插槽 */
.avatar-slot                  /* 头像插槽（左右都有） */
.avatar-left                  /* 左侧头像插槽 */
.avatar-right                 /* 右侧头像插槽 */
.avatar-visible               /* 头像可见状态 */
.avatar-placeholder           /* 头像占位状态 */
```

### 气泡
```css
.bubble                       /* 气泡基础样式 */
.bubble-user                  /* 用户气泡 */
.bubble-ai                    /* AI气泡 */
.bubble-text                  /* 气泡内文字 */
.bubble-image                 /* 气泡内图片 */
.bubble-caption               /* 图片说明文字 */
.reply-context                /* 回复引用内容 */
.chat-bubble-wrapper          /* 气泡外层包装 */
.has-tail                     /* 带尾巴的气泡（最后一条） */
.has-tail::before             /* 尾巴主体（伪元素） */
.has-tail::after              /* 尾巴遮罩（伪元素） */
```

### 头像
```css
.chat-avatar                  /* 头像容器 */
.chat-avatar-user             /* 用户头像 */
.chat-avatar-ai               /* AI头像 */
.chat-sender-name             /* 发送者名称（群聊） */
```

### 时间戳 & 旁白
```css
.chat-timestamp               /* 时间戳文字 */
.narration                    /* 旁白文字 */
```

### 消息元信息
```css
.msg-meta                     /* 消息元信息 */
.user-meta                    /* 用户消息元信息 */
.ai-meta                      /* AI消息元信息 */
```

### 聊天头部结构

头部 HTML 结构如下（所有元素都已渲染）：
```html
<div class="chat-header">
  <div class="chat-header-inner">
    <button class="chat-header-back">返回</button>
    <div class="chat-header-center">
      <div class="chat-header-avatar">头像</div>
      <div class="chat-header-name">
        <span class="chat-header-name-text">名字</span>
        <i class="chat-header-name-arrow">箭头</i>
      </div>
      <div class="chat-header-subtitle">副标题</div>
    </div>
    <div class="chat-header-actions">
      <i class="chat-header-action-video">视频</i>
      <i class="chat-header-action-phone">电话</i>
      <i class="chat-header-action-more">更多</i>
      <i class="chat-header-action-list">列表</i>
    </div>
  </div>
</div>
```

```css
.chat-header                  /* 头部容器 */
.chat-header-inner            /* 头部内层 */
.chat-header-back             /* 返回按钮 */
.chat-header-badge            /* 消息数量徽章 */
.chat-header-center           /* 中间区域 */
.chat-header-avatar           /* 头部头像 */
.chat-header-avatar-group     /* 群聊头像 */
.chat-header-name             /* 名称区域 */
.chat-header-name-text        /* 名称文字 */
.chat-header-name-arrow       /* 名称旁箭头 */
.chat-header-subtitle         /* 副标题 */
.chat-header-actions          /* 右侧操作区 */
.chat-header-action-video     /* 视频按钮 */
.chat-header-action-phone     /* 电话按钮 */
.chat-header-action-more      /* 更多按钮 */
.chat-header-action-list      /* 列表按钮 */
```

### 输入区域结构

输入区 HTML 结构如下（所有元素都已渲染）：
```html
<div class="chat-input-wrapper">
  <div class="chat-input-toolbar">工具栏</div>
  <div class="chat-input">
    <button class="chat-input-plus-left">左加号</button>
    <div class="chat-input-menu-left">左侧菜单</div>
    <div class="chat-input-field">输入框</div>
    <button class="chat-input-emoji">表情</button>
    <button class="chat-input-plus-right">右加号</button>
    <button class="chat-input-send">发送</button>
  </div>
  <div class="chat-input-popup">底部弹出菜单</div>
</div>
```

```css
.chat-input-wrapper           /* 输入区包装 */
.chat-input                   /* 输入区域容器 */
.chat-input-toolbar           /* 顶部工具栏（QQ风格） */
.chat-input-toolbar-item      /* 工具栏项 */
.chat-input-plus-left         /* 左侧加号按钮 */
.chat-input-plus-right        /* 右侧加号按钮 */
.chat-input-menu-left         /* 左侧弹出菜单 */
.chat-input-menu-item         /* 菜单项 */
.chat-input-menu-photo        /* 照片菜单项 */
.chat-input-menu-sticker      /* 贴纸菜单项 */
.chat-input-menu-icon         /* 菜单图标 */
.chat-input-menu-label        /* 菜单文字 */
.chat-input-field             /* 输入框容器 */
.chat-input-text              /* 输入框 */
.chat-input-emoji             /* 表情按钮 */
.chat-input-send              /* 发送按钮 */
.chat-input-send-icon         /* 发送按钮图标 */
.chat-input-popup             /* 底部弹出菜单（微信风格） */
.chat-input-popup-item        /* 底部菜单项 */
```

### 玻璃效果
```css
.glass-panel                  /* 毛玻璃面板 */
.glass-input-area             /* 毛玻璃输入区 */
```

---

## 布局自定义示例

### 气泡尾巴控制

```css
/* 隐藏所有气泡尾巴 */
:root {
  --bubble-tail-display: none;
}

/* 或通过伪元素直接隐藏 */
.has-tail::before,
.has-tail::after {
  display: none !important;
}

/* 自定义尾巴颜色（会跟随气泡颜色） */
:root {
  --bubble-user-bg: #95EC69;  /* 尾巴自动使用此颜色 */
  --chat-bg: #EDEDED;         /* 尾巴遮罩使用此颜色 */
}
```

### 徽章样式控制

```css
/* 自定义返回按钮徽章颜色 */
:root {
  --badge-bg: #FF3B30;
  --badge-text: #fff;
}

/* 隐藏徽章 */
.chat-header-badge {
  display: none !important;
}
```

### 头像位置控制

```css
/* 默认：用户头像在右，AI头像在左 */

/* 所有头像都在左边 */
.chat-message-user .avatar-left { display: flex !important; }
.chat-message-user .avatar-right { display: none !important; }

/* 所有头像都在右边 */
.chat-message-ai .avatar-right { display: flex !important; }
.chat-message-ai .avatar-left { display: none !important; }

/* 双侧都显示头像 */
.avatar-slot { display: flex !important; }

/* 隐藏所有头像 */
.avatar-slot { display: none !important; }
```

### 消息对齐控制

```css
/* 所有消息靠左 */
.chat-message-row {
  justify-content: flex-start !important;
}

/* 所有消息靠右 */
.chat-message-row {
  justify-content: flex-end !important;
}

/* 所有消息居中 */
.chat-message-row {
  justify-content: center !important;
}
```

### 头部样式控制

```css
/* QQ/微信风格：隐藏头像，显示更多按钮 */
.chat-header-avatar { display: none !important; }
.chat-header-action-video { display: none !important; }
.chat-header-action-more { display: block !important; }
.chat-header-name-arrow { display: none !important; }
.chat-header {
  min-height: 60px !important;
  background: #EDEDED !important;
}
.chat-header-center {
  position: relative !important;
  padding-top: 0 !important;
}
.chat-header-name-text {
  font-size: 17px !important;
}

/* LINE风格：头像和名字水平排列 */
.chat-header-center {
  flex-direction: row !important;
  gap: 8px;
}
.chat-header-action-phone { display: block !important; }
.chat-header-action-list { display: block !important; }
.chat-header-action-video { display: none !important; }
```

### 输入区样式控制

```css
/* 微信风格：隐藏左加号，显示表情和右加号 */
.chat-input-plus-left { display: none !important; }
.chat-input-menu-left { display: none !important; }
.chat-input-emoji { display: flex !important; }
.chat-input-plus-right { display: flex !important; }
.chat-input-popup { display: grid !important; }

/* QQ风格：显示顶部工具栏 */
.chat-input-toolbar { display: flex !important; }
.chat-input-menu-left { display: none !important; }
```

### 隐藏元素

```css
.chat-watermark { display: none; }           /* 隐藏水印 */
.chat-header-actions { display: none; }      /* 隐藏右侧操作按钮 */
.chat-sender-name { display: none; }         /* 隐藏发送者名字 */
.msg-meta { display: none; }                 /* 隐藏消息元信息 */
```

---

## 完整主题示例

### 微信风格
```css
/* 微信主题 */

:root {
  --primary-color: #07C160;
  --bubble-user-bg: #95EC69;
  --bubble-user-text: #000;
  --bubble-ai-bg: #FFFFFF;
  --bubble-ai-text: #000;
  --bubble-radius: 4px;
  --bubble-tail-display: none;  /* 微信无尾巴 */
  --bg-color: #EDEDED;
  --chat-bg: #EDEDED;
}

/* 隐藏水印 */
.chat-watermark { display: none; }

/* 气泡无阴影 */
.bubble {
  box-shadow: none !important;
}

/* 头部：QQ/微信风格 */
.chat-header {
  min-height: 56px !important;
  background: #EDEDED !important;
  border-bottom: 1px solid #D9D9D9;
}
.chat-header-avatar { display: none !important; }
.chat-header-center {
  position: relative !important;
  padding-top: 0 !important;
}
.chat-header-name-text { font-size: 17px !important; }
.chat-header-name-arrow { display: none !important; }
.chat-header-action-video { display: none !important; }
.chat-header-action-more { display: block !important; }
.chat-header-back { color: #000 !important; }
.chat-header-actions { color: #000 !important; }

/* 头像显示在气泡旁 */
.avatar-slot.avatar-visible { display: flex !important; }

/* 输入区：右侧加号和表情 */
.chat-input-plus-left { display: none !important; }
.chat-input-menu-left { display: none !important; }
.chat-input-emoji { display: flex !important; }
.chat-input-plus-right { display: flex !important; }

/* 发送按钮颜色 */
.chat-input-send-icon {
  background: #07C160 !important;
}
```

### 像素复古风格
```css
/* 像素复古主题 */

:root {
  --theme-font: "Press Start 2P", monospace;
  --font-size: 10px;
  --primary-color: #00FF00;
  --bg-color: #0a0a0a;
  --card-bg: #000;
  --text-primary: #00FF00;
  --text-secondary: #008800;
  --bubble-radius: 0;
  --bubble-user-bg: #000;
  --bubble-user-text: #00FF00;
  --bubble-ai-bg: #000;
  --bubble-ai-text: #00FF00;
}

.bubble {
  border: 2px solid #00FF00 !important;
  box-shadow: 4px 4px 0 #00FF00 !important;
}

.chat-header {
  background: #000 !important;
  border-bottom: 2px solid #00FF00 !important;
}

.chat-input {
  background: #000 !important;
  border-top: 2px solid #00FF00 !important;
}

.chat-input-field {
  border: 2px solid #00FF00 !important;
  border-radius: 0 !important;
  background: #000 !important;
}

.chat-input-send-icon {
  background: #00FF00 !important;
  color: #000 !important;
  border-radius: 0 !important;
}

.chat-watermark { display: none; }
.chat-avatar {
  border-radius: 0 !important;
  border: 2px solid #00FF00 !important;
}
```

### 可爱粉色风格
```css
/* 可爱粉色主题 */

:root {
  --theme-font: "Nunito", sans-serif;
  --primary-color: #FF69B4;
  --bg-color: #FFF0F5;
  --card-bg: #FFFFFF;
  --bubble-user-bg: #FF69B4;
  --bubble-user-text: #FFF;
  --bubble-ai-bg: #FFFFFF;
  --bubble-ai-text: #333;
  --bubble-radius: 20px;
  --bubble-shadow: 0 4px 12px rgba(255, 105, 180, 0.3);
}

.bubble-user {
  background: linear-gradient(135deg, #FF69B4, #FF1493) !important;
}

.chat-avatar {
  border: 2px solid #FF69B4 !important;
}

.chat-header {
  background: rgba(255, 240, 245, 0.9) !important;
}

.chat-input-send-icon {
  background: linear-gradient(135deg, #FF69B4, #FF1493) !important;
}

.chat-header-back,
.chat-header-actions {
  color: #FF69B4 !important;
}
```

---

## 给 AI 的提示

当用户要求生成自定义主题时，请：

1. **理解用户需求**：分析用户描述的风格（如微信、QQ、LINE、像素、可爱等）
2. **设置 CSS 变量**：使用 :root 设置颜色、字体、圆角等基础变量
3. **控制布局**：使用选择器控制头像位置、头部样式、输入区样式
4. **覆盖组件样式**：使用 !important 覆盖默认样式
5. **考虑深色模式**：使用 .dark 选择器处理深色模式

**输出格式：**
```css
/* 主题名称 */

/* 字体导入（如需要，填入设置的「字体导入URL」） */
/* https://fonts.googleapis.com/css2?family=... */

/* CSS 变量（填入设置界面对应字段） */
:root {
  --primary-color: #xxx;
  --bubble-user-bg: #xxx;
  /* ... */
}

/* 以下内容填入「自定义 CSS」 */

/* 深色模式调整 */
.dark {
  /* ... */
}

/* 布局控制 */
.chat-header-avatar { display: none; }
/* ... */

/* 组件样式覆盖 */
.bubble-user {
  /* ... */
}
```

**注意事项：**
1. 只使用本文档列出的选择器
2. 需要覆盖默认样式时使用 !important
3. 所有元素都已渲染，只需用 CSS 控制 display 属性
4. 不要写 @import（字体导入有专门设置项）
