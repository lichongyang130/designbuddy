# DesignBuddy

一个**插件化**的设计 Agent 工作台：内核 700 行，能力全部是可装卸的插件。

> Everything is a Plugin —— 参考 DeepSeek Harness 的 Cordis 架构思路，用 TypeScript 从零实现。

![status](https://img.shields.io/badge/build-passing-4ade80) ![license](https://img.shields.io/badge/license-MIT-7f6cf7)

---

## 它能做什么

界面是浅色工作台，分三层：

- **图标栏**：首页 / 最近对话 / 工作区文件 / 设计记忆 / 插件 / 设置，底部是 `⌘K` 快速跳转。
- **工作区侧栏**：新建会话、最近的文件、搜索、设计记忆、插件与运行内核、会话列表。
- **主区**：首页是居中的大输入框 + 能力 chips + 推荐模板；进入会话后变成对话、工具调用卡片和审批条。

打开页面后你看到的不是一个聊天框，而是一个可观察的 Agent 运行时：
- 模型要写文件时先停下：顶部出现确认条，写清工具名和参数，你点"允许"才执行；也可以一键切到只读。拦截在执行器里，模型无论怎么被提示词诱导都绕不过去。
- 打开右侧「运行内核」面板（图标栏的插件图标）关掉 `memory`，模型的系统提示词里立刻少一段，`memory.save` 工具立刻消失。
- 关掉 `tools`，所有工具插件自动进入 `pending`，重新打开时自动恢复 —— 不需要重启进程。
- 每个插件都可以在面板里改配置并热重载。
- 推荐模板是 CSS 画的缩略图，点一下就会带着该模板的提示词开一个新会话。

默认模型是**离线示例模型**（规则驱动、无 API key），它真的会调用工具：说"帮我拆解步骤"它会调 `plan.write`，说"看看项目里有什么"它会调 `fs.list`。配上真实模型后行为完全一致，只是回答质量不同。

## 快速开始

```bash
npm install
npm run dev          # 编译 TypeScript + 构建前端 + 启动服务
# 打开 http://localhost:5178
```

开发前端（带热更新）：

```bash
npm run dev:web      # Vite 5179，代理 /api 到 5178
```

跑测试：

```bash
npm test             # 18 个测试：内核生命周期、依赖挂起、Agent 循环、审批门禁、MCP 子进程
```

接入真实模型：在右侧「插件 → OpenAI 兼容模型」里填 `baseUrl` / `apiKey` / `models`，或直接用环境变量：

```bash
OPENAI_API_KEY=sk-... npm run dev
# DeepSeek: baseUrl=https://api.deepseek.com/v1, models=deepseek-chat
```

## 架构

```
apps/
  server/          组合根：选插件、启动 Host
  web/             React + Vite 工作台
packages/
  core/            内核：Context / 服务总线 / Fork 生命周期 / 依赖注入
  host/            HTTP + SSE，本身就是一个插件
  llm/             模型路由（provider 以插件形式注册）
  session/         append-only 事件日志
  system-prompt/   有序的提示词段落
  tools/           工具注册表 + 守卫执行管线
  agents/          Agent 注册表 + 默认 loop（step / tool call / 回灌）
  presets/         专家团（数据，不是代码分支）
  memory/ skills/ plan/ workspace/
  tool-*/          每种工具是一个独立插件
  model-mock/ provider-openai/
```

依赖关系不是 import，而是**服务 key**：

```ts
export const name = 'tool-fs'
export const inject = ['tools', 'workspace']

export function apply(ctx) {
  const tools = ctx.get('tools')
  tools.register({ name: 'fs.read', ... })
  ctx.effect(() => tools.unregister('fs.read'))   // 卸载时自动清理
}
```

`inject` 里任何一个服务消失，这个插件就被挂起（`pending`），重新出现时被激活。没有任何 `if (hasMemory)` 判断散落在业务代码里。

三条设计原则：

1. **一个异步操作只有一个生命周期所有者**。`Fork` 同时拥有服务、事件、子插件和清理钩子，`dispose` 一定跑完。
2. **历史只有一份**。会话是事件日志，模型消息、UI 时间线、计划进度都是它的投影。
3. **在做出决定的那一层执行决定**。工具守卫写在 executor 里，不写在提示词里；模型绕过提示词也照样被拦住。

## 插件

| 插件 | 作用 |
|---|---|
| `core` | Context、服务总线、Fork 生命周期 |
| `llm` | 模型路由，provider 可插拔 |
| `sessions` | append-only 事件日志 + JSONL 持久化 |
| `systemPrompt` | 按 `order` 拼装提示词段落 |
| `tools` | 工具注册 + 守卫管线 |
| `policy` | 副作用策略：只读 / 写需确认 / 自动放行 |
| `agents` / `presets` | Agent 循环 / 专家团 |
| `memory` | 设计记忆，跨会话注入 |
| `skills` | Markdown 技能库，按需打开 |
| `plan` | 会话级计划器 |
| `workspace` | 沙箱化工作目录 |
| `tool-fs` `tool-memory` `tool-plan` `tool-skill` `tool-agent` | 具体工具 |
| `mcp` | MCP 客户端：外部服务器（Figma / Notion / 文件系统…）的工具注册进同一个 registry |
| `model-mock` `provider-openai` | 模型 |
| `host` | REST + SSE + 静态托管 |

新增一个能力 = 新增一个包 = 在 `apps/server/src/registry.ts` 里加一行。

### 接一个外部 MCP 服务器

在右侧「插件 → MCP 客户端 → 配置」里填：

```json
[{ "name": "figma", "command": "npx", "args": ["-y", "figma-mcp"], "readOnly": true }]
```

它的工具会以 `mcp__figma__<tool>` 出现在工具列表里，Agent 循环、提示词、审批门禁全部自动生效——因为对内核来说它和本地工具没有区别。仓库里带了一个可运行的最小 MCP 服务器 `apps/server/test-fixtures/design-mcp-server.js`，可以用它先验证链路：

```json
[{ "name": "design", "command": "node", "args": ["apps/server/test-fixtures/design-mcp-server.js"], "readOnly": true }]
```

然后问「查一下最近的评审记录」。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/state` | 服务、插件、模型、专家、工具、日志的全量快照 |
| GET | `/api/market` | 插件市场（含配置 schema 与装载状态） |
| POST | `/api/market/:name/enable` \| `/disable` | 运行时装卸插件 |
| POST | `/api/market/:name/config` | 改配置并热重载 |
| GET/POST | `/api/sessions` | 会话列表 / 新建 |
| POST | `/api/sessions/:id/messages` | 触发一轮，结果通过 SSE 推送 |
| GET | `/api/events` | 内核事件总线（SSE），前端不轮询 |
| GET/POST | `/api/memory` | 设计记忆 |
| GET | `/api/policy` | 当前策略模式与待确认队列 |
| POST | `/api/policy/mode` | 切换 `auto` / `approve-writes` / `readonly` |
| POST | `/api/approvals/:id` | 批准或拒绝一次副作用（`{ allow }`） |

## 与 DeepSeek Harness 的对照

| | DeepSeek Harness | DesignBuddy |
|---|---|---|
| 插件内核 | Cordis | `packages/core`（Context + 服务总线 + Fork） |
| 服务发现 | `ctx.xxx` / `ctx.get()` | 同 |
| Agent 循环 | `packages/core/agent-loop` | `packages/agents/loop.ts` |
| 会话 | append-only event log | 同（JSONL 持久化） |
| 提示词 | section 拼装 | 同 |
| 工具 | registry + 执行管线 | 同（多了 guard 钩子 + policy 插件） |
| 副作用审批 | 权限/审批层 | `packages/policy`，阻塞式 human-in-the-loop |
| MCP | 内置 MCP 支持 | `packages/mcp`，stdio 传输，工具自动注册 |
| Host / Client | host 包 + client 包 | `packages/host` + `apps/web` |
| 规模 | 60+ 包 | 20 包，够读懂 |

有意没做的：ACP、sandbox 进程隔离、云端多租户、Electron。这些都可以按同样方式加插件，不影响内核。

详见 [`docs/architecture.md`](docs/architecture.md) 与 [`docs/writing-a-plugin.md`](docs/writing-a-plugin.md)。

## License

MIT
