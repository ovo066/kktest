# MCP 功能说明

## 概述

本应用支持两种 MCP（Model Context Protocol）工具调用模式：

| 模式 | 适用场景 | 用户操作 |
|------|----------|----------|
| **直连模式**（推荐） | Vercel 部署、手机使用、Composio/Smithery 等托管 MCP | 只填一个 URL |
| **Bridge 模式** | 本地开发、自建 Bridge 服务、STDIO 类 MCP | 填 Bridge 地址 + 配置各服务器 |

---

## 直连模式（推荐）

### 适用场景
- 部署在 Vercel，手机访问
- 使用 [Composio](https://composio.dev)、[Smithery](https://smithery.ai) 等托管 MCP 服务
- 任何支持标准 MCP Streamable HTTP 传输的服务

### 配置步骤

1. 进入「设置 → AI 功能 → 后台工具调用」，打开开关
2. 在「MCP 直连服务器」区域点「添加」
3. 填写：
   - **名称**：随便填，如 `Notion`
   - **URL**：MCP 服务的 HTTPS 地址
   - **Auth Header**（可选）：如 `Bearer sk-xxx`，优先作为 Authorization header
   - **API Key**（可选）：未填写 Auth Header 时，会自动转为 `Bearer <apiKey>`
4. 点「测试连接」——成功后显示发现的工具数量
5. 开始聊天，AI 会自动使用这些工具
6. 如果希望用户在主聊天中感知工具调用，可打开「展示工具调用卡片」

### 常用托管 MCP 服务

#### Composio（Notion、Gmail、GitHub 等）
```
URL: https://mcp.composio.dev/notion/<your-token>
URL: https://mcp.composio.dev/gmail/<your-token>
URL: https://mcp.composio.dev/github/<your-token>
```
前往 [composio.dev](https://composio.dev) 注册获取 token。

#### Smithery（各类 MCP）
```
URL: https://server.smithery.ai/@smithery-ai/fetch/mcp
URL: https://server.smithery.ai/@modelcontextprotocol/server-brave-search/mcp
```
前往 [smithery.ai](https://smithery.ai) 搜索可用 MCP。

#### 自定义 HTTP MCP
任何实现了 MCP Streamable HTTP 传输协议的服务：
```
方法: POST <url>
请求体: { "jsonrpc": "2.0", "method": "tools/list", ... }
```

### Vercel 部署说明

直连模式在 Vercel 上通过 `/api/mcp-proxy` 自动代理，无需任何额外配置：
- HTTPS 页面 → 自动走代理（解决跨域）
- 本地开发 → 直接连接（无跨域问题）

---

## Bridge 模式

### 适用场景
- 本地开发时使用 STDIO 类 MCP（如 `npx @modelcontextprotocol/server-filesystem`）
- 自建了 Bridge 服务

### 启动本地 Bridge

```bash
cd bridge
npm install
npm start  # 默认监听 http://localhost:3099
```

### 配置步骤

1. 打开「后台工具调用」开关
2. 打开「MCP 桥接」开关
3. 填写「桥接地址」：`http://localhost:3099`
4. 在「MCP 服务器」区域添加服务器：
   - STDIO 类：填命令（`npx`）和参数
   - HTTP 类：填 URL
5. 点「测试连接」

### Bridge API 协议

Bridge 服务需实现以下接口：

```
GET  /status          → { ok, name, serverCount, connectedCount, servers }
GET  /servers         → { ok, servers: [] }
POST /servers/add     body: { id, name, transport, command, args, env, url }
POST /servers/remove  body: { id }
GET  /tools           → { ok, tools: [{ serverId, serverName, name, description, inputSchema }] }
POST /call            body: { server, tool, arguments } → { ok, result }
```

---

## 内置工具（无需任何配置）

打开「后台工具调用」后，以下内置工具自动可用：

| 工具 | 功能 | 所需开关 |
|------|------|----------|
| `create_event` | 创建日程事件 | 日程 AI |
| `write_diary` | 写日记 | 日程 AI |
| `add_memory` | 保存核心记忆 | 无 |
| `update_mood` | 更新角色情绪 | 拟真引擎 |

---

## 联系人/群组绑定 MCP

可以在联系人或群组设置里绑定特定的 MCP 服务器 ID，这样该对话只使用指定的工具，不影响其他对话。

---

## 故障排查

| 错误 | 原因 | 解决 |
|------|------|------|
| `MCP request failed: HTTP 401` | 需要认证 | 填写 Auth Header |
| `MCP server returned non-JSON` | URL 不正确或服务不支持 MCP | 检查 URL |
| `Failed to fetch` | 跨域或网络问题 | Vercel 部署会自动代理，本地需检查 CORS |
| `桥接主机未加入 API_PROXY_ALLOWED_HOSTS` | Bridge 模式跨域 | 在 Vercel 环境变量加入该 host |
| 工具发现成功但 AI 不使用 | 工具调用开关未开 | 确认「后台工具调用」已开启 |
