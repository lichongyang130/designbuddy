# Gamma 级 AI 原生卡片引擎 — 落地方案（基于你现有 designbuddy）

> 目标：从现有 `PptStore→大纲三选一→卡片流` 扩展为 Gamma 式的 **演示/文档/网页** 三形态共用的 AI 原生卡片系统，支撑 400M+ 内容的规模化思路。

## 1. 现状盘点

- 已落地：`pptStore.ts`（Slide + sources/metric/hint + 版本20条 + workspace）、`pptFrameworks.ts` 10 套主题、`PptPage` 四 Tab（内容/数据/素材/来源）、`PptSharePage` 只读 + `exportPptx` 备注写引用、`/assets/:id/raw` base64 直出
- 未补：① 统一的 `GammaDoc` 模型 ② 自适应版式引擎 ③ 多模型编排（20+） ④ 分布式存储

## 2. 四步架构（对应你问的 400M 方案）

```
User Input
  → Prompt 分类（presentation/document/webpage）→ Outline 3选1
  → GammaOrchestrator（outline / cards / image 三链路）
  → GammaDoc {cards[]} 结构化存储
  → GammaEngine（版式引擎：规则 + layout-ranking 模型）
  → Renderer（演示16:9 / 文档流 / 网页栅格 三渲染器）
  → Collaboration（CRDTs + SSE）→ Export/Share → Observability
```

### Step 1 — 统一数据模型（1-2天）

```ts
type GammaCardKind = 'cover'|'text'|'bullets'|'cards'|'split'|'chart'|'table'|'timeline'|'image'|'embed'|'cta';
type GammaCard = {
  id: string; kind: GammaCardKind; title: string; body: string; eyebrow: string;
  layout: string; image?: string; focus: number; notes: string;
  sources?: PptSlideSource[]; metric?: string; hint?: string; props?: Record<string, unknown>;
};
type GammaDocKind = 'presentation'|'document'|'webpage';
type GammaDoc = {
  id: string; title: string; prompt: string; kind: GammaDocKind;
  cards: GammaCard[]; themeId?: string; workspaceId?: string; workspaceName?: string;
  createdAt: string; updatedAt: string;
};
// 存储键：designbuddy.gamma.v1 / designbuddy.gamma.versions.v1
```

- 复用 `pptStore` 的 localStorage 版本/快照逻辑，原地迁移 `PptProject.slides` → `GammaDoc.cards`
- 新建 `gammaStore.ts`：`listGammaDocs/getGammaDoc/saveGammaDoc/createGammaDoc/deleteGammaDoc/listGammaVersions/restoreGammaVersion/encodeGammaShare/isGammaPrompt`

### Step 2 — 版式引擎（3天，Gamma 最难部分）

- **规则层**：`kind + body长度 + image有无 → layout`，例：`body>300字 → bullets`，`有image + 短标题 → split`，`有数值 → chart`
- **模型层**：轻量 `layout-ranking`（输入 title/body长度/image标记 → 输出 layout 分），先用规则打分 `score = keyword + 0.6*random`（已在 `pptFrameworks` 验证），后续替换为小模型 API
- **渲染层**：`ppt-page.css .ws-slide` → 抽为 `gamma-card.css`，新增 `.gamma-doc-flow`（竖排文档流）、`.gamma-web-grid`（栅格网页流），三渲染器共用同一 `GammaCard` 数据

### Step 3 — AI 编排（3天，20+ 模型）

- 复用你现 `POST /api/ai/chat`，新建 `server/api/gamma-orchestrator.ts`：

```
outline (Perplexity/Claude 类) → cards (GPT-4/Claude) → image (Flux)
     ↓                ↓                ↓
  结构化 JSON    结构化 JSON      URL/base64
```

- 实现 `AIJSX` 风格：`buildGammaOutlinePrompt(prompt, kind) → buildGammaCardsPrompt(outline, theme)`，每段独立 prompt + 独立模型，可切换 provider 不改业务
- 评测：`Braintrust` 思路本地化——每生成记 `prompt / latency / token / user反馈` 到 `localStorage: designbuddy.gamma.eval.v1`，为后续模型切换提供依据

### Step 4 — 400M 规模化（运维）

- **存储**：`SQLite → Prisma+Postgres（gamma_docs/cards 主表）+ ClickHouse（事件/评测）+ Kafka（生成队列）`，对象存储接 `assets/:id/raw` 的 S3 化
- **协作**：你现 `subscribeToProject` SSE → 升级为 `CRDTs (Yjs) + WebSockets` + `ECS Fargate` 多实例，`workspaces` 复用现有 `WorkspaceRole`
- **上线**：`Terraform + Cloudflare CDN`[8]，`Datadog` 全链路，`Gamma API / MCP Server` 对外暴露 `POST /api/gamma/generate` 与 `GET /api/gamma/:id/share`

## 3. 复用清单

| 已有 | 扩展为 Gamma |
|---|---|
| `pptStore` | `gammaStore`（兼容迁移） |
| `pptFrameworks` 10 套 | `gammaThemes` + `gammaLayouts` |
| `PptPage` + 四 Tab | `GammaPage` 三形态切换 |
| `PptSharePage` | `GammaSharePage` 通用 |
| `exportPptx` 备注写引用 | 复用，`document/webpage` 改 `exportPdf/exportHtml` |
| `assets/:id/raw` | 对象存储预留 |

## 4. 验证

- `pnpm -C apps/web exec tsc --noEmit` + `vite build`
- 手测：首页输入“做一个 AI 原生卡片文档：Q4 复盘”→ 大纲三选一→ 卡片流（三形态切换）→ 数据 CSV→ 素材→ 引用→ 协作→ 分享→ 导出
- 压测：`gamma_docs` 10万条本地写入 + 版本 20 条 cap 验证

## 5. 本次已交付

- 本文档
- `frontend/workspace/gammaStore.ts`（统一模型 + CRUD + 版本 + 分享 + prompt 分类）
- `frontend/workspace/gammaEngine.ts`（规则版式引擎占位，已可跑通自动布局）
