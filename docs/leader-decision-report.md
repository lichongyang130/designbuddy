# 领导决策汇报｜PPT 引擎试点建议

## 已交付结果

**建议有条件批准小范围试点；范围、责任、材料授权、资源上限和退出条件未明确前不启动。** 这是建议，不是已批准决定。

- 受众：项目决策领导；建议讲述 15 分钟；12 页。
- 题材：本项目实际可访问源码、上一轮保存的测试记录和明确标注的定性分析。
- 交付范围：应用内置模板示例 + 原生可编辑 PPTX + 同一 PPTX 实际导出的 PDF + 全页预览、逐页正文、讲稿、来源、数据绑定、质量报告及 SHA-256 清单。
- 未向外部社区、云模板或消息服务发布，没有创建社区发布记录。

### 查看与下载

在应用中打开 **模版 → 幻灯片 →「领导决策汇报 · PPT引擎试点建议」**。

应用路由：`/inspiration/leader-decision`。

| 文件 | 用途 |
|---|---|
| [可编辑 PPTX](../apps/web/public/presentation-examples/leader-decision/leader-decision.pptx) | 12 页原生文字/形状、1 个原生图表、3 个原生表格、逐页讲稿 |
| [实际 PDF](../apps/web/public/presentation-examples/leader-decision/leader-decision.pdf) | 同一 PPTX 经本机 LibreOffice 导出的 12 个物理页面 |
| [全页联系表](../apps/web/public/presentation-examples/leader-decision/slide-contact-sheet.jpg) | 快速查看完整叙事与版式 |
| [完整证据包 ZIP](../apps/web/public/presentation-examples/leader-decision/leader-decision-package.zip) | 包含上述文件及全部页图、原始白名单材料、规范、来源/讲稿、质量与渲染报告、哈希清单和字体许可 |
| [逐页正文与讲稿](../apps/web/public/presentation-examples/leader-decision/README.md) | 按页阅读实质正文、讲稿、图示理由和来源位置 |
| [质量报告](../apps/web/public/presentation-examples/leader-decision/quality-report.json) | 自动检查结果、缺失信息和明确未检查项 |

静态资源根路径：`/presentation-examples/leader-decision/`。仓库和应用的下载文件为同一组内容，`manifest.json` 可校验哈希。

## 12 页内容主线

| 页 | 实质内容 | 性质 |
|---|---|---|
| 01 | 建议有条件批准小范围试点，明确不是全面推广 | 建议 |
| 02 | 请求批准的范围、复核责任、资源和停止条件 | 建议 |
| 03 | 上一轮技能 240 项通过、相关 UI 25 项通过、扩展 API 4 项失败；分别说明范围 | 事实 |
| 04 | 已实现的原生导出链路，与事实核查/目标 Office/P2 等能力边界 | 事实 |
| 05 | 同一批扩展 API 检查的 19 通过/4 失败；隔离 HEAD 复现相同失败，仍需评审影响 | 事实 |
| 06 | 维持现状、受控小范围试点、完善后再试点的定性比较 | 分析 |
| 07 | 试点应回答的真实材料、模型理解、复核投入及可编辑性问题 | 建议 |
| 08 | 模型、人工、部署及材料合规成本的证据与记录口径；金额未提供 | 分析 |
| 09 | 事实误读、字体/编辑异常、中断与既存 API 问题的触发及应对 | 分析 |
| 10 | 确认边界 → 真实试跑 → 人工验收 → 复盘决策，无虚构日期 | 建议 |
| 11 | 达标后再扩围的建议门槛，执行成功不等于商业批准 | 建议 |
| 12 | 请求确认范围、责任、资源和退出条件 | 建议 |

所有页有实际正文、讲稿、图示说明及可回溯来源。建议讲述时间合计 900 秒，不是实测演讲时长。所有表的字段与口径、源单元格及逐字映射规则保存在 `report.json` / `sources-and-notes.json`；没有暗中计算预算、收益、通过率或概率。方案/成本/风险表为助手定性分析，不冒充实测数据。

## 本次真实执行了什么

1. 检查源码与既存证据，保存白名单摘录、仓库路径、行号和原文件 SHA-256；不复制凭据、环境变量值、完整数据库或完整日志。
2. 助手依照已确认需求编排 12 页内容；规划原稿在 [plan.json](examples/leader-decision/plan.json)，需求记录在 [brief.md](examples/leader-decision/brief.md)，证据摘录在 [evidence-snapshot.json](examples/leader-decision/evidence-snapshot.json)。
3. 将证据和分析整理为 4 份真实材料：Markdown、两份 CSV、一份包含 3 表的 XLSX。经过项目原有 `parsePresentationRequest` / `readPresentationSources`，不是绕过上传材料格式约束或替图表填写任意数值。
4. 用 `compilePresentationSpec` 校验来源和绑定，再由 `buildStructuredPresentation` 生成原生 PPTX；本机 `renderPresentation` 用同一文件输出 PDF 和 12 张 960px JPEG。
5. 运行独立质量检查并检查全页联系表及对比、方案、成本、关卡重点页，未以删除事实、缩字或位图替代原生对象消除问题。
6. 将真实文件和查看器接入内置模板库。查看器可翻页、阅读正文/讲稿、展开来源和哈希、下载文件；有错误重试和移动端适配，不提供虚假的浏览器局部编辑功能。
7. 「用自己的材料生成」显式打开只允许 `slides.create` 的实际工作台，预填 12 页、管理层受众、商业汇报及咨询主题。默认不展开、不代选材料、不自动上传、不预先勾选授权；依赖缺失时没有假运行按钮，也不回退到旧 compose 冒充新引擎。

**本次没有调用生产后台的外部模型规划通道。** 内容由助手依据源码证据编排，实际调用项目解析、原生编译、导出及质量模块。因此证明的是这份真实内容能够通过该链路交付，不能据此声称部署后的任意提示词、真实模型叙事或真实商业材料均已验收。

场景能力目录的 `office-slides` / `design-slides` 同步补入 `slides.create`。该目录变更不是「聊天自动生成了文件」的证据；本次实际可点击的复用入口是内置案例里的生成工作台。

## 本次验证结果

| 检查范围 | 结果 |
|---|---|
| 新增文件/来源/PPTX/PDF/清单验证 | **4/4 通过** |
| 新案例 7 项 + 原演示输入/工作台/技能目录 25 项浏览器回归 | **32/32 通过** |
| Web TypeScript 与生产构建 | 通过；保留既有分包体积/静动导入警告 |
| 本次文件质量 | **0 critical，needs-human-review，commercialApproval:false** |
| 实际 PDF / 全页图 | **12 个物理 PDF 页、12 张页图；无缺失字体** |
| 本次外部规划提供商调用 | **0** |

证据日志：`.cache/leader-decision-generation.log`、`.cache/leader-decision-artifact-tests.log`、`.cache/leader-decision-ui-final.log`、`.cache/leader-decision-build.log`。

文件验证实际检查：来源/字段绑定可重新编译；原生图表、原生表格、文字及全部讲稿存在；没有以 `<p:pic>` 全页位图代替正文；PDF 每页存在可提取中文；清单的所有 SHA-256 与独立下载文件及完整 ZIP 一致。浏览器验证实际检查：模板可检索、旧两份幻灯片保留、12 页真实图片载入、来源可展开、PPTX/PDF 可下载、没有社区或运行写入、320/390/768px 不横向溢出、新运行的默认需求和未授权状态、依赖缺失、错误重试及原有工作台回归。

汇报里的 **240/25/19/4 是上一轮历史证据**，没有改写为本次新测。扩展 API 的 4 项基线失败未在本次修复；全仓测试、真实外部模型和目标 Office 人工编辑仍不属于已通过范围。

复验：

```sh
corepack pnpm exec tsc -p server/tsconfig.local.json
node scripts/generate-leader-decision-report.cjs
node --test scripts/leader-decision-report.test.cjs
corepack pnpm --filter designbuddy-web build
node apps/web/scripts/run-playwright.mjs test \
  tests/leader-decision.spec.ts tests/presentation-composer.spec.ts \
  tests/skill-runtime.spec.ts tests/skills.spec.ts
```

## 效果判断与待审阅事项

当前可以交付**结构清晰、主线完整、来源可追溯的商务汇报初稿**，适合由业务人员复核后继续编辑；不能承诺专业设计定稿、自动事实核查、图表内部标签全面检测或目标软件商业兼容认证。PPTX 未嵌入字体，接收方需安装仓库 `assets/presentation-fonts` 对应的 Noto Sans SC 常规/粗体，且在实际使用的 PowerPoint/WPS/Keynote 中重开确认。

请用户后续确认：业务复核人与技术负责人、实际模型通道及留存政策、允许的资料范围、资源上限、试点规模/时间和退出条件；这些均未伪造成既定事实。若只是审阅本次输出效果，无需先补这些信息即可浏览和下载。

本案例是获准加入应用的工程示例，其文件在应用静态目录提供，不承诺私有附件级鉴权。**未来真实客户资料不得写入此 public 模板目录**，应通过现有账号隔离的技能运行/产物接口交付。重建保留历史证据的快照性质；可访问源码发生哈希变化时会报告 `staleSourcePaths`，需要重审，不会偷偷改写历史测试结果。
