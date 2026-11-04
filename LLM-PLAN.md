# 接入真实大模型：方案

> 一句话：**管道已经通了，缺的是「开关」和「用法」**。今天配三个环境变量就能让对话跑在真模型上；
> 但设置页里存的模型不驱动运行时、有 Key 就没有兜底、大纲和逐页文案仍然是规则模板。
> 下面是按优先级排的四步，P0 半天，全做完大约 3 天。

---

## 0. 实施状态（2026-11-04）

**P0 / P1 / P2 已经落地**（P3 未做），测试 206/206，离线可验：

| 原计划 | 状态 | 落点 |
| --- | --- | --- |
| P0 运行时热接入 + 链尾兜底 | ✅ | `src/core/model-runtime.ts`（纯函数 `planMounts` / `chainFor`）、`src/plugins/model-runtime.ts`、`boot/profiles.ts`（mock 常驻） |
| P1 大纲用模型 + 契约 + 回落 | ✅ | `src/core/llm-json.ts`、`src/core/outline-llm.ts`、`sdk/host.ts` 的 `plan.outline`、`outline.ts` 的 `withSections` |
| P2 逐页文案用模型 | ✅ | `src/core/deck-copy.ts`、`deck.ts` 的 `applyCopy` / `copySource`、`plugins/deck-engine.ts` |
| P3 主观审核 / 用量 / 状态点 | ✅ | `src/core/deck-review.ts`、`usage.record` 记账、会员中心「模型」一格 |
| 追加：演示文稿大纲用模型 | ✅ | `src/core/deck-plan-llm.ts`、`deck.ts` 的 `options.plan` / `upgraded` |

### 现在怎么接（两条路，任选）

**A. 在界面里接（推荐，保存即生效）**

1. 设置 → 模型 → 添加模型；
2. 供应商选一个（DeepSeek / OpenAI / Kimi / 通义 / 本地…），或「自定义」后手填接口地址；
3. 填 API Key、模型名 → 保存；
4. 面板顶部会写「**正在用 xxx 生成，保存即生效**」，行尾标 **已接入**；
   没配好的一行会标 **未接入** 并把原因（没填地址 / 没有 Key）挂在悬停提示上。

**B. 用环境变量（部署 / CI 更合适）**

```bash
DB_LLM_API_KEY=sk-… DB_LLM_BASE_URL=https://api.deepseek.com/v1 DB_LLM_MODEL=deepseek-chat npm run web:preview
```

### 没有外网时怎么验

```bash
npm run llm:mock      # 本地「联调网关」：一个假 OpenAI 端点，只回显请求里的骨架
```

然后在设置里添加：供应商「本地」、地址 `http://127.0.0.1:5179/v1`、Key 留空、模型名随便填。
它会真的走 HTTP + SSE（和真模型同一条代码路径），只是对面是规则引擎代答——
所以看到的是「链路通了」，**不是「模型写得真好」**。用完把这条删掉即可。

### 和原计划的差异（有意为之）

1. **`JsonClient` 不给 mock 兜底**：`LlmRequest.only` 把 `mock-*` 挡在结构化请求之外。
   理由：mock 只会写散文，回不了 JSON；让它兜底会把「Key 错了 / 断网」淹成一句「模型没有返回 JSON」，
   用户无从排查。对话类请求仍然保留 mock 兜底。
2. **文案有总预算**（默认 12s，`copyFor({budgetMs})`）：超了就用手上已有的部分，其余页走模板。
   宁可先看到页面出来，也不要对着空墙等。
3. **降级可见**：大纲面板左上角「模型：deepseek-chat · 1.2s」/「规则模板 · 原因：…」；
   生成时先报一句「正在让模型写逐页文案」，结束后报「逐页文案由 xxx 写好了 8 页」
   或「逐页文案走规则模板（原因）」。

### 还没做的

- **对话式局部修改**（`deck.revise`）仍是规则匹配：用户说「第 3 页换个说法」，
  目前按关键词改标题/换版式，还不是模型重写。接口一样，接一次 `JsonClient` 即可。
- 每份产出的**成本估算**（按 token × 单价）：现在只有 token 数，没有折算成钱。
- 说明：本沙箱出口只放行 github / npm / pypi，`api.deepseek.com`、`api.hcnsec.cn` 之类**连不上**，
  所以真实调用的验证要在你自己的机器上做；我这边验证的是「代码路径 + 假 fetch + 本地网关」。

---

---

## 1. 现状：哪些是真的，哪些只是看着像

### 1.1 已经能用（今天就能跑）

`src/plugins/openai-llm.ts` 是一个完整的 OpenAI 兼容适配器：把我们的 `Message[]` 翻成
chat-completions、读回 SSE、累积分片 tool call，再吐成 `LlmChunk`。默认 base URL 是
`https://api.deepseek.com/v1`，模型默认 `deepseek-chat`，**任何 OpenAI 兼容网关**（DeepSeek / Kimi /
Qwen / vLLM / one-api / 自建）都能接。

启动时由 `src/boot/profiles.ts` 的 `modelBundle` 决定挂谁：

```ts
rows: process.env.DB_LLM_API_KEY
  ? [{ id: 'models.openai', plugin: 'openai-llm' }]
  : [{ id: 'models.mock', plugin: 'mock-llm' }],
```

所以现在的接入方式是**环境变量三件套**：

```bash
DB_LLM_API_KEY=sk-xxxx \
DB_LLM_BASE_URL=https://api.deepseek.com/v1 \
DB_LLM_MODEL=deepseek-chat \
npm run web:preview
```

配套能力也已经有了：

| 能力 | 位置 | 状态 |
| --- | --- | --- |
| 按用途路由（planning / design / copy / review） | `core/router.ts` `setPolicy()` | ✅ 真的轮询候选链 |
| 「首块之后不再回退」的硬规则 | `core/router.ts` `stream()` | ✅ 已实现，避免重复输出 |
| 连通性测试（真发一次 `max_tokens:1`） | `core/model-probe.ts` + `models.test` RPC | ✅ 界面有「测试连接」按钮 |
| 自定义模型清单 + 密钥分文件（0600） | `core/models.ts`、`models.keys.json` | ✅ 写入/读回都是真文件 |
| 路由观测面 | `router.status` RPC（adapters / policies / attempts） | ✅ 有，但界面只用来判断「已接入」 |

### 1.2 三处「看着能用，其实没接」

| # | 现象 | 原因 | 影响 |
| --- | --- | --- | --- |
| G1 | 设置页「添加模型」保存成功、能测通，但聊天还是走老模型 | `models.save` 只写 `models.json`；适配器只在**启动时**按环境变量挂一次（`openai-llm.apply()` 读 `process.env`），运行时不看 catalog | 用户会以为接上了 |
| G2 | 换了 Key 之后**所有**回复都报错，没有降级 | `modelBundle` 是二选一：有 Key 就**只**挂 openai，`mock` 根本没装上；policy 链里只有 `openai` 一个候选 | 一个错 Key 把演示炸掉 |
| G3 | 「大纲」「逐页文案」「质量审核」都是规则模板 | `core/outline.ts`、`core/deck.ts` 是纯函数模板（文档里也写了口径） | 内容像模板，不像 AI 写的 |

---

## 2. 目标（四条可验收的行为）

1. 在**设置 → 模型**里填 base URL / 模型名 / Key，保存后**不用重启**，下一次对话就走这个模型。
2. 任何一次模型调用失败（Key 错、超时、限流、断网）都**回落规则模板**，界面明确显示「降级中」，不假装成功。
3. 大纲、逐页文案由模型产出，**结构仍是同一套**（JSON 契约校验不过就回落），界面上的字段一个不少。
4. 每份产出都能查到**用了哪个模型、几次调用、多少 token、多少毫秒**。

---

## 3. 改动点（按优先级）

### P0 · 运行时热接入（0.5 天，今天可做）

**目标**：把「设置页保存的模型」真的变成运行时适配器，并且链尾永远留一个兜底。

新增 `src/plugins/model-runtime.ts`（挂成 `'modelRuntime'` 服务）：

```ts
export class ModelRuntime {
  /** 幂等：按 models.json + keys 重新对齐一次挂载，多退少补。 */
  sync(): { mounted: string[]; skipped: { id: string; reason: string }[]; chain: string[] }
}
```

- 读 `ModelCatalog.list()` + `catalog.key(id)`，每个条目挂一个 `OpenAiAdapter`：
  `adapter.id = 'user:' + model.id`，`models = [model.model]`，`baseUrl` 取条目的（空则跟随环境变量）；
- `sync()` 先 `dispose` 上一次的 `ctx.effect`，再重新 register + `setPolicy`，
  **不改磁盘、只在内存里对齐**，所以可以随便调；
- 策略链：`[首选模型, ...环境变量适配器, 'mock-designer']`。这就是 G2 的修法——
  `modelBundle` 改成**永远挂 mock**，真模型只是链上更靠前的候选：
  ```ts
  rows: [
    { id: 'models.mock', plugin: 'mock-llm' },       // 永远在，兜底
    { id: 'models.openai', plugin: 'openai-llm' },   // 没 Key 时 apply() 自己 return
  ]
  ```
- 触发 `sync()` 的三个地方：启动后一次、`models.save` 成功后、`models.remove` 成功后；
- 新 RPC `models.activate`（可选，切首选）+ `router.status` 增加 `models: [{ id, mounted }]`；
  设置页据此显示 **已接入 / 未接入**，而不是拿模型名去猜。

**验收**
- 界面上保存一个模型 → `router.status.adapters` 立刻多出 `user:<id>`；
- 断开网络/写错 Key → 对话仍然有回复，且 `attempts` 里能看到 `openai failed … mock ok`；
- 删掉模型 → `user:<id>` 消失，行为退回原样；
- 单测：`ModelRuntime.sync()` 用假 catalog 断言「重复 sync 不会重复注册」（router 会抛 already registered）。

### P1 · 大纲用模型（1 天）

**目标**：`plan.outline` / 演示文稿的 plan 段，优先由模型产出结构，失败回落现有的 `outlineFor()`。

新增 `src/core/outline-llm.ts`：

```ts
export interface OutlineResult {
  outline: Outline
  source: 'llm' | 'rules'
  model?: string
  ms: number
  /** 回落时说清为什么，界面照实显示 */
  reason?: string
}
export async function outlineWithLlm(router: ModelRouter, request: OutlineRequest): Promise<OutlineResult>
```

- 提示词：system 固定「你是内容结构规划器，只输出 JSON」；user 里带**同一份规则大纲当骨架**
  （先算 `outlineFor()`，把标题与要点塞进 prompt，让模型做「润色 + 具体化」而不是自由发挥）；
- 输出契约见 §4.1；解析失败 → 重试一次（要求「只返回 JSON」）→ 仍失败则 `source: 'rules'`；
- 超时 20s，`AbortSignal` 一路传到 fetch；
- 结果缓存：`key = hash(prompt + kind + count + 骨架 hash)`，进程内 LRU 20 条（同一句需求重复点不重复花钱）；
- RPC `plan.outline` 返回值加 `source / model / ms`，大纲工作台左上角显示小标签：
  `模型：deepseek-chat` 或 `规则模板 · 模型不可用（原因）`。

**验收**
- 有 Key：大纲标题与要点明显比模板具体（同一句「手机选购指南」，要点里出现机型/预算/参数口径）；
- 无 Key / 断网：界面照旧出模板大纲，标签写「规则模板」，不报错、不转圈；
- 单测：注入假 `fetch` 返回非法 JSON → 一定回落且耗时 < 超时；返回合法 JSON → 断言 `source: 'llm'`。

### P2 · 逐页文案用模型（1–1.5 天）

**目标**：演示文稿的每一页文案、文档正文，由模型写，版式与结构不动。

- `core/deck.ts` 的 `slideFor(brief, section)` 拆出 `copyFor(section)`，在 `stream()` 里改成
  **批量请求**：每 5 页一次调用（15 页 = 3 次 + 1 次大纲 = 4 次），返回 `Record<n, {title, bullets}>`；
- 校验：字段缺/长度超 `CAPACITY`（现有版式容量表）就丢弃该页覆盖，**用模板文本补**，
  并在 `deck/slide` 事件里带上 `copySource: 'llm' | 'rules'`，界面上标一个小点；
- 缓存 + 预算：`hash(plan.outline) → copy`，同一次生成内不重复请求；单次产出上限
  `DB_LLM_BUDGET_TOKENS`（默认 30k），超了就后面几页自动走模板并在顶栏提示；
- 文档（`core/artifact.ts` 的 `docBlocks`）同一条路：先 `outline`，再一次性生成本文，
  失败就用要点扩写成段落（现成的规则）。

**验收**
- 15 页演示：`router.status.attempts` 里恰好 4 次调用（大纲 1 + 文案 3），总耗时与首字延迟可量化；
- 断网：仍然出 15 页，全部 `copySource: 'rules'`；
- 旧测试全绿（deck 引擎的那 16 条不依赖文案来源）。

### P3 · 审核、记忆与可观测（0.5 天）

- 质量审核里的「商业逻辑 / 说服力」两条主观项交给 `kind: 'review'` 的模型（客观项仍用规则，
  便宜且可复现）；
- 用量与成本：`core/usage.ts` 已有 token 记账，补一个「按模型 / 按 kind」的维度，
  设置里显示「今天 12 次调用 · 8.4k tokens」；
- 降级可视化：顶栏一个 `LLM` 状态点（绿=真模型 / 黄=降级 / 灰=纯模板），点了看 `attempts` 最近 20 条。

---

## 4. 提示词与 JSON 契约

### 4.1 大纲（P1）

```json
{
  "title": "手机选购指南：普通用户版",
  "audience": "第一次换机的普通用户",
  "sections": [
    {
      "title": "内存与存储：8GB + 256GB 是舒适起点",
      "points": [
        { "text": "建议至少 8GB 内存、256GB 存储", "tag": "建议" },
        { "text": "爱拍照、拍视频的人，存储宁多勿少", "tag": "待确认" }
      ]
    }
  ]
}
```

约束：`sections.length` 必须等于用户要的数量；每段 1–4 条要点；`tag ∈ {建议, 待补数据, 需确认}`；
总输出 ≤ 1800 token。任何一条不满足 → 视为失败（重试一次后回落）。
提示词里明确「不许编造数字；不确定的写『待补数据』」，因为审核会把没有来源的数字标出来。

### 4.2 逐页文案（P2）

```json
{ "pages": [ { "n": 4, "title": "…", "bullets": ["…", "…", "…"] } ] }
```

`bullets` 条数必须落在该版式的容量区间内（`CAPACITY` 表），否则整页回落模板。

---

## 5. 模型分工与成本

| route kind | 用在哪 | 建议档位 | 每份产出的调用数 |
| --- | --- | --- | --- |
| `planning` | 大纲（P1） | 强模型（deepseek-chat / gpt-4.x 级） | 1 |
| `copy` | 逐页文案、文档正文（P2） | 快模型（flash / mini 级） | 3（15 页，批量 5 页/次） |
| `review` | 主观审核（P3） | 中档 | 1 |
| `design` | 现有 agent 对话 | 跟随首选 | 按对话轮次 |

量级估算（15 页演示）：prompt ≈ 1.5k，输出 ≈ 2.5k，合计约 4k tokens / 份，**不到 ¥0.1**（按 DeepSeek 价位）。
所以真正的风险不是钱，是**延迟**：三次批量调用串行 ≈ 6–15s，正好落在现在「逐页 90ms 出片」的观感区间里，
建议：大纲与文案**并行预取**，页面照样逐张出，文案没到就用模板顶上、到了再替换（`deck/slide` 允许同页二次推送）。

---

## 6. 密钥与安全（三条红线）

1. **Key 只进 `models.keys.json`（0600）或环境变量**，永不进 `models.json`、prompt、会话日志、前端内存；
   任何 RPC 只回 `hasKey: boolean`（现状已经如此，P0 不要破坏它）。
2. **出网只走后端**：浏览器不直连任何模型网关，预览与桌面版共用后端同一份凭据。
3. **降级要说出来**：模型不可用时的输出必须可见地标成「规则模板」，不能让人以为这是模型写的。

---

## 7. 失败与降级矩阵

| 情况 | 行为 | 界面 |
| --- | --- | --- |
| 没配 Key | 走 mock / 规则模板 | 状态点灰 |
| Key 错 / 401 / 403 | 链尾兜底 → 规则模板 | 状态点黄 +「Key 无效」 |
| 超时（>20s） | 中止本次，回落 | 黄 +「超时 20s」 |
| 429 限流 | 指数退避重试 1 次，再回落 | 黄 +「限流」 |
| 首块之后断开 | **不回退**（避免重复输出），报错 | 红 + 可重试 |
| JSON 不合契约 | 重试 1 次 → 回落 | 黄 +「格式不合规」 |
| 超预算 | 后续批次改模板 | 黄 +「超出预算」 |

---

## 8. 测试与联调

- **单测**（不需要真 Key）：`openai-llm` 已经支持注入 `fetchImpl`，用它模拟
  200/401/429/超时/半截 JSON/SSE 分片乱序；`ModelRuntime.sync()` 用假 catalog 断言幂等；
  `outlineWithLlm` 断言「非法 JSON 必回落」与「合法 JSON 的字段全部通过 schema」。
- **离线回归**：`npm test` 现在 171 条，P0–P2 之后仍要全绿——所有新路径都必须有「没有模型也能跑」的分支。
- **真机联调**：
  ```bash
  DB_LLM_API_KEY=sk-… DB_LLM_BASE_URL=https://api.deepseek.com/v1 DB_LLM_MODEL=deepseek-chat npm run web:preview
  # 或在设置 → 模型里添加并「测试连接」，保存后不重启直接对话
  ```
  先用「测试连接」确认 2xx，再看 `router.status` 的 `attempts`。

> ⚠️ **本沙箱的限制**：这里的出口只放行 github / npm / pypi，`api.deepseek.com` 这类域名会被挡住。
> 也就是说我在这个环境里**没法替你验证真实调用**（能验证的是「代码路径 + 假 fetch」）。
> 真机联调要么在你自己的机器上跑，要么告诉我一个已放行的网关域名。

---

## 9. 需要你定的四件事

| # | 问题 | 影响 |
| --- | --- | --- |
| 1 | 用哪家 / 哪个网关（DeepSeek 官方、Kimi、自建 one-api…） | 决定 `baseUrl` 与模型名默认值 |
| 2 | 模型档位怎么分（强模型做大纲、快模型做文案？还是全用一个） | 决定 P2 的批量与预算 |
| 3 | Key 放在哪（后端环境变量 / `.designbuddy/models.keys.json`） | 决定 P0 是「只读环境变量」还是「热接入」 |
| 4 | 是否允许我把 `mock` 常驻为链尾兜底 | G2 是否修掉（我建议允许） |

---

## 10. 排期

| 阶段 | 内容 | 工作量 | 可验收的结果 |
| --- | --- | --- | --- |
| P0 | 热接入 + 兜底 + 状态可见 | 0.5 天 | 设置页保存即生效，错 Key 不炸 |
| P1 | 大纲用模型 + 契约校验 + 回落标记 | 1 天 | 大纲明显更具体，失败自动降级 |
| P2 | 逐页文案 / 文档正文批量生成 | 1–1.5 天 | 15 页出片 4 次调用，断网照出 |
| P3 | 主观审核 + 用量成本 + 状态点 | 0.5 天 | 能查到每次调用的模型与 token |

**建议先做 P0**：它是唯一一个「不做，后面三件事都白搭」的改动，而且不依赖你对模型档位的决定。

---

## 10. 在线用：把真 Key 接进来（2026-11-04 补写）

你有 Key 和 base URL，想让产出真的由模型写。两条路，按「在哪儿跑」选，代码是同一套。

### 路 A：在自己机器 / 服务器上跑（推荐，一次配好，长期可用）

```bash
git clone <repo> && cd designbuddy
npm install
npm run web          # 或 npm run web:preview（0.0.0.0，局域网可访问）
```

打开页面 → 设置 → 模型 → 「添加模型」，四个格子：

| 填什么 | 例子（以 DeepSeek 为例，其它 OpenAI 兼容供应商同理） |
| --- | --- |
| 供应商 | DeepSeek / 自定义 |
| 接口地址 | `https://api.deepseek.com/v1`（填到 `/v1` 就行，也可以整段贴 `/v1/chat/completions`） |
| API Key | `sk-…`（存进 `~/.designbuddy/models.keys.json`，权限 600，不进 models.json） |
| 模型名称 | `deepseek-chat` |

先点「测试连接」（真发一次请求，8 秒超时，四种失败文案不一样），再「保存」。
**保存即生效**，不用重启：会员中心那一格的「模型」会变成绿点 +「已接入 · deepseek-chat」。

也可以完全绕开设置页，用环境变量（适合部署）：

```bash
DB_LLM_API_KEY=sk-… DB_LLM_BASE_URL=https://api.deepseek.com/v1 DB_LLM_MODEL=deepseek-chat npm run web
```

### 路 B：就在这个预览里用（服务端出不了网，靠你自己的浏览器当出口）

预览跑在容器里，出口只放行少数域名，`api.deepseek.com` 这类地址**从服务端打不通**。
所以设置里多了一个开关：**浏览器直连**。

它是怎么工作的：服务端不自己发请求，而是把这一次请求（地址、方法、请求体）通过已经连着的 SSE 通道
交给你的浏览器，浏览器补上 `Authorization` 发出去，再把整段响应回传。

填法完全一样，只是把「浏览器直连（服务端出不了网时用）」勾上：

- 勾上之后 Key **只写进这台浏览器的 localStorage**，服务端一个字都看不到，也不会写进 `models.keys.json`；
- 「测试连接」也走这条路，通了才说明这条路真通；
- 限制三条，先看清楚再决定：
  1. **要求该接口允许跨域（CORS）**。不少国内厂商不给浏览器开 CORS，被拦时界面会写「浏览器直连被拦住了（最常见的是这个接口没开 CORS）」——这不是地址写错，换路 A。
  2. **整段回传，不是逐字流**：长文生成时字会一次到齐，不是慢慢长出来；
  3. **生成时别关页面**：页面就是那条网线。

### 两种模式怎么选

| 场景 | 选 |
| --- | --- |
| 自己天天用、要稳 | 路 A（本机 / 服务器 + 服务端直连） |
| 只想在这个预览里立刻看到真模型的效果 | 路 B（浏览器直连），CORS 被拦就退回 A |
| 没有外网 / 只想跑通流程 | 什么都不接，规则模板 + `npm run llm:mock` |

### Key 与花费

- Key 存在三处之一：设置里存的 `models.keys.json`（600）、环境变量、浏览器 localStorage（仅直连模式）。
  三处都不会进 `models.json`，`git status` 里也看不到；
- 每次模型调用都记账（大纲 / 文案 / 审核分开），会员中心「今日额度」是 token 数，不是次数；
- 降级是显式的：链尾永远留着 mock，Key 写错、限流、断网都不会炸，只会回落并在界面上标「规则模板 · 原因：…」。

### 排查

| 现象 | 原因 |
| --- | --- |
| 测试连接 401 | Key 错、或这个 Key 不属于这个地址 |
| 404 / 405 | 地址少写或多写了 `/v1`、`/chat/completions`（界面会把实际请求的完整地址打出来） |
| 429 | 限流，等一会儿；生成时不放缓存的请求已经做了去重（同一句需求不重复花钱） |
| `网络错误：fetch failed` | 服务端出不了网 —— 换路 A，或勾浏览器直连 |
| 直连模式下「浏览器直连被拦住了」 | CORS 被拒，这条路对这家供应商不通 |
| 界面显示「模型已挂上，但浏览器中转没连上」 | 直连模式但没有页面连着，刷新页面后重试 |
