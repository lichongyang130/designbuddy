# DeepSeek Harness ↔ DesignBuddy 源码级架构对比

本文档基于我**实际拉取**的仓库内容写成，不是根据二手介绍推测。核对方式与结论都写在第一节，方便你复核。

- 仓库：`deepseek-ai/deepseek-harness`（默认分支 `master`，MIT，`description: "DeepSeek Harness: Everything is a Plugin."`）
- 语言统计（GitHub Languages API）：TypeScript 69,097,432 B ≈ 95.5%，CSS 1.3%、Python 1.3%、JavaScript 0.7%、Swift 0.5%
- topics：`ai-agents`、`cordis`、`dsh`、`dsh-plugin`
- 仓库规模：23,049 个路径，其中 `packages/` 占 12,907

---

## 一、先纠正两处资料错误

写代码之前先对齐事实，否则后面的架构判断会跟着错。

| 你资料里的说法 | 核实结果 |
|---|---|
| 架构文档在 `deepseek-harness.github.io` | **不成立**。该站点返回 404。真实架构文档是仓库里的 `docs/architecture.md`（另有 `docs/architecture.zh.md`）。 |
| "Cordis 是官方自己开发并采用的框架" | **不准确**。Cordis 是上游第三方框架（`cordiverse/cordis`），DSH 把它 **vendor 进仓库**成 `vendor/cordis`，包名 `@deepseek-ai/cordis`，并且各插件以 `peerDependencies` 引用 `workspace:~`。旁证：`vendor/cordis-rc11-upgrade-plan.md` 说明他们在跟进上游版本。 |
| React / Vite / Vitest / pnpm | **成立**。`apps/web/package.json` 的 devDeps 含 `react`、`react-dom`、`@vitejs/plugin-react`、`vite`；根 `package.json` 用 `pnpm@11.28.5`，测试是 `vitest run`，构建是 `tsdown`（不只 tsc）。 |
| "Everything is a Plugin" | **成立**，而且是官方原话。`docs/architecture.md` 写道：*"There is no privileged core to patch: you extend dsh by mounting a plugin beside the others, and registrations are effects that unwind when their plugin unloads."* |

顺带一个资料里没提但很关键的点：**构建用 `tsdown`，不是裸 tsc**；`dependencies` 里没有 `@deepseek-ai/cordis`，它只在 `peerDependencies` 里 —— 插件不打包框架，由宿主提供。这是插件能被复用的前提。

---

## 二、真实目录结构

`packages/` 的二级分组（我按 API 返回的路径聚合）：

| 分组 | 代表包 | 职责 |
|---|---|---|
| `core/` | `agent`、`agent-loop`、`session`、`system-prompt`、`tools`、`scope` | 内核能力，各自提供 `ctx.<key>` |
| `llm/` | `llm`、`llm-deepseek`、`llm-retry`、`token-meter` | 模型 seam 与具体适配器分离 |
| `boot/` | `app-boot`、`plugin-manager`、`plugin-market`、`hmr`、`cmdline` | 组合、运行时装卸、热更新 |
| `host/` | `webserver`、`frontend-static`、`plugin-inventory` | 宿主进程：HTTP、静态资源、插件清单 |
| `client/` | `connection`、`store`、`ui-*`（约 40 个 UI 插件） | 前端按功能拆成插件 |
| `sdk/` | `protocol`、`server`、`client` | 宿主↔客户端契约 |
| `bundle/` | `base`、`web-app`、`headless`、`sdk-app`、`sdk-minimal`、`acp-app` | 发行组合（profile 的第一层） |
| `extensions/` | `cordis-host-runner`、`cordis-client-runner`、`tool-cordis` | 让 Agent 自己写/装插件 |
| 领域层 | `fs/`、`sandbox/`、`session/`、`preset/`、`subagent/`、`mcp/`、`skill/`、`guard/`、`compaction/` | 按能力切分 |
| `experimental/` | `agent-team`、`forge`、`cua`、`liveshare`、`webhook` | 未定型的探索，单独隔离 |
| `util/`、`typert/`、`test-support/` | `atomic-write`、`code-language`、`llm-mock-server`、`agent-loop-testkit` | 基础设施与测试支撑 |

`apps/` 只有四个真应用：`cli`、`desktop`、`desktop-host`、`web`，外加 `plugin-market-generator`。

**值得注意的结构信号**：

1. `core/` 里没有"上帝模块"，`agent` 与 `agent-loop` 是**两个包** —— 接口与实现分离，方便替换驱动。
2. 测试支撑是**一等公民**（`test-support/llm-mock-server`、`agent-loop-testkit`），说明可测性被写进架构。
3. `experimental/` 独立存在，说明他们允许长出边界，但不让边界污染主干。

---

## 三、插件机制：一个真实插件长什么样

我拉了 `packages/context/time-context/src/index.ts` 和它的 `package.json`，这是最可靠的样本：

```ts
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = 'time-context'            // loader 诊断用的插件名
export const inject = ['agents', 'sessionProjections']  // 缺一个就保持 pending
export interface Config { timeZone?: string; refreshIntervalMs?: number }
export const Config: z<Config> = z.object({ ... })      // 配置校验由框架调用
```

由此可以确认 DSH 插件契约的四个要素：

1. **`name`** —— 插件身份，出现在启动树与诊断里。
2. **`inject`** —— 声明依赖的服务；服务不在就**不激活**（不是报错退出）。这是它能做到"任意组合、任意顺序"的根本机制。
3. **`Config` 导出** —— 配置 schema 由框架读取并校验，插件内部不再写校验代码。
4. **注册即副作用** —— `docs/architecture.md` 明确说 registrations are effects that unwind when their plugin unloads。

另外两个细节值得抄：

- 它用 `declare module '@deepseek-ai/dsh-llm' { interface MessageSourceMap { ... } }` 做**类型级扩展点**，插件能扩消息来源而不改核心类型。
- `@deepseek-ai/cordis` 在 `peerDependencies`，不在 `dependencies`。

### 组合：profile / bundle / patch

`docs/architecture.md` 原文模型，比"配置文件"复杂一层：

- **profile**：命名的组合，存在 Harness home，列出它叠的 bundles、外装插件、以及用户自己的 `cordis.patch.yml`。`web`、`headless`、`sdk`、`sdk-minimal`、`acp` 是模板。
- **bundle**：Cordis 配置行 + 它们挂载的代码的**发行格式**，插进去的内容仍然能被上层 patch。
- 声明位置在各自 `package.json` 的 `dsh` 字段：`dsh.profile` 列 bundle，`dsh.bundle` 指向 patch 文件。
- 层序：profile 的有序 bundles → profile patch → home patch → `--patch`。**patch 按 id 命中行，整块替换它的 config，或插入新行。**

查看实际启动树：`dsh --profile web --dump-config`。

### 事件：三分类

`docs/architecture.md` 把事件分成三类，这个划分决定了代码该放哪：

| 类型 | 性质 | 归属 |
|---|---|---|
| **Session events** | 持久事实，追加进日志，通过 `session/event` 广播 | 必须能跨 reload 存活 |
| **Agent events**（`agent/*`） | 携带活的 `Agent`：inbox、step、status、request、validation、continuation | 观察/拦截飞行中的工作 |
| **Capability events**（`fs/*`、`tools/*`、`telemetry/*`） | 给 seam 挂策略与适配器 | 不 import loop 就能扩展 |

核心包与它们的 `ctx` key（原文表格）：

| 包 | 拥有 | `ctx` key |
|---|---|---|
| `core/session` | append-only `SessionEvent` 日志 + 内存 store | `ctx.sessions` |
| `core/system-prompt` | prompt 分节与工具 schema 组装 | `ctx.systemPrompt` |
| `core/tools` | 作用域工具注册表 + 守卫执行管线 | `ctx.tools` |
| `core/agent` | `Agent` 接口、活注册表、`agent/*` 事件 | `ctx.agents` |
| `core/agent-loop` | 实现该接口的默认驱动 | `ctx.agentLoop` |
| `llm/llm` | 消息与流词汇 + 适配器 seam | `ctx.llm` |

---

## 四、我给你的实现 ↔ DSH 真实位置

代码在 `src/`，一列一列对得上。

| DSH 真实位置 | 我的实现 | 保留的语义 | 刻意没做 |
|---|---|---|---|
| `vendor/cordis/src/{context,fiber,registry,service,events}.ts` | `src/kernel/index.ts` | Context/Fiber 状态机、effect 栈 LIFO 回滚、`inject` 等待激活、服务注销复原、子插件级联卸载、`dispose` 事件 | Proxy 式 `ctx.xxx` 服务访问、HMR、隔离域、schema 校验 |
| `packages/core/tools`（`ctx.tools`） | `src/core/tools.ts` + `src/plugins/core-tools.ts` | 注册表、守卫管线（lookup→validate→policy→timeout→execute→truncate）、错误结果化 | 审批 UI、sandbox 策略、并行执行 |
| `packages/core/session` + `session/session-persistence-jsonl` | `src/core/session.ts` | append-only + `seq`、消息投影、订阅、`toJsonl()`/`loadJsonl()` | SQLite、checkpoint、projection cache |
| `packages/core/system-prompt` | `src/core/prompt.ts` | 分节 + `order` + 按装载状态渲染 | 工具 schema 组装、缓存、多语言 |
| `packages/core/agent` + `preset/agent-preset-registry` | `src/core/agent.ts` | preset（配置）与 instance（运行）分离、`agent/*` 事件 | inbox、并发调度、continuation |
| `packages/core/agent-loop` | `src/core/agent-loop.ts` | step/turn、工具循环、结束原因（`done`/`failed`/`aborted`/`max steps`） | compaction、重试、并行工具、validation 阶段 |
| `llm/llm` + `llm/llm-retry` + `llm/llm-deepseek` | `src/core/router.ts` + `src/plugins/core-llm.ts` + `src/plugins/mock-llm.ts` | 适配器 seam、kind→候选链、**仅在首块输出前回退**、attempt 记录 | token 计量、真实 SDK、流式 tool delta |
| `packages/boot/app-boot` + profile/bundle patch | `src/boot/{loader,app,profiles}.ts` | profile→bundle→row、按 id 整块替换 config、禁用行、缺失模块只报错不致命 | YAML patch 文件、HMR、市场安装 |
| `packages/host/webserver` + `api/*-controller` + `sdk/protocol` | `src/sdk/{protocol,host}.ts` | 请求/响应帧 + 两条单向事件流、session 级隔离 | WebSocket、鉴权、多租户、远程接入 |
| `packages/client/connection` + `client/store` + `ui-*` | `src/sdk/client.ts` | 客户端状态机；**transcript 只由持久事件投影，activity 才用 live 事件** | React 组件、slots、主题 |
| `packages/subagent/*` | `src/plugins/design-experts.ts` 的 `expert.consult` | 委托是普通工具；子 Agent 开**独立 session**，不污染父会话 | 跨进程 subagent、ACP、worktree |
| `packages/extensions/cordis-*` | 未实现 | — | 运行时下发并执行插件代码（安全边界太大，不该从这个起点开始） |

### 我修掉的两个真 bug（说明测试确实在起作用）

1. **内核重入**：`#runner` 在 `#run()` 返回后才赋值，插件在 `provide()` 里触发 settle 会起**嵌套 run**，让消费者先于提供者激活。修法：`#run()` 开头让出一次微任务，保证 runner 先发布。对应测试 `test/kernel.test.ts` 的前两条。
2. **`type: 'tool_call'` 判别字段缺失**：mock 适配器漏了这个字段，`toolCallsOf()` 过滤掉全部调用，模型每步都"忘记"自己调过工具，回合打满步数失败。这个 bug 是 `tsc` 本可以在编译期拦住的 —— 所以我补了 `npm run typecheck`。

### 一处诚实的语义缺口

内核**不会**在服务注销时自动重载依赖方（DSH 有 HMR 与 reload 机制处理这件事）。我的处理是把风险显式化：`Registry.dependentsOf()` / `servicesOwnedBy()`，由 app 层 `unmount()` 决定拒绝还是级联。demo 里能看到：

```
拒绝: cannot unload "design.memory": still required by figma
```

这是我认为更适合 DesignBuddy 的取舍 —— 静默重载比明确报错更难排查。

---

## 五、三条最值得搬的设计，以及怎么落到 DesignBuddy

### 1. Cordis 插件系统 → 让专家/技能/连接器独立装卸

**为什么值得**：DesignBuddy 的"专家、技能、连接器"天然是可插拔单元。用 `inject` 声明依赖，就不需要维护启动顺序表；注册即副作用，就不需要写卸载清理代码。

**落地方式**（已在你手上的代码里验证）：

```ts
// src/plugins/connector-figma.ts
export const name = 'figma'
export const inject = ['tools', 'designMemory']

export function apply(ctx: Context, config: Config) {
  const tools = ctx.require<ToolRegistry>('tools')
  ctx.effect(() => tools.register({ name: 'figma.inspect_frame', ... }))
}
```

卸载它，工具、它的 prompt 分节、它的服务全部自动消失，没有任何 `if (unloaded)` 分支。

### 2. Agent Runtime → Manager + 多专家，但委托只是工具

**为什么值得**：硬编码编排（`if 需要配色 then 调视觉专家`）会随专家数量爆炸。把委托做成 `expert.consult` 工具后，加一个专家 = 注册一个 preset，Manager 的 prompt 一个字都不用改。

**关键实现细节**：子 Agent 必须开**独立 session**，否则专家的中间推理会污染 Manager 的上下文，还会让 token 成本翻倍。

```ts
const child = sessions.create({ title: `${expert.name} · ${callCtx.agentId}` })
for await (const event of loop.run({ presetId: expert.id, sessionId: child.id, ... })) { ... }
```

另外每个 preset 的 `tools` 是白名单，专家拿不到 `expert.consult`，所以**结构上不可能递归**。

### 3. Host / Client 分层 → 后端执行引擎与前端界面解耦

**为什么值得**：你现在的 React 前端如果直接调 Agent，就等于把执行状态焊在 UI 生命周期上。分层后，桌面端、Web、CLI 共用同一个 Host。

**最该抄的一条规则**：**transcript 只从持久事件投影，动画/状态才用 live 事件。** 混用会导致重连后文字重复。代码里 `ClientStore` 就是这么写的，测试 `the client transcript comes from durable events only` 守着它。

---

## 六、移植到你的仓库

1. **先搬内核，别改业务**：把 `src/kernel/index.ts` 放进你的仓库，跑通一条 `provide`/`inject`/`effect` 的测试。约 500 行，零依赖。
2. **把现有单例改成服务**：`DesignMemory`、`AssetLibrary`、`Connector*` 这类模块，从 `export const x = new X()` 改成插件里 `ctx.provide('x', new X())`。这一步会暴露隐藏的启动顺序依赖，**收益也最大**。
3. **再接 Core**：`tools`/`sessions`/`systemPrompt`/`agents`/`agentLoop` 依次包装，保持 `ctx` key 与本文档一致，方便日后对照上游。
4. **最后动前端**：先加 `sdk/protocol` + `HostServer`，让现有 React 改成只消费帧。这一步可以灰度，不必一次切完。
5. **别抄的部分**：`extensions/cordis-client-runner`（在客户端执行下发的插件代码）、多租户、HMR。前者是安全面，后两者对单机桌面应用是过度设计。

---

## 七、参考来源（均为我实际读取的文件）

- `README.md`、根 `package.json`、`AGENTS.md`
- `docs/architecture.md`（profile/bundle/patch、核心包表、事件三分类、turn flow）
- `packages/context/time-context/src/index.ts` 与 `package.json`（插件契约样本）
- `packages/core/agent-loop/`、`packages/extensions/`、`packages/boot/plugin-manager/` 的文件清单
- `apps/web/package.json`（React/Vite 确认）、`vendor/cordis/` 文件清单
- GitHub API：仓库元信息、languages、递归 tree

**未读**：`vendor/cordis/src/*.ts` 的具体实现（我只读了文件名与架构文档的描述）。因此本文档对 Cordis 内部机制的描述属于**接口级**，不是逐行级；如果你要精确对齐 cordis 的语义，那 7 个文件值得单独读一遍。
