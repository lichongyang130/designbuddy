# 连接器方案

连接器不是「一排卡片」，是**给 Agent 加一只手**：目录里的一项 = 一份能力包（凭据 + 工具 + 作用域）。
这篇写清楚现状、目标、数据模型、后端落点、前端交互、权限与分阶段计划。

> **落地状态（P0 已完成，`450120a`）**：目录 40 项 manifest 化 → 凭据 0600 → `ConnectorHub` + REST/演示适配器
> → 工具注册/注销 → 前端筛选 + 详情弹窗 → 审计。验收链路实测：连上后 `/health` 的
> `connectors:{total:40,connected:1,tools:2}`，断开回落 `0/0`，`connectors.keys.json` 权限 `0600`。
> 与下文设计的两处口径差异，以便日后对齐：
> 1. **写操作确认**目前落在「连接时」：详情页必须显式勾选「允许写操作」，写工具才会注册；
>    没勾就压根不存在这些工具，不需要调用时再拦。逐步升级为「每次调用弹确认卡片」。
> 2. **专家白名单**用工具上的 `dynamic` 标记解决：连接器工具对所有预设可见，
>    否则用户刚点完「连接」下一轮却调不动。`github.*` 通配写法留到 P1。
> 另外 `/health` 已带连接器计数；`mock-llm` 会在用户点名（如「用通达信查报价」）时优先调该连接器的只读工具。

---

## 1. 现状：目录是真的，功能是假的

| 位置 | 现在是什么 | 问题 |
|---|---|---|
| `apps/web/public/demo-data.js` | 40 条 `{name, desc, hue}` | 只有文案，没有身份、没有凭据、没有工具 |
| 专家页 → 连接器 | 渲染 40 张卡，点任意一张 → `openSettings('devices')` | 40 张卡都跳到同一个面板，等于「点了没反应」 |
| 设置 → 设备连接 | `plugins.rows` 里 grep 出 figma/connector 行，给个「断开」 | 只认识已经写死的插件行，和目录里的 40 项对不上 |
| `src/plugins/connector-figma.ts` | 一个写死 fixture 的插件，注册 `figma.inspect_frame` | 这是唯一「真的能用」的连接器，但它不叫连接器管理 |

结论：**缺的不是 UI，是中间那层**——目录条目 → 凭据 → 运行时插件行 → 工具注册 的链路。

---

## 2. 目标：三个判定标准

一个连接器「做完了」= 同时满足：

1. **能连**：给出凭据（API Key / OAuth / 本地进程），点「连接」后有真实的成功或失败结果，不是 toast 敷衍。
2. **能用**：连上之后 `tools.list` 里真的多出工具，专家能在对话里调用，返回真实或明确标注的演示数据。
3. **能断**：断开后工具立刻消失、凭据从磁盘删除、会话里不残留引用。

并且：**40 个目录项一个不能少**，每一项至少要能打开详情、看到它需要什么权限、提供哪种连接方式。

---

## 3. 数据模型

### 3.1 目录条目（连接器定义，随代码走）

```ts
// src/connectors/catalog.ts
export interface ConnectorManifest {
  id: string                 // 'github'，工具命名空间也用它
  name: string               // 'GitHub'
  desc: string
  vendor: string             // 'github' | 'tencent' | 'alibaba' …
  kind: ConnectorKind
  /** 需要的凭据；空数组表示无需凭据（本地进程 / 演示） */
  auth: AuthField[]
  /** 连接后贡献的工具（名称 + 一句话说明），详情页直接展示 */
  tools: { name: string; desc: string; write?: boolean }[]
  /** 需要的权限范围，连接页原样展示给用户 */
  scopes?: string[]
  /** 连接方式的具体参数（MCP 启动命令 / REST baseUrl / OAuth 授权地址） */
  endpoint?: { baseUrl?: string; command?: string[]; authorizeUrl?: string }
  /** 没有真实后端的目录项走演示数据，UI 必须标注 */
  demo?: boolean
}

type ConnectorKind = 'mcp-stdio' | 'mcp-http' | 'rest' | 'local-cli' | 'builtin'

interface AuthField {
  key: string                // 'token'
  label: string              // 'Personal Access Token'
  type: 'text' | 'password' | 'oauth'
  placeholder?: string
  help?: string              // 去哪里申请
  required: boolean
}
```

### 3.2 连接状态（`~/.designbuddy/connectors.json`）

```json
{
  "github": { "state": "connected", "since": 1793700090495, "lastOkAt": 1793700091000, "account": "octocat" },
  "feishu": { "state": "error", "error": "401 invalid token", "at": 1793700092000 }
}
```

状态机：`idle → connecting → connected → (error) → idle`。
**凭证永远不进这个文件**，只放可公开展示的元信息（账号名、连接时间）。

### 3.3 凭据（`~/.designbuddy/connectors.keys.json`，权限 0600）

沿用 `models.keys.json` 已经验证过的做法（`src/core/models.ts`）：明文只在本机、目录权限 600、
文件名独立于配置、接口只回 `hasKey: true` 不回真值。若后续要更强，可换 AES-GCM + 本机主密钥，接口不变。

```ts
save(id: string, secrets: Record<string, string>): void
get(id: string): Record<string, string> | null   // 只给运行时用，绝不过 RPC
has(id: string): boolean
remove(id: string): void
```

---

## 4. 后端：四个新文件 + 一组 RPC

```
                 ┌──────────────────────────────┐
 前端 ── RPC ──▶ │ connectors.connect / test …  │
                 └──────────────┬───────────────┘
                                ▼
        ┌───────────────┬───────────────┬─────────────────┐
        │ ConnectorHub  │ CredentialStore│  ConnectorRuntime│
        │ 目录 + 状态机  │ 0600 密钥文件   │ 动态 mount/unmount│
        └───────┬───────┴───────────────┴────────┬─────────┘
                │                                 ▼
                │                        ┌──────────────────┐
                │                        │ ToolRegistry     │
                │                        │ github.list_…    │
                ▼                        └──────────────────┘
        adapters: mcp-stdio / mcp-http / rest / local-cli / builtin
```

| 文件 | 职责 | 关键 API |
|---|---|---|
| `src/core/connectors.ts` | 目录 + 状态持久化 + 状态机 | `list()`, `get(id)`, `markConnected(id, meta)`, `markError(id, msg)` |
| `src/core/credentials.ts` | 密钥读写（0600），只给后端用 | `save/get/has/remove` |
| `src/connectors/adapters/*.ts` | 每种 kind 一个适配器 | `probe(config)`、`connect(config, secrets)` → `ToolDefinition[]`、`close()` |
| `src/plugins/connector-hub.ts` | 把上面三样拼起来，暴露 RPC 面 | `connect(id, secrets)`, `test(id, secrets)`, `disconnect(id)`, `toolList(id)` |

`connector-hub` 内部用 `App.mount(row)` 动态挂一行（行 id `connector.<id>`），断开就是 `unmount`，
工具随插件行一起消失——和现有 `plugins.unmount` 是同一套机制，不需要新概念。

### 新增 RPC（`src/sdk/host.ts`）

| 方法 | 入参 | 返回 |
|---|---|---|
| `connectors.list` | — | 目录 40 项 + 每项 `state / hasKey / account / toolCount` |
| `connectors.test` | `{ id, secrets? }` | `{ ok, account?, error?, ms }`，**不落盘** |
| `connectors.connect` | `{ id, secrets }` | `{ state: 'connected', tools: [...] }` |
| `connectors.disconnect` | `{ id }` | `{ state: 'idle' }` |
| `connectors.tools` | `{ id }` | 该连接器已注册的工具名与入参 schema 摘要 |
| `connectors.log` | `{ id, limit }` | 最近调用（工具名 / 耗时 / 成功失败） |

### 适配器怎么实现（三选一，按目录声明的 kind）

- **`mcp-stdio` / `mcp-http`（战略主线）**：讲 MCP 的 JSON-RPC：`initialize` → `tools/list` → 包装成
  `ToolDefinition`，`tools/call` 转发。40 项里一大半描述就是「XXX MCP」，这条通道一次接通一片。
- **`rest`**：manifest 里给一个极小的端点表（`{ tool, method, path, bodyFrom }`），不引入 OpenAPI 解析器。
  GitHub 用它起步最省事。
- **`builtin`**：就是现在的 figma 那种，凭据由插件自己管；用来做「无需配置、开箱可用」的样本。

### 安全边界（写进代码注释，也写进详情页）

1. **凭据只存在于后端进程**：不进 prompt、不进会话 JSONL、不进前端内存；RPC 只返回 `hasKey`。
2. **写操作二次确认**：manifest 里 `write: true` 的工具，`connector-hub` 注册一条 `ToolGuard`——
   首次调用返回「需要确认」，前端弹确认后带 `approvedAt` 重发。读操作直接放行。
3. **作用域最小化**：详情页把 `scopes` 原文列出；断开即删除密钥。
4. **审计**：每次调用写一行 `usage.jsonl`（`connector`、`tool`、`ms`、`ok`），详情页可查最近 20 次。
5. **网络边界**：所有外呼都在 Node 侧（`fetch`/子进程），前端只发 RPC——预览环境里浏览器没有外网也能用。

---

## 5. 前端：卡片 → 详情抽屉 → 连接

### 5.1 连接器页（专家 → 连接器）

- 卡片加状态：`已连接`（绿点）/`演示`（灰标）/`需重新授权`（橙点）。
- 顶部加筛选：`全部 / 已连接 / 需要凭据 / 无需配置`，搜索框保留。
- **点卡片打开详情抽屉**（不再是「跳设置」）：

```
┌ 连接器详情 ─────────────────────────────┐
│ [logo] GitHub                    已连接  │
│ 在 GitHub 上克隆、推送代码、管理 PR        │
│                                          │
│ 需要权限   repo:read · pr:write          │
│ 连接方式   Personal Access Token         │
│ [ Personal Access Token  ▸ 去申请 ]      │
│ [ 测试连接 ]              [ 连接 ]        │
│                                          │
│ 连接后可用（3）                           │
│  github.repo_info      读取仓库信息  [读] │
│  github.list_issues    列出 issue    [读] │
│  github.create_pr      创建 PR       [写] │
│                                          │
│ 最近调用  2 分钟前 github.list_issues 120ms│
└──────────────────────────────────────────┘
```

- 已连接时按钮变 `断开连接`（danger），并显示账号名与连接时间。
- 演示型连接器（无真实后端）：按钮文案 `启用演示数据`，启用后同样会注册工具、返回 fixture，
  **详情页与技能页都要有「演示数据」标注**，不能让人以为连了真服务。

### 5.2 技能页 / 专家

- 连上后 `tools.list` 变化 → 技能页「已装载工具」自动多出 `github.*`，无需额外接线。
- 专家的 `tools` 白名单支持通配：`github.*`，这样新工具不用改专家配置。

### 5.3 会话里

- 工具调用在时间线里显示为 `connector · github.create_pr`，可展开看参数与结果（已有 tool 折叠结构）。
- 写操作确认卡片：`将向 owner/repo 创建一个 PR` → `[确认] [取消]`。

---

## 6. 错误处理矩阵

| 情况 | 后端 | 前端 |
|---|---|---|
| 凭据缺失 | `connect` 前校验，返回 `missing: token` | 输入框高亮，按钮不置灰（点了给明确原因） |
| 401 / 403 | `markError('凭据无效或权限不足')` | 橙点 + 详情页「重新授权」 |
| 429 | 指数退避 3 次后报错 | 提示「触发限流，稍后再试」 |
| 超时 | 工具级 `timeoutMs`（默认 15s，沿用 `ToolDefinition`） | 时间线里标记超时，不阻塞后续对话 |
| 本地进程挂了（mcp-stdio） | `close()` + 状态转 `error` | 提示「本地服务已退出」，可一键重启 |
| 后端整体不可达 | — | 沿用刚落地的 `loadPresets` 模式：读取态 + 超时 + 重试，不把空态钉死 |

---

## 7. 分阶段

### P0 · 打通一条完整链路（建议先做，1–2 天量级）

1. `catalog.ts`：把 40 条 demo 数据升级成 manifest（先补 `id / vendor / kind / auth / tools` 字段，文案不动）。
2. `credentials.ts` + `connectors.json` 状态文件（照抄 `models.keys.json` 的写法）。
3. `connector-hub` + `rest` 适配器，接 **GitHub**：`repo_info` / `list_issues` / `create_pr`（写）三个工具。
4. 前端：详情抽屉 + 连接/断开/测试，卡片状态，筛选。
5. **验收**：输入 PAT → 连接成功 → 技能页出现 3 个 `github.*` → 会话里让设计经理列出 issue 有结果 →
   断开后工具消失、`connectors.keys.json` 里该条被删、`/health` 的 connector 计数回落。

### P1 · 战略通道与授权（3–5 天）

1. `mcp-stdio` 适配器 + 一个本地 MCP 服务样例（`tools/mcp-echo.mjs`），跑通握手与 `tools/call`。
2. OAuth 设备码流（GitHub / 飞书），凭据自动续期。
3. `ToolGuard` 写操作确认 + 审计日志 + 详情页「最近调用」。
4. 40 项全部可达：没有真实后端的走 `demo`，标注清晰。

### P2 · 让人用得放心

1. 连接器市场：版本、更新、卸载、按目录项开关工具子集。
2. 按专家的授权矩阵（这个专家只允许用哪几个连接器）。
3. 限流与配额、企业共享凭据（团队级密钥托管）。
4. 连接器健康巡检（定时 `test()`，失效自动转橙点）。

---

## 8. 测试怎么写

- **单测**（`test/connectors.test.ts`）：状态机流转、凭据文件权限 600、`disconnect` 后工具真的注销、
  `write` 工具未确认时被 guard 拦下。
- **适配器测**（`test/connector-adapters.test.ts`）：起一个本地 `node:http` 假服务，覆盖 200 / 401 / 429 / 超时；
  MCP 用本地子进程，覆盖握手、`tools/list`、进程退出。
- **前端静态断言**（`test/web-public.test.ts`）：目录 40 项、每项都有详情入口、演示型带「演示数据」标记、
  没有「跳设置」这种万能兜底。
- **端到端**（probe）：连接 → 工具出现 → 对话调用 → 断开 → 工具消失，全流程截图。

---

## 9. 取舍说明

- **为什么不做「万能 URL 集成」**：通用 REST/OpenAPI 解析看着省事，但错误处理、鉴权差异、分页语义全要
  单独写，最后得到的是一层谁也调不动的壳。manifest 驱动的「每个连接器一小段声明」反而更快落地。
- **为什么 MCP 优先**：目录里多数条目本身就是 MCP/CLI 套件，一条 MCP 通道能把「一次接一个」变成「一次接一类」。
- **为什么 40 个要全留**：这是产品叙事的一部分（生态广度）；但每一项必须能打开详情、说清要什么权限，
  没有后端的明确标「演示」，比删掉更诚实，也比假装能连更诚实。
