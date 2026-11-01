# DesignBuddy

一个**插件化**的设计 Agent 工作台：内核 700 行，能力全部是可装卸的插件。

> Everything is a Plugin —— 参考 DeepSeek Harness 的 Cordis 架构思路，用 TypeScript 从零实现。

![status](https://img.shields.io/badge/build-passing-4ade80) ![license](https://img.shields.io/badge/license-MIT-7f6cf7)

---

## 它能做什么

打开页面后你看到的不是一个聊天框，而是一个可观察的 Agent 运行时：

- 左侧是会话，中间是对话与工具调用卡片，右侧是**正在运行的内核**。
- 在右侧「插件」面板关掉 `memory`，模型的系统提示词里立刻少一段，`memory.save` 工具立刻消失。
- 关掉 `tools`，所有工具插件自动进入 `pending`，重新打开时自动恢复 —— 不需要重启进程。
- 每个插件都可以在面板里改配置并热重载。

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
npm test             # 内核生命周期、依赖挂起、Agent 循环、工具守卫
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
| `agents` / `presets` | Agent 循环 / 专家团 |
| `memory` | 设计记忆，跨会话注入 |
| `skills` | Markdown 技能库，按需打开 |
| `plan` | 会话级计划器 |
| `workspace` | 沙箱化工作目录 |
| `tool-fs` `tool-memory` `tool-plan` `tool-skill` `tool-agent` | 具体工具 |
| `model-mock` `provider-openai` | 模型 |
| `host` | REST + SSE + 静态托管 |

新增一个能力 = 新增一个包 = 在 `apps/server/src/registry.ts` 里加一行。

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

## 与 DeepSeek Harness 的对照

| | DeepSeek Harness | DesignBuddy |
|---|---|---|
| 插件内核 | Cordis | `packages/core`（Context + 服务总线 + Fork） |
| 服务发现 | `ctx.xxx` / `ctx.get()` | 同 |
| Agent 循环 | `packages/core/agent-loop` | `packages/agents/loop.ts` |
| 会话 | append-only event log | 同（JSONL 持久化） |
| 提示词 | section 拼装 | 同 |
| 工具 | registry + 执行管线 | 同（多了 guard 钩子） |
| Host / Client | host 包 + client 包 | `packages/host` + `apps/web` |
| 规模 | 60+ 包 | 20 包，够读懂 |

有意没做的：ACP/MCP、sandbox 进程隔离、云端多租户、Electron。这些都可以按同样方式加插件，不影响内核。

详见 [`docs/architecture.md`](docs/architecture.md) 与 [`docs/writing-a-plugin.md`](docs/writing-a-plugin.md)。

## License

MIT
