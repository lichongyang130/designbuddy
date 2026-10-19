# 内容导演首批：逐页任务、整套节奏与原生解释视觉

日期：2026-10-19。用户批准上一轮增强方案后的第一批实施。延续 M0/M1/M2，不把第二批渲染后视觉修复或第三批编辑器合并宣称完成。

## 一、直接使用

**应用：模版 → 幻灯片 → 内容导演 · 让表达由证据决定**，路由 `/inspiration/content-director`。

- [12页实际PDF](../apps/web/public/presentation-examples/content-director/presentation.pdf)
- [原生可编辑PPTX](../apps/web/public/presentation-examples/content-director/presentation.pptx)
- [完整文件与证据包](../apps/web/public/presentation-examples/content-director/presentation-package.zip)
- [逐页导演任务、节奏与关系依据](../apps/web/public/presentation-examples/content-director/direction-plan.json)
- [全页联系表](../apps/web/public/presentation-examples/content-director/slide-contact-sheet.jpg)
- [同内容对照与锁定哈希](../apps/web/public/presentation-examples/content-director/comparison.json)

查看器可在「内容导演」和「原M2咨询图文版」之间切换，保持当前页和对应下载地址。它展示实际PPTX渲染，不是网页模拟效果；不会自动上传示例或发布到社区。

### 本次最值得看的页面

| 页码 | 表达变化 | 保留的边界 |
|---|---|---|
| 02 | 主张＋支撑：一个重点大区，三个原有支撑点 | 全部原文要点保留，不把建议写成已批准 |
| 07 | 原生并列分支结构 | 四项价值是并列论据，不臆造先后、从属或因果 |
| 10 | 原生阶段节点与顺序箭头 | 来自原稿建议关卡，明确“建议顺序”，不表示启动、完成、批准、日期或因果 |
| 11 / 12 | 原生待核对条件卡 | 空框不表示条件已经满足，不擅自给出验收通过状态 |

每页在网页里另有「任务、核心结论、表达方式、设计理由、事实边界、证据位置」，全套有决策目的、论证顺序与12页节奏条。

**原稿正文、原有讲稿、图表/表格数值、绑定、来源、页序、页数不变。** 任务说明、图示关系声明、要点序号和素材附注属于新增视觉说明，不构成新业务事实。脚本对原有内容逐对象比较并锁定哈希；不删事实、不缩字、不自动增页。

## 二、真实生成链路的变化

只有显式选择 `brief.narrativeMode="directed"` 且 `layoutStyle="adaptive"` 才启用。未提供新字段时保留原V1/V2/M2行为与检查点合同。

### 阶段A：内容导演

使用既有服务端配置与本次授权的正文处理通道，先请求结构化导演计划：

- 受众需要做出的决策；整套论证顺序。
- 每页角色：开场、证据、解释、方案、条件、决策。
- 每页核心结论、真实文字/数据来源、表达理由和事实边界。
- 表达方式：重点主张、原生数据、比较、并列结构、顺序流程、决策条件。
- 节奏：重点页、解释页、核对页；不是每隔几页机械插图。
- 顺序关系的依据：原文逐字引用，或明确建议；不提供任意因果图模式。

导演计划是有界声明数据，不接受坐标、脚本、外部图片URL、提供商设置或虚构来源；素材元数据不能作为正文事实依据。

### 阶段B：锁定任务后写稿

将通过校验的导演计划作为 `lockedDirection` 送到第二阶段：

- 写稿必须完整保留导演计划，页标题与锁定结论逐字一致，不能遗漏导演证据。
- 内容类型必须适合表达方式；不能用第二张封面或仅标题页凑页数。
- 真实图表/表格/指标仍从原单元格确定性读取，不接收模型自填数值。
- 建议流程只能是 `recommendation/pending`；源引流程必须绑定同页位置并有逐字原文。引用存在不等于关系语义已核实。
- 并列/流程/条件页不允许偷偷塞图后挤掉图示，或悄悄丢弃证据图片；冲突会报错。

本批不是“先按旧方式生成，再补一份设计理由”。实际通道是先导演，再受约束写稿；但下述内置样例的导演任务为明确的助手编排，不能当作真实服务端模型质量证明。

### 阶段C：原生解释编译与节奏评审

新增五种组合：

1. `message-focus`：重点与完整支撑。
2. `native-structure`：并列分支，不表示因果或先后。
3. `native-process`：2–4项有依据的顺序步骤。
4. `decision-criteria`：待核对条件，非已通过状态。
5. `connected-gates`：保留日期（若提供）、节点标题与说明的建议/原文顺序。

图示由原生文字、矩形、椭圆、线形区块和箭头形状组成，不是整页图片。它们是逐对象可编辑的形状与文字，**不是SmartArt或自动吸附连接器**。目标Office交互效果仍需人工验收。

几何、文字、对比度、来源、数值和实际PDF/全页渲染继续经过原有检查。图示文字不能完整排入时明确要求改布局或确认拆页，不能偷偷缩字或跳过节点。

连续三页核对页/重点主张会产生节奏复核提示，不为追求疏密变化删掉必要证据或机械插入装饰页。

## 三、调用、成本与恢复边界

- 导演最多2次（首次＋一次结构/来源校验重试）；写稿最多2次。
- 标准路径仍最多2次；导演路径最多4次，不增加隐式外部搜图、生图、OCR或多模态图片发送。
- 导演一旦完成就保存 `stage="directed"` 检查点；写稿每次调用前先持久预约预算，返回或失败后保存已报告用量。
- 只保存导演时：恢复不重复导演，仅使用剩余写稿预算；仍可能向同一已配置通道发送本次已授权正文。
- 已完成写稿 `stage="planned"`：恢复仅编译/渲染，不重复模型调用。
- 写稿预算耗尽：恢复API返回409；不允许通过反复恢复取得新的自动调用额度，需要重新准备材料并明确授权新任务。
- 如果在预算预约后中断、无法确认是否已请求提供商，该次预算保守计入已用；不能保证所有预约都实际调用或产生费用。实际用量以提供商记录与已有用量账本为准。
- 检查点绑定原始输入哈希、运行与所有者，仍使用原有配额和隔离机制。声明字段不能指定模型、端点或密钥。

## 四、界面

商业演示工作台新增「内容导演」选项，清楚披露两阶段、最多4次调用及可能增加用量。默认标准路径，旧任务不会自动升级。

切换导演设置与其他需求一样，撤销准备状态、上传同意及本次正文处理授权。选择经典V1会移除导演设置，保留正文文档。内置案例可打开独立工作台，默认填入导演模式，但不会自动上传材料或执行。

案例页有真实文件下载、原文稿文字版、讲稿、原始材料块、历史源码证据映射、视觉任务单、节奏、错误重试与严格的预览路径校验。320/390px移动端已测试。

## 五、证据与测试

- 新增6组服务端测试：导演声明/来源与引用/关系边界/五类原生图示/事实锁定/检查点/实际适配器两阶段/调用预算/恢复。
- 测试用本地模拟提供商，明确标记 `synthetic...NOT-live-quality`，验证的是实际HTTP适配器合同、用量、检查点与本机导出，**不是外部模型内容质量**。
- 浏览器44项通过（原39项＋导演选项1项＋新案例4项）。
- 实际文件15项通过（原11项＋新案例4项）。含12页PDF文字保留、原生对象、哈希、事实/数据/讲稿锁定与完整文件包。
- 新例质量状态 `needs-human-review`，0项critical、`commercialApproval=false`。全技能回归 **267/267通过、0失败、0跳过**；最后对缺失导演计划的诊断和质量报告重试字段作明确化后，6组导演用例再次复验。
- TypeScript与生产构建通过，保留现有大包/动态导入提示。
- CLI真实模型预检：`status=not-run`、`serverCredentialPresent=false`、`externalProviderCalls=0`。未使用旧代码中的隐含凭据。
- 已人工查看实际重点页、并列图、建议流程、全页联系表和移动端；不是目标Office编辑验收。

```bash
corepack pnpm exec tsc -p server/tsconfig.local.json
node scripts/generate-presentation-content-director.cjs
node --test --test-concurrency=1 scripts/leader-decision-report.test.cjs scripts/presentation-visual-directions.test.cjs scripts/presentation-content-director.test.cjs
corepack pnpm test:skills
corepack pnpm --filter designbuddy-web build
cd apps/web
# 使用已安装的Playwright浏览器，或指定可用Chromium路径及共享库
corepack pnpm exec playwright test tests/leader-decision.spec.ts tests/presentation-composer.spec.ts tests/presentation-visual-gallery.spec.ts tests/content-director.spec.ts tests/skill-runtime.spec.ts tests/skills.spec.ts
```

本环境浏览器使用 `/tmp/chromium` 与 `LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp`；缓存/浏览器不作为Git交付。日志在 `.cache/director-*.log`。

## 六、不宣称完成的事项

1. 本例沿用历史材料、由助手编排导演任务；不是新的源码审计或真实外部模型规划验收。旧测试数不因本次重排获得重新认证。
2. 不是语义事实/因果关系自动认证；规则只验证位置、逐字引用、类型兼容与明确建议状态。
3. 不发送图片像素，不自动OCR/生图/搜图。封面只沿用上轮已真实生成的概念素材，不新增业务证据。
4. 本批没有渲染后多模态审美评审、自动视觉修复、持久化局部编辑器或任意旧PPT无损编辑。
5. 字体未嵌入，仍需安装Noto Sans SC；目标PowerPoint/WPS/Keynote编辑与实际可读性需人工核对。
6. 未向外部社区发布，未commit或push。

## 七、建议审阅顺序

先比较第02、07、10、11页，确认“表达更明确且没有增加不该有的关系”；再用同一份真实授权材料，通过显式配置的实际服务端模型验证导演计划与写稿质量。只有这一轮真实验收完成后，再进入下一批“渲染后复核＋有边界的视觉修正”。
