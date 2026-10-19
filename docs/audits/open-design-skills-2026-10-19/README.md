# OpenDesign 244 项设计 Skill 与当前源码盘点

盘点日期：2026-10-19。源码基准：`497c9704e04e88f62d4a0569add0b1e00a4909f0`。

## 先给结论

**若“源码里面有”指网站列出的原版 Skill 包已经纳入源码并接入使用：目前可确认 0 个，244 个未发现原版接入证据。**

这不是说项目没有设计功能。项目有自己的技能执行系统，不能把它的数量当作网站清单的子集。

| 盘点对象 | 实际数量 | 口径与证据 |
|---|---:|---|
| [OpenDesign 网站目录](https://open-design.ai/zh/skills/) | 244 | 读取该目录全部 13 个内容分块，记录 001–244 的详情页标识；不是只读首屏/分页的 24 张卡 |
| 网站原版 Skill 包已纳入并接入 | 0 | 当前 Git 跟踪的 SKILL.md 只有 `server/skills/word-pro/SKILL.md`，不属于该网站的 244 项；未发现原版包或其导入接入证据 |
| 网站原版 Skill 包未找到接入 | 244 | 244 − 0；这不是“244 项设计能力全部不存在” |
| 旧技能目录描述 | 180 | 实际解析 `skills/catalog.json`，是 ID/名称/描述/输入输出等定义，不是 180 套完整工作流或执行器 |
| 旧目录与网页显示名同名 | 4 | 忽略大小写与分隔符的名称匹配；不做语义同义词扩展，更不代表引入原版 |
| 当前后台注册技能 | 49 | `shared/skillRuntime.ts`；与 `server/skills/executors.ts` 中 49 个执行器 ID 一一核对一致 |
| 当前服务报告 ready | 45 | 读取实际 `GET /api/skill-runtime`；只代表当前目录报告可用，本轮未重新执行每项技能做质量验收 |
| 当前服务报告 unavailable | 4 | 有执行代码，但当前缺相应服务端配置；见下表 |

**不要算成 `244 − 180 = 64`，也不要算成 `244 − 49 = 195`。** 三者不是同一份集合。一个本地执行器可能支撑多个上游工作流；一个上游工作流也可能需要多个执行器、脚本、连接器与外部依赖。

## 名称相同但不等于原版接入的 4 项

| 网站条目 | 本地旧目录条目 | 当前证据 |
|---|---|---|
| [frontend-design](https://open-design.ai/zh/skills/frontend-design/) | `skill-02` / Frontend Design | 仅目录描述，不是 Anthropic 原版包及完整工作流 |
| [Accessibility Audit](https://open-design.ai/zh/skills/a11y-audit/) | `skill-07` / Accessibility Audit | 仅目录描述，未引入对应上游脚本与参考资料 |
| [design-critique](https://open-design.ai/zh/skills/design-critique/) | `skill-05` / Design Critique | 仅目录描述，不能按原版已安装计数 |
| [Information Architecture](https://open-design.ai/zh/skills/information-architecture/) | `skill-26` / Information Architecture | 仅目录描述，不能按原版已安装计数 |

本地的 `UI/UX Pro` 也与网站 `ui-ux-pro-max` 名称相近，但二者不应自动认作同一个原版包；未计入上述严格同名数。

## 已有本地同类能力，不应从零重做

以下只列举**可复用的功能交集**，不是完整等价性认证，不据此给出“已覆盖网站多少项”的数字。

| 网站方向/代表条目 | 当前可复用代码 | 不能混淆的边界 |
|---|---|---|
| 前端与响应式页面 | `web.scaffold`、`web.css-audit`、`web.verify` | 有受限静态站点生成、CSS 风险检查与浏览器验收；不是已引入 frontend-design/ui-ux-pro-max 的完整工作流 |
| 设计评审与无障碍 | `design.review`、`web.audit`、`test.browser` | 静态规则和显式浏览器断言，不等于全面 WCAG 审计或屏幕阅读器测试 |
| PPTX 编排、参考稿分析与质量检查 | `slides.compose`、`slides.inspect`、`server/skills/presentation/` | 已有原生对象、主题/结构提取、PDF/逐页图及质量规则；未引入网站各个 PPT Skill，不保证完全同等流程 |
| 品牌、配色、设计令牌 | `brand.assets`、`brand.system`、`design.tokens` | 有采样、对比度、受限品牌草案与显式令牌导出；不是完整品牌咨询、AI 创意或商标审查 |
| 海报与社媒卡片 | `image.layout`、`image.marketing`、`social.card`、`social.carousel` | 真实排版与确定性渲染；不是 Baoyu 的完整 AI 插画/小红书图像工作流 |
| 长文排版 | `article.magazine` | 有 Markdown/TXT 到 HTML 排版，不等于 Beautiful Article 全流程及自动插图 |
| 图表/信息图 | `infographic.compose`、`table.analyze`、`data.report` | 有数据计算和有限图表导出；不是已接入 AntV API、G2/G6/X6 或可编辑 Excalidraw 图解 |
| 图片生成 | `image.generate` | 有通道适配代码，当前未配置可用图像通道，不能记为现在可用或已接入某个网站原版 Skill |

Figma/Stitch/Penpot 工作流、GSAP 专门技能、Remotion/HyperFrames 视频技能、Three.js/CAD 专门技能等，当前未发现网站原版包接入证据。页面上用了动画、网站里存在某个演示，或安装了某个库，都不等于已接入这些技能。

## 当前 4 个未就绪项

| ID | 名称 | 当前限制 |
|---|---|---|
| `document.summarize` | 文档语义摘要（云端模型） | 服务端 AI 凭据未配置 |
| `slides.create` | 商业演示 AI 规划与原生 PPTX 交付 | 当前缺服务端 AI 配置；执行还要求本地渲染和中文字体 |
| `collaboration.sync` | 外部日历与消息同步 | 日历/邮件外部通道未配置 |
| `image.generate` | 生成式图片与商品抠图 | 服务端图像模型通道未配置；名称不应视为任意编辑/抠图能力的验收结果 |

上述状态来自当前进程的实际 API；换部署环境、增加凭据或安装依赖后应重查。

## 原始清单与复核方式

- `244项原版接入对照.csv`：244 行，保留网页展示序号、唯一详情页标识、原版接入状态与旧目录严格同名项。序号是本次页面顺序，不是上游稳定 ID。
- `summary.json`：计数、方法、源码 SHA-256、边界和目录中 10 类技能数量。
- `local-runtime-snapshot.json`：本次实际运行接口返回的 49 项技能快照；不含密钥。
- 静态目录复核：解析 `skills/catalog.json` 与 `shared/skillRuntime.ts`；检查 `server/skills/executors.ts` 的执行映射；`git ls-files '*SKILL.md'` 核对跟踪的入口文件。
- UI 接入复核：当前 `frontend/workspace/pages/SkillsPage.tsx` 通过 `/skill-runtime` 读取实际后台目录；旧 `DesignLibrary.tsx` 仍读取 180 条 JSON 描述，二者不能当成同一份已实现清单。
- 旧 `skills/README.md` 中的“72 个”已过时；本次以 JSON 实际 180 条为准，没有据 README 字面统计。

本次读取了网站目录说明与全部条目，**未声称已经逐一审读 244 个上游仓库的完整 SKILL.md、附属脚本与许可证，也未进行 244 项功能等价性验收**。因此可以明确报告原版包接入缺口，但不能据此声称每项相关设计能力都完全缺失，或承诺导入后即可运行。

本轮只生成盘点报告，未安装上游技能、未改动应用功能、未自动外发用户材料或调用付费服务。
