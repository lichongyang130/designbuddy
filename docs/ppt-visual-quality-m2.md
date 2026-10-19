# PPT 视觉质量 M2：视觉策划、安全素材与三种艺术方向

日期：2026-10-19。按用户在 Gamma 分析后的授权执行，作为 M0/M1 之后的 **M2 首批落地**；不是完整 Gamma 复刻，也不含 M3 任意局部修改编辑器。

后续获批的「内容导演、整套节奏与原生解释视觉」已另行实施，见 [内容导演首批记录](ppt-content-director.md)。本文件保留M2三种艺术方向当轮结果。

## 先看实际结果

应用入口：**模版 → 幻灯片 → 视觉叙事 · 三种艺术方向**，路由 `/inspiration/visual-directions`。

每种风格均为同一历史领导决策报告的 **12 页 / 15 分钟**实际可编辑 PPTX、同文件 PDF、全页 JPEG、ZIP 和检查记录。切换风格保留当前页，便于同页比较。查看案例不会上传材料、调用后台模型或发布外部社区。

| 艺术方向 | 构图，而非只有换色 | 实际文件 |
|---|---|---|
| 咨询极简 | 克制留白、结论在左、主视觉在右、清晰数据层次 | [PPTX](../apps/web/public/presentation-examples/visual-directions/consulting/presentation.pptx) · [PDF](../apps/web/public/presentation-examples/visual-directions/consulting/presentation.pdf) |
| 科技发布 | 深色舞台、右侧大图贴边、明亮焦点、原生数据区 | [PPTX](../apps/web/public/presentation-examples/visual-directions/technology-launch/presentation.pptx) · [PDF](../apps/web/public/presentation-examples/visual-directions/technology-launch/presentation.pdf) |
| 品牌图文 | 暖色杂志、左图右文、章节侧线、编辑式标题 | [PPTX](../apps/web/public/presentation-examples/visual-directions/brand-editorial/presentation.pptx) · [PDF](../apps/web/public/presentation-examples/visual-directions/brand-editorial/presentation.pdf) |

每个目录同时有 `presentation-package.zip`、`visual-plan.json`、`quality-report.json`、`sources-and-notes.json`、`resolved-layout.json`、`manifest.json`、`README.md`、全页图和完整规范化素材。文字、图表、表格、图注及讲稿仍为原生对象；图片本身是可替换PNG，不冒称可编辑矢量。

### 同材料比较的准确范围

- 原文稿正文、原有讲稿、数据、图表/表格绑定、事实来源、页序和页数保持不变；测试逐项比较对象，不只依赖一句声明。
- 第11页新增完整历史截图的文件定位引用；原事实引用不被替换。新图注、概念标识、素材归属和图片讲稿附注属于视觉说明。
- 不将旧报告中的源码位置和历史测试数视为本次代码审计，不重新认证历史材料。
- 生成脚本检查 V1/V2 的 PPTX、PDF 和报告哈希未变。旧 `/inspiration/leader-decision` 及其 V1/V2 下载仍保留。

## 已实现的链路

### 1. 可追溯的视觉策划

- `brief.visualStyle` 显式选择三种方向；无该字段、无素材时保留旧行为，不能静默升级旧稿。
- 文字规划模型只接收来源正文、数据位置和素材元数据，不接收图片base64/像素。不隐式OCR或声称看懂截图。
- `design.visual` 只有已授权 `assetId` 和 `contain|cover` 意图；拒绝坐标、脚本、任意图片URL和不存在的素材。
- 三个新增原生组合布局：`visual-cover`、`visual-story`、`screenshot-evidence`；不在密集表格/图表页强塞图片，不删行、不缩字、不静默增页。
- `visual-plan.json` 记录规则引擎版本、实际配色、逐页主旨/构图/图片用途、素材来源/许可声明/双哈希、未使用素材等。
- 规则引擎版本 `visual-1.0.0`；**元数据驱动的确定性策划，不冒称自主多模态审美、图像识别或实际外部模型质量验收**。

### 2. 安全素材、截图与Logo

- 新输入 `assets` 与正文文档分离。每份必须声明角色、装饰/证据用途、说明、来源、使用许可，并明确确认本次使用权限。
- 最多5份素材，每份≤2MB；与最多5份正文材料合计≤10MB，JSON信封≤13.6MB。
- 只接受真实 PNG/JPEG/WebP 魔数；拒绝SVG/HTML、伪装格式、路径、远程抓取、APNG/WebP动画、超过800万像素、解码失败及超出规范化预算的图片。不用占位图掩盖失败。
- Sharp 按EXIF方向旋转、去除原元数据，统一PNG；装饰图最长边≤2200，证据图保留原始像素（只应用方向），单张规范化≤4MB、合计≤8MB。
- 截图强制 `evidence`；证据素材强制 `contain`、完整显示并绑定本页来源。素材元数据不能单独支撑一页正文，仍需可核对的文本/数据来源；图片文字请另附材料。
- Logo只能使用明确选择的 `brief.logoAssetId`，全页小尺寸完整显示，不能被当作事实证据或虚构品牌标识。
- 来源JSON、视觉规划、布局记录和文字模型提示中没有原始或规范化图片base64；导出文件与完整素材另行交付。数字字面检查也不把素材哈希/说明中的数字当成业务数值依据。
- 证据图与遮挡对象的外框相交不能通过“装饰层”豁免。图片像素内容、图内文字、Office重排、实际可读性仍需人工检查。

### 3. 可使用的界面

- 真实商业演示工作台可选艺术方向、上传视觉素材、声明用途/来源/许可、确认权限、选择品牌Logo。
- 素材像素不会送给文字规划模型，但元数据会在本次正文处理授权后参与规划。应用接收的完整请求包含图片用于本机生成，这是材料上传的一部分。
- 未确认权限不能准备输入；任何素材、说明、风格或需求修改均撤销已准备输入及两项授权。预览本地图片不会上传。
- 经典V1选择明确移除视觉风格与素材，保留正文文档；界面预先说明。生成器打开时使用当前风格，之后是独立任务，需在工作台内调整。
- 案例页提供实际下载、逐页讲稿、事实来源、视觉意图、素材来源/许可声明/哈希、完整截图下载、失败重试及安全路径检查；移动端无横向溢出。

## 本次素材的真实来源

1. 概念雕塑：本次会话通过 Arena 图像工具实际生成一次，存于 `assets/presentation-visuals/concept-hero.jpg`。仅概念装饰，不是真实产品或业务证据，不声称CC0或独立版权认证。
2. 截图：冻结 V2 第04页的完整实际渲染。用来示范原生页与栅格图的区别，没有OCR，不作为当前代码审计。
3. 示例标识：脚本本地Canvas绘制 `DB / CONCEPT`，非第三方Logo，不宣称第三方品牌授权。

**应用的 `image.generate` 仍是已有的、需实际服务端通道与明确授权的独立技能。此次未实现或调用 PPT 自动生图编排。** 不以这张工具生成的图片冒充后台自主生成效果。

## 验证与复现

- 技能回归：最终 **261/261通过、0失败、0跳过**（含新增7项M2测试），日志 `.cache/m2-all-skills-final.log`。
- 浏览器：39项通过（此前34项范围，加5项M2用例）；后续只调整案例页信息顺序、提前展示真实风格封面，9项定向复验再次全部通过（`.cache/m2-ui-final-targeted.log`）。
- 实际文件：11项通过（原V1/V2的7项与M2新增4项）。覆盖12页PDF、原生图表/表格/文字、完整截图像素/长宽比、来源/数据/讲稿不变、素材与交付哈希、三种不同封面几何、完整证据包。
- 三套案例均0项critical，状态均 `needs-human-review`，`commercialApproval=false`。不等于商业通过。
- 已人工查看实际全页联系表、咨询封面、科技封面/图表与表格节奏、品牌图文页/完整截图页、移动端页面。不是PowerPoint目标软件编辑验收。
- TypeScript与生产构建通过；构建保留仓库已有的大包/动态导入提示。

```bash
corepack pnpm exec tsc -p server/tsconfig.local.json
node scripts/generate-presentation-visual-directions.cjs
node --test --test-concurrency=1 scripts/leader-decision-report.test.cjs scripts/presentation-visual-directions.test.cjs
corepack pnpm test:skills
corepack pnpm --filter designbuddy-web build
cd apps/web
# 使用正常已安装Playwright浏览器，或提供可用Chromium路径和必要共享库
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium corepack pnpm exec playwright test tests/leader-decision.spec.ts tests/presentation-composer.spec.ts tests/presentation-visual-gallery.spec.ts tests/skill-runtime.spec.ts tests/skills.spec.ts
```

本环境Chromium在 `/tmp/chromium`，运行时使用 `LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp`。缓存/浏览器文件不属于Git交付。

## 仍待验收，不合并宣称完成

- M0真实服务端外部规划质量：本次案例沿用原助手编排正文，没有发起真实后台规划调用；模拟提供商/检查点测试不算真实质量验收。
- 多模态图内理解、OCR、自动搜图、自动PPT生图或图像编辑：未实现；现有独立生图技能没有被假接通。
- 自定义品牌字体/任意主题/字体嵌入：本批未实现。PPTX仍未嵌入Noto Sans SC，接收端需安装字体。
- 目标Office逐页编辑、截图可读性、材料事实含义与来源权限：需要人工确认。
- M3持久化局部改稿/任意旧PPT无损编辑：不在本批交付。
- 未向外部社区发布，未commit或push。

### 建议下一步

先用当前三套实际文件选择更合适的艺术方向；再使用同一份真实授权材料运行实际后台模型，并与Gamma做同材料、同页数、实际PPTX/PDF与Office编辑结果的对照。未补真实规划与目标软件验收前，不把工程通过表述为“自动商业成稿”。
