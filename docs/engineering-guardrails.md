# 工程维护规范

本规范用于约束本仓库后续的维护、重构和新增功能，目标是降低复杂度增长速度，避免局部模块继续演变成难以维护的“神文件”。

## 1. 分层边界

- `src/features/<feature>`：功能私有页面、组件、组合式逻辑、路由和测试。新增业务优先放这里。
- `src/components`：跨功能复用的 UI 组件，不承载业务流程。
- `src/composables`：跨功能复用的副作用逻辑和共享能力，例如 API、存储、图片生成、通知。
- `src/stores`：Pinia 状态容器，只保留状态、getter 和少量 orchestration，不堆叠长流程与重 I/O。
- `src/utils`：纯函数工具，避免依赖 store、router 或 DOM。

## 2. 新功能落位

新增功能默认使用以下结构：

```text
src/features/<feature>/
  views/
  components/
  composables/
  routes/
  utils/
  __tests__/ 或 *.test.js
```

规则：

- 功能私有页面不要继续堆到 `src/views`。
- 纯展示逻辑留在组件中，业务流程下沉到 composables 或 feature 内部 helper。
- 同一功能的 API 解析、资源持久化、文本构造等职责继续细分到子模块，不集中堆在单个入口文件。
- Feature 对外暴露统一走公开入口：`src/features/<feature>/index.js` 供路由和 JS API 使用，`src/features/<feature>/ui.js` 供外部嵌入组件使用；`router`、`App`、`stores`、`utils`、`integrations` 不直接 deep import feature 内部文件。

## 3. 复杂度预算

- 单文件建议控制在 `400` 行以内；超过 `600` 行必须优先考虑拆分。
- Vue 组件中，`template` 分支明显增多时，改用子组件分发，而不是继续堆 `v-if / v-else-if`。
- Store 出现“同时管理状态、持久化、网络请求、解析”的情况时，必须拆出独立模块。
- 新增逻辑优先加到现有子模块，不向热点文件直接追加大段逻辑。

## 4. 依赖规则

- Feature 之间避免直接互相引用内部实现；共享能力走 `src/composables`、`src/utils`、`src/stores` 的明确出口。
- Feature 外部模块如果必须接入某个 feature，只能依赖该 feature 的公开入口：`index.js` 或 `ui.js`。
- 组件不直接操作持久化细节；存储层变更统一经过 storage / repository 类模块。
- 文本 prompt、资源解析、媒体转换这类可复用逻辑，抽离成 helper 并补单测。
- 核心数据结构必须有显式契约。优先给 `storage snapshot`、`meet instruction` 这类高影响结构补 `@ts-check` + JSDoc / `.d.ts` 契约，而不是只靠约定记忆。

## 5. API 错误处理

- 共享 API 失败结果统一走 `src/composables/api/errors.js`，返回结构保持为 `success / error / code / context / retryable / traceId?`。
- 组件层默认直接消费 `result.error`，不要在多个页面里重复拼接 `"请求失败："` 一类临时文案。
- `context` 只保留定位问题所需的最小字段，例如 `feature`、`action`、`memberId`、`meetingId`。
- 网络、超时、限流、5xx 这类基础设施错误由共享 helper 统一映射，避免各 API composable 再各自硬编码。
- 聊天主链路继续保留 `traceId`；新增 API 能力若涉及复杂流式或多阶段请求，也应预留诊断字段。

## 6. 测试与质量闸门

- `main` 分支必须保持 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全通过。
- `npm run typecheck` 当前采用增量范围，只检查已显式契约化的核心模块；新增核心数据流接入 `@ts-check` 后，应同步纳入 `tsconfig.typecheck.json`。
- 修复 bug 时，优先补对应的最小回归测试。
- 对以下模块优先补契约测试：存储快照、消息解析、资源解析、时间/日程推断。
- 对热点文件的拆分，至少为新抽出的 helper 模块补单测。
- `npm run test` 内已包含架构护栏测试，用于拦截热点文件继续膨胀和新增跨 feature 内部依赖。

## 7. 提交流程

- PR 或提交只做一类事情：修 bug、拆模块、补测试、调样式不要混在一起。
- 提交前检查是否引入新的超大文件、跨 feature 依赖、未测试的副作用逻辑。
- 修改存储结构、消息结构、资源结构时，需要说明兼容策略和回归风险。

## 8. 当前优先重构对象

- `src/composables/useStorage.js`
- `src/features/chat/components/ChatMessageBlock.vue`
- `src/features/chat/views/ChatView.vue`
- `src/features/meet/composables/useMeetResources.js`
- `src/features/moments/views/MomentsView.vue`

首轮目标不是“大重写”，而是持续把职责搬进更小、可测试、可复用的模块中。

## 9. 重构状态

截至 `2026-03-14`，已完成的样板重构如下：

- `src/composables/useStorage.js`
  - 已从 `889` 行降到约 `236` 行
  - 已拆出 `backupTransport`、`contactMessagePersistence`、`loadController`、`saveController`、`persistenceController`、`storageRuntime`
- `src/features/chat/components/ChatMessageBlock.vue`
  - 已从 `1093` 行降到约 `174` 行
  - 已拆成 `message-blocks/` 下的子组件分发
- `src/features/chat/views/ChatView.vue`
  - 已引入 `useChatShellState` 承接页面壳状态、路由同步和保存包装
  - 已从约 `839` 行降到约 `798` 行
- `src/features/meet/composables/useMeetResources.js`
  - 已继续拆出 `sourceResolver`，承接资源来源解析、音频选择与 Safebooru 拉取
  - 已从 `852` 行降到约 `507` 行
- `src/features/meet/composables/meetPlayer/useMeetPlayerMedia.js`
  - 已拆成 `useMeetPlayerAudio` 与 `useMeetPlayerVisuals`，分别承接音频控制和视觉资源指令
  - 已从 `402` 行降到约 `52` 行
- `src/features/meet/composables/meetPlayer/useMeetPlayerRuntime.js`
  - 已拆出 `createMeetInstructionPlayer`，承接指令播放主循环与等待/推进逻辑
  - 已从 `273` 行降到约 `170` 行
- `storage snapshot` / `meet instruction`
  - 已补 `storageContracts.d.ts` 与 `meetInstructionContracts.d.ts`
  - `stateBridge`、`appData`、`saveController`、`loadController`、`backupTransport`、`contactMessagePersistence`、`localCompactBackup`、`useMeetParser`、`useMeetApi` 已接入 `@ts-check` / JSDoc 契约引用
  - `useStorage`、`storageRuntime`、`persistenceController` 已继续接入契约，`npm run typecheck` 当前已覆盖 storage 核心模块、`useMeetParser` / `useMeetApi` 以及 `meetPlayer` 运行时 / media 链路
  - `useMeetPlayerShell` 已接入 `@ts-check` + `MeetPlayerShellOptions` 契约
  - `meetResources/` 全部子模块（`utils`、`resourcePrompts`、`characterMeta`、`resourceStore`、`generationQueue`、`sourceResolver`、`sourceHelpers`、`spriteCutout`）已接入 `@ts-check`，纳入 `tsconfig.typecheck.json`
- 异步 vendor chunk 精简
  - `segmentit`（3.6 MB）已替换为浏览器内置 `Intl.Segmenter`，零依赖
  - 异步 vendor 总体积从约 `20.7 MB` 降到约 `17.1 MB`
- `src/features/meet/views/MeetPlayerView.vue`
  - 已将菜单弹层、开始遮罩和页面壳交互下沉到 `MeetPlayerMenuSheet`、`MeetPlayerStartOverlay`、`useMeetPlayerShell`
  - 已从 `662` 行降到约 `347` 行
- `src/features/moments/views/MomentsView.vue`
  - 已将 AI 生成链路与资料编辑动作下沉到 `src/features/moments/`
  - 已从 `1135` 行降到约 `816` 行

当前质量闸门目标：

- `npm run lint` 保持全绿
- `npm run typecheck` 保持全绿
- `npm run test` 保持全绿
- `npm run build` 保持可构建

当前主要余项：

- 继续避免 `useStorage.js` 回涨，新增逻辑优先落到 `storage/` 子模块
- 对后续热点模块延续”先拆职责，再补测试”的节奏
- 继续保持跨 feature 白名单为 `0`，新增集成需求优先走 `src/components/integrations` 或共享 composable / utils
- 新增 feature 对外接入时，先补公开入口：路由/JS API 走 `index.js`，可嵌入 UI 走 `ui.js`

## 10. 自动化护栏

当前已落地的自动化护栏位于 [src/architecture/guardrails.test.js](../src/architecture/guardrails.test.js)，在 `npm run test` 中自动执行。

已启用的检查：

- 热点文件硬上限：
  - `src/composables/useStorage.js <= 260`
  - `src/features/chat/components/ChatMessageBlock.vue <= 220`
  - `src/features/chat/views/ChatView.vue <= 820`
  - `src/features/meet/composables/useMeetResources.js <= 560`
  - `src/features/meet/composables/meetPlayer/useMeetPlayerMedia.js <= 120`
  - `src/features/meet/composables/meetPlayer/useMeetPlayerRuntime.js <= 220`
  - `src/features/meet/views/MeetPlayerView.vue <= 420`
  - `src/features/moments/views/MomentsView.vue <= 860`
- Feature 边界：
  - 禁止新增未登记的跨 feature 内部引用
  - 现有存量跨 feature 引用通过白名单显式记录，后续应只减少，不应增加
  - Feature 外部模块只允许通过 `src/features/<feature>/index.js` 或 `src/features/<feature>/ui.js` 接入公开能力

最近一次收敛：

- 共享 ST 预设解析已迁到 `src/utils/stPreset.js`
- 共享 planner action / 时间解析已迁到 `src/utils/plannerAssistantActions.js` 与 `src/utils/taskDateTime.js`
- 共享音乐卡片已迁到 `src/components/cards/MusicCard.vue`
- 共享语音播放已迁到 `src/composables/useVoicePlayback.js`
- 共享 TTS 分段已迁到 `src/utils/ttsSegmentation.js`
- 共享离线会话联动已迁到 `src/utils/offlineSessionLinkage.js`
- 共享阅读解析已迁到 `src/composables/useBookParser.js` 与 `src/utils/epubParser.js`
- 共享阅读进度存取已迁到 `src/composables/useReadingProgress.js`
- 共享角色立绘已迁到 `src/components/media/VNSprite.vue`
- `MomentsView` 的 AI 生成链路与资料编辑已迁到 `src/features/moments/`
- `useMeetResources` 的资源来源解析与音频选择已迁到 `src/features/meet/composables/meetResources/sourceResolver.js`
- `useMeetPlayerMedia` 已拆成 `src/features/meet/composables/meetPlayer/useMeetPlayerAudio.js` 与 `src/features/meet/composables/meetPlayer/useMeetPlayerVisuals.js`
- `useMeetPlayerRuntime` 的主循环已迁到 `src/features/meet/composables/meetPlayer/createMeetInstructionPlayer.js`
- `storage snapshot` 与 `meet instruction` 已收敛为显式契约，避免后续改动继续依赖隐式字段约定
- `storage` 控制器层与导入导出链路已接入显式 pack / hydrate / backup result 契约，避免后续子模块继续靠临时对象拼接
- `meet` 解析器与 API 消息构造已对齐显式指令 / message 契约，并纳入 `npm run typecheck`
- `meetPlayer` 已补 `meetPlayerContracts.d.ts`，运行时、指令执行器、音频、视觉与 media 聚合层已纳入 `npm run typecheck`
- `MeetPlayerView` 的菜单弹层、开始遮罩与页面壳交互已迁到 `MeetPlayerMenuSheet`、`MeetPlayerStartOverlay` 与 `useMeetPlayerShell`
- 聊天页跨域 UI 集成已收敛到 `src/components/integrations/chat/`
- `router`、`App`、`stores`、`utils`、`integrations` 对 feature 的访问已统一收敛到 `index.js` / `ui.js` 公开入口
- 架构护栏跨 feature 白名单已从 `14` 条降到 `0` 条

