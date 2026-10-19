# PPT 输出质量 V2：本轮落地与验收记录

日期：2026-10-19。对应[升级方案](plans/ppt-output-quality-v2.md)的第一批 M0 + M1。

**实际状态：M1 首批自适应原生布局已落地；M0 的验收工具、规划合同、工程评审和预检已落地，但真实外部模型质量验收尚未完成。** 当前环境没有配置 `AI_API_KEY` / `OPENAI_API_KEY`，未发起真实外部规划调用，不将固定稿或模拟提供商测试当成真实模型验收。

后续获批并交付的 M2 首批功能与新案例另见 [PPT 视觉质量 M2](ppt-visual-quality-m2.md)；本文件保留 M0/M1 当轮结果与边界。

## 一、可以直接查看的结果

打开应用：**模版 → 幻灯片 → 领导决策汇报 · PPT引擎试点建议**，默认展示「自适应商务 V2」，可切换「经典 V1 对照」。路由：`/inspiration/leader-decision`。

- [V2 可编辑 PPTX](../apps/web/public/presentation-examples/leader-decision/adaptive/leader-decision.pptx)
- [V2 实际 PDF](../apps/web/public/presentation-examples/leader-decision/adaptive/leader-decision.pdf)
- [V2 全页联系表](../apps/web/public/presentation-examples/leader-decision/adaptive/slide-contact-sheet.jpg)
- [V2 完整文件/证据包](../apps/web/public/presentation-examples/leader-decision/adaptive/leader-decision-package.zip)
- [新旧对照说明](../apps/web/public/presentation-examples/leader-decision/adaptive/comparison.json)
- [质量报告](../apps/web/public/presentation-examples/leader-decision/adaptive/quality-report.json)

新旧稿均为 12 页，保留相同原文稿正文、讲稿、源数值、绑定、页序和来源；这是对同一份**历史工程案例材料**的排版比较，不重新认证材料里的历史测试计数，也不把旧源码快照冒称为当前源码审计。旧 PPTX、PDF、报告和清单未被覆盖。

### 主要效果变化

- 结论封面与清晰的草稿状态区，不将建议排成已批准决定。
- 摘要侧栏/主结论强调、行动清单等不同布局，减少整套页面的重复感。
- 更清晰的标题/正文/指标字号层级；原生表格正文采用 18pt，按实际内容和页面空间计算列宽、行高与留白。
- 三方案矩阵强调原分析中明确推荐的行，不编造评分或优先级。
- 图表与结论分栏，图表仍是含数据工作簿的原生对象。
- 风险表的关键列、阶段关卡和指标页使用各自的表达方式。
- 页脚提醒来源与人工复核；全部讲稿和引用保留。

已查看真实导出的全页联系表，以及方案比较、成本口径、图表重点页和移动端查看器；实际 PDF 的逐页正文提取检查也通过。不能据此声称目标 Office 商业编辑验收已完成。

## 二、M1 已实现的代码能力

### 1. 版本化且兼容的生成合同

- `PresentationBrief.layoutStyle`：`classic` 或 `adaptive`。没有该字段的旧请求继续走 V1。
- 新表单默认自适应 V2，同时保留明确的经典 V1 选择。
- 自适应请求要求规划根对象 `schemaVersion:2`；不合法时不会偷偷回退经典排版。旧请求也不会被模型静默升级为 V2。
- 逐页 `design` 只允许受支持的布局 ID、事实/分析/建议/待确认性质、受来源约束但仍需人工语义复核的结论说明，以及明确数据行的视觉强调。
- 不接受任意坐标、绘图代码、远程图片 URL、来源覆盖或模型提供的图表数值。
- 改变排版模式与其他需求一样，撤销已准备输入、上传同意和本次外部正文处理授权。

`design.takeaway` 若提供，会成为可见正文补充，因此纳入规划语义哈希和数字告警检查，不当作不影响内容的纯视觉令牌。所有来源标记只证明位置存在，不证明该结论被语义支持。

### 2. 12 套可执行原生布局

| 布局 ID | 当前支持 |
|---|---|
| `editorial-cover` | 结论封面 |
| `executive-summary` | 执行摘要；根据正文密度选择侧栏、主结论或堆叠结构 |
| `decision-matrix` | 方案比较矩阵与明确指定的推荐行强调 |
| `capability-boundary` | 能力/证据边界双栏 |
| `kpi-insight` | 指标、标签和口径说明 |
| `chart-takeaway` | 原生柱状/折线图与结论分栏 |
| `chart-ledger` | 小规模原生图表与同数据明细；当前最多 3 个类别 |
| `adaptive-table` | 内容测量、列宽和行高自适应表格 |
| `risk-response` | 风险/触发/动作表；关键列强调，不暗中赋予概率或严重性 |
| `stage-gates` | 原生阶段关卡 |
| `evidence-spotlight` | 原文引用聚焦；引用须逐字存在于所引材料 |
| `action-agenda` | 行动/决策清单 |

**与方案的取舍：**计划中的「证据截图 + 说明」需要 M2 的安全素材协议，本轮未假装支持图片导入；先交付可执行的「原文证据聚焦」布局。品牌 Logo、截图、图片和新的图表类型仍属于后续 M2。

布局目录不等于十二种新的语义页型。底层保留八种已支持内容类型，在其上选择不同的原生视觉布局。自动选择的依据是类型、位置和可测量密度，不冒称理解了商业语义；更具体的布局和强调行由显式规划意图选择。

### 3. 原生布局模型与质量检查

- 新增 `ResolvedLayout V2`：引擎版本、页面布局、内容语义哈希、稳定元素 ID、文字、形状、表格和图表外框，以及装饰/表格父子关系。
- 使用部署的 Noto Sans SC 常规/粗体字体做保守度量；V2 当前只认证这组字体的度量路径，不接受未测量字体冒充可靠布局。
- 表格逐个原始单元格保留；不隐式排序、聚合、隐藏行或修改数值。
- 排不下时明确指出页面和换布局/拆页需求，不自动缩字、删事实或增加页数。
- 新增全对象外框越界、标识重复和非装饰对象交叠检查；显式排除装饰背景以及表格与自身子单元格的预期包含关系。
- 仍未检查 Office 原生断行、图表内部标签碰撞、全部装饰遮挡及审美判断，不把图表外框检测叫作内部标签检测。
- 继续使用同一 PPTX 导出实际 PDF/全页 JPEG，保留字体、页数、来源和独立质量状态。

## 三、M0：已接入工程验收，真实模型仍待验收

### 已完成

1. 自适应 V2 规划合同：要求明确版本，选择兼容布局，区分事实/分析/建议/待确认，强调证据、实际正文、讲稿口径、成本风险和决策动作。
2. 原严格来源/数据/引语校验和最多一次结构纠错继续生效，凭据与正文授权边界不变。
3. 新增 `planningReview`：来源解析、数据绑定范围、重复标题、讲稿过薄、性质待确认、语义哈希和人工评审清单。它是工程信号，不是自动叙事评分或事实认证。
4. 实际新规划的模拟适配器回归：验证 V2 提示合同、完整材料位置、一次结构纠错、用量记录和真实文件导出。明确是离线测试，不是实际服务商模型验收。
5. 新增命令行验收入口 `scripts/benchmark-presentation-planning.cjs`：须显式选择请求、验收归属和外部正文处理授权；缺服务端配置时记为 `not-run`，不采用旧通道隐含回退。
6. 验收输出默认写入私有 `.cache` 目录，拒绝写入应用 `public` / `dist` 静态目录。真实业务材料不加入公共模板。

### 本环境的实际预检

已执行：

```sh
node scripts/benchmark-presentation-planning.cjs --preflight \
  --request apps/web/public/presentation-examples/leader-decision/input-request.json \
  --owner repo-pilot-acceptance
```

结果：`status:not-run`、`serverCredentialPresent:false`、`externalProviderCalls:0`。日志：`.cache/presentation-v2-m0-preflight.log`；状态：`.cache/presentation-planning-acceptance/acceptance-status.json`。

### 后续真实验收

在**部署环境**安全配置服务端模型通道、核对服务商留存政策和材料权限；不要把密钥放进源码、上传材料、命令行参数或聊天。仅配置前端通用聊天模型不等于已配置本技能的服务端通道。

由有权限的操作者选定实际请求与新的私有输出目录，再使用 `--request <实际材料请求路径> --owner <实际验收归属> --output <新私有目录> --allow-external-ai` 显式执行。该参数会授权发送所选完整提取正文，可能产生实际费用，不能默认或自动运行。

完成后需核对真实模型返回、实际用量、原文语义、矛盾/遗漏、成本风险及决策主线；不能只检查文件成功导出。当前没有实际模型费用记录，因此没有虚构预算或效果分数。

## 四、本轮实际验证结果

| 检查范围 | 结果 |
|---|---|
| 全部技能后端测试 | **254/254 通过，0 skip**，包含新增 V2 的 14 项 |
| 浏览器：案例/对照/输入/授权/执行台/目录 | **34/34 通过** |
| 原案例与新旧文件/来源/清单/PDF正文验证 | **7/7 通过** |
| V2 真实导出样本 | 12 布局 × 3 主题全部输出实际 PDF/页图；另有 25 页上限验证 |
| 本案例 | 12 页实际 PDF、12 张页图；**0 critical** |
| Web 生产构建、服务端 TypeScript、diff 检查 | 通过；保留既有分包警告 |
| 真实服务商模型验收 | **未运行，外部调用 0** |

主要日志：

- `.cache/presentation-v2-all-skills.log`：254 项，串行执行，避免 Office/OCR 内存竞争。
- `.cache/presentation-v2-ui-tests.log`：34 项；含 V1/V2 切换后保留页码、下载与所选版本对应、V2 默认选择、模式切换撤销授权及错误重试。
- `.cache/presentation-v2-artifact-tests.log`：7 项；包括新旧原文稿/绑定一致、全包哈希一致、实际 V2 PDF 每页的所有原有正文/表格行可提取。
- `.cache/presentation-v2-comparison.log`、`.cache/presentation-v2-web-build.log`。

自动检查通过仍是 `needs-human-review`，`commercialApproval:false`。这些结果不是全仓测试通过声明；此前扩展 API 的四项基线失败未在本轮修复，也没有在本轮重新执行那批 23 项 API 测试。

## 五、代码落点与复现

- `shared/presentationDesign.ts`：布局目录、声明合同、引擎版本。
- `shared/presentation.ts`、`presentation/sources.ts`、`spec.ts`：可选排版协议、版本与规划校验。
- `server/skills/presentation/layouts/`：度量、密度适配、完整对象模型及原生编译。
- `server/skills/pptx-deck.ts`：保留原 V1，显式分流 V2，仍共用 PptxGenJS 与主题处理。
- `presentation/quality.ts`、`planning-review.ts`、`pipeline.ts`：全对象外框检查、规划工程评审与任务产物集成。
- `PresentationComposer.tsx`、`LeaderDecisionReport.tsx`：排版选择、授权撤销和新旧效果对照。
- `scripts/generate-presentation-v2-comparison.cjs`：离线同内容重排，不覆写 V1，不调用提供商。

```sh
corepack pnpm exec tsc -p server/tsconfig.local.json
node scripts/generate-presentation-v2-comparison.cjs
node --test scripts/leader-decision-report.test.cjs
corepack pnpm test:skills
corepack pnpm --filter designbuddy-web build
node apps/web/scripts/run-playwright.mjs test \
  tests/leader-decision.spec.ts tests/presentation-composer.spec.ts \
  tests/skill-runtime.spec.ts tests/skills.spec.ts
```

并发、执行时限、单次成果大小和所有者配额没有为 V2 取消或放宽；模型规划恢复仍复用已保存检查点，不静默重发正文。

## 六、未完成边界

- M0 真实外部模型的叙事、事实及商业效果验收；目标 PowerPoint/WPS/Keynote 重开编辑与人工视觉验收。
- 截图/Logo/图片与品牌系统、新图表种类：仍待 M2，不因有布局目录而算完成。
- 持久演示工作区、单页修改、版本回退、自动视觉修复：仍待 M3。本次新旧切换是静态导出对照，不是这些能力。
- 不支持任意旧 PPT 无损编辑、任意字体度量、自动事实核验或自动商业批准。

此前设置改版与其他未提交工作保持原样；本轮没有提交或推送。
