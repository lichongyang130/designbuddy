# 方案：工作流（Workflow）——把"做一件事"压成点几下

日期：2026-10-17（第十二轮后）。目标：让普通人**不写提示词、不选专家、不调技能、不进编辑器**，
只点几下就能拿到真结果；同时不牺牲现有的诚实边界（缺凭据就说缺、失败就说失败）。

---

## 1. 现状：为什么现在还"不简单"

今天的真实路径是：

```
首页输入框 → 选模式 → （可能）选专家 → （可能）选技能 → 发送
   → 任务对话页 → 回答澄清问题 → 确认需求 → 等生成 → 再手动进编辑器预览/导出
```

每一步都要人做判断，而且很多步是"选择"而不是"做事"。首页那 16 个「场景」目前只是**填好提示词**，
点完仍然要走上面整条链路（`apps/web/src/components/homeScenes.ts`）。

已经具备、可以直接编排成"配方"的零件：

| 零件 | 位置 | 能提供什么 |
|---|---|---|
| 46 个技能（41 个有真执行器） | `server/skills/service.ts`、`skills/catalog.json` | 真实执行：OCR、公式重算、表格关联、浏览器验证、受限构建、图像/邮件/日历适配器 |
| 技能计划与运行记录 | `/api/skill-plans`、`/api/skill-runs`（含 cancel/resume/artifacts） | 可查步骤状态、可重试、可续跑 |
| 任务后端（P01） | `server/api/task-backend.ts` | 任务创建/状态/重试/产物归属/通知 |
| 16 位专家目录 | `shared/expertRouting.ts` | 专家的任务规范与材料清单 |
| 模型注册表 | `server/api/model-registry.ts` | 真实模型、参数映射、额度与用量 |
| 素材库（第十一轮） | `server/api/assets.ts` | 上传落盘、服务端解析、可见范围 |
| 社区模板（第十二轮） | `server/api/community-templates.ts` | 发布/下架/复制、可见范围 |
| 技能权限模型（P07） | `server/skills/skill-permissions.ts` | 第三方能力必须单次授权 |

**结论：不用重造轮子，工作流 = 把这些零件按固定顺序串成"配方"，并给每条配方一个向导式界面。**

---

## 2. 方案分四块

### 2.1 服务端：工作流注册表 + 真实执行编排（新增 `server/api/workflows.ts`）

**工作流定义**（服务端登记，版本化，可被列出与引用）：

```ts
type WorkflowStep = {
  id: string;
  title: string;            // 人话步骤名
  skill: string;            // 引用**已登记技能**，不新增任意代码执行
  inputs: Record<string, string>;   // 从工作流输入到技能参数的映射
  optional?: boolean;       // 缺凭据时可否跳过
};
type Workflow = {
  id: string;               // 例如 "landing-page"
  version: string;          // "1.0.0"
  name: string;             // 「网页落地页」
  goal: string;             // 一句话说清产出什么
  icon: string;
  expertId?: string;        // 借用专家的任务规范
  fields: WorkflowField[];  // 向导要问的字段（text/textarea/file/choice/number）
  steps: WorkflowStep[];
  outputs: string[];        // 产物说明
  requires: string[];       // 需要用户提供的材料（人话）
  permissions: SkillPermission[]; // 会用到的权限，外部能力必须单次授权
  visibility: "builtin" | "private";
};
```

**执行编排**（真跑，不是假进度条）：

- `POST /api/workflows/:id/runs` → 建任务（复用 P01 任务后端）→ 按步骤依次调用 `SkillService` 的 run →
  每步状态、耗时、产物、失败原因都落库 → 运行记录可在另一个标签页/设备继续看。
- `GET /api/workflow-runs/:id` → 运行详情（步骤状态机 + 产物 + 失败原因）。
- `POST /api/workflow-runs/:id/steps/:stepId/retry` → 单步重试/续跑（复用 skill-runs 的 resume）。
- 缺凭据的步骤：**不静默跳过**，标记「不可用 · 缺 IMAGE_API_KEY 之类的说明」，由用户选择
  「跳过这步继续」或「补齐后再跑」。

**首批 3 条真工作流**（只用现在就能真跑的执行器）：

| id | 名称 | 步骤 | 产物 | 需要用户 |
|---|---|---|---|---|
| `landing-page` | 网页落地页 | ① 读取需求 → ② 生成页面文件 → ③ 浏览器结构检查（web.verify） → ④ 导出 HTML | 可离线打开的 HTML + 预览截图 | 一句话需求 |
| `doc-digest` | 文档要点提炼 | ① 上传文件（走素材库） → ② 服务端解析/OCR → ③ 分段提炼 → ④ 生成要点 Markdown | 要点 Markdown + 来源页码 | 一个文件（PDF/图片/文本） |
| `sheet-report` | 表格分析出图 | ① 上传表格 → ② 多表关联 → ③ 公式重算 → ④ 生成图表与结论 | XLSX + 图表 SVG/PNG + 结论 | 一个表格 |

> 这 3 条都**不依赖外部账号**：OCR、公式、关联、浏览器验证都是本机真执行。
> 需要 AI 的那一步（生成/提炼）在缺 `AI_API_KEY` 时会明确标「不可用」，不做假结果。

### 2.2 前端：向导式执行器（新增 `/workflows` + 首页入口）

- **卡片墙**：名称、目标、产出、耗时估计、需要的材料、是否要联网/要凭据、是否已可运行。
- **三步向导**：
  1. 选工作流（也可以从首页直接点某张卡片进入）。
  2. 填必填项（文件走素材库，文本直接填；可选项默认折叠）。
  3. **确认页**：逐条列出「会跑哪几个技能、会向哪里发数据、需要哪些授权」，第三方能力走**单次授权**（P07 已有），
     未授权的步骤直接标红不可用。
- **执行页**：步骤条显示真实状态（等待 / 运行中 / 完成 / 失败 + 真实原因 + 耗时），可取消、可单步重试；
  产物列表可下载、可「继续编辑」（进项目编辑器）、可「存为社区模板」。
- **首页入口**：新增「工作流」按钮；并把现有 16 个「场景」逐步升级成指向对应工作流（先保留原行为做兜底）。

### 2.3 与现有能力的接缝

- 产物 → 项目编辑器（已有版本库、冲突检测、右侧预览）。
- 附件 → 素材库（已支持服务端解析与可见范围）。
- 成品 → 社区模板发布（第十二轮已实现发布/下架/复制）。
- 运行记录 → 通知中心（任务后端已有通知）。

### 2.4 验收与边界

- 浏览器用例：选工作流 → 填参 → 确认 → 跑完拿产物 → 失败步可重试 → 产物可下载。
- 验收套件：向导在 1440×900 与 390×844 都可用（`scripts/acceptance/suites/designbuddy-workflows.suite.json`）。
- **诚实边界**：缺 AI 凭据时生成类步骤明确不可用；"一键"只覆盖本机与已配置的第三方能力，
  不含自动发布、自动对外发送、自动付款；工作流不会替用户确认第三方账号；每条工作流都写明需要什么材料。

---

## 3. 落地顺序（每轮都有可验收交付物）

| 轮 | 交付 | 验收 |
|---|---|---|
| A | 服务端工作流注册表 + 3 条配方 + 编排执行（建任务/跑技能/落状态/重试） | 服务端单测（配方校验、缺凭据标不可用、步骤状态机、重试） |
| B | `/workflows` 卡片墙 + 三步向导 + 首页入口 | 浏览器用例（走通一条完整工作流并拿到产物） |
| C | 运行详情页（步骤条/重试/续跑）+ 产物接缝（继续编辑 / 存为社区模板） | 浏览器用例 + 验收套件 |
| D | 把首页 16 个场景接到工作流 + 证据包 + 文档回填 | 全站回归 + 验收证据包 |

---

## 4. 需要你拍板的 3 个点（不回复我就按括号里的默认做）

1. **首批做几条**？（默认：**先 3 条跑通全链路**，再扩到 8–16 条；理由是工作流的价值在链路跑通，
   不在数量。）
2. **某一步缺凭据/材料时**？（默认：**允许跳过该步并在结果里写明「这步没跑、缺什么」**，
   绝不伪造结果；如果你更保守，我就改成整条阻塞。）
3. **要不要「用户自己保存/分享工作流配方」**？（默认：**这一轮不做**，先把内置工作流与运行记录做扎实，
   用户自建配方留到下一轮，避免做出半成品入口。）

---

## 5. 与既有台账的关系

- 新增缺口编号 **P17（工作流）**，登记在 `docs/plans/open-tasks.md` 与 `docs/plans/functional-gap-audit.md`。
- 依托本轮已完成的：素材库（附件）、社区模板（产物去向）、技能权限（授权）、任务后端（运行记录）、
  技能运行记录（步骤状态）。
- 不改变既有诚实边界：适配器/入口不算成品，工作流里缺凭据的步骤必须显式不可用。

---

## 6. 实施结果（第十三轮，2026-10-17）

方案已经落地，四个轮次全部交付。**不是入口页，是真的按顺序调用已登记技能并产出真文件。**

### 6.1 交付物

| 层 | 文件 | 做了什么 |
|---|---|---|
| 服务端 | `server/api/workflows.ts` | 配方注册表（7 条）、运行记录（SQLite `data/workflows.sqlite`）、编排引擎（合成 multipart → 调 `SkillService.handle()` → 轮询技能运行至终态 → 记录真实状态/耗时/产物引用） |
| 路由 | `server/api/http-handler.ts`、`server/local-daemon.ts` | `GET /api/workflows`、`POST /api/workflows/:id/runs`、`GET /api/workflow-runs`、`GET /api/workflow-runs/:id`、`POST /api/workflow-runs/:id/steps/:stepId/retry` |
| 前端 | `frontend/workspace/pages/WorkflowsPage.tsx`、`frontend/workspace/api/workflows.ts`、`frontend/workspace/pages/workflows.css` | `/workflows` 卡片墙 + 三步向导（填写 → 确认 → 结果）+ 运行详情 + 单步重试 + 续跑 |
| 入口 | `apps/web/src/App.tsx`、`WorkBuddySidebar.tsx`、`HomeDiscovery.tsx`、`homeScenes.ts` | 路由、侧栏入口、首页入口、场景卡上的「用工作流：<配方>」 |
| 用例 | `server/api/workflows.test.cjs`（12）、`apps/web/tests/workflows.spec.ts`（5）、`scripts/acceptance/suites/designbuddy-workflows.suite.json`（56 项） | 服务端单测、浏览器用例、桌面/移动验收 |

### 6.2 已上线的 7 条配方（全部可离线真跑，除注明外）

| 配方 | 步骤（技能） | 产物 | 备注 |
|---|---|---|---|
| 业务对比信息图 | `infographic.compose` | 转曲 SVG、PNG、选图 JSON | 目的（比较/趋势/构成）由人选，程序不猜口径 |
| FAQ 帮助页 | `faq.page` | HTML、离线 ZIP、报告 | 答案由人提供，程序不核实 |
| 表格清洗与统计 | `table.analyze` | XLSX、统计 JSON、SVG | 读服务器素材库里的真实文件 |
| 文档结构提取 | `document.structure` | 正文 JSON/TXT、预览 HTML、XLSX、位图 ZIP | 只处理主文档正文 |
| 文档要点与成品 | `document.format` → `document.summarize` | 整理稿 DOCX、内嵌字体 PDF → 要点 Markdown | **第 2 步要 `AI_API_KEY`/`OPENAI_API_KEY`；缺了就显式标"不可用"并写明缺什么**，其余步骤照常 |
| 网页落地页 | `web.scaffold` | 静态站点 ZIP、index.html、styles.css、app.js | 白名单区块，无外部依赖 |
| 社媒封面卡片 | `social.card` | 1080×1440 PNG、报告 | 确定性排版，不调用图像模型 |

### 6.3 首页场景接入（15 个场景里 5 个有真配方）

| 场景 | 配方 | 其他 10 个场景 |
|---|---|---|
| 会议纪要 | 文档要点与成品 | 周报生成、汇报PPT、邮件撰写、管理后台、接口开发、报错排查、单元测试、App原型、品牌视觉、营销策划 **没有对应配方**，仍走原来的对话链路——不放假按钮 |

### 6.4 产物接缝（两条真实接缝，不是社区模板）

- **继续编辑**：文本类产物（HTML/SVG/JSON/MD/CSV）→ 新建项目 → 进编辑器，并同步一份到服务器（版本库可用）。
- **存为素材**：任意产物 → 上传到服务器素材库（私密），素材页可见。
- **没有做「存为社区模板」**：社区模板存的是"模板族"的状态（`state` 形如某套交互样例的字段结构），
  工作流产物是文件，硬塞进去会生成打不开的副本。宁可少一个按钮，也不做半成品入口。

### 6.5 诚实边界（仍然成立）

- 缺凭据/未授权的步骤：`unavailable` / `skipped`，并写明"缺什么"；整条运行状态是 `partial` 或 `failed`，**绝不报成功**。
- 工作流只是把已登记技能按固定顺序跑一遍：权限、上限、单次授权仍由技能服务判定，配方不能绕过。
- 不会替用户确认第三方账号、不自动发布、不自动外发、不付款。
- 用户自建与分享配方**本轮不做**（按第 4 节默认值），避免做半成品入口。
- 「一键」只覆盖本机与已配置的第三方能力。

### 6.6 可核验数字

- 服务端全量：`node --test server/skills/*.test.cjs server/api/*.test.cjs` = **309/309 通过**（本轮新增 12 项工作流用例）。
- 浏览器专项：`tests/workflows.spec.ts` = **5/5 通过**。
- 验收套件 `designbuddy-workflows.suite.json`（1440×900 + 390×844）= **56/56 通过**，证据包
  `docs/verification/workflows-2026-10-17/`（manifest/console/network/screenshots）。
