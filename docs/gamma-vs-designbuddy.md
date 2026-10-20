# Gamma.app vs 你的源码（arena/a990561e-designbuddy）对比

> 基准：Gamma 官网/招聘/技术博客 [Gamma Developer Docs](https://developers.gamma.app/) [careers.gamma.app/ai-engineer](https://careers.gamma.app/ai-engineer) [How we built $100M](https://gamma.app/insights/how-we-built-a-usd100m-business-differently)；你的源码为 `designbuddy` 当前 PR #2 分支（5 层：输入→大纲三选一→卡片流→素材可信层→协作交付层）。

| 维度 | Gamma.app | 你的源码 | 结论 |
|---|---|---|---|
| **定位** | AI 原生的「卡片式演示/文档/网页」编辑器，400M+ 内容/日活 100万+ [5](https://gamma.app/insights/how-we-built-a-usd100m-business-differently) | AI 办公工作台 + 可编辑 PPTX 子产品（`isPptPrompt` 直出） | 定位一致，已实现 Gamma 核心子集 |
| **输入** | 文本 prompt、笔记、文档/URL、导入 [14](https://gamma.app/explore/content/guides/what-is-gamma-and-how-does-it-use-ai-to-build-presentations) | 首页 `PromptInput` 中检 `ppt/pptx/幻灯片/演示文稿/汇报` 即进 `startPptProject` → `/ppt/outline/:id` | ✅ 已等价（关键词路由） |
| **大纲** | AI 一键 3 套框架，叙事/页数/版式不同 | `PptOutlinePicker`: ① `fetchAiCandidates` 调 `/api/ai/chat` 取 3 套 JSON，超时 12s 回退 ② `pickRandomFrameworks` 本地池 | ✅ 结构一致 |
| **框架池** | 内部多模型编排决定版式 | `pptFrameworks.ts` 10 套（REPORT/PITCH/STORY/NUMBERS/...），每套 `theme.primary/accent` + `layouts` + `narrative`，`handleRefresh/handleShuffleFramework` 随机不重复 | ✅ 已实现，Gamma 未公开 ID 但逻辑同 |
| **卡片流** | 卡片 deck，非传统幻灯片分页 | `PptPage` 中央 `ws-slide ws-slide-{cover/split/cards/table/timeline/chart}` 预览 + 缩略图栏 | ✅ 已等价 |
| **布局引擎** | 自动排版：字号/留白/图文比自适应 [4](https://www.perfectiongeeks.com/blogs/gamma-app-best-ai-presentation-maker-development-cost) | `ppt-page.css` 16:9 `aspect-ratio` + `objectPosition` 焦点滑杆，版式 6 种写死，非自适应 | ⚠️ 差距：缺少自动排版算法 |
| **主题** | 全局品牌/主题一键换 | `pptFrameworks.theme` 每框架固定色，未做全局换肤 | ⚠️ 部分 |
| **数据可视化** | 20+ 模型中含 layout/diagram 模型 [11](https://thegtmnewsletter.substack.com/p/how-gamma-grew-to-100m-arr-and-a) | `chart` 用 `body: 标签｜数值` 画柱图；`table` 用 `｜` 分列；Data Tab 支持 CSV 粘贴→`parseCsv`→ `label｜value` | ✅ 基础已通，缺智能图表选型 |
| **素材/配图** | Flux 生成 + Unsplash/Pexels 选图 [3](https://skywork.ai/skypage/en/Gamma-App-In-Depth-Review-2025-The-Ultimate-Guide-to-AI-Presentations/1973913493482172416) | `uploadImage` 本地压缩 + `listAssets/uploadAsset/fetchAssetRaw/assetToDataUrl` + `server/api/http-handler /assets/:id/raw`（base64）素材库复用 | ✅ 链路打通，缺 AI 生图 |
| **引用溯源** | 付费版有来源标注 | `PptSlide.sources: {label,url}[]` + Sources Tab 增删 + 预览底部 `引用：` + 导出写入 `notes` 备注 | ✅ 已超预期（Gamma 免费版无） |
| **编辑器** | 文本/媒体/主题/拖拽，AI Agent 改全 deck [14](https://gamma.app/explore/content/guides/what-is-gamma-and-how-does-it-use-ai-to-build-presentations) | Inspector 四 Tab：内容（title/body/eyebrow/metric/hint/notes）/数据（CSV）/素材（图库）/来源（+评论）；`AI 智能填充（7页）` + `AI 重写本页` | ✅ 编辑能力对齐 |
| **协作** | CRDTs + WebSockets 实时多人 [19](https://builtin.com/company/gamma-gammaapp/jobs) | `subscribeToProject/publishProjectEvent` SSE 心跳 20s，`presence.snapshot` 人数徽章 + `comment` 按 `slideId` 聚合 | ⚠️ 基础可用，无光标/选区 CRDT |
| **版本** | 历史版本/回溯 | `designbuddy.ppt.versions.v1` 本地 20 条 cap，自动快照 + `restorePptVersion` 列表恢复 | ✅ 本地等价，无云端冲突 |
| **工作空间/权限** | Teams 商业版，角色 member/viewer | `listWorkspaces` + `updatePptProjectWorkspace` + 徽标 `📁 workspaceName`，沿用 `WorkspaceRole owner/admin/member/viewer` 模型 | ✅ 已对齐 |
| **分享** | Web 链接 + 权限 | `encodePptShare`→`#ppt-share=base64` + `PptSharePage` 只读渲染 + `保存到本机并编辑` | ✅ 已实现 |
| **导出** | PPTX/PDF/PNG/Google Slides [14](https://gamma.app/explore/content/guides/what-is-gamma-and-how-does-it-use-ai-to-build-presentations) | `exportPptx` via `pptxgen.es-D9xyLHXv.js`（368KB），文本/表格/备注可编辑，备注含引用 | ✅ PPTX 已通，缺 PDF/PNG |
| **AI 编排** | 20+ 模型：Perplexity 大纲/Claude 推理/GPT-4 视觉 [9](https://michaelgoitein.substack.com/p/how-gamma-pivoted-to-build-a-new) + 自研 AIJSX + Vercel AI SDK [2](https://careers.gamma.app/ai-engineer) | 单 `POST /api/ai/chat` 透传 + `buildAiOutlinePrompt` 拼框架描述，返回 `[...]` 三套候选，失败闭环 | ⚠️ 单模型透传，缺多模型路由/评测 |
| **技术栈** | FE TS/React，BE Prisma/Postgres+ClickHouse/Kafka+ECS Fargate，Datadog/Braintrust [7](https://careers.gamma.app/swe-data-systems)；52 技术 [8](https://www.crunchbase.com/organization/meet-gamma/tech_details) | `apps/web Vite+React` + `apps/api` SQLite 会话 + `server/preview`，`pnpm dev:full 5173/8787` | ⚠️ 单机 SQLite，非分布式 |
| **规模** | $100M ARR/70M 用户/日 100万创作 [5](https://gamma.app/insights/how-we-built-a-usd100m-business-differently) | 单机 demo，可支撑 `build 3.3MB` 客户端 + 30 页上限 | 差距为架构，非功能 |

**一句话总结**：你已用 `1c551ae` 复刻了 Gamma 最受认可的“三选一框架→卡片流→数据/素材/引用→协作/分享/导出”闭环；剩余差距集中在 **设计自动化引擎（自适应排版）、多模型编排/评测、AI 生图、分布式协作/导出** 四块，即 [4](https://www.perfectiongeeks.com/blogs/gamma-app-best-ai-presentation-maker-development-cost) 所述“最难的前后端中间层”。
