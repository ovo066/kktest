# 项目治理实施文档

更新时间：`2026-03-15`

本文档用于指导 `aichat-vite` 在未来 `1-3` 个迭代内的工程治理工作，目标不是“大重写”，而是在不破坏现有体验的前提下，持续降低复杂度、提升可维护性，并为后续功能演进留出余量。

配套文档：

- 工程边界与日常约束见 [docs/engineering-guardrails.md](engineering-guardrails.md)
- API 错误处理约定见 [docs/error-handling.md](error-handling.md)
- 主题自定义参考见 [public/theme-reference.md](../public/theme-reference.md)

## 0. 实施进展快照

截至 `2026-03-15`，本轮已完成以下治理推进：

- API 失败结果已统一收敛到 `src/composables/api/errors.js`，对齐 `success / error / code / context / retryable / traceId?` 模型
- `useApi`、`useVNApi`、`useMeetApi`、`useOfflineApi`、`useCallApi` 已接入共享错误映射，减少重复硬编码错误文案
- `README.md` 与 `src/features/README.md` 已修正结构漂移，公开入口与 `views/` 约定已对齐
- `tsconfig.typecheck.json` 已补 `meetResources/**/*.d.ts` 覆盖，`import.meta.env` 的契约缺口已收敛
- 本地质量闸门复核结果为：`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全通过

## 1. 背景判断

当前项目不是早期 demo，而是已经进入“中大型单页应用”的复杂度区间：

- 功能面较广：聊天、群聊、Moments、Planner、Offline、Reader、Meet、VN、Music、Call、Memory、Cloud Sync、Push、Theme 等
- 已具备一定分层基础：`features / composables / stores / utils / router / components`
- 已存在自动化护栏：热点文件上限、跨 feature 依赖限制、测试与 typecheck
- 主要问题不在“框架选错”，而在“局部热点持续堆积、规范和文档尚未完全收敛”

结论：

- 不建议进行推倒重来的架构重构
- 建议采用“治理型优化”路线，优先做质量闸门、热点拆分、错误处理统一、文档与契约收敛

## 2. 当前基线

以下数据基于 `2026-03-14` 本地检查结果。

### 2.1 规模

- 项目可见文件约 `558` 个，约 `4.55 MB`
- `src` 目录约 `499` 个文件，约 `3.07 MB`
- `src` 下 `.js/.vue/.ts/.css` 约 `87,293` 行

分布概况：

- `src/features`: `239` 文件 / `46,022` 行
- `src/composables`: `135` 文件 / `21,810` 行
- `src/stores`: `26` 文件 / `3,636` 行
- `src/utils`: `37` 文件 / `4,370` 行
- `src/components`: `29` 文件 / `4,297` 行
- `src/views`: `19` 文件 / `4,718` 行

### 2.2 质量闸门现状

- `npm run test`: 通过，`68` 个测试文件、`255` 个测试全绿
- `npm run typecheck`: 通过
- `npm run build`: 通过
- `npm run lint`: 未通过

当前 lint 阻塞项：

- [src/composables/useStorage.js:200](../src/composables/useStorage.js:200)
- [src/composables/useStorage.js:202](../src/composables/useStorage.js:202)

问题类型：

- `no-unsafe-finally`

### 2.3 热点文件现状

非测试文件中：

- 超过 `400` 行的文件：`57`
- 超过 `600` 行的文件：`19`
- 超过 `800` 行的文件：`5`

重点热点：

- [src/utils/stickerSearch.js](../src/utils/stickerSearch.js)
- [src/features/call/components/CallOverlay.vue](../src/features/call/components/CallOverlay.vue)
- [src/views/ThemeView.vue](../src/views/ThemeView.vue)
- [src/features/vn/views/VNPlayerView.vue](../src/features/vn/views/VNPlayerView.vue)
- [src/features/chat/components/ChatInput.vue](../src/features/chat/components/ChatInput.vue)
- [src/composables/storage/mediaSnapshot.js](../src/composables/storage/mediaSnapshot.js)
- [src/features/chat/views/ChatView.vue](../src/features/chat/views/ChatView.vue)
- [src/features/moments/views/MomentsView.vue](../src/features/moments/views/MomentsView.vue)
- [src/features/chat/composables/useMessageParser.js](../src/features/chat/composables/useMessageParser.js)
- [src/composables/useApi.js](../src/composables/useApi.js)

### 2.4 类型与契约现状

- `src` 中 `.js` 文件约 `310` 个
- `.vue` 文件约 `180` 个
- `.ts` 文件仅 `3` 个
- `.d.ts` 文件仅 `3` 个
- 带 `@ts-check` 的 JS 文件约 `27` 个

判断：

- 已经开始“局部类型化”，但仍处于早期阶段
- 更适合继续采用“核心模块优先契约化”的增量路线，而不是一次性全面迁移 TypeScript

### 2.5 文档与规范现状

已有文档：

- [docs/engineering-guardrails.md](engineering-guardrails.md)
- [docs/firebase-cloud-sync.md](firebase-cloud-sync.md)
- [docs/error-handling.md](error-handling.md)
- [public/theme-reference.md](../public/theme-reference.md)

已发现的轻微漂移：

- [README.md](../README.md) 提到 `src/stores/appStore.js`，但当前实际导出入口为 [src/stores/index.js](../src/stores/index.js)
- [src/features/README.md](../src/features/README.md) 中仍使用 `pages/` 描述，现状主要采用 `views/`

## 3. 治理目标

### 3.1 主目标

1. 恢复并守住质量闸门，保证 `lint / test / typecheck / build` 常态全绿。
2. 控制复杂度继续增长，避免新的“神文件”出现。
3. 统一关键横切规范：错误处理、常量、数据契约、文档入口。
4. 在不牺牲迭代速度的前提下，逐步提升类型安全。
5. 降低非核心能力对包体和维护成本的拖累。

### 3.2 非目标

以下事项不在本轮治理主目标内：

- 全量迁移 TypeScript
- 重写 Pinia、Router、Storage、Chat 主流程
- 追求全项目统一成纯领域驱动或完全分层架构
- 为“锦上添花”的能力引入重型依赖

## 4. 治理原则

1. 先修质量闸门，再谈新治理层。
2. 先拆热点职责，再补类型和测试，不反过来。
3. 共享能力优先抽到 `utils / composables / components/integrations`，避免 feature 间深层引用。
4. 文档必须服务于执行，避免写成空洞宣言。
5. 非核心体验能力以“足够好”为准，不为精确度过度付出包体和复杂度成本。

## 5. 工作流与责任边界

建议按以下工作流执行：

1. 每次治理任务只处理一类问题。
2. 提交前必须明确影响范围、回归风险、验收方式。
3. 涉及数据结构、导入导出、消息结构时，必须补契约说明或测试。
4. 超过 `600` 行的文件默认进入待拆清单。
5. 新功能开发若触达热点文件，应优先把新增逻辑落到新子模块，而不是继续向热点文件追加。

职责划分建议：

- `stores`: 状态容器、getter、少量 orchestration，不承载复杂 I/O 和长流程
- `composables`: 副作用、API 编排、存储控制、可复用流程
- `utils`: 纯函数、字符串和数据处理
- `features/*/views`: 页面壳与装配
- `features/*/components`: feature 私有展示组件
- `features/*/composables`: feature 私有流程逻辑
- `components/integrations`: 跨 feature UI 接入层

## 6. 治理实施计划

建议按 `4` 个阶段推进。

### 阶段 0：恢复基线

目标：先把现有质量门槛恢复到稳定状态。

任务：

1. 修复 [src/composables/useStorage.js](../src/composables/useStorage.js) 中的 `no-unsafe-finally`。
2. 将 `README` 和 feature 文档中的漂移内容校正到当前结构。
3. 确认 `main` 分支提交标准为：
   - `npm run lint`
   - `npm run test`
   - `npm run typecheck`
   - `npm run build`
4. 将“热点文件 > 600 行”的清单固定到治理待办中。

产出：

- 质量门槛恢复全绿
- 文档与现状一致
- 当前热点拆分名单

验收标准：

- 四个命令可本地稳定通过
- 文档中不再出现失效路径或过时结构说明

### 阶段 1：热点拆分与职责收敛

目标：把最影响维护效率的大文件继续拆成可测试的小模块。

优先级顺序建议：

1. [src/composables/useApi.js](../src/composables/useApi.js)
2. [src/features/chat/components/ChatInput.vue](../src/features/chat/components/ChatInput.vue)
3. [src/views/ThemeView.vue](../src/views/ThemeView.vue)
4. [src/features/call/components/CallOverlay.vue](../src/features/call/components/CallOverlay.vue)
5. [src/features/vn/views/VNPlayerView.vue](../src/features/vn/views/VNPlayerView.vue)
6. [src/features/chat/composables/useMessageParser.js](../src/features/chat/composables/useMessageParser.js)

拆分策略：

- 页面组件拆“页面壳 + 子面板 + 交互 composable”
- API 编排拆“提示词构造 / 请求执行 / 回复解析 / 错误映射 / usage 统计”
- 大型 parser 拆“词法处理 / 结构解析 / 后处理 / UI 适配”
- 共享逻辑优先迁往 `src/composables/api/`、`src/utils/` 或对应 feature 子目录

产出：

- 至少 `3-5` 个核心热点文件被显著缩小
- 新增 helper/composable 附带最小单测
- 护栏测试中的热点上限根据新目标同步更新

验收标准：

- 本阶段处理文件原则上下降到 `500-600` 行以内
- 新增逻辑不再直接回流到原热点文件
- 相关回归测试存在且可执行

### 阶段 2：横切规范统一

目标：处理最常见、最影响协作的一类工程不一致。

#### 2.1 错误处理统一

现状：

- [src/composables/useErrorHandler.js](../src/composables/useErrorHandler.js) 已存在
- 但 [src/composables/useApi.js](../src/composables/useApi.js)、`useVNApi.js`、`useMeetApi.js`、`useOfflineApi.js`、`useCallApi.js` 中仍存在重复错误文案和返回模型

实施方案：

1. 明确统一错误返回结构，例如：
   - `{ success: false, error, code?, context?, retryable? }`
2. 把通用错误文案和错误码迁到统一模块，例如：
   - `src/constants/errors.js`
   - 或 `src/composables/api/errors.js` 扩展
3. 将 API 模块的“配置缺失、无活动会话、空回复、网络失败、内容过滤”等场景统一映射。
4. UI 层只消费稳定错误结构，不直接拼接临时文案。

验收标准：

- 主要 API composable 的失败返回结构一致
- 常见提示语不再多处分散硬编码
- 新增 API 能力默认接入统一错误映射

#### 2.2 常量与阈值收敛

现状：

- 阈值、占位文案、路由顺序、提示语、按钮文本仍分散存在

实施方案：

1. 仅抽离“跨模块重复、会变、影响行为”的常量。
2. 不追求把所有字符串都抽到常量文件，避免过度设计。
3. 优先收敛以下类别：
   - API 错误文案与错误码
   - 路由顺序与导航规则
   - token/上下文预算阈值
   - 大文件硬上限配置
   - 存储与导入导出相关 key

建议落位：

- `src/constants/errors.js`
- `src/constants/navigation.js`
- `src/constants/tokens.js`
- `src/constants/storage.js`

验收标准：

- 重复使用的魔法字符串明显减少
- 行为阈值修改时不需要跨多个文件手改

#### 2.3 文档入口统一

本阶段需要补齐以下轻量文档：

1. `docs/ui-guidelines.md`
2. `docs/error-handling.md`
3. `docs/data-contracts.md`
4. `docs/feature-development-guide.md`

建议内容：

- `ui-guidelines`: 设计 token、间距、字号、按钮、列表、卡片、sheet、状态提示、浅色/深色规则
- `error-handling`: 错误模型、toast 策略、日志策略、可重试判断
- `data-contracts`: storage snapshot、message、moment、meet instruction、theme schema
- `feature-development-guide`: 新增 feature 目录规范、公开入口规范、测试要求、禁止事项

验收标准：

- 新人可以只看这些文档就开始做功能
- 常见争议不再靠口头传达

### 阶段 3：类型契约与包体治理

目标：在不打断开发节奏的前提下，逐步提升安全性并压缩非核心成本。

#### 3.1 类型策略

结论：

- 不建议立刻全量迁移 TypeScript
- 建议采用“双轨制”：
  - 新增核心模块优先 `TS`
  - 旧 JS 热点模块优先 `@ts-check + JSDoc + .d.ts`

优先接入类型的模块：

1. storage 相关新增模块
2. API usage / message schema / prompt schema
3. meet / vn / offline 的指令与资源结构
4. cloud sync / backup / import-export 的结果结构

执行要求：

- 新增复杂数据结构时，至少提供 JSDoc 类型或 `.d.ts` 契约
- 仅在“字段影响持久化、消息解析、资源生成、导入导出”时强制类型化
- 纯 UI 组件不强制立即迁移

验收标准：

- `tsconfig.typecheck.json` 覆盖范围逐步扩大
- 高风险数据流具备显式契约
- 类型化工作不阻塞功能迭代

#### 3.2 tokenizer 与 token 统计治理

这是本轮治理中的专项决策。

当前现状：

- 项目已实现基于模型家族切换 tokenizer 的能力，核心位于 [src/utils/tokenEstimate.js](../src/utils/tokenEstimate.js)
- 当前引入了 `@lenml/tokenizer-claude`、`@lenml/tokenizer-deepseek_v3`、`@lenml/tokenizer-gemini`、`gpt-tokenizer`
- 构建结果中 tokenizer vendor chunk 体积较大：
  - `vendor-tokenizer-gemini` 约 `11.1 MB`
  - `vendor-tokenizer-deepseek` 约 `4.1 MB`
  - `vendor-tokenizer-claude` 约 `1.75 MB`

业务判断：

- token 统计不是项目核心体验
- 项目核心价值是“模拟聊天、陪伴感、情感支持、交互氛围”
- tokenizer 只影响预算展示和部分上下文估算，对核心定位影响有限

因此，本项目对 tokenizer 的治理原则为：

1. 优先稳定和轻量，不追求每个模型都做到精确统计。
2. token 统计的目标从“精确计费级别”降为“足够稳定的预算估算”。
3. 若精确 tokenizer 造成明显包体、构建或维护成本，应优先降级到简化方案。

推荐实施方案：

方案 A，推荐默认采用：

- 保留 [src/utils/tokens.js](../src/utils/tokens.js) 的启发式估算作为基础能力
- 将 UI 文案统一改为“估算 tokens”或“上下文预算估算”，不暗示精确计费
- 对上下文裁剪、memory 注入等逻辑，优先依赖启发式预算
- 将模型专属 tokenizer 视为可选增强，而非默认依赖

方案 B，条件允许时再做：

- 仅为 OpenAI 家族保留较轻量的 tokenizer
- Claude / Gemini / DeepSeek 默认退回启发式估算
- 若未来确实需要更精确统计，再采用按需动态加载或独立 worker 化方案

不推荐当前继续投入的事项：

- 继续扩展更多模型家族的 tokenizer
- 为小众模型补充专属 token 规则
- 为仅用于展示的 token 数引入更重依赖

落地决策建议：

1. 将“模型专属 tokenizer 精度”从主路线降级为可选项。
2. 把 PRD/文档中的表述改成“token 估算”而不是“精确 token 统计”。
3. 若后续包体压力持续明显，优先移除 `@lenml` 系列 tokenizer，保留启发式方案。
4. 若继续保留现实现，必须明确它是“增强功能”，不是架构核心。

验收标准：

- 业务侧接受 token 为估算值
- 构建产物中的 tokenizer chunk 不再主导体积风险
- token 功能的维护复杂度与其业务价值匹配

## 7. 建议新增文档清单

本轮治理建议最终形成以下文档组合：

1. [docs/engineering-guardrails.md](engineering-guardrails.md)
   - 继续保留，负责工程边界和复杂度预算
2. [docs/governance-implementation-plan.md](governance-implementation-plan.md)
   - 本文档，负责阶段目标和执行路线
3. `docs/ui-guidelines.md`
   - 负责视觉和组件规范
4. [docs/error-handling.md](error-handling.md)
   - 负责错误模型和日志策略
5. `docs/data-contracts.md`
   - 负责核心数据结构契约
6. `docs/feature-development-guide.md`
   - 负责新增 feature 的目录与集成规范

## 8. UI 规范建议范围

当前仓库已有主题参考，但缺少“内部开发视角”的 UI 规范。建议新增 `docs/ui-guidelines.md`，至少覆盖以下内容：

1. 设计 token
   - 主色、副色、背景、边框、强调色、成功/警告/危险色
2. 字体层级
   - 页面标题、分组标题、正文、辅助文字、caption
3. 间距体系
   - `4 / 8 / 12 / 16 / 20 / 24 / 32`
4. 圆角与阴影
   - 卡片、sheet、输入框、浮层、头像
5. 组件规则
   - Cell、Button、Toggle、Modal、Sheet、Card、Message Bubble、List、Toolbar
6. 状态规则
   - loading、empty、error、disabled、skeleton
7. 浅色/深色模式
   - 变量来源、禁止直接写死颜色的场景
8. 交互约定
   - 返回、滑入、底部弹层、危险操作确认、toast 时长

这份文档的重点不是“做设计展示”，而是让后续页面不再各自发散。

## 9. 风险与应对

### 风险 1：治理工作被新功能挤压

应对：

- 每个功能迭代至少附带一个小治理任务
- 触达热点文件时要求顺手拆一层，不允许纯追加

### 风险 2：过早全面 TypeScript 化导致停滞

应对：

- 严格坚持“核心模块优先，UI 组件后置”
- 只在高风险数据流上强制契约化

### 风险 3：tokenizer 精度诉求继续扩大

应对：

- 先统一产品口径为“估算”
- 若需要高精度统计，只允许在明确定义的少数模型上保留

### 风险 4：文档写完没人遵守

应对：

- 把关键规则转成自动化护栏
- 在测试、lint、typecheck 或 PR 模板中体现

## 10. 执行优先级总结

高优先级：

1. 修复 lint 阻塞项，恢复全绿基线
2. 拆 [src/composables/useApi.js](../src/composables/useApi.js) 等核心热点
3. 统一错误处理和关键常量
4. 修正文档漂移，补治理入口文档

中优先级：

1. 扩大 `@ts-check` / `.d.ts` / TS 覆盖
2. 新增 UI 规范、数据契约、feature 开发指南
3. 收敛 tokenizer 方案，降低其架构权重

低优先级：

1. 进一步追求 token 统计精确度
2. 大规模视觉系统重做
3. 对现有稳定模块进行无收益重构

## 11. 一句话决策

本项目现在需要的是“持续治理”，不是“重新设计框架”。

治理的核心顺序应当是：

`质量闸门 -> 热点拆分 -> 横切规范统一 -> 类型契约扩大 -> 非核心能力降本`

其中 tokenizer 明确按“非核心增强能力”处理，必要时优先简化，而不是继续加码。







