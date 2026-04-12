# KakaChat

仿 iMessage 风格的 AI 角色扮演聊天应用，基于 Vue 3 + Vite + Pinia 构建。在浏览器中模拟真实手机界面，与 AI 角色自然对话。

兼容所有 OpenAI 格式的 API（包括各类中转站），开箱即用。

<!-- 截图占位：替换为实际截图 -->
<!-- ![screenshot](docs/screenshot.png) -->

## 功能一览

**聊天核心**
- 1:1 聊天 + 群聊（单 API / 多 API 模式）
- 图片消息 + 自定义贴纸 + AI 图片生成
- 语音消息（模拟 / 浏览器 TTS / Edge TTS / MiniMax）
- AI 通话（语音/视频模拟，STT + TTS）
- 记忆管理（逐联系人核心记忆 + 自动摘要）

**角色与世界观**
- 人设面具（Personas）— 切换用户身份
- 世界书（Lorebook）— 关键词触发的世界观注入
- 拟真互动引擎 — 主动消息、情绪状态、拟人化时机

**社交与内容**
- 朋友圈 / Moments — AI 可发帖、点赞、评论
- 视觉小说模式、阅读模式
- 相册、视频聊天模拟

**工具与扩展**
- 音乐播放器（歌词、BGM、AI 推荐）
- 日程 / Planner（日历、任务、日记、角色日程）
- 线下模式（独立故事写作，预设 + 正则）
- 天气上下文注入、灵动岛通知
- MCP 工具调用支持
- 主题自定义（CSS 变量 + 深色模式）

## 快速开始

```bash
git clone https://github.com/ovo066/kktest.git
cd kktest
npm install
npm run dev
```

打开 http://localhost:5173/，在设置中填入你的 API 地址和密钥即可开始使用。

## 部署

```bash
npm run build   # 产物输出到 dist/
```

`dist/` 是纯静态文件，可部署到任意静态托管服务（Vercel、Netlify、Cloudflare Pages、Nginx 等）。

### 可选：Web Push 通知

如需 AI 在后台主动推送消息，参考 `.env.example` 配置 VAPID 密钥。

### 可选：Discord 访问验证

如需限制访问来源，可开启 Discord OAuth 门禁，参考 `.env.example` 中 `ACCESS_GUARD_*` 相关配置。

### 可选：Firebase 云同步

支持跨设备数据同步，参考 [docs/firebase-cloud-sync.md](docs/firebase-cloud-sync.md)。

### 可选：MCP 工具调用

支持让 AI 调用外部工具（搜索、代码执行等），参考 [docs/mcp-guide.md](docs/mcp-guide.md)。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3（Composition API + `<script setup>`） |
| 构建 | Vite |
| 状态管理 | Pinia |
| 路由 | Vue Router（hash history） |
| 持久化 | IndexedDB |
| 样式 | Tailwind CSS + CSS 变量主题 |
| 图标 | Phosphor Icons |

## 项目结构

```
src/
├── stores/           # Pinia 状态模块
├── composables/      # 组合式函数
│   ├── api/          # API 调用
│   ├── liveness/     # 拟真互动事件源
│   ├── storage/      # 持久化
│   └── imageGen/     # 图片生成
├── features/         # 功能模块
│   ├── chat/         # 聊天
│   ├── call/         # AI 通话
│   ├── music/        # 音乐播放器
│   ├── planner/      # 日程
│   ├── offline/      # 线下模式
│   ├── memory/       # 记忆管理
│   ├── meet/         # 视频聊天
│   ├── vn/           # 视觉小说
│   ├── moments/      # 朋友圈
│   └── reader/       # 阅读模式
├── views/            # 顶层页面
├── components/       # 通用组件
├── router/           # 路由配置
├── utils/            # 工具函数
└── data/             # 静态数据
```

## 许可证

[AGPL-3.0](LICENSE) + [Commons Clause](https://commonsclause.com/)

- ✅ 个人使用、学习、研究
- ✅ 二次修改（必须开源，保持相同许可证）
- ✅ SaaS 部署（必须开源源码）
- ❌ 禁止用本项目或其衍生版本进行商业盈利
