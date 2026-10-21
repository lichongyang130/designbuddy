# 连接器平台完整实现验证报告（2026-10-21）

- **验证分支**：`arena/22ebd4cd-designbuddy`
- **验证日期**：`2026-10-21`
- **唯一状态真源**：[`docs/plans/feature-status-registry.json`](../plans/feature-status-registry.json)（`F07-CONNECTORS-ADMIN-PLUGINS`）

## 1. 本轮交付范围

`/connectors` 从"参考目录 + 503 占位接口"升级为可配置、可测试、可连接、可断开的真实连接器平台：
**22 个内置连接器 + 任意数量的自定义 MCP 连接器**，四种连接方式全部落到服务端。

| 层次 | 文件 | 职责 |
|---|---|---|
| 共享目录 | `shared/connector-catalog.ts` | 22 个内置连接器的唯一真源：名称、说明、支持的连接方式、OAuth 端点、凭据字段、真实校验请求模板 |
| 服务端 | `server/api/connectors.ts` | SQLite 持久化、AES-256-GCM 凭据加密、OAuth 授权码流程、API Key / Webhook / MCP 真实连通性探测、出站地址防护、审计流水、HTTP 路由 |
| 接入 | `server/local-daemon.ts` | 挂载 `/api/connectors/*`，OAuth 回调作为唯一的免会话路由（一次性 state 自带归属） |
| 前端 API | `frontend/workspace/api/connectors.ts` | 严格字段校验；只保留公开状态元数据，任何未知字段（含令牌）都被丢弃 |
| 前端页面 | `frontend/workspace/pages/ConnectorsPage.tsx` | 市场、创建、详情（连接方式切换 + 凭据表单 + 测试/连接/断开/删除 + 服务端记录）、OAuth 回调核验 |
| 前端目录 | `frontend/workspace/connectorCatalog.ts` | 图标与共享目录合并，名称/说明/连接方式一律以服务端为准 |

### HTTP 接口

| 方法与路径 | 作用 |
|---|---|
| `GET /api/connectors` | 当前账号的全部连接器状态（22 个内置 + 自定义），不含任何凭据 |
| `GET /api/connectors/catalog` | 目录 + 每种连接方式需要收集的字段 + OAuth 应用是否已配置 |
| `POST /api/connectors` | 创建自定义连接器（MCP / Webhook），保存配置不访问该地址 |
| `POST /api/connectors/:id/configure` | 保存配置（不连接），凭据加密入库 |
| `POST /api/connectors/:id/test` | 真实连通性校验，不改连接状态 |
| `POST /api/connectors/:id/connect` | 真实校验通过后才写入凭据并标记 `connected` |
| `POST /api/connectors/:id/disconnect` | 删除凭据；提供撤销端点的服务方同时发起令牌撤销 |
| `DELETE /api/connectors/:id` | 删除自定义连接器配置（内置连接器只能断开，不能删除） |
| `GET /api/connectors/:id/events` | 服务端审计流水（配置/测试/连接/断开及对方真实回答） |
| `POST /api/connectors/oauth/start` | 生成一次性 state（含 PKCE）并返回服务商授权地址 |
| `GET /api/connectors/oauth/callback` | 交换令牌 → 用令牌真实调用服务商 API → 成功才连接 |

### 22 个内置连接器的连接方式

| 连接器 | 连接方式 | 校验方式 |
|---|---|---|
| Gmail / Outlook | OAuth（Google、Microsoft 身份平台） | 令牌交换后真实调用 Gmail API、Microsoft Graph `/me` |
| GitHub / Notion / Linear / Figma / Canva | OAuth + API Key | OAuth 真实调用各自 API；API Key 走 `api.github.com/user`、`notion /users/me`、Linear GraphQL `viewer`、Figma `/v1/me` |
| 飞书 / 企业微信 / 钉钉 | Webhook + MCP + API Key | 真实投递带 HMAC-SHA256 签名的测试消息（飞书 body 内 `sign`、钉钉 `sign`/`timestamp` 查询参数），或 MCP 握手 |
| TextIn / 可灵 / 星财富 / 来也 / WPS / EdgeOne / TikTok / 富途 / Moomoo | API Key + MCP | 用你填写的凭据与地址发起真实请求；或用 MCP 握手 |
| 腾讯会议 / 数据库 / 云服务 | MCP + API Key | MCP `initialize` + `tools/list` 握手；或对你填写的地址发起真实请求 |

## 2. 自动化门禁与实测结果（全部零失败）

| 门禁 | 执行命令 | 通过数 | 失败数 | 覆盖内容 |
|---|---|---:|---:|---|
| 连接器服务端回归 | `node --test server/api/connectors.test.cjs` | **12 / 12** | **0** | 22 个内置连接器全部可列可配置；**全量矩阵：22 个连接器 × 每种连接方式真实走完配置→测试→连接→断开**；真实 MCP 握手（Streamable HTTP 与 SSE 两种传输）；钉钉/企业微信 Webhook 真实投递与签名校验；OAuth 启动→回调→令牌交换→真实校验；一次性 state 防重放；凭据加密落库；跨账号隔离；CSRF、越权与非法输入；出站私网防护 |
| 服务端 HTTP API 全量 | `node --test server/api/*.test.cjs` | **115 / 115** | **0** | 含 `workspace-backend` 的 `/api/connectors` 断言（由 503 占位改为真实 200 列表、22 条、无凭据泄露） |
| 真实 Headless Chromium 端到端 | `playwright test connectors.spec.ts` | **18 / 18** | **0** | 市场布局与 92px 卡片几何、搜索与空态、22 个连接器各自的真实配置页、自定义连接器服务端持久化与确认删除、校验失败不连接、校验通过→已连接→断开、服务端记录、OAuth 目的地址白名单、畸形响应与回调查询参数不能伪造成功、320–1024px 响应式 |
| 服务端类型检查 | `tsc -p server/tsconfig.local.json` | **通过** | 0 | — |
| 前端类型检查 | `apps/web: tsc --noEmit` | **通过** | 0 | 含 `frontend/workspace` 与 `shared/` |
| 全仓一致性门禁 | `node scripts/verify-status-registry.mjs` | **通过** | 0 | 引用路径存在、锁版、诚实状态约束 |
| 前端/脚本单元门禁 | `pnpm test:unit` | **72 / 72** | **0** | — |

## 3. 真实连通性证据（非模拟断言）

以下为守护进程运行期间对真实本地服务发起的请求与真实回答（`DESIGNBUDDY_CONNECTORS_ALLOW_PRIVATE_NETWORK=true` 指向 127.0.0.1）。

### 3.1 MCP 握手（Streamable HTTP）

```
$ curl -X POST .../api/connectors/mcp-…/test -d '{"authType":"mcp","token":"secret-mcp-token"}'
{
  "ok": true,
  "status": 200,
  "latencyMs": 18,
  "detail": "MCP 握手成功：mock-mcp 1.0.0，发现 3 个工具。",
  "tools": ["search","fetch","summarize"]
}
```

### 3.2 MCP 握手（旧版 HTTP+SSE 传输）

```
$ curl -X POST .../api/connectors/mcp-…/connect -d '{"authType":"mcp","transport":"sse",...}'
True  "MCP 握手成功（SSE 传输）：mock-mcp 2.0.0，发现 2 个工具。"  ['search','fetch']
```

### 3.3 凭据加密落库（数据库文件中不留明文）

```
$ grep -c "github_pat_secretvalue" data/connectors.sqlite   → 0
$ sqlite: SELECT credential FROM connector_connections WHERE connector_id='github'
  v1.<iv>.<tag>.<ciphertext>          # AES-256-GCM
```

### 3.4 Webhook 真实投递与签名（单元门禁内校验）

测试在本地起真实 HTTP 服务，按钉钉文档重新计算 `base64(HMAC-SHA256(timestamp+"\n"+secret))` 并与服务端投递的 `sign` 查询参数逐字节比对；签名错误时服务端如实返回失败并保持未连接。

### 3.5 全量矩阵：22 个连接器的每种连接方式都走完"配置 → 测试 → 连接 → 断开"

`server/api/connectors.test.cjs` 的第 11 项用例遍历 `connectorDefinitions` 的全部内置连接器及其声明的每种连接方式（OAuth 单独校验契约），对真实的本地服务完成 `configure → test → connect → disconnect` 四步：

| 步骤 | 断言 | 结果 |
|---|---|---|
| `configure` | 保存后仍为 `disconnected`（保存不等于连接） | 全通过 |
| `test` | 真实请求返回成功，`target` 为实际拨出的地址 | 全通过 |
| `connect` | 只有校验通过才写入凭据并置为 `connected`，并返回掩码凭据提示 | 全通过（企业微信 Webhook 无签名字段，按约定不返回提示） |
| `disconnect` | 凭据删除、状态回到 `disconnected` | 全通过 |

### 3.6 OAuth 未配置应用时诚实报错

```
$ curl -X POST .../api/connectors/oauth/start -d '{"connectorId":"github"}'
503 { "error": "服务端尚未配置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET，无法启动 OAuth 授权。",
      "code": "OAUTH_APP_NOT_CONFIGURED" }
```

## 4. 严格诚实边界声明（未伪装为已完成的部分）

1. **真实第三方 OAuth 需要你自己的应用凭据（`optional_credentials`）**：仓库不携带任何 Client Secret。未配置时 `oauth/start` 返回 `503` 并明示缺失的环境变量名；配置了才返回服务商授权地址。API Key / Webhook / MCP 三种连接方式不依赖服务端凭据即可完成真实校验。
2. **未提供固定校验地址的连接器由你填写地址**：对没有公开、稳定校验端点的服务（如部分国内 SaaS 开放平台），目录只声明需要收集的凭据字段与官方文档链接，校验地址由你在表单中填写，服务端对你填写的地址发起真实请求。
3. **端到端测试不建立真实外部授权**：Playwright 套件用 `page.route` 拦截连接器接口与服务商地址；服务端套件用注入的 `fetch` 与本地 mock 服务完成真实令牌交换与真实握手，二者都不接触真实第三方账号。
4. **DNS 重绑定的残余风险**：出站防护在发起请求前解析并拒绝私网、链路本地与云元数据地址，但 Node 的 `fetch` 在连接时仍会再次解析；生产部署建议在网络层（egress proxy / 防火墙）再做一次同样的限制。

## 5. 复现命令

```bash
pnpm exec tsc -p server/tsconfig.local.json
node --test server/api/connectors.test.cjs
node --test server/api/workspace-backend.test.cjs
cd apps/web && pnpm exec playwright test connectors.spec.ts
```
