# 首批九类模板标杆：实现与验证记录

日期：2026-10-20（Asia/Shanghai） · 模板版本：`2026.10.20-1`

## 当前结论

已将 8 套新增可编辑/运行样例加入应用，配合既有 FORME 原型形成九类标杆候选。在模板页点击 **「查看本批 9 类标杆」**，可以逐套打开；另有「能力与缺口清单」查看登记与待办。

这是已批准升级方案的首批实施，不是 46 个旧条目、130 个行业目录或建议新增 18 套均已完成的声明。业务与视觉审定、目标办公软件验收仍待用户审阅；`commercialApproval` 保持 `false`。没有发布到正式服务器，没有更换登录页面或 15 张欢迎图，没有付费生成素材或接入真实支付、预约、邮件服务。

## 1. 盘点与去重

源码盘点由 `scripts/audit-template-readiness.cjs` 生成 [readiness.json](../../../apps/web/public/template-benchmarks/readiness.json)：

- 当前展示登记 **54 = 46 既有 + 8 新增**；每条有来源、能力声明、数据模式、去重说明、许可复核状态及待办。
- 行业目录 **130 个 ID / 19 类 / 3,120 条描述**，不与展示条目相加。
- 130 个目录的页面名称序列只有 1 种。该事实是描述层重复信号，不能作为独立页面或业务实现证据。
- 旧模板未以新模板测试结果代替逐套验收；旧素材许可保留 `pending-per-asset-review`。行业目录逐条保留业务页面、交互/异常、导出、授权与验收缺口。

## 2. 九类实际交付与边界

| 类别 / 入口 ID | 样例与实际内容 | 已提供输出 | 明确限制 |
| --- | --- | --- | --- |
| 原型 / `forme` | 既有家具选配采购，24 个页面/状态、5 张原图、产品筛选、比较、空间编辑、模拟采购及售后 | 当前配置与原图的离线交付；本轮完整回归 | 本地模拟，不是生产订单或付款 |
| 幻灯片 / `pro-review` | NORTH：10 页季度复盘，指标口径、诊断、流程、风险、行动、管理层取舍、来源与讲稿 | 原生可编辑 PPTX；原始版真实渲染 PDF 与 10 张页图 | 合成教学数据，无真实企业背书；固定 PDF 不包含用户修改 |
| 文档 / `pro-project` | FIELDNOTE：目标、范围、交付关卡、职责、变更、风险、验收、交接，共 8 节正文及原生表格 | DOCX；原始版实际 5 页 PDF、5 张页图与质量报告 | 页数会随编辑变化；未验证 Microsoft Word/WPS，不是业务批准 |
| 图片 / `pro-launch` | ORBIT：品牌、卖点、结构、场景、邀请、行动入口 6 张原创矢量画板 | 当前 SVG / PNG、6 张 SVG ZIP、参数 JSON | 屏幕视觉；无摄影、无印刷出血/色彩认证 |
| HyperFrames / `pro-tour` | WAYFINDER：创建项目至交付复核的五步教学，前后导航、键盘与重置 | 当前独立 HTML / JSON | 不操纵第三方软件、不采集行为 |
| 视频 / `pro-film` | FORM / FUNCTION：五个程序场景，缓慢镜头运动，20 秒短片及分镜说明 | H.264 MP4、VTT、当前分镜 JSON；浏览器字幕轨可加载 5 条 | 960×540 / 25fps / 无音轨；修改分镜不重编码固定样片 |
| 音频 / `pro-cues` | SIGNAL：成功、提醒、警告、错误、完成 5 种程序音效，增益/试听 | PCM WAV / ZIP / JSON | 22,050 Hz、单声道、16-bit；不是音乐或人声 |
| 实时产物 / `pro-cost` | LEDGER：三工种、外采、预备金、税费、独立压力情景，逐项复算 | 当前 CSV / 可运行 HTML / JSON | CNY，分为计算单位；非合同报价或财税建议，不接支付 |
| WebGL / `pro-config` | OBJECT：原创边几几何，宽高、色彩、视角、相机重置、失败降级 | 当前 WebGL HTML / OBJ / JSON | OBJ 无材质/相机；示意模型，不用于工程测量 |

8 套新作支持本地编辑、刷新恢复、恢复原始、副本隔离，以及真实 API 的授权快照保存/恢复。云快照有版本冲突控制与跨用户隔离测试；不是完整版本历史或第三方业务系统。固定文件按钮明确标识“不含修改”。

## 3. 已执行的检查

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 服务端 TypeScript 编译、Web TypeScript 检查 | 通过 | 可用下方命令重跑 |
| Web 生产构建 | 通过；存在主包超过 500 kB 与 fflate 静态/动态混用警告，未声称性能认证 | [构建日志](logs/web-build.log) |
| 模板模型/文件测试 | **10 / 10** | [Node 测试](logs/unit.log) |
| 既有后端回归 | **6 / 6** | [后端日志](logs/backend.log) |
| 新标杆浏览器验证 | **28 / 28**，按布局/功能两组运行（17 + 11） | [布局 17 项](logs/browser-layout.log)、[功能 11 项](logs/browser-functions.log) |
| FORME 完整回归 | **12 / 12**，包含全部 24 页及 320 / 375 / 768 / 1440 宽度 | [FORME 日志](logs/forme-regression.log) |
| 8 套工作区 axe 与键盘路径 | 当前 **0 个自动确认的 violation**；仍有 1 项需人工判断的 SVG 对比度 incomplete | [axe 原始汇总](axe-summary.json) |
| Office 原始文件真实渲染 | PPT 10 页、Word 5 页，逐页图完整 | [生成日志](logs/benchmarks-build.log)、公开目录的元数据与报告 |

以上浏览器测试包含：1440 / 390 无外层横向溢出与运行错误，原生 Office 当前编辑内容，SVG/PNG/ZIP，音视频下载、视频解码/定位至 8 秒，离线导览完成五步与键盘路径，预算 CSV/HTML 与实时金额一致，WebGL/OBJ，云恢复、CAS 409、跨用户隔离、副本不覆盖原版。

金额核对样例：人工 ¥18,400 + 外采 ¥2,000；10% 预备金 ¥2,040；6% 税费 ¥1,346.40；合计 **¥23,786.40**。策略工时 24→30 后合计 **¥25,045.68**。每步以分计算并四舍五入，不能将税率直接应用于未含预备金的小计。

视频不是仅检查 MP4 文件头：Node 测试用 FFmpeg 完整解码至 null；浏览器取得 20 秒时长、定位 8 秒且 readyState ≥ 2，并确认 5 条 VTT cue 可加载。真实 WebGL 绘制另用 Chromium SwiftShader 截图确认，不能拿允许降级的导出测试充当 GPU/设备兼容认证。

### 离线中文与许可修复

独立 iframe 不继承父页面字体，视觉复核曾发现中文方框。现将仓库本地 Noto Sans SC WOFF2 内嵌到三个 HTML 及浏览器导出的 SVG，随文件携带完整 OFL 声明。新测试阻断所有网络请求，逐一加载三个 HTML、等待内嵌 FontFace 的 `loaded` 状态，确认没有外部请求；再截图复查中文。字体尚未准备好时相关导出按钮不可点击。

完整内嵌字体增加了文件体积。当前清单收录 **47 个文件 / 6,431,358 bytes**，精确字节及 SHA256 以 [assets-manifest.json](../../../apps/web/public/template-benchmarks/assets-manifest.json) 为准；另有 manifest/readiness 自身。若重新生成，Office 元数据可能使哈希变化，应同时重跑文件一致性测试。字体外的生僻字符仍需接收端字体支持。

同时修复了 WebGL 深度方向和主区域语义；为视频接入现有 VTT 字幕轨。axe 的工作区检查可覆盖可达的 iframe 文档，但不是全站、所有浏览器或完整 WCAG 认证。ORBIT 内联 SVG 的背景/文字对比度仍有一项自动工具无法判定，保留 incomplete，不改写成通过。

## 4. 视觉复核证据

本次已实际查看 PPT 全 10 页、Word 全 5 页及下列截图。PPT 从单一版式调整为封面、指标卡/原生表格、流程卡、风险表、行动条、决策分栏；图中文字与表格未见明显遮挡/裁切。Word 标题、表格、页码与正文在此次 LibreOffice 5 页渲染中未见明显溢出。它们是代理本次视觉复核的观察，不等同于用户商业批准；Word 自动报告中的 `renderedVisualReview: required` 与目标 Word/WPS 检查仍保持原始状态，没有伪造报告通过。

- [九类标杆集合](images/workspace-gallery.png)
- [PPT 全页缩览](images/pptx-all-pages.png) / [Word 全页缩览](images/docx-all-pages.png)；完整单页图见公开素材目录
- [预算工作区](images/workspace-cost.png) / [品牌画板工作区](images/workspace-launch.png)
- [实际 WebGL 绘制、遮挡与中文标签](images/workspace-config.png)
- 断网加载截图：[导览](images/offline-tour.png)、[预算](images/offline-cost.png)、[三维独立页面](images/offline-config.png)

工作区截图裁掉左侧账号栏，不保存测试账户认证文件或真实用户数据。

## 5. 素材与权利

本批新增文字、合成数据、程序图形、音效及几何是仓库原创样例；原创内容 CC0-1.0。Noto Sans SC 及嵌入字体仍适用 SIL OFL，代码及依赖保持原许可，不能统称“全部 CC0”。[素材边界与许可](../../../apps/web/public/template-benchmarks/README.md)、[CC0 全文](../../../apps/web/public/template-benchmarks/CC0-1.0.txt)、[OFL 通知与全文](../../../apps/web/public/template-benchmarks/OFL.txt)。

没有检索虚构品牌的全球商标状态，没有对真实业务素材或用户后续替换的图片/字体授权作保证。PPTX/DOCX 不内嵌字体，接收方需安装 Noto Sans SC 并在目标软件复核。旧模板素材授权仍待逐套核查，不能由本批声明覆盖。

## 6. 复现

在仓库根目录，先 `corepack pnpm install --frozen-lockfile`。生成视频需要 FFmpeg（可运行 `corepack pnpm setup:ffmpeg`，或设置 `FFMPEG_PATH`）；Office 生成使用仓库现有 LibreOffice Kit 与授权字体。

```sh
corepack pnpm templates:build
corepack pnpm test:templates
corepack pnpm --filter designbuddy-web exec tsc --noEmit
corepack pnpm --filter designbuddy-web build
node --test server/api/workspace-backend.test.cjs

# 预览未运行时启动（0.0.0.0，前后端同源代理）
corepack pnpm dev:full

# 在另一个终端：需安装可用 Chromium，或指定 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
corepack pnpm --filter designbuddy-web exec playwright test template-benchmarks.spec.ts --grep 'collection|1440|390' --reporter=line
corepack pnpm --filter designbuddy-web exec playwright test template-benchmarks.spec.ts --grep-invert 'collection|1440|390' --reporter=line
corepack pnpm --filter designbuddy-web exec playwright test inspiration-forme.spec.ts --reporter=line
```

本沙箱使用 Chromium 153、`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium`、`LD_LIBRARY_PATH=/tmp/lib:/tmp`；这些是临时环境路径，不是接收方必须使用的部署路径。模板测试读取编译后的 shared JS，改源码后先编译，不要只测试陈旧 dist。`.cache`、浏览器会话、node_modules、dist 与运行时数据库不进 Git。

## 7. 用户审阅与下一阶段

请在九类集合中审阅内容深度、整体视觉、默认操作路径，并重点在目标 Word/PowerPoint/WPS 中打开导出的 Office 文件；可修改一套标题、做副本并核对导出是否保持修改。业务与品牌材料缺失的部分不能以合成数据替代真实证据。

依批准方案，在标杆方向确认后再分批处理存量及剩余建议新增主题。真实外部服务继续单列授权、配置和验收；正式服务器部署仍需另行确认。
