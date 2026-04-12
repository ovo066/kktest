# 代码优化治理方案

更新时间：2026-03-27

## 背景

本仓库当前的主要问题不是“完全没有分层”，而是已经进入“层次很多，但同一份规则在多处重复”的阶段。继续在现有模式上追加功能，短期能跑，长期会持续放大以下成本：

- 新增一个字段或开关，需要在默认值、store、snapshot、normalize、adapter 多处同步修改。
- 同类 helper 在不同 feature / store / composable 内各写一份，小改动容易漏改。
- 兼容和兜底逻辑长期停留在主链路，启动和保存路径越来越重。
- 聊天和存储等主链路已经出现新的“总装层”，复杂度会继续回流。

本方案的目标不是“大重写”，而是用持续、小步、可验证的方式把复杂度压回去。

## 治理目标

1. 单一真相源：默认值、normalize 规则、snapshot 字段不再多处散落。
2. 减少样板代码：重复 proxy、clamp、normalize 等 helper 收敛到共享模块。
3. 降低主链路复杂度：聊天请求链路、存储启动链路改为“装配薄、步骤清晰”。
4. 兼容逻辑可退役：所有 legacy / fallback 逻辑必须有来源、边界和移除条件。
5. 每次重构都可验证：优先做低风险、高收益、可用构建或测试验证的改动。

## 约束

- 不做一次性大重写。
- 不为了“看起来优雅”重排业务目录。
- 任何结构调整必须优先保证历史数据兼容。
- 新增共享模块优先放在 `src/utils`、`src/composables` 这类中立层，避免跨 feature 深引用。

## 识别标准

出现以下情况，默认视为需要治理：

- 同一个字段名在 3 个及以上文件内重复定义规则。
- 同一类 helper 在 2 个及以上位置出现近似复制实现。
- 一个函数同时承担“拼装参数 + 调 API + 解析结果 + UI 收尾 + 兼容处理”。
- 兼容旧结构的代码进入主启动路径、保存路径、聊天主链路，且没有退役计划。
- 只改一处小需求，却需要触碰 4 个以上文件才能保持一致。

## 分期计划

### Phase 1：去重与收口

目标：先消灭最明显的“重复造轮子”和“几行事写几十行”的问题。

执行项：

- 抽共享 proxy helper，替换 `storageStoreAdapter`、`useChatViewStore` 内重复实现。
- 抽共享图片生成参数归一化 helper，避免 chat 和 VN 各写一套。
- 新增共享 helper 时，原位置只保留薄封装或 re-export，不继续复制实现。

验收：

- 至少消除 2 处重复实现。
- 不新增跨 feature 深引用。
- `npm run build` 通过。

### Phase 2：设置 schema 单一来源

目标：把 settings 的默认值、归一化、snapshot 字段定义收敛到一处描述。

执行项：

- 建立统一 settings schema 定义，描述字段名、默认值、normalize 规则、是否持久化。
- `settings store`、`storage normalize`、`snapshot build/apply` 从 schema 生成或消费。
- 删除多处手写字段列表。

验收：

- 新增一个 settings 字段时，只需要改 1 个主定义文件和最多 1 个业务接线点。
- `appData.js`、`storageModules.js`、`settings.js` 中的字段平铺列表明显减少。

### Phase 3：主链路瘦身

目标：把“总装层”变薄，避免新的神文件继续形成。

执行项：

- 将 `useApi` 收敛为统一 request pipeline，单聊/群聊只保留 mode-specific 差异。
- 将 `ChatView` 继续下沉事件编排和跨域集成桥接。
- 将 `useStorage` 的模块级全局状态显式化，减少隐藏单例行为。

验收：

- `useApi` 中单聊/群单/群多共享流程改为共用 builder / executor。
- `ChatView.vue` 只保留页面装配，不继续新增业务细节。

### Phase 4：兼容逻辑退役

目标：把“永远挂着的 fallback”变成“可统计、可移除”的迁移逻辑。

执行项：

- 为 legacy localStorage、旧 STT 字段、旧离线结构等兼容项建立清单。
- 区分“启动迁移一次”与“长期运行期兜底”。
- 能迁移落盘的兼容逻辑，迁移成功后退出主路径。

验收：

- 兼容项有来源、引入时间、移除条件。
- 启动主路径不再层层叠加 fallback 分支。

## 执行节奏

- 每次只做一类治理动作，不混入 UI 样式调整和新功能。
- 每个阶段先做低风险收敛，再做结构性改造。
- 每完成一轮，更新本文件中的“执行记录”。

## 本轮执行记录

### 2026-03-25

计划执行 Phase 1：

- 抽共享 proxy helper。
- 抽共享图片生成参数归一化 helper。
- 保持构建可通过。

后续按 Phase 2 继续推进 settings schema 单一来源。

已完成：

- 新增 `src/utils/objectProxy.js`，收敛对象代理样板代码。
- `src/composables/storage/storageStoreAdapter.js` 与 `src/features/chat/composables/useChatViewStore.js` 已改用共享 proxy helper。
- 新增 `src/composables/imageGen/generationPrefs.js`，作为图片生成参数归一化的共享来源。
- `src/features/vn/utils/generationPrefs.js` 已改为 re-export，避免继续维护两份实现。
- `src/features/chat/composables/useChatImageTokens.js` 已复用共享 generation prefs helper，去掉 chat 内部重复实现。
- 新增 `src/utils/presetNormalization.js`，收敛 preset 数值归一化与 prompt entry 归一化逻辑，避免 `meet`、`offline`、`stPreset` 各自重复维护一套近似 helper。
- `src/stores/meet.js`、`src/stores/offline.js`、`src/utils/stPreset.js` 已改为复用共享 preset normalization helper，删除重复的 `clampNumber`、`normalizePromptEntries` 与可选整数解析实现。

继续完成 Phase 2：

- 新增 `src/stores/settingsSchema.js`，集中维护 settings 状态字段、snapshot 字段和 normalize 规则。
- `src/stores/settings.js` 已改为基于 schema 生成 general settings state，去掉大段手写 `ref(...)` 平铺代码。
- `src/composables/storage/storageModules.js` 与 `src/composables/storage/appData.js` 已改为消费统一 schema，删除重复的 snapshot 字段定义和大段逐项归一化样板。
- `src/composables/storage/storageStoreAdapter.js` 已改为复用统一 settings proxy 字段列表，避免存储适配层再维护一份手写清单。
- 新增 `src/stores/settingsSchema.test.js`，把“默认值工厂 / schema 字段 / 持久化覆盖范围”对齐关系变成测试护栏，防止后续再回到多处散落维护。

继续推进 Phase 3：

- 新增 `src/features/chat/chatAsyncComponents.js`，把 `ChatView` 内一串异步组件注册移出页面脚本，减少视图装配层噪音。
- 新增 `src/features/chat/composables/useChatSnoopConsent.js`，把 snoop 打开条件和跳转逻辑从 `ChatView` 中抽离。
- 新增 `src/features/chat/composables/useChatContextActions.js`，收口右键菜单、多选入口、收藏动作、通话历史弹层等页面胶水逻辑。
- `src/features/chat/views/ChatView.vue` 已从 840 行降到 816 行，重新回到架构 guardrail 上限内。
- 新增 `src/utils/renderRichText.js` 与 `src/composables/snoop/shared.js` / `src/composables/snoopConsent.js`，把 snoop 同意弹窗依赖的富文本渲染和同意请求逻辑转移到中立共享层。
- `src/features/chat/components/SnoopConsentDialog.vue` 已迁入 chat feature；旧的 `src/features/snoop/components/SnoopConsentDialog.vue` 已删除，消除 chat -> snoop 与 snoop -> reader 这条跨 feature 依赖链。
- `src/features/snoop/composables/useSnoopGenerate.js` 已改为复用共享 snoop helper，避免新中立层和 snoop feature 各自再维护一套 API 请求与角色上下文逻辑。
- 新增 `src/composables/api/requestPlan.js`，把单聊、群聊单 API、群聊多 API 共有的 request plan 与消息拼装流程抽成统一 builder。
- `src/composables/useApi.js` 已改为复用统一 request builder，三条链路不再各自重复维护 prompt 组合、history 拼装和 post-instruction 追加逻辑。
- 新增 `src/composables/api/requestPlan.test.js`，给 request builder 加上独立测试护栏，防止后续又在 `useApi` 内复制出第二套、第三套拼装流程。
- `src/architecture/guardrails.test.js` 已新增 `src/composables/useApi.js` 的 720 行硬上限，先把新的高风险主链路纳入增长护栏，避免 request pipeline 收口后又继续回流到单文件膨胀。
- 新增 `src/composables/storage/storageSessionState.js`，把 `useStorage` 里的延迟保存标记和共享 composable API 单例状态移出主文件，避免 storage 入口继续堆积隐藏模块状态。
- `src/composables/useStorage.js` 已改为消费显式 session state 模块，外部行为保持不变，文件长度压回 259 行，继续满足架构 guardrail。
- 新增 `src/composables/storage/storageSessionState.test.js`，把“延迟保存一次性消费”和“共享 API 显式缓存”变成可回归验证的护栏。

继续推进 Phase 4：

- `src/composables/storage/storageModules.js` 已补齐联系人 `prompt` 的存储兼容默认化：普通联系人在快照回放后若 `prompt` 缺失或为空，会回落到 `DEFAULT_PROMPT`；群聊仍保持原行为。
- 已收回 `src/composables/storage/stateBridge.test.js` 的历史失败，避免“加载旧数据后联系人 prompt 为空”继续留在主路径。

本轮验证：

- `npm run lint` 通过，保留 3 个与本轮治理无关的历史 warning。
- `npm run build` 通过。
- 定向测试通过：
  - `src/stores/settingsSchema.test.js`
  - `src/composables/storage/appData.test.js`
  - `src/composables/storage/stateBridge.test.js`
  - `src/composables/storage/storageSessionState.test.js`
  - `src/features/chat/composables/useChatViewStore.test.js`
  - `src/architecture/guardrails.test.js`
  - `src/composables/api/requestPlan.test.js`
  - `src/utils/presetNormalization.test.js`
  - `src/utils/stPreset.test.js`
- 当前本轮治理范围内未发现新的失败项；剩余 warning 为历史清理项，可后续单独处理。

## 下一轮优化规划（2026-03-26）

本轮基于当前仓库实测重新校准了一遍热点，而不是直接照搬外部评估结论。结论是：问题方向基本对，但部分数字已经过期，且有些治理已经做了一半，下一轮应该从“继续收口”进入“结构性拆分”。

### 现状校准

- `src/composables/useApi.js` 当前为 `656` 行，不是 `717` 行；并且已经抽出 `src/composables/api/requestPlan.js` 与 `src/composables/api/messageHistoryBuilder.js`，说明“请求拼装”已部分下沉，但最终 orchestration 仍然堆在单文件内。
- `src/composables/storage/` 当前为 `34` 个文件、约 `6453` 行，不是 `33` 个文件、`6880` 行；复杂度依然偏高，热点已集中到：
  - `src/composables/storage/mediaSnapshot.js` `902` 行
  - `src/composables/storage/mediaSnapshotSchemas.js` `658` 行
  - `src/composables/storage/appData.js` `574` 行
  - `src/composables/storage/storageModules.js` `515` 行
  - `src/composables/storage/saveController.js` `385` 行
- 持久化链路已经不再是“只改 `snapshotAppData()` 和 `loadAll()`”的旧状态；现在已有 `STORAGE_SNAPSHOT_MODULES`、`STORAGE_APPLY_MODULES` 和 `settingsSchema`。真正的剩余问题是：
  - `defaultAppData()`
  - `normalizeLoadedAppData()`
  - `STORAGE_SNAPSHOT_MODULES`
  - `STORAGE_APPLY_MODULES`
  这四处仍然没有完全收敛成单一来源。
- 重复代码问题仍然成立，但也要按“已解决一部分”处理：
  - `formatRelativeTime()` 仍在 `src/utils/relativeTime.js` 与 `src/composables/useMomentsContext.js` 重复
  - `normalizeSearchText()` 当前确认存在于 `src/features/chat/composables/useChatSearch.js` 与 `src/composables/useHistorySearch.js`
  - 消息解析选项对象仍在 `src/utils/favorites.js` 与 `src/features/chat/composables/useChatSearch.js` 各维护一份
  - `clampNumber()` 在 preset 相关模块已经统一，但在 `memory`、`imageGen`、`meetResources`、`voicePlayback`、`api/usage` 等领域仍各有实现，属于“跨领域重复”，不宜一次性硬并
- `src/stores/settings.js` 当前仅 `90` 行，但本质仍是 façade + proxy：对 `theme / voice / liveness / cloudSync` 四个子 store 做转发，间接层依旧存在。
- 大组件问题仍然存在，但优先级需要重新排序：
  - `src/features/call/components/CallOverlay.vue` `887` 行，仍是高优先级拆分对象
  - `src/features/chat/views/ChatView.vue` 已降到 `760` 行，且在 guardrail 以内；问题已从“纯行数超限”转为“55 个 import 的装配中心”
  - 当前仓库中超过 `500` 行的非测试文件为 `40` 个，不是 `55` 个

### 下一轮优化目标

1. 把“已做了一半的收口”推进到真正的单一来源，不让复杂度停在半拆不拆的状态。
2. 优先解决主链路上的 orchestration 膨胀，而不是继续在外围追加 helper。
3. 对存储层避免再加新抽象，改为减少重复入口、减少字段对齐点、减少隐式迁移。
4. 对 settings 保持对外 API 尽量稳定，但逐步移除没有业务价值的 proxy 层。
5. 组件拆分继续以“壳层更薄、交互更可测”为目标，不为拆分而拆分。

### 分阶段计划

#### Phase A：低风险去重与共享运行器

目标：先把后续重构反复会碰到的基础重复项收掉，降低第二阶段改动面。

执行项：

- 抽 `src/utils/searchText.js`，统一 `normalizeSearchText()`，由 chat search / history search 共同消费。
- 让 `src/composables/useMomentsContext.js` 改为复用 `src/utils/relativeTime.js`。
- 抽消息内容搜索/收藏共享 helper，至少收敛：
  - 消息解析 options
  - part -> searchable text
  - part -> favorite snippet/detail text
- 抽共享 OpenAI compat 流式请求运行器，统一以下共性步骤：
  - 配置校验
  - 请求构造
  - `fetchOpenAICompat`
  - 流式消费
  - error/result 映射

优先覆盖模块：

- `src/composables/useApi.js`
- `src/features/offline/composables/useOfflineApi.js`
- `src/composables/useVNApi.js`
- `src/features/reader/composables/useReaderAI.js`

验收：

- 至少消灭 `3` 处确认重复实现。
- 不引入新的跨 feature deep import。
- 为共享 helper 补最小单测。

#### Phase A 执行记录（2026-03-26 第二批）

已完成：

- 新增 `src/composables/api/openaiCompatTextStream.js`，收敛 OpenAI compat 文本流请求的公共步骤：
  - `fetchOpenAICompat`
  - `readOpenAICompatError`
  - 流式消费
  - 累积快照 / 重复 chunk 去重
  - 统一返回 `text / streamResult / url`
- 新增 `src/composables/api/openaiCompatTextStream.test.js`，为共享运行器补齐最小护栏，覆盖：
  - 累积快照处理
  - 重复 chunk 抑制
  - 错误状态元数据挂载
- `src/features/offline/composables/useOfflineApi.js` 已改为复用共享文本流运行器，删除 `sendMessage()` 与 `generateOpening()` 中两段重复的 fetch + consume + 文本拼接逻辑；同时把 `stats / finishReason / truncated` 收敛到本地 helper。
- `src/composables/useVNApi.js` 已改为复用共享文本流运行器，`callVNApi()` 不再手写一套流式拼接与 `onStream(fullText)` 更新逻辑。
- `src/features/reader/composables/useReaderAI.js` 已从原始 `fetch(url + '/chat/completions')` 改为复用 OpenAI compat 请求链路，避免 reader 单独维护一套 headers / 错误处理 / 流式拼接逻辑。
- `src/composables/api/errors.js` 已补充基于 `error.status` 的错误码推断，不再强依赖 message 内是否手写了 `HTTP 429 / 500` 之类文本。

本轮暂不纳入：

- `src/composables/useApi.js` 主聊天 orchestration 仍保持现状，避免把 assistant lifecycle、fallback 和主消息装配一起卷入这次低风险收口。
- `useMeetApi`、`useCallApi`、`useReaderQuickAction` 仍保留原有流式实现，后续可在同一共享运行器上继续收口。

本轮验证：

- 定向测试通过：
  - `src/composables/api/openaiCompatTextStream.test.js`
  - `src/composables/api/errors.test.js`
  - `src/utils/messageContentParts.test.js`
  - `src/utils/favorites.test.js`
  - `src/features/chat/composables/useChatSearch.test.js`
  - `src/composables/useHistorySearch.test.js`
  - `src/utils/relativeTime.test.js`
- `npm run lint` 通过，保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。
#### Phase B：聊天 API 编排器拆分

目标：把 `useApi.js` 从“大总管”降为装配入口，单聊 / 群聊单 API / 群聊多 API 拆成独立 orchestrator。

建议结构：

```text
src/composables/api/chat/
  sharedChatExecutor.js
  directChatOrchestrator.js
  groupSingleChatOrchestrator.js
  groupMultiChatOrchestrator.js
  chatSideEffects.js
```

执行项：

- `useApi.js` 仅保留 store 接线、公共依赖注入、对外导出。
- 单聊、群单、群多各自迁入独立 orchestrator。
- 将以下共性能力继续从 orchestrator 中抽薄：
  - assistant message lifecycle
  - stream chunk batching
  - forum / planner / image token display cleanup
  - failure/result 构造
  - liveness 只读判定
- 补三种模式各自的定向回归测试，覆盖：
  - 配置缺失
  - streaming 成功
  - 空回复/内容过滤
  - 群聊 reply 解析

验收：

- `src/composables/useApi.js` 目标压到 `420` 行以内。
- 三种模式的主流程不再并排堆在同一文件中。
- chat 主链路相关测试可独立验证，而不是只能通过页面回归发现问题。

#### Phase B 执行记录（2026-03-26 第一批）

已完成：

- 新增 `src/composables/api/chat/directChatOrchestrator.js`，承接单聊主流程，包括 liveness 只读拦截、request plan 构造、流式执行和最终 assistant reply 收尾。
- 新增 `src/composables/api/chat/groupSingleChatOrchestrator.js`，承接群聊单 API 模式，保留群回复拆分、forum-only 占位和 reply 引用解析逻辑。
- 新增 `src/composables/api/chat/groupMultiChatOrchestrator.js`，承接群聊多 API 模式，保留按成员配置请求、前缀清理和 forum / interaction 收尾逻辑。
- 新增 `src/composables/api/chat/groupChatOrchestrator.js`，把 group mode 分发从 `useApi.js` 中移出。
- `src/composables/useApi.js` 已从 `656` 行压到 `304` 行，主文件现在只保留：
  - store / prompt 依赖装配
  - API 图片 URL 解析与 display cleanup 这类公共 helper
  - `fetchModels()`
  - orchestration context 注入与对外导出
- `src/architecture/guardrails.test.js` 已将 `src/composables/useApi.js` 的硬上限从 `720` 行收紧到 `340` 行，防止编排逻辑重新回流到壳层。
- 新增 `src/composables/api/chat/groupChatOrchestrator.test.js`，为 group mode 分发补最小护栏。

本轮暂不纳入：

- `sharedChatExecutor.js` 与 `chatSideEffects.js` 这类更细粒度抽象暂未继续下沉；本轮先完成“按模式拆文件”，避免在同一轮里同时重组执行器和副作用层。
- `useMeetApi`、`useCallApi` 等相邻链路暂不并入本轮 chat orchestrator 拆分。

本轮验证：

- 定向测试通过：
  - `src/composables/api/chat/groupChatOrchestrator.test.js`
  - `src/composables/api/requestPlan.test.js`
  - `src/composables/api/openaiCompatTextStream.test.js`
  - `src/composables/api/errors.test.js`
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。
#### Phase B 执行记录（2026-03-26 第二批）

已完成：

- 新增 `src/composables/api/chat/sharedChatExecutor.js`，把 direct / group-single / group-multi 三条链路共有的：
  - typing 状态切换
  - `executeStreamedAssistantRequest()`
  - 失败收尾与错误消息回填
  收敛为统一执行框架。
- 新增 `src/composables/api/chat/chatSideEffects.js`，把聊天主链路里重复的 side effect 收到共享 helper：
  - read-only 抑制时的已读 + toast + typing 清理
  - assistant reply 成功后的已读回执 + 收到消息音效
- `src/composables/api/chat/directChatOrchestrator.js` 已改为复用共享执行器和 side effects helper，保留业务特有的 liveness 判定和单聊 reply finalize。
- `src/composables/api/chat/groupSingleChatOrchestrator.js` 已改为复用共享执行器，文件只保留群聊单 API 模式真正特有的 reply 拆分与 forum-only 处理。
- `src/composables/api/chat/groupMultiChatOrchestrator.js` 已改为复用共享执行器和 side effects helper，文件只保留成员级 request plan 与 finalize 差异。
- `src/architecture/guardrails.test.js` 已新增三个 orchestrator 的硬上限：
  - `directChatOrchestrator.js` `170`
  - `groupSingleChatOrchestrator.js` `200`
  - `groupMultiChatOrchestrator.js` `170`
- 新增共享层单测：
  - `src/composables/api/chat/sharedChatExecutor.test.js`
  - `src/composables/api/chat/chatSideEffects.test.js`

当前结果：

- `directChatOrchestrator.js` 当前 `152` 行
- `groupSingleChatOrchestrator.js` 当前 `175` 行
- `groupMultiChatOrchestrator.js` 当前 `144` 行
- `sharedChatExecutor.js` 当前 `55` 行
- `chatSideEffects.js` 当前 `33` 行

本轮验证：

- 定向测试通过：
  - `src/composables/api/chat/sharedChatExecutor.test.js`
  - `src/composables/api/chat/chatSideEffects.test.js`
  - `src/composables/api/chat/groupChatOrchestrator.test.js`
  - `src/composables/api/requestPlan.test.js`
  - `src/composables/api/openaiCompatTextStream.test.js`
  - `src/composables/api/errors.test.js`
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。
#### Phase C：存储单一来源与迁移注册

目标：把“默认值 / normalize / snapshot / apply / migration”从多入口对齐，收敛为模块化注册。

现状判断：

- `stateBridge.js` 已有 `STORAGE_SNAPSHOT_MODULES` / `STORAGE_APPLY_MODULES`
- `settings` 已有 `settingsSchema`
- 真正未完成的是 `appData.js` 仍承担过多默认值、兼容与 normalize 职责

执行项：

- 让每个 storage module 同时声明：
  - `defaults`
  - `snapshot`
  - `apply`
  - `normalize`
  - `migrations`
- 由注册表生成 `defaultAppData()`，不再手工平铺整份 app data。
- `normalizeLoadedAppData()` 收敛为：
  - envelope 校验
  - module normalize
  - versioned migration runner
- 迁移改为显式注册，至少区分：
  - 启动期一次性迁移
  - 运行期长期兼容
- 保留 `context.needsSave` 机制，用于一次性迁移后自动落盘。

优先迁移的模块顺序：

1. `settings`
2. `forum`
3. `reader`
4. `offline`
5. `resources`

验收：

- 新增持久化字段时，只需要改对应 storage module，而不是同时修改 `defaultAppData()`、`normalizeLoadedAppData()` 与 snapshot/apply 多处平铺代码。
- 历史兼容逻辑有来源、版本和移除条件。
- `appData.js` 目标压到 `300` 行以内。

#### Phase C 执行记录（2026-03-26 第一批）

已完成：

- 新增 `src/composables/storage/appDataModules.js`，把 `appData` 的默认值和加载归一化改成按模块注册。
- `src/composables/storage/appData.js` 已改为薄装配入口，只保留默认值、归一化、用户数据判断和导出脱敏。
- 新增 `src/composables/storage/lorebookDefaults.js`，把 lorebook 预设补齐与 legacy 升级逻辑从 `appData.js` 中拆出。
- `src/composables/storage/storageModules.js` 已去掉对 `defaultAppData()` 的反向依赖，并让 `core/home` 的 contacts/theme 分组更一致。
- `src/composables/storage/appData.test.js` 已补 storage module id 对齐护栏，避免 defaults/normalize 与 snapshot/apply 再次漂移。
- `src/architecture/guardrails.test.js` 已新增 `src/composables/storage/appData.js <= 300` 的硬上限。

当前结果：

- `src/composables/storage/appData.js` 已从 `622` 行压到 `149` 行。
- `defaultAppData()` 不再手工平铺整份快照结构。
- `normalizeLoadedAppData()` 不再集中堆放各 feature 的兼容与兜底分支。

本轮验证：

- 定向测试通过：
  - `src/composables/storage/appData.test.js`
  - `src/composables/storage/stateBridge.test.js`
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，仍保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。

下一步：

- 继续 Phase C 第二批，把一次性迁移从 normalize/apply 零散分支收敛成显式 migration runner。
- 优先处理 `forum` 与旧字段兼容的“迁移后自动落盘”注册化。

#### Phase C 执行记录（2026-03-26 第二批）

已完成：

- 新增 `src/composables/storage/appDataMigrations.js`，把一次性兼容逻辑收敛成显式 migration registry，并返回：
  - `needsSave`
  - `appliedMigrations`
- `src/composables/storage/appData.js` 已新增 `prepareLoadedAppData()`，作为“normalize + migration runner”的统一入口；`normalizeLoadedAppData()` 继续保留为稳定外观 API。
- `src/composables/storage/stateBridge.js` 已改为消费 `prepareLoadedAppData()`，由 migration runner 统一驱动 `context.needsSave`，不再依赖 `apply` 阶段临时判断是否需要落盘。
- `src/composables/storage/loadController.js` 已改为优先消费 `prepareLoadedAppData()`，恢复到 IndexedDB 的快照会直接写回迁移后的结构，而不是只做 normalize。
- `src/composables/storage/storageModules.js` 已移除 forum 的内联迁移逻辑，`forum` apply 只负责纯状态回放。

当前已注册的一次性迁移：

- `legacy-planner-auto-capture`
- `legacy-whisper-stt-settings`
- `legacy-edge-tts-mode`
- `legacy-offline-presets-array`
- `legacy-forum-snapshot`

本轮验证：

- 定向测试通过：
  - `src/composables/storage/appData.test.js`
  - `src/composables/storage/loadController.test.js`
  - `src/composables/storage/stateBridge.test.js`
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，仍保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。

下一步：

- 继续 Phase C 第三批，把其余仍属于“一次性兼容”的旧结构清单化，并区分“迁移后落盘”与“运行期长期兜底”。
- Phase C 收口后进入 Phase D，优先拆 `mediaSnapshot.js` 的 walker 与持久化接线。

#### Phase D：存储媒体快照瘦身

目标：降低 `mediaSnapshot.js` 的认知负担，但不再新增新的“控制器层”。

执行项：

- 将 `mediaSnapshot.js` 进一步拆为纯遍历 helper 与持久化接线层：
  - clone/externalize walker
  - collect refs walker
  - hydrate walker
  - strip walker
  - media persistence adapter
- 保持 schema 文件继续独立，但避免 schema 定义和 walker 细节互相耦合。
- 明确哪些逻辑是“媒体外置规则”，哪些逻辑是“IndexedDB 读写”。

验收：

- `src/composables/storage/mediaSnapshot.js` 目标压到 `700` 行以内。
- 不新增新的跨文件来回跳转链条；拆分后每个文件职责可一句话说清。

#### Phase D 执行记录（2026-03-26 第一批）

已完成：

- 新增 `src/composables/storage/mediaSnapshotWalkers.js`，承接媒体快照的纯遍历逻辑：
  - externalize / clone
  - refs collect
  - hydrate
  - strip
- `src/composables/storage/mediaSnapshot.js` 已改为薄控制器，只保留：
  - runtime blob URL cache
  - IndexedDB 读写
  - 媒体签名缓存
  - 垃圾回收
  - 导出编码 helper
- `src/composables/storage/mediaSnapshot.js` 已从 `902` 行压到 `218` 行，彻底脱离“遍历规则 + 持久化接线”混写状态。
- `src/architecture/guardrails.test.js` 已为 `src/composables/storage/mediaSnapshot.js` 新增硬上限：`<= 260`，防止 walker 逻辑重新回流到控制器。

当前结果：

- `mediaSnapshot.js` 的职责现在可以稳定描述为“媒体运行时缓存与持久化适配器”。
- `mediaSnapshotWalkers.js` 继续承担 schema 驱动的媒体字段遍历，不影响现有 `createMediaSnapshotController()` 对外接口。

下一步：

- 继续评估 `mediaSnapshotWalkers.js` 是否需要按 extract / hydrate / strip 再做第二批拆分。
- 视验证结果决定是否把 `mediaSnapshotSchemas.js` 的局部 schema 再做归组，而不是继续让 walker 和 schema 一起增长。

#### Phase E：Settings Store 去代理化

目标：移除无明显收益的 proxy 转发层，但保持现有调用面尽量稳定。

执行项：

- 优先将 `voice / liveness / cloudSync` 三个轻量子 store 内联回 `useSettingsStore`。
- `theme` 由于包含 DOM side effect，允许暂时保留独立 store，但 `useSettingsStore` 不再用大批量 proxy 工具转发所有字段和方法。
- 对外兼容策略优先选：
  - `useSettingsStore()` 继续稳定
  - 原子 store 在过渡期保留兼容导出
  - 新代码不再继续增加对 façade proxy 的依赖

验收：

- 删除或实质空心化 `settingsVoice.js`、`settingsLiveness.js`、`settingsCloudSync.js` 的重复状态定义。
- settings 相关持久化测试继续通过。
- 不出现响应式丢失或 `storeToRefs()` 回归。

#### Phase E 执行记录（2026-03-26 第一批）

已完成：

- `src/stores/settings.js` 已改为直接持有 `voice / liveness / cloudSync` 三组状态，不再反向依赖子 store 再做 computed proxy 转发。
- `theme` 仍保留在 `src/stores/settingsTheme.js`，但 `useSettingsStore()` 对 theme 状态的暴露已改为直接 state ref 映射，不再额外包一层 writable computed。
- 新增 `src/stores/settingsSubsetStore.js`，把旧的 `settingsVoice.js`、`settingsLiveness.js`、`settingsCloudSync.js` 收敛成兼容包装，统一从 `useSettingsStore()` 取同一份状态引用。
- `src/stores/settings.test.js` 已新增兼容回归测试，覆盖“主 store 与旧子 store 共用同一状态源”的双向写入验证。

当前结果：

- `useSettingsStore()` 现在是 `voice / liveness / cloudSync` 的单一真相源。
- 旧子 store 仍可继续导入，但已经不再维护独立状态，后续可以逐步退场。
- 这批调整没有触碰 `theme` 的 DOM side effect 逻辑，风险范围保持在设置状态装配层。

本轮验证：

- 定向测试通过：
  - `src/stores/settings.test.js`
  - `src/features/chat/composables/useChatViewStore.test.js`
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。

下一步：

- 继续评估是否需要让 `theme` 也从 façade 式暴露进一步收紧到更显式的 API。
- Phase F 优先进入 `CallOverlay.vue`，因为它仍是当前 UI 层最显著的大组件热点。

#### Phase F：大组件拆分第二波

目标：继续把“页面壳 / 交互编排 / 业务副作用”拆开，但优先处理真正还在膨胀的热点。

#### Phase F 执行记录（2026-03-26 第一批）

已完成：

- 新增 `src/features/call/composables/useCallOverlayRuntime.js`，将 `CallOverlay.vue` 内的大部分通话运行时逻辑下沉到 composable，统一承接：
  - 通话接听/挂断流程
  - AI 流式回复与 TTS 串联
  - STT 启停、恢复、静默自动发送、手动识别
  - 通话结束后的记录落盘与隐藏事件写入
- 新增 `src/features/call/composables/callOverlayHistory.js`，把通话结束原因、系统事件文本、通话记录落盘等纯规则从页面组件中拆出。
- 新增 `src/features/call/composables/callOverlayHistory.test.js`，为通话记录与事件文本规则补最小回归护栏。
- `src/features/call/components/CallOverlay.vue` 已从 `887` 行压到 `175` 行，回到明确的“壳层组件”职责。
- `src/architecture/guardrails.test.js` 已新增 `src/features/call/components/CallOverlay.vue <= 450` 的硬上限，防止运行时逻辑重新回流到组件脚本。

当前结果：

- `CallOverlay.vue` 现在只保留模板装配、子组件接线和 `startCall/receiveCall` expose。
- 通话层复杂度已从组件脚本移出，但 `useCallOverlayRuntime.js` 仍偏大，后续可以继续按 `speech / conversation / lifecycle` 方向再拆一轮。

本轮验证：

- 定向测试通过：
  - `src/features/call/composables/callOverlayHistory.test.js`
  - `src/features/call/composables/useCallParser.test.js`
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。

优先级：

1. `src/features/call/components/CallOverlay.vue`
2. `src/features/chat/views/ChatView.vue`

执行项：

- `CallOverlay.vue`
  - 抽 `useCallOverlayRuntime`
  - 抽通话状态同步/计时/收尾逻辑
  - 抽 STT/TTS 生命周期与 transcript 拼装
- `ChatView.vue`
  - 保留 route shell
  - 继续下沉 modal / file input / integration bridge / bulk action 胶水
  - 用“按交互域拆分”替代“按 UI 区块拆分”

验收：

- `CallOverlay.vue` 目标压到 `450` 行以内。
- `ChatView.vue` 目标压到 `650` 行以内，且 import 数量明显下降。
- 新增业务不再回流到壳层组件。

### 推荐执行顺序

建议按以下提交顺序推进，不混做：

1. Phase A：共享 helper 与共享流式运行器
2. Phase B：`useApi` 三编排器拆分
3. Phase C：storage registry + migration runner
4. Phase D：`mediaSnapshot` walker 拆分
5. Phase E：settings 去代理化
6. Phase F：`CallOverlay` / `ChatView` 第二波拆分

原因：

- 先做 Phase A/B，可以复用到多个 API 模块，收益最直接。
- Phase C/D 风险最高，应在 API 主链路收口后单独推进。
- Phase E 依赖 storage 对 settings 持久化边界更清晰。
- Phase F 放后面，避免 UI 壳层拆分和底层结构调整同时发生。

### 本轮新增护栏建议

- 为 `src/composables/useApi.js` 引入下一阶段更严格的硬上限：完成拆分后调整到 `<= 420`
- 为 `src/composables/storage/appData.js` 新增硬上限：`<= 300`
- 为 `src/composables/storage/mediaSnapshot.js` 新增硬上限：`<= 260`
- 为 `src/features/call/components/CallOverlay.vue` 新增更严格上限：`<= 450`
- 对 `ChatView.vue` 除行数外，增加 import 数量或 direct composable 依赖数量的软性检查，防止“行数下降但装配复杂度不降”

### 暂不在本轮处理

- 全量 TypeScript 迁移
- IndexedDB / localStorage 后端替换
- 因为“目录看起来更整齐”而做的大规模搬家
- 跨多个阶段混做的大重写

本轮建议的核心策略是：不再继续“先多抽一层再说”，而是明确把 orchestration 和 persistence 的单一来源补齐。否则项目会长期停留在“看起来已经分层，但改动仍然要同时改 3-4 处”的半治理状态。

#### Phase F 执行记录（2026-03-27 第二批）

已完成：

- 通话共享纯规则继续下沉到中立层：
  - 新增 `src/composables/call/callHistory.js`
  - 新增 `src/composables/call/callParser.js`
  - `src/features/chat/composables/useChatCalls.js` 已改为复用共享 invite / history 规则，不再在 chat 侧继续拼装重复文本。
- `CallOverlay` 的语音链路继续拆薄：
  - `src/features/call/composables/useCallOverlaySpeechRuntime.js` 已压到薄 orchestration；
  - 新增 `src/features/call/composables/useCallSpeechSession.js` 承接 STT 会话；
  - 新增 `src/features/call/composables/callSpeechSupport.js` 与 `src/features/call/composables/callSpeechErrors.js` 收口能力探测与错误映射。
- 存储媒体快照继续拆分职责：
  - `src/composables/storage/mediaSnapshotWalkers.js` 已进一步缩到 `134` 行；
  - 新增 `src/composables/storage/mediaSnapshotFieldTransforms.js`
  - 新增 `src/composables/storage/mediaSnapshotTraversal.js`
  - 现在 `mediaSnapshot.js` 保持控制器定位，walker 文件只负责 schema 驱动遍历。
- `ChatView` 壳层继续按交互域下沉，而不是新造 mega composable：
  - 新增 `src/features/chat/composables/useChatInteractionSurface.js`
  - 新增 `src/features/chat/composables/useChatTimelineShell.js`
  - 新增 `src/features/chat/components/ChatStickerLayers.vue`
  - 新增 `src/features/chat/components/ChatCallLayers.vue`
  - `src/features/chat/views/ChatView.vue` 已从 `816` 行进一步压到 `720` 行。
- `src/architecture/guardrails.test.js` 已补充对新薄层文件的硬上限，避免刚拆出来的模块再次膨胀。

当前结果：

- `ChatView.vue` 现在更接近真正的 route shell：页面仍负责装配，但通话层、贴纸层、交互层、时间线层已经各自有边界。
- `CallOverlay.vue` 与 speech runtime 都已经脱离“大包大揽”写法；剩余复杂度主要集中在更明确的运行时模块，而不是 UI 壳层。
- `useApi.js` 当前已降到约 `300` 行量级，已不再是当前第一优先级热点。
- `settings.js` 虽然已经完成 `voice / liveness / cloudSync` 单一来源收口，但 `theme` 仍通过 façade 暴露，代理味道还没彻底清干净。
- `mediaSnapshotSchemas.js` 仍然偏大，但它现在更像“定义文件过长”，优先级低于仍影响装配清晰度的 settings/theme 边界问题。

本轮验证：

- 定向测试通过：
  - `src/architecture/guardrails.test.js`
- `npm run lint` 通过，仍保留 3 个与本轮无关的历史 warning。
- `npm run build` 通过。

下一步建议：

1. 优先继续 Phase E，把 `theme` 从 `settings.js` 的 façade 暴露再收紧一轮，减少“主 store 代言 theme store 全量接口”的间接层。
2. 然后回到存储层，评估 `mediaSnapshotSchemas.js` 是否能按领域分组定义，而不是继续堆在一个超长 schema 文件里。
3. `ChatView` 暂时不建议为追求更低行数继续抽象；除非出现新的明确交互域，否则维持当前装配层即可，避免为了拆分而拆分。
