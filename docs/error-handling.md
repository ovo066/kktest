# API 错误处理约定

更新时间：`2026-03-15`

本文档约束聊天、Meet、VN、Offline、Call 等 API composable 的失败返回结构、提示语和日志策略，避免同一类问题在多个模块里重复硬编码。

## 1. 统一失败结果

API composable 的失败结果统一返回：

```js
{
  success: false,
  error: '面向 UI 的稳定文案',
  code: '稳定错误码',
  context: { feature, action, ... },
  retryable: false,
  traceId: 'trace_xxx'
}
```

约定：

- `error` 给 UI 直接消费，默认不再由组件层拼接临时文案。
- `code` 用于逻辑分支、测试和后续日志聚合。
- `context` 只记录定位问题需要的最小上下文，例如 `feature`、`action`、`memberId`、`meetingId`。
- `retryable` 表示是否适合直接提示用户重试。
- `traceId` 目前优先用于聊天主链路；其他模块可按需要补充。

## 2. 共享入口

统一 helper 位于：

- `src/composables/api/errors.js`

当前已接入的主要模块：

- `src/composables/useApi.js`
- `src/composables/useVNApi.js`
- `src/features/meet/composables/useMeetApi.js`
- `src/features/offline/composables/useOfflineApi.js`
- `src/features/call/composables/useCallApi.js`

## 3. 推荐错误码

常用业务错误码：

- `CONFIG_MISSING`
- `CHAT_NOT_FOUND`
- `GROUP_CHAT_REQUIRED`
- `MEMBER_NOT_FOUND`
- `MEMBER_NOT_SELECTED`
- `CONTACT_NOT_FOUND`
- `CALL_CONTACT_NOT_FOUND`
- `PROJECT_NOT_FOUND`
- `MEETING_NOT_FOUND`
- `EMPTY_REPLY`
- `CONTENT_FILTER`

常用基础设施错误码：

- `ABORTED`
- `NETWORK_ERROR`
- `AUTH_ERROR`
- `PERMISSION_DENIED`
- `NOT_FOUND`
- `TIMEOUT`
- `RATE_LIMITED`
- `SERVER_ERROR`
- `UNSUPPORTED_STREAM`
- `API_ERROR`

原则：

- 先复用已有稳定错误码，再新增。
- 新增错误码只在“需要区分行为或提示”时引入，不为每个字符串单独造码。

## 4. 提示语策略

- helper 层负责把 HTTP / 网络 / 内容安全等常见错误映射成稳定中文提示。
- 组件层默认只展示 `result.error`，不再拼接 `"请求失败："` 一类前缀。
- `EMPTY_REPLY`、`CONTENT_FILTER` 这类高频场景统一走共享文案。
- 取消请求统一显示 `已取消`。

## 5. 日志策略

- 可恢复失败优先保留 `context`，便于 `console.warn` 或后续埋点收敛。
- 聊天主链路继续保留 `traceId`，用于排查流式回复问题。
- UI 组件不直接打印原始异常堆栈；由 composable 或共享 helper 决定是否记录。

## 6. Toast 策略

- 用户主动触发的失败可以直接 toast `result.error`。
- 被动后台任务默认先静默失败或 `console.warn`，避免频繁打断。
- `retryable: true` 时，UI 可以优先使用“请稍后重试”类动作提示。

## 7. 新增 API 能力的接入要求

1. 参数校验失败和上下文缺失必须返回统一失败结果。
2. 网络请求失败统一走 `createApiFailureResult(...)` 或等价共享 helper。
3. 若模块已经有显式结果契约，新增 `code / context / retryable / traceId` 时要同步更新 `.d.ts` 或 JSDoc。
4. UI 层消费失败结果时，优先依赖 `code` 和 `retryable`，不要重新解析字符串。
