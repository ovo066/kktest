# Features

该目录用于放“可独立扩展”的功能模块（例如：`forum`、`chat`、`wallet`、`overlays` 等）。

建议每个 feature 采用以下约定（按需创建即可）：
- `views/`：路由页面或页面壳
- `components/`：该 feature 专用组件
- `composables/`：该 feature 专用组合式函数
- `utils/`：该 feature 私有纯函数或解析 helper
- `routes.js`：导出该 feature 的路由表，供 `src/router/` 组合
- `index.js`：对外公开入口，供 `router` / `stores` / `utils` / `App` 等非 feature 模块接入
- `ui.js`：可选的 UI 公开入口，供跨 feature 集成组件引用

约定补充：
- Feature 外部不要 deep import 内部实现，统一走 `index.js` 或 `ui.js`
- 功能私有页面不要继续堆到 `src/views`
- 新增复杂流程优先拆到 `composables/` 或 `utils/`，不要直接堆回热点页面组件

当前聊天、Moments、Meet、Planner、Offline、Reader、VN 等模块都已按这套目录继续收敛，后续新增 App 也应保持同样模式。
