# 维护导向重构任务清单（修正版）

> 本文档用于替代“只看文件位置、不看依赖方向”的粗糙重构方案。
> 目标不是机械搬文件，而是把仓库收敛成：`薄路由`、`薄入口`、`小而准的职责模块`、`清晰稳定的依赖边界`。
> 所有任务都以“利于后续维护更新”为唯一目标；禁止为了看起来更模块化而制造新的壳文件、重复实现或反向依赖。

---

## 核心原则

### P1：禁止业务逻辑堆积

- `router`、`routes.js`、`index.js`、`ui.js`、聚合入口文件只保留路由声明、公开导出、轻量装配。
- 复杂逻辑不得继续堆在入口文件中，包括：网络请求、解析、缓存、格式化、状态编排、检索、持久化。
- 真正承载业务的代码必须下沉到职责明确的子模块，而不是继续堆在 `useXxx.js` 巨型入口里。

### P2：真正的薄路由

- 路由文件只允许保留：`path`、`name`、`component`、`children`、`meta`、懒加载引用。
- 路由文件禁止直接承载任何业务判断、数据拼装、API 调用、store 访问、prompt 构造、消息解析。
- `src/router/**` 和 `src/features/*/routes.js` 只作为导航表，不作为业务层。

### P3：禁止“大包大揽”

- 一个文件只做一类事，不同时承担“解析 + 缓存 + UI 组装 + 数据修正 + 特性开关”多重职责。
- 拆分时按稳定职责拆，不按表面名词拆。
- 拆分目标不是“文件越多越好”，而是“每个模块边界清楚、名字准确、可以单独理解和修改”。

### P4：禁止重复造轮子

- 新增模块前先搜索现有实现，能复用就复用，不能复用再抽离。
- 不允许出现功能高度相近、只差少量参数或命名的平行 helper。
- 不允许在 feature 内复制一份共享实现；共享能力必须回到共享层。

### P5：共享能力与 feature 私有能力严格分层

- 只被单一 feature 使用的逻辑，留在该 feature 内部。
- 被多个 feature 或共享基础设施使用的逻辑，必须留在共享层，不能为了“就近”塞回某个 feature。
- 禁止出现“共享 API 层反向依赖某个 feature 私有模块”的结构。

### P6：禁止无意义额外代码

- 允许新增的新文件，必须承接真实职责迁移。
- 除 `index.js`、`ui.js`、聚合 re-export 入口外，禁止新增只有一两行转发的空壳 wrapper。
- 不新增新业务逻辑、新类型体系、新注释体系；只做删除、移动、合并、拆职责、统一出口。

---

## 允许保留的薄文件

以下薄文件是允许的，而且应该保持薄：

- 路由文件：只保留导航声明
- `src/features/<feature>/index.js`：只保留 feature 对外公开能力
- `src/features/<feature>/ui.js`：只保留外部可嵌入 UI 的公开导出
- 聚合入口文件：只保留稳定 re-export，不承载业务

除以上场景外，不再制造新的“中转壳文件”。

---

## 执行顺序

执行顺序：高优先级 → 中优先级 → 低优先级。

每项任务都必须单独可验证；完成标准不是“看起来拆了”，而是：

- 依赖方向更清晰
- 入口更薄
- 模块职责更窄
- 无重复实现
- `npm run build` 通过

---

## 高优先级

### T1：将 `useMemoryManager.js` 并回记忆子系统，消除顶层孤立入口

**问题**：

- `src/composables/useMemoryManager.js` 不应继续作为根级孤立入口存在。
- `runMemoryManager` 不只给 `MemoryPanel.vue` 使用，`useMemory.js` 内部也有动态调用。
- 正确方向不是“再造一个 wrapper”，而是把它并回 `memory/` 子系统，由 `useMemory.js` 统一薄暴露。

**操作**：

1. 将 `runMemoryManager` 的实现下沉到 `src/composables/memory/` 内最贴近的真实职责模块。
2. `src/composables/useMemory.js` 只保留组合调用和对外导出，不再依赖根级 `useMemoryManager.js`。
3. `MemoryPanel.vue` 与内部动态调用统一改从 `useMemory.js` 或 `memory/` 子系统稳定入口访问。
4. 删除 `src/composables/useMemoryManager.js`。

**验收**：

- `useMemory.js` 成为唯一外部薄入口
- 根级不再存在孤立 `useMemoryManager.js`
- `npm run build` 通过

---

### T2：将 `useVNApi.js` / `useVNParser.js` 移入 `features/vn/`

**问题**：

- 这两个模块是 VN feature 私有能力，继续放在根级 `src/composables/` 会污染共享层。

**操作**：

1. 移动到 `src/features/vn/composables/`。
2. 更新 `VN` feature 内部所有引用。
3. 若 feature 外部确实需要访问，只能通过 `src/features/vn/index.js` 的公开出口，不允许 deep import。
4. 删除根级旧文件。

**验收**：

- VN 私有实现不再滞留共享层
- 无新增跨 feature 内部依赖
- `npm run build` 通过

---

### T3：`useHistorySearch.js` 迁入共享检索层，不得塞回 `offline feature`

**问题**：

- 原方案要求移入 `features/offline/`，这会造成错误的依赖方向。
- 当前该能力不只被 offline 使用，共享 API 上下文检索也依赖它。
- 这类能力属于“共享检索基础设施”，不是 offline 私有模块。

**操作**：

1. 将 `src/composables/useHistorySearch.js` 移到更中性的共享目录，例如：
   - `src/composables/history/useHistorySearch.js`
   - 或 `src/composables/retrieval/useHistorySearch.js`
2. 同步移动对应测试文件。
3. 更新 `offline` 与共享 `api` 层的 import。
4. 删除旧路径。

**验收**：

- 共享 API 层不反向依赖 feature 私有目录
- 检索逻辑有明确共享归属
- `npm run build` 通过

---

### T4：将音乐逻辑收回 `features/music/`，并建立唯一公开入口

**问题**：

- `useMusic.js` / `useMusicSearch.js` 主要服务于 music feature。
- 但外部还存在 `App.vue`、`MusicCard.vue` 等调用点，不能简单“挪完继续 deep import”。
- 正确做法是：实现收回 feature，跨 feature 访问统一走公开入口。

**操作**：

1. 将 `useMusic.js`、`useMusicSearch.js` 移到 `src/features/music/composables/`。
2. 新增或补齐 `src/features/music/index.js`，作为音乐 feature 的统一 JS 出口。
3. 从 `index.js` 公开 `useMusic`、`useMusicSearch`、`resolveMusicTrack` 等确需跨边界使用的能力。
4. `App.vue`、`MusicCard.vue` 等 feature 外部调用方统一从 `src/features/music/index.js` 导入。
5. `ui.js` 继续只公开 UI 组件，不承载业务逻辑。
6. 删除根级旧文件。

**验收**：

- 音乐 feature 的对外访问统一走公开入口
- 不再从根级 composables 暴露 feature 私有实现
- `npm run build` 通过

---

## 中优先级

### T5：收敛为真正的薄路由

**问题**：

- 路由层是最容易被临时逻辑污染的地方。
- 后续若继续把权限判断、数据拼装、入口逻辑塞进路由文件，会直接破坏维护性。

**操作**：

1. 检查 `src/router/**`、`src/features/*/routes.js`。
2. 路由文件只保留：
   - 路由表
   - 懒加载组件引用
   - 纯静态 `meta`
3. 如存在业务逻辑、store 访问、helper 拼装、功能判断，全部下沉到 feature 内部模块。
4. `router/index.js` 只负责装配，不承载 feature 业务。

**验收**：

- 路由文件变为真正的“导航配置”
- 路由层不再直接依赖业务 composable / store / parser
- `npm run build` 通过

---

### T6：`useMessageParser.js` 缩成薄入口，只保留组合与导出

**问题**：

- 当前文件体量过大，且同时承担多类职责：时间格式、reply 预览、解析缓存、头像判断、block 组装、消息类型分发。
- 这就是典型的“大包大揽”。

**操作**：

1. 按稳定职责拆入 `messageParser/` 子目录，例如：
   - 时间与尾部元信息
   - reply preview 处理
   - parse cache
   - sender/avatar 解析
   - block 装配
2. 主入口文件只保留：
   - 对外导出
   - `useMessageParser` 的轻量组合
3. 禁止把一个 700+ 行文件拆成大量碎片化、难检索的小文件；模块数控制在“够用且清晰”的范围。

**验收**：

- `useMessageParser.js` 只剩薄入口
- 子模块命名能直接反映职责
- 主文件控制在 `150` 行以内
- `npm run build` 通过

---

### T7：`api/prompts.js` 按稳定职责拆分，不按表面类型生硬切片

**问题**：

- 原方案按 `system / user / tools` 拆分过于表面，容易拆完依旧互相缠绕。
- 当前文件混合的是：模板变量、时间上下文、persona、贴纸与特性规则、lorebook 注入、统一 prompt 组装。
- 正确拆法应围绕“长期稳定职责”，而不是围绕“字面上属于哪类 prompt”。

**操作**：

1. 按职责拆为 4-6 个稳定模块，优先考虑：
   - `templateVars`
   - `timeContext`
   - `persona`
   - `featureRules` 或 `specialFeatures`
   - `lorebook`
   - `unifiedPrompt`
2. `src/composables/api/prompts.js` 只保留聚合 re-export。
3. 禁止“一个函数一个文件”的过度碎片化。
4. 禁止引入新的逻辑分支，只重组现有职责边界。

**验收**：

- `prompts.js` 成为纯入口
- 子模块职责单一且名称准确
- 不改变任何现有调用点语义
- `npm run build` 通过

---

## 低优先级

### T8：清理 `voicePlayback` 空目录 / 重复目录

**问题**：

- 若 `src/features/chat/composables/voicePlayback/` 只是遗留空目录或副本，会误导后续维护者继续在 feature 内重复实现共享能力。

**操作**：

1. 确认 `features/chat/composables/voicePlayback/` 是否为空或为重复实现。
2. 若为空或重复，直接删除。
3. 所有共享语音播放能力统一收敛到 `src/composables/voicePlayback/`。

**验收**：

- 仓库内只保留一套语音播放底层实现
- 不存在误导性的重复目录
- `npm run build` 通过

---

## 结构红线

以下行为一律禁止：

- 把共享模块移入某个 feature，导致共享层反向依赖 feature
- 继续把业务逻辑堆进 `routes.js`、`index.js`、`ui.js`、根级 `useXxx.js`
- 为了“看起来拆了”而新增大量一行转发文件
- 在 feature 内复制共享 helper，形成第二套实现
- 新增与现有能力重叠的 helper / composable / util
- 把单个大文件拆成大量难检索、命名模糊的碎片文件

---

## 执行约束

- 每个任务单独提交，不混做
- 不新增业务能力，不改变运行时行为
- 优先删除、移动、合并、按职责拆分；避免引入新的抽象层
- 只有在承接真实职责迁移时才允许新增文件
- 新增的薄文件只允许是公开入口或聚合入口
- 有测试文件的模块必须同步移动或补齐引用
- 每项完成后至少运行 `npm run build`
- 若改动涉及测试文件或共享基础模块，追加运行对应测试

---

## 结果标准

本轮重构完成后，应达到以下状态：

- 路由层只剩薄路由
- feature 私有逻辑回到 feature 内部
- 共享能力停留在共享层，不再反向依赖 feature
- 巨型入口文件被压薄为“组合层”
- 没有第二套相似实现
- 没有为重构而增加的大量无用代码
- 后续新增功能时，维护者能明确知道“该放哪里、该依赖谁、不能依赖谁”
