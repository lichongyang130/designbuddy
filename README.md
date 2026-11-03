# designbuddy-kernel

一套可直接搬进 DesignBuddy 的 **Agent 框架内核 + 参考实现**，架构对齐 `deepseek-ai/deepseek-harness`（DSH）。

设计原则和 DSH 一致：**没有特权的核心，一切皆插件**。连 `tools`、`sessions`、`llm`、`agentLoop` 本身都是插件，都能单独卸载替换。

- 零运行时依赖（用 Node 24 原生 TypeScript 类型擦除直接跑 `.ts`）
- 159 个测试全部通过
- `tsc --noEmit` 类型检查通过
- 完整 demo：Manager → 专家分派 → 记忆写回 → 插件热卸载

## 快速开始

```bash
node demo/run.ts                              # 看完整链路（不需要装任何依赖）
node apps/client/main.ts                      # 跨进程版：客户端 spawn 宿主进程
npm test                                      # 159 个用例
npx tsc -p tsconfig.json --noEmit             # 类型检查（需先 npm install）
```

`node demo/run.ts` 会依次打印：启动树、一轮完整多专家对话、客户端重建的会话、路由记录、会话日志、**插件卸载被拒绝 → 级联卸载**、卸载后的启动树。

## 目录结构

```
src/
├── kernel/index.ts          # 插件内核：Context / Fiber / Registry / effect 栈
├── core/                    # 与框架无关的能力实现
│   ├── connectors.ts        #   连接器状态文件（.designbuddy/connectors.json）
│   ├── credentials.ts       #   凭据文件（0600，只给后端读）
│   ├── approvals.ts         #   写操作审批中介（默认拒绝、超时兜底）
│   ├── deck.ts              #   演示文稿引擎：需求分析→大纲→视觉→逐页→审核→局部改
│   ├── tools.ts             #   工具注册表 + 守卫管线
│   ├── router.ts            #   AI Model Router（失败回退）
│   ├── session.ts           #   append-only 会话日志
│   ├── prompt.ts            #   系统提示分节装配
│   ├── agent.ts             #   preset 注册表 + agent/* 事件
│   ├── agent-loop.ts        #   默认 Agent 驱动
│   ├── llm.ts               #   消息与流词汇 + 适配器 seam
│   └── schema.ts            #   JSON Schema 子集与参数校验
├── connectors/              # 连接器：目录 → 适配器 → 工具
│   ├── catalog.ts           #   40 条 manifest（名称/权限/鉴权/工具）
│   ├── adapters.ts          #   rest（真请求）、mcp（真握手）与 demo（结构化样例）
│   ├── mcp.ts               #   MCP：JSON-RPC + Streamable HTTP + stdio 两种传输
│   └── hub.ts               #   连接状态机、工具注册/注销、JSONL 审计
├── plugins/                 # 每个能力都是一个插件（export name/inject/apply）
│   ├── core-*.ts            #   把 core/ 的服务挂成 ctx.<key>
│   ├── connector-hub.ts     #   ConnectorHub 挂成 'connectors' 服务
│   ├── approvals.ts         #   写工具守卫：每次调用前弹确认（'approvals' 服务）
│   ├── deck-engine.ts       #   演示文稿生成服务：异步流事件 + 计划确认 + 局部修改（'decks'）
│   ├── design-memory.ts     #   Design Memory：服务 + prompt 分节 + 2 个工具
│   ├── design-experts.ts    #   Manager + 多专家（委托即工具）
│   ├── connector-figma.ts   #   外部连接器（fixture 版）
│   └── mock-llm.ts          #   离线可跑的确定性模型适配器
├── sdk/                     # Host/Client 分层
│   ├── protocol.ts          #   帧定义 + 进程内环回传输（平台无关）
│   ├── host.ts              #   宿主：执行、RPC、事件转发
│   └── client.ts            #   客户端：请求 + 状态投影（ClientStore）
└── boot/                    # 启动装配
    ├── loader.ts            #   profile / bundle / patch
    ├── app.ts               #   挂载、卸载、依赖检查
    └── profiles.ts          #   DesignBuddy 的 core / models / design 三个 bundle

tools/
└── mcp-echo.mjs             # 最小 MCP 服务器（stdio），测试与手动联调都用它

apps/
├── host/main.ts             # 宿主进程：JSONL over stdio，持有内核
├── client/main.ts           # 客户端进程：spawn 宿主，只消费帧（不 import kernel）
└── web/                     # 网页版：SSE 下行 + POST 上行的 RPC，静态资源按请求读取
    ├── server.ts            #   /、/events、/send、/health
    └── public/              #   index.html（界面）、cases.js（案例）、i18n.js（七种语言）
```

## 插件长什么样

DSH 的插件契约是 `name` + `inject` + `apply`，这里完全一致：

```ts
import type { Context } from '../kernel/index.ts'
import type { ToolRegistry } from '../core/tools.ts'

export const name = 'connector-figma'
export const inject = ['tools', 'designMemory']   // 缺依赖就保持 pending，不会报错退出

export function apply(ctx: Context, config: Config) {
  const tools = ctx.require<ToolRegistry>('tools')
  // 注册即副作用：卸载时自动撤销，不需要写清理代码
  ctx.effect(() => tools.register({ name: 'figma.inspect_frame', ... }))
}
```

`ctx.effect(() => ...)`、`ctx.provide()`、`ctx.on()`、`ctx.plugin()` 全部登记在这条插件的 effect 栈上，卸载时**逆序回滚**。子插件先于父插件卸载。

## 三个核心机制

| 机制 | 位置 | 一句话说明 |
|---|---|---|
| **服务注入** | `Context.provide` / `inject` | 依赖不满足时插件停 `pending`，服务一出现立刻激活，因此不需要启动顺序表 |
| **可回滚副作用** | `Fiber` 的 effect 栈 | 卸载插件 = 精确撤销它加的一切，包括工具、prompt 分节、preset 覆盖 |
| **双流事件** | `sdk/protocol.ts` | 持久事件（session log）驱动 transcript，live 事件（agent/*）驱动状态动画，混用会导致重连后文字重复 |

`apps/client/main.ts` 是这层的验收标准：它 `spawn` 宿主进程、只吃 JSONL 帧，**不 import 任何 kernel / core / plugin**。如果它离开 `src/core/` 就编译不过，说明分层只是装饰。

## 接进 DesignBuddy

详见 [`ARCHITECTURE-COMPARISON.md`](./ARCHITECTURE-COMPARISON.md)，那里有 DSH 真实源码位置与本实现的逐项映射。移植顺序建议：

1. 只搬 `src/kernel/index.ts`，跑通一条 `provide`/`inject`/`effect` 测试；
2. 把现有单例（DesignMemory、连接器、资产库）改成插件提供的服务；
3. 再包 `tools`/`sessions`/`prompt`/`agents`/`agentLoop`；
4. 最后加 `sdk/`，让前端只消费帧，可灰度切换。

## 已知限制（刻意为之）

- **服务注销不会自动重载依赖方**。改用 `Registry.dependentsOf()` + `App.unmount(rowId, { cascade })` 显式处理：要么拒绝，要么级联卸载。静默重载更难排查。
- 没有 HMR、没有隔离域、没有配置 schema 校验（DSH 用 Schemastery/zod）。
- 不在客户端执行插件代码（DSH 的 `extensions/cordis-client-runner` 是安全面，不宜作为起点）。
- `mock-llm` 是确定性脚本适配器，用来离线跑通全链路；接真实模型只需实现 `LlmAdapter.stream()` 并 `router.register()`。
