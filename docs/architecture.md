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

## 3. 副作用策略（packages/policy）

写入类工具不应该只靠提示词里的一句"先征求用户同意"。这里的做法是：

```
LLM 发起 tool call
        │
        ▼
ToolsService.execute()
        ├─ 未知工具 / 缺参数 → 直接失败
        ├─ guard.before(call)            ← policy 挂在这里
        │    ├─ scope=read        → 放行
        │    ├─ 命中 allow 列表    → 放行（默认 plan.*，只改会话内状态）
        │    ├─ mode=readonly     → 拒绝，不产生待确认项
        │    └─ 其它              → 挂起，emit approval/request，等待人
        │                             超时 / abort / 拒绝 → 拒绝
        ├─ tool.handler()
        └─ guard.after(...)
```

三个设计决定值得强调：

1. **拦截点必须在执行器**。守卫注册在 `ToolsService`，不是包在某个工具里，也不是写进 schema。工具作者不需要知道策略存在，策略也不需要知道有哪些工具。
2. **阻塞而不是事后审计**。`before` 返回 Promise，工具调用在 `await` 上停住，模型这一步本来就没结束——所以不存在"先写后撤"。
3. **拒绝是一次普通的工具失败**。模型收到 `denied: 用户没有批准 memory.save`，会自己换策略或解释，循环不需要特殊分支。

因为 policy 本身是插件，把它卸掉，审批就消失（模型直接写）——这既是可演示的行为，也是"一切皆插件"的代价：安全边界必须显式装载。

## 4. 外部能力（packages/mcp）

MCP 服务器对内核来说就是一个工具制造机：

```
McpClient.connect({command, args})   spawn → initialize → tools/list
        │
        ▼
registerTool(ctx, { name: 'mcp__figma__get_frames', scope: readOnly ? 'read' : 'write' })
        │
        ▼
tools/call  ← 模型调用时；崩溃只影响这一个工具
```

三件事是刻意这样设计的：

- **命名空间 `mcp__<server>__<tool>`**：提示词和 UI 里一眼看出归属，也避免与本地工具撞名。
- **连接失败不致命**：连接、列工具都在 `try` 里，失败只写日志。一个挂掉的 MCP 服务器等于少了个能力，不等于工作台坏了。
- **进程归插件所有**：`ctx.effect` 里 `client.close()`，卸载插件就 `SIGTERM`（1.5s 后 `SIGKILL`），测试里断言过没有孤儿进程。

专家白名单支持前缀通配（`mcp__*`），所以主理人能用到任何后来接入的外部工具，而后加入的专家也可以选择只看本地工具。

## 5. Host / Client

`packages/host` 是一个插件，且**不 inject 任何业务服务**。它在处理请求时才 `ctx.get('sessions')`，取不到就返回 503。

这不是偷懒，是为了让服务端在插件被卸载时继续存活：用户关掉 `memory`，整个 HTTP 服务不应该一起停。

前端只做两件事：

1. 打开时 `GET /api/state` 拿全量快照。
2. 之后订阅 `GET /api/events`（SSE），把内核事件应用到本地状态。

所以 `agent/delta` 的流式文本、`fork/change` 的插件状态、`log/append` 的日志，走的是同一条通道。前端不轮询，也不需要知道任何业务逻辑。

## 6. 与 DeepSeek Harness 的取舍

借鉴的部分：

- Cordis 的 Context / 服务注入 / Fork 生命周期 / `inject` 可选依赖。
- append-only session log，历史从日志投影。
- 系统提示词按段落拼装。
- Host 与 Client 分离，UI 只是内核的观察者。

没有做的部分，以及原因：

| 没做 | 原因 |
|---|---|
| ACP 协议接入 | 需要真实的会话传输层；MCP 已完成（见上） |
| sandbox 进程隔离 | 当前工作区用路径沙箱（`WorkspaceService.resolvePath`）已能阻止越界 |
| 云端多租户 | Host 是无状态的，加一层会话归属即可 |
| Electron 桌面壳 | Web 已经能跑；桌面只是再包一层 |
| 60+ 包的细分 | 这个项目要能被一个人读完 |

如果你要往这个方向继续走，优先级建议是：

1. ~~工具守卫做成独立插件~~ —— 已完成（`packages/policy`）。下一步是把审批做成可持久化的队列（跨进程重启仍待决）。
2. ~~MCP 客户端插件~~ —— 已完成（`packages/mcp`）。下一步是支持 HTTP/SSE 传输与 resources/prompts。
3. **记忆检索换成向量**：`MemoryService.search` 是唯一需要改的地方。
4. **会话分支**：事件日志天然支持从任意 seq 分叉。
