# 架构

这份文档解释三件事：内核怎么运转、Agent 一轮对话里发生了什么、为什么这样分层。

## 1. 内核对（packages/core）

```
Container ──┬── services: Map<key, ServiceEntry[]>
            ├── forks: Map<id, Fork>
            ├── bus: EventBus
            └── logs

Fork ───────┬── plugin + 合并后的 config
            ├── state: pending | active | error | disposed
            ├── provides: string[]
            ├── inject: string[]
            └── disposer: Disposer
```

`Context` 是插件拿到的句柄，它绑定一个 `Fork`。通过它做的每一次注册都属于这个 Fork：

```ts
ctx.set('llm', service)          // 注册服务（卸载时自动移除）
ctx.effect(cleanup)              // 任何清理钩子
ctx.on('event', handler)         // 事件监听
ctx.plugin(child, config)        // 子插件，随父插件销毁
ctx.inject(['systemPrompt'], cb) // 可选依赖：依赖在则运行，不在则挂起
```

### 生命周期

1. `container.apply(plugin, config)` 创建 Fork，合并配置默认值，加入 `forks`。
2. `evaluate()` 反复对账，直到图稳定：
   - `inject` 里有缺失服务的 active Fork → `suspend`
   - 依赖齐备的 pending Fork → `activate`
3. `activate` 调用 `plugin.apply(ctx, config)`；返回的函数作为清理钩子。
4. `suspend` 先落状态，再释放服务，最后广播 `fork/change`。

顺序很关键：**先把状态落定，再释放服务**。反过来会导致 `removeServices → evaluate` 看到"仍然 active"的 Fork 而重复挂起，或者看到"变回 pending"的 Fork 而把它复活。这个 bug 在 `apps/server/src/tests/kernel.test.ts` 里有回归测试。

`evaluate()` 带重入保护：插件在 `apply` 里注册服务会再次触发对账，此时只置 `dirty` 标记，由外层循环继续。

### 为什么服务是字符串 key

Cordis 的做法，这里照抄：服务表是 `Map<string, unknown>`，使用方自己断言类型。

好处是新增能力不需要改动内核、不需要循环依赖、可以在运行时装卸。代价是失去编译期检查，所以约定每个包 `export` 自己的服务接口：

```ts
import type { LlmService } from '@designbuddy/llm'
const llm = ctx.get<LlmService>('llm')
```

## 2. 一轮对话

```
POST /api/sessions/:id/messages
        │
        ▼
AgentLoopService.run()
        │
        ├─ sessions.append(turn-start)
        ├─ sessions.append(user)
        │
        └─ for step in 1..maxSteps:
             ├─ systemPrompt.assemble({ sessionId, agent, expert, input })
             ├─ projectHistory(events) → ChatMessage[]
             ├─ tools.schemas() → 按专家 allowlist 过滤
             ├─ llm.stream() → 文本增量 / tool calls
             ├─ sessions.append(assistant)
             ├─ 对每个 tool call:
             │    ├─ sessions.append(tool-call)
             │    ├─ tools.execute()   ← 守卫在这里生效
             │    └─ sessions.append(tool-result)
             └─ 没有 tool call → append(turn-end, stop) 结束
```

关键点：

- **历史只有一份**。`projectHistory()` 把事件日志投影成模型消息；UI 用自己的投影渲染时间线；计划器直接读同一份状态。三处不会打架。
- **提示词是拼出来的**。`systemPrompt` 是一组 `{ id, order, render(input) }`。memory / skills / plan / workspace 各自 `ctx.inject(['systemPrompt'])` 注册自己的段落 —— 卸载插件，段落就消失。
- **step 上限**在插件配置里（默认 6），防止模型陷入工具循环。
- **subagent** 是 `agentLoop.delegate()`：新开一个会话、用另一个专家跑完、把结论以 `note` 事件写回父会话。父会话的历史因此保持可读，子会话仍然可以单独打开复盘。

## 3. Host / Client

`packages/host` 是一个插件，且**不 inject 任何业务服务**。它在处理请求时才 `ctx.get('sessions')`，取不到就返回 503。

这不是偷懒，是为了让服务端在插件被卸载时继续存活：用户关掉 `memory`，整个 HTTP 服务不应该一起停。

前端只做两件事：

1. 打开时 `GET /api/state` 拿全量快照。
2. 之后订阅 `GET /api/events`（SSE），把内核事件应用到本地状态。

所以 `agent/delta` 的流式文本、`fork/change` 的插件状态、`log/append` 的日志，走的是同一条通道。前端不轮询，也不需要知道任何业务逻辑。

## 4. 与 DeepSeek Harness 的取舍

借鉴的部分：

- Cordis 的 Context / 服务注入 / Fork 生命周期 / `inject` 可选依赖。
- append-only session log，历史从日志投影。
- 系统提示词按段落拼装。
- Host 与 Client 分离，UI 只是内核的观察者。

没有做的部分，以及原因：

| 没做 | 原因 |
|---|---|
| ACP / MCP 协议接入 | 需要真实的进程与传输层，属于"再加一个插件"，不改内核 |
| sandbox 进程隔离 | 当前工作区用路径沙箱（`WorkspaceService.resolvePath`）已能阻止越界 |
| 云端多租户 | Host 是无状态的，加一层会话归属即可 |
| Electron 桌面壳 | Web 已经能跑；桌面只是再包一层 |
| 60+ 包的细分 | 这个项目要能被一个人读完 |

如果你要往这个方向继续走，优先级建议是：

1. **工具守卫做成独立插件**（现已内置 hook，抽出来即可实现"只读模式""审批模式"）。
2. **MCP 客户端插件**：把外部工具注册进 `tools`，模型侧无感。
3. **记忆检索换成向量**：`MemoryService.search` 是唯一需要改的地方。
4. **会话分支**：事件日志天然支持从任意 seq 分叉。
