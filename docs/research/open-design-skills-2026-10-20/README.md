# OpenDesign 244 项技能：中文用途全清单

整理日期：2026-10-20。来源：[OpenDesign 设计技能目录](https://open-design.ai/zh/skills/#catalog)。

**结论：这是设计 Agent 的方法、工具工作流与检查规范库，不是 244 个互不重复、安装后就能独立运行的完整软件产品。**

## 阅读与证据范围

- 本次读取目录全部 13 个分段，包含 001—244 项的用途、部分工具要求、输出提示与网站许可标签。
- 编号、技能标识与详情链接沿用仓库已有的 [244 项原版接入核查表](../../audits/open-design-skills-2026-10-19/244项原版接入对照.csv)，本次补充中文用途及边界说明；以标识区分同名技能，后续网站排序可能变化。
- 下表是对目录摘要的解释和转述。**没有在本轮逐一重读 244 份上游 SKILL.md、安装全部依赖、调用外部服务或验证商业质量。**
- “工作性质”是本次整理，便于区分规范、研究、制作、检查和转换，不是网站原始分类字段。“工具或边界”不是完整安装清单；实际运行须继续核对上游配套脚本、参考文件、版本、权限和许可。
- 官网称目录来自 58 个仓库，并列出 2026-09-14、10-07、10-12 等研究快照；不能把目录的当前可见内容当成上游全部最新版本。
- 本轮只整理资料，不安装或启用新技能、不改应用界面、不采购服务。

## 一、网站的 10 个任务分类

下列数量来自本次目录顶部的任务筛选项，合计 **244**。后文逐项清单保持网站核查表顺序，不按本次自定义“工作性质”重新计数。

| 网站任务分类 | 数量 | 通俗用途 | 代表条目 |
| --- | ---: | --- | --- |
| Web 与 UI / 前端 | 53 | 做网页界面、落地页、后台、组件、响应式布局和截图还原 | frontend-design、ui-ux-pro-max、interface-design、image-to-ui |
| 移动应用 | 10 | 做 iOS、Android、React Native 界面与移动交互 | mobile-ios-design、mobile-android-design、animate-expo |
| 品牌与设计系统 | 30 | 统一标志、配色、字体、间距、令牌、组件和交接规则 | brand、ui-design-system、theme-factory、logo-design |
| UX 与研究 | 32 | 研究计划、访谈、用户画像、旅程、信息架构、文案和交互规范 | user-research、interview-script、journey-map、ux-writing |
| 设计评审与无障碍 | 19 | 找界面缺陷、验证键盘/读屏/对比度、审查计划并指导修复 | design-review、break-ui、a11y-audit、wcag-audit-patterns |
| 演示文稿 | 19 | 做或分析演示文稿，包括原生 PPTX、HTML 和图片式路线 | pptx-generator、frontend-slides、pptx-quality-gates、image-to-editable-ppt |
| 图像与生成艺术 | 15 | 海报、封面、插画、漫画、生成艺术及图像编辑 | canvas-design、imagegen、baoyu-comic、algorithmic-art |
| 动效与视频 | 40 | 网页动效、滚动动画、字幕、产品宣传片和讲解视频 | gsap-*、hyperframes、motion-graphics、remotion-* |
| 图解与数据可视化 | 13 | 流程图、架构图、关系网络、信息图、仪表盘和交互图表 | diagram、draw-io-diagram-generator、AntV 系列 |
| 3D 与空间设计 | 13 | 模型几何、材质、纹理、灯光、着色器及 CAD 自动化 | Three.js 系列、freecad-scripts、rhino3d-scripts |

## 二、不要混淆的能力

### 1. 都叫“做演示”，交付不同

- `pptx-generator`、`slide-making-skill`、PPTX 规范/质量门槛等围绕 PowerPoint 对象与文件；实际是否保留每一类编辑对象仍需验证。
- `slides`、`frontend-slides`、`slidev`、`guizang-ppt-skill` 等侧重 HTML/浏览器演示，不能直接等同于可编辑 PPTX。
- `baoyu-slide-deck`、`codex-ppt` 把图像组织为演示：视觉页面可以很好看，但页面中的文字与图形不是原生独立对象。
- `image-to-editable-ppt` 是从图像重建结构的另一条路线；必须核查内容、布局与重建保真，不因为有“editable”名字就默认成功。

### 2. 研究规范不等于已经做过用户研究

`interview-script`、`usability-test-plan`、`diary-study-plan` 主要输出计划；`affinity-diagram`、`research-synthesis` 依赖已有证据。它们不自动提供真实受访者，也不能凭空证明市场需求或用户行为。

### 3. 风格指南不等于一个新的独立产品

极简、粗野主义、Apple 风格、反模板感等条目是不同方向。应根据产品选择，而不是同时把所有规则叠加。GSAP 的时间轴、插件、React 集成和性能也是同一动效体系的不同工序。

### 4. 软件与服务不会随说明文件一起出现

Figma、Penpot、Stitch、Illustrator、Rhino、FreeCAD、Three.js、Remotion、图像生成 API 等，需要分别具备软件、环境、账号、权限、素材或额度。导入 SKILL.md 不会自动开通这些条件。

### 5. 许可不是统一的“免费商用”

以下只是**本次网站标签**，不是重新审查上游许可的法律结论：

- `anything2explainer`：非商业用途。
- `guizang-ppt-skill`、`dashi-ppt`：AGPL-3.0；商业使用不必然被禁止，但集成与网络提供服务的义务需要单独评估。
- `anti-ui-slop`、`academic-pptx`：条款相互冲突。
- OpenAI 的 5 个 Figma 专项：Figma 条款与账号权限约束。
- `remotion-captions/create/interactivity/maps/markup` 及 CloudAI-X 的 8 个 Three.js 条目：网站标注未确认。
- `color-expert`：CC-BY-4.0，需关注署名等义务。
- `vercel-react-view-transitions`：MIT 为技能自行声明，仍需核对实际分发内容。

技能说明、依赖软件、模型服务、图片、字体和品牌标识可能分别有不同许可。MIT/Apache 标签也不是对全部输出、商标或素材的授权保证。

## 三、对 DesignBuddy 的意义（建议，不是已接入声明）

1. 可以作为少量核心技能背后的方法库，不建议把 244 项直接变成 244 张卡片。
2. 优先组合完整链路，例如“参考 PPT 分析 → 页面规范 → 生成原生对象 → 素材放置 → 渲染 → 质量检查”；单个说明文件不足以证明整个链路能运行。
3. 专业制作、检查、研究与资源获取应分开标识。先有真实任务和输出要求，再选择方法与工具。
4. 这是一份偏设计的目录，不能据它声称已具备完整 Word 编辑、Excel 兼容计算、中文会议转写或真实业务系统接入。
5. 如果将视频、动效或 3D 纳入未来核心技能范围，应另定执行、编辑、导出与验收标准，不能用通用“视觉制作”名称掩盖缺口。

## 四、244 项逐条用途

表格中的链接是目录详情入口；不是声称本轮逐一审阅了这些详情页或其上游全文。

### 001—040

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 001 | [algorithmic-art](https://open-design.ai/zh/skills/algorithmic-art/) | 用代码画粒子、流场和可调参数的生成艺术。 | 制作 | p5.js；输出程序视觉，不等于摄影。 |
| 002 | [anthropics-brand-guidelines](https://open-design.ai/zh/skills/anthropics-brand-guidelines/) | 把 Anthropic 官方颜色和字体规范用到产物上。 | 规范 | 仅针对 Anthropic 品牌，不能当作任意品牌生成器。 |
| 003 | [canvas-design](https://open-design.ai/zh/skills/canvas-design/) | 制作原创海报及静态画面，交付 PNG 或 PDF。 | 制作 | 静态视觉文件，不承诺图层可编辑。 |
| 004 | [frontend-design](https://open-design.ai/zh/skills/frontend-design/) | 为网页界面确定有辨识度的字体、布局和视觉方向。 | 设计与实现 | 需前端实现环境；设计指导不等于已完成页面。 |
| 005 | [slack-gif-creator](https://open-design.ai/zh/skills/slack-gif-creator/) | 制作适合 Slack 尺寸及体积限制的动态 GIF。 | 制作 | 需要生成及校验 GIF 的工具。 |
| 006 | [theme-factory](https://open-design.ai/zh/skills/theme-factory/) | 给网页、幻灯片或文档配置统一配色和排版主题。 | 规范 | 主题配置，不是完整内容创作。 |
| 007 | [web-artifacts-builder](https://open-design.ai/zh/skills/web-artifacts-builder/) | 用 React 等组件技术搭建交互式 HTML 成果。 | 设计与实现 | React、Tailwind、shadcn/ui。 |
| 008 | [design-consultation](https://open-design.ai/zh/skills/design-consultation/) | 通过设计咨询梳理美学、配色、排版和动效系统。 | 规范 | 产出设计方向和系统方案。 |
| 009 | [design-html](https://open-design.ai/zh/skills/design-html/) | 把已确认的设计方向落实为 HTML/CSS。 | 设计与实现 | 应先确定设计方向。 |
| 010 | [design-review](https://open-design.ai/zh/skills/design-review/) | 检查已实现页面的层级、间距和一致性，并推动修复。 | 检查 | 需要可检查的页面和项目。 |
| 011 | [design-shotgun](https://open-design.ai/zh/skills/design-shotgun/) | 制作不同设计方案，提供可视化对比与反馈选择。 | 设计与实现 | 多个候选方案，不等于自动确定最佳方案。 |
| 012 | [diagram](https://open-design.ai/zh/skills/diagram/) | 把文字或 Mermaid 图转成可编辑 Excalidraw，并渲染图片。 | 转换 | Excalidraw；可提供 SVG/PNG。 |
| 013 | [ios-design-review](https://open-design.ai/zh/skills/ios-design-review/) | 在真实 iOS 设备上检查应用的视觉设计。 | 检查 | 真实设备及可运行应用。 |
| 014 | [plan-design-review](https://open-design.ai/zh/skills/plan-design-review/) | 编码前检查设计计划是否完整、有无体验风险。 | 检查 | 产出计划审查，不是成品测试结果。 |
| 015 | [banner-design](https://open-design.ai/zh/skills/banner-design/) | 设计社媒、广告、网站头图或印刷用途的横幅。 | 制作 | 实际尺寸、素材与印刷条件需另行确认。 |
| 016 | [brand](https://open-design.ai/zh/skills/brand/) | 定义品牌语气、视觉识别和信息表达的一致性。 | 规范 | 需要品牌背景。 |
| 017 | [design](https://open-design.ai/zh/skills/design/) | 结合设计令牌、UI 风格及图像生成规划品牌识别。 | 工作流 | 图像路径需要 Gemini、Atlas Cloud 或 MuAPI 等指定通道。 |
| 018 | [nextlevelbuilder-design-system](https://open-design.ai/zh/skills/nextlevelbuilder-design-system/) | 建立分层设计令牌、组件规则，并用于幻灯片等成果。 | 规范 | 设计系统不是单张配色图。 |
| 019 | [slides](https://open-design.ai/zh/skills/slides/) | 制作含图表、响应式布局的 HTML 演示文稿。 | 制作 | Chart.js；HTML 幻灯片不等于原生 PPTX。 |
| 020 | [ui-styling](https://open-design.ai/zh/skills/ui-styling/) | 用现有组件和样式框架实现可访问的界面。 | 设计与实现 | shadcn/ui、Tailwind CSS。 |
| 021 | [ui-ux-pro-max](https://open-design.ai/zh/skills/ui-ux-pro-max/) | 为 Web、移动和桌面界面选择布局、色彩、排版和 UX 规则。 | 规范 | 方法与参考库；实际效果仍需渲染验证。 |
| 022 | [shadcn](https://open-design.ai/zh/skills/shadcn/) | 查找、添加、组合和修复 shadcn 组件。 | 设计与实现 | shadcn/ui 项目。 |
| 023 | [frontend-ui-engineering](https://open-design.ai/zh/skills/frontend-ui-engineering/) | 实现可访问、响应式且适合生产使用的前端界面。 | 设计与实现 | 具体交付仍依赖项目和运行验证。 |
| 024 | [brandkit](https://open-design.ai/zh/skills/brandkit/) | 通过生成图像制作品牌指南面板、标志与识别手册。 | 制作 | 需要图像生成服务。 |
| 025 | [design-taste-frontend](https://open-design.ai/zh/skills/design-taste-frontend/) | 为落地页、作品集和改版提出避免模板感的前端设计。 | 设计与实现 | 需要项目及实际内容。 |
| 026 | [gpt-taste](https://open-design.ai/zh/skills/gpt-taste/) | 用编辑式布局、丰富排版和动画构建页面。 | 设计与实现 | GSAP。 |
| 027 | [high-end-visual-design](https://open-design.ai/zh/skills/high-end-visual-design/) | 指导字体、阴影、间距、卡片等细节的高级视觉处理。 | 规范 | 审美方法不等于商业质量认证。 |
| 028 | [image-to-code](https://open-design.ai/zh/skills/image-to-code/) | 先生成或分析设计图，再实现相应页面。 | 工作流 | 需要图像生成服务及前端环境。 |
| 029 | [imagegen-frontend-mobile](https://open-design.ai/zh/skills/imagegen-frontend-mobile/) | 用生图方式表达高保真移动界面概念及流程。 | 制作 | 需要图像生成；图像概念稿不是可运行 App。 |
| 030 | [imagegen-frontend-web](https://open-design.ai/zh/skills/imagegen-frontend-web/) | 为网站各区块生成视觉参考图。 | 制作 | 需要图像生成；参考图不等于页面源码。 |
| 031 | [industrial-brutalist-ui](https://open-design.ai/zh/skills/industrial-brutalist-ui/) | 以瑞士排版、终端元素构造粗野主义 UI。 | 设计与实现 | 特定视觉风格，不适用于所有产品。 |
| 032 | [minimalist-ui](https://open-design.ai/zh/skills/minimalist-ui/) | 实现单色、简约、编辑式界面。 | 设计与实现 | 特定视觉风格。 |
| 033 | [redesign-existing-projects](https://open-design.ai/zh/skills/redesign-existing-projects/) | 审查现有应用或网站，提出并实现视觉改版。 | 检查与改进 | 需现有项目；不能仅凭名称证明改版效果。 |
| 034 | [stitch-design-taste](https://open-design.ai/zh/skills/stitch-design-taste/) | 为 Google Stitch 编写强调视觉辨识度的 DESIGN.md。 | 规范 | Google Stitch。 |
| 035 | [impeccable](https://open-design.ai/zh/skills/impeccable/) | 综合执行界面设计、审计、精修、优化和动效调整。 | 检查与改进 | 覆盖范围广，仍需具体项目及验证工具。 |
| 036 | [hyperframes](https://open-design.ai/zh/skills/hyperframes/) | 为视频需求选择工作流，协调合成、媒体、预览和渲染。 | 工作流 | HyperFrames；Node.js 22+、FFmpeg；媒体/云渲染可能另需服务。 |
| 037 | [faceless-explainer](https://open-design.ai/zh/skills/faceless-explainer/) | 把文章或笔记做成不出镜讲解视频。 | 制作 | HyperFrames；所需媒体与声音另依流程配置。 |
| 038 | [figma](https://open-design.ai/zh/skills/figma/) | 把 Figma 素材、品牌令牌和分镜带入视频合成。 | 转换 | HyperFrames、Figma。 |
| 039 | [general-video](https://open-design.ai/zh/skills/general-video/) | 无适合模板时创作或编辑多场景视频。 | 制作 | HyperFrames。 |
| 040 | [hyperframes-animation](https://open-design.ai/zh/skills/hyperframes-animation/) | 规定视频场景动画、转场及运行时适配方式。 | 规范 | HyperFrames。 |

### 041—080

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 041 | [hyperframes-creative](https://open-design.ai/zh/skills/hyperframes-creative/) | 确定视频的构图、色彩、字体、旁白和节奏。 | 规范 | HyperFrames；创意指导不是已渲染视频。 |
| 042 | [hyperframes-keyframes](https://open-design.ai/zh/skills/hyperframes-keyframes/) | 实现视频中的推近、缩放、重构图及关键帧。 | 设计与实现 | HyperFrames；含 Ken Burns 类移动。 |
| 043 | [motion-graphics](https://open-design.ai/zh/skills/motion-graphics/) | 制作标志动画、动态文字、计数和下三分之一字幕等短动效。 | 制作 | HyperFrames。 |
| 044 | [product-launch-video](https://open-design.ai/zh/skills/product-launch-video/) | 依据产品链接、脚本或简报制作发布宣传视频。 | 制作 | HyperFrames；仍需可访问的产品材料。 |
| 045 | [slideshow](https://open-design.ai/zh/skills/slideshow/) | 做带分支、片段和演讲者模式的交互式演示。 | 制作 | HyperFrames；HTML 演示。 |
| 046 | [slidev](https://open-design.ai/zh/skills/slidev/) | 用 Markdown、Vue、代码高亮和动画制作开发者演示。 | 制作 | Slidev；不是原生 PowerPoint 编辑流程。 |
| 047 | [break-ui](https://open-design.ai/zh/skills/break-ui/) | 用长文字等极端数据压测 UI，先报告损坏再修复。 | 检查 | 需组件源码、运行应用及浏览器；对比开关限开发环境。 |
| 048 | [animation-performance](https://open-design.ai/zh/skills/animation-performance/) | 定位动画掉帧、主线程竞争及逐帧更新问题。 | 检查 | 浏览器性能工具、可复现交互与真实目标设备。 |
| 049 | [adobe-illustrator-scripting](https://open-design.ai/zh/skills/adobe-illustrator-scripting/) | 用 ExtendScript 自动创建、编辑和导出 Illustrator 图稿。 | 自动化 | 需要 Adobe Illustrator CC 或更高版本。 |
| 050 | [anti-ui-slop](https://open-design.ai/zh/skills/anti-ui-slop/) | 从产品真实对象与约束出发设计界面，避免同质化。 | 规范 | 目录标注许可条款冲突；UIZZE MCP 为可选，不是必需。 |
| 051 | [freecad-scripts](https://open-design.ai/zh/skills/freecad-scripts/) | 把带尺寸的建模需求转成可检查的 FreeCAD 对象。 | 自动化 | FreeCAD 及其 Python；部分操作需 PySide/Pivy。 |
| 052 | [generate-image](https://open-design.ai/zh/skills/generate-image/) | 调用已配置提供商生成并保存图像素材。 | 制作 | 需要受支持服务的 API 凭据、网络及额度。 |
| 053 | [nano-banana-pro-openrouter](https://open-design.ai/zh/skills/nano-banana-pro-openrouter/) | 经 OpenRouter 用参考图生成或编辑图片。 | 制作 | uv、随附 Python 脚本及有额度的 OpenRouter 凭据。 |
| 054 | [premium-frontend-ui](https://open-design.ai/zh/skills/premium-frontend-ui/) | 为表现型落地页、作品集和演示提供前端视觉指南。 | 规范 | 不限定单一运行时；动画库按需选择。 |
| 055 | [rhino3d-scripts](https://open-design.ai/zh/skills/rhino3d-scripts/) | 用宏或脚本完成 Rhino 三维建模自动化。 | 自动化 | Rhino 7+；来源建议 Rhino 8 脚本编辑环境。 |
| 056 | [slang-shader-engineer](https://open-design.ai/zh/skills/slang-shader-engineer/) | 编写 Slang 着色器，核对渲染器的资源、输入和输出连接。 | 设计与实现 | 需要 Slang 编译器和目标渲染后端。 |
| 057 | [accessibility-compliance](https://open-design.ai/zh/skills/accessibility-compliance/) | 指导实现符合 WCAG 2.2 方向的可访问界面。 | 规范 | 规则指导不能替代实际无障碍测试。 |
| 058 | [brand-landingpage](https://open-design.ai/zh/skills/brand-landingpage/) | 先访谈品牌需求，再在 Stitch 生成并迭代落地页。 | 工作流 | Google Stitch。 |
| 059 | [design-system-patterns](https://open-design.ai/zh/skills/design-system-patterns/) | 规划设计令牌、主题基础设施和组件架构。 | 规范 | 面向可扩展设计系统。 |
| 060 | [interaction-design](https://open-design.ai/zh/skills/interaction-design/) | 设计交互反馈、过渡和微动效。 | 规范 | 实际交互需实现和测试。 |
| 061 | [kpi-dashboard-design](https://open-design.ai/zh/skills/kpi-dashboard-design/) | 为 KPI 仪表盘选择指标、图表、布局和实时表达方式。 | 规范 | 设计仪表盘不等于已接通实时数据。 |
| 062 | [mobile-android-design](https://open-design.ai/zh/skills/mobile-android-design/) | 按 Material Design 3 和 Jetpack Compose 设计 Android UI。 | 设计与实现 | 原生 Android/Compose 环境。 |
| 063 | [mobile-ios-design](https://open-design.ai/zh/skills/mobile-ios-design/) | 按 Apple HIG 和 SwiftUI 设计 iOS UI。 | 设计与实现 | 原生 iOS/SwiftUI 环境。 |
| 064 | [pptx-quality-gates](https://open-design.ai/zh/skills/pptx-quality-gates/) | 检查并修复可编辑 PPTX 的几何、可访问性及包完整性。 | 检查 | 需要可编辑 PPTX 及对应检查工具。 |
| 065 | [pptx-reference-deck-analysis](https://open-design.ai/zh/skills/pptx-reference-deck-analysis/) | 分析参考 PPTX 的主题、排版和版式节奏。 | 分析 | 需要真实参考文件；分析不等于已导入模板。 |
| 066 | [pptx-slide-specification](https://open-design.ai/zh/skills/pptx-slide-specification/) | 为 PPTX 页面编写带明确坐标的 JSON 对象规范。 | 规范 | 规范须交由生成器实现，不能直接视作成品。 |
| 067 | [pptx-visual-assets](https://open-design.ai/zh/skills/pptx-visual-assets/) | 挑选并放置已获批准的图标、图片和 SVG 等演示素材。 | 工作流 | 素材须有授权；与 PPTX 生成器配合。 |
| 068 | [react-native-design](https://open-design.ai/zh/skills/react-native-design/) | 制作 React Native 样式、导航与 Reanimated 动画。 | 设计与实现 | React Native。 |
| 069 | [responsive-design](https://open-design.ai/zh/skills/responsive-design/) | 用容器查询、流式排版、Grid 和移动优先断点适配界面。 | 设计与实现 | 需要在实际视口验证。 |
| 070 | [screen-reader-testing](https://open-design.ai/zh/skills/screen-reader-testing/) | 用 VoiceOver、NVDA、JAWS 测试网页读屏体验。 | 检查 | 需要相应辅助技术及可运行页面。 |
| 071 | [tailwind-design-system](https://open-design.ai/zh/skills/tailwind-design-system/) | 用 Tailwind CSS v4 建立令牌、组件和响应式规则。 | 设计与实现 | Tailwind CSS。 |
| 072 | [visual-design-foundations](https://open-design.ai/zh/skills/visual-design-foundations/) | 统一排版、色彩、间距与图标等视觉基础。 | 规范 | 设计基础指导。 |
| 073 | [wcag-audit-patterns](https://open-design.ai/zh/skills/wcag-audit-patterns/) | 结合自动和人工步骤审计 WCAG 2.2 问题并指导修复。 | 检查 | 自动扫描不能替代所有人工检查。 |
| 074 | [web-component-design](https://open-design.ai/zh/skills/web-component-design/) | 组织 React、Vue、Svelte 的可复用组件及组合模式。 | 规范 | 框架依项目选择。 |
| 075 | [draw-io-diagram-generator](https://open-design.ai/zh/skills/draw-io-diagram-generator/) | 创建和编辑 draw.io 流程图及相关文件。 | 制作 | draw.io；支持 .drawio 及 SVG/PNG 形式。 |
| 076 | [excalidraw-diagram-generator](https://open-design.ai/zh/skills/excalidraw-diagram-generator/) | 从文字生成 Excalidraw 图和思维导图。 | 制作 | Excalidraw。 |
| 077 | [gsap-framer-scroll-animation](https://open-design.ai/zh/skills/gsap-framer-scroll-animation/) | 制作视差、固定区块、横向滚动和滚动文字动画。 | 设计与实现 | GSAP。 |
| 078 | [penpot-uiux-design](https://open-design.ai/zh/skills/penpot-uiux-design/) | 通过 MCP 在 Penpot 中制作界面、组件和设计系统。 | 设计与实现 | Penpot MCP 及相应权限。 |
| 079 | [power-bi-report-design-consultation](https://open-design.ai/zh/skills/power-bi-report-design-consultation/) | 改善 Power BI 报表的选图、布局、可读性与无障碍。 | 规范 | Power BI；不是通用表格计算器。 |
| 080 | [web-design-reviewer](https://open-design.ai/zh/skills/web-design-reviewer/) | 检查运行中网站的视觉布局，并定位和修复问题。 | 检查与改进 | 需要浏览器与项目访问。 |

### 081—120

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 081 | [animate](https://open-design.ai/zh/skills/animate/) | 从目的出发，选择动画工具、属性、缓动和时长。 | 设计与实现 | 实际效果需预览。 |
| 082 | [animate-expo](https://open-design.ai/zh/skills/animate-expo/) | 在 React Native/Expo 中实现手势、弹簧和过渡。 | 设计与实现 | React Native、Expo。 |
| 083 | [animation-vocabulary](https://open-design.ai/zh/skills/animation-vocabulary/) | 把模糊的动画描述翻译成明确的动效术语。 | 规范 | 词汇与表达辅助，不直接输出完整视频。 |
| 084 | [apple-design](https://open-design.ai/zh/skills/apple-design/) | 将 Apple 风格的手势、物理感和空间层级用于网页。 | 规范 | 网页实现仍需实际测试。 |
| 085 | [emil-design-eng](https://open-design.ai/zh/skills/emil-design-eng/) | 指导 UI 组件、精细交互及动效的设计工程决策。 | 规范 | 设计理念与实现参考。 |
| 086 | [find-animation-opportunities](https://open-design.ai/zh/skills/find-animation-opportunities/) | 识别界面中值得增加动画的位置，并剔除不必要动效。 | 检查 | 给出位置和参数建议。 |
| 087 | [improve-animations](https://open-design.ai/zh/skills/improve-animations/) | 评估已有动效代码并给出有优先级的实现方案。 | 检查 | 需要动画源码。 |
| 088 | [prototype](https://open-design.ai/zh/skills/prototype/) | 实现同一组件的不同版本，并提供实时切换比较。 | 设计与实现 | 组件原型对比，不等于完整业务应用。 |
| 089 | [review-animations](https://open-design.ai/zh/skills/review-animations/) | 检查动画代码的时序、交互行为和完成度。 | 检查 | 需要代码及实际效果验证。 |
| 090 | [vercel-react-view-transitions](https://open-design.ai/zh/skills/vercel-react-view-transitions/) | 通过 React View Transition 实现页面过渡。 | 设计与实现 | React；目录许可为技能自声明，商用仍须核对。 |
| 091 | [frontend-slides](https://open-design.ai/zh/skills/frontend-slides/) | 新建动画 HTML 幻灯片，或从 PPT 转换。 | 制作与转换 | HTML 输出不承诺对象级 PPTX 可编辑。 |
| 092 | [figma-code-connect-components](https://open-design.ai/zh/skills/figma-code-connect-components/) | 把已发布的 Figma 组件映射到代码组件。 | 转换 | Figma MCP、Code Connect 资格和编辑权限；受 Figma 条款约束。 |
| 093 | [figma-create-design-system-rules](https://open-design.ai/zh/skills/figma-create-design-system-rules/) | 为实现 Figma 稿件记录仓库路径、组件和约定。 | 规范 | Figma MCP、代码库访问；受 Figma 条款约束。 |
| 094 | [figma-generate-design](https://open-design.ai/zh/skills/figma-generate-design/) | 在 Figma 中生成可编辑且关联设计系统的设计稿。 | 制作 | Figma MCP、文件访问、已发布系统及配套 figma-use；受 Figma 条款约束。 |
| 095 | [figma-generate-library](https://open-design.ai/zh/skills/figma-generate-library/) | 先定义令牌，再建立可复用的 Figma 组件库。 | 制作 | Figma MCP、可编辑文件、配套技能和参考资料；受 Figma 条款约束。 |
| 096 | [figma-implement-design](https://open-design.ai/zh/skills/figma-implement-design/) | 用项目组件还原 Figma 设计，并对照设计验证。 | 设计与实现 | Figma MCP、代码库和运行预览；受 Figma 条款约束。 |
| 097 | [ink](https://open-design.ai/zh/skills/ink/) | 把 JSON 规范渲染成交互式终端界面。 | 转换 | Ink；产出终端 UI，而不是浏览器网页。 |
| 098 | [a11y-audit](https://open-design.ai/zh/skills/a11y-audit/) | 将无障碍问题关联到具体元素、修法和验证证据。 | 检查 | Python、源码及浏览器或辅助技术环境。 |
| 099 | [apple-hig-expert](https://open-design.ai/zh/skills/apple-hig-expert/) | 按不同 Apple 平台的 HIG 和无障碍要求审查界面。 | 检查 | Python 3、最新 HIG、设备或模拟器。 |
| 100 | [landing-page-generator](https://open-design.ai/zh/skills/landing-page-generator/) | 将真实产品主张组织成落地页区块再生成组件。 | 设计与实现 | React/Next.js、Tailwind；部分组件和品牌工具另配。 |
| 101 | [imagegen](https://open-design.ai/zh/skills/imagegen/) | 生成或编辑照片、插画、纹理、精灵图及样机。 | 制作 | 需要图像生成服务。 |
| 102 | [baoyu-article-illustrator](https://open-design.ai/zh/skills/baoyu-article-illustrator/) | 为文章确定插图位置，并生成解释关键概念的图片。 | 制作 | 需图像后端及该技能参考/配置文件。 |
| 103 | [baoyu-comic](https://open-design.ai/zh/skills/baoyu-comic/) | 先安排教学叙事分镜，再生成漫画页面。 | 制作 | 图像后端；PDF 合并脚本需 Bun 或 npx Bun。 |
| 104 | [baoyu-cover-image](https://open-design.ai/zh/skills/baoyu-cover-image/) | 围绕一个中心创意制作文章封面。 | 制作 | 需图像后端和艺术指导参考。 |
| 105 | [baoyu-diagram](https://open-design.ai/zh/skills/baoyu-diagram/) | 用可检查的矢量文件表达关系、标签与连线。 | 制作 | SVG 代码环境；PNG 转换脚本需 Bun 或 npx Bun。 |
| 106 | [baoyu-image-gen](https://open-design.ai/zh/skills/baoyu-image-gen/) | 通过不同提供商运行单张或批量生图、编辑任务。 | 工作流 | Bun、提供商适配器及所选通道的凭据或登录。 |
| 107 | [baoyu-infographic](https://open-design.ai/zh/skills/baoyu-infographic/) | 按比较、层级、流程等目的选信息图版式并制作图片。 | 制作 | 需要图像后端及布局参考；不等于原生可编辑图表。 |
| 108 | [baoyu-slide-deck](https://open-design.ai/zh/skills/baoyu-slide-deck/) | 制作插画式幻灯片并组装成演示文件。 | 制作 | 图像后端、Bun；幻灯片对象不能逐项编辑。 |
| 109 | [baoyu-xhs-images](https://open-design.ai/zh/skills/baoyu-xhs-images/) | 制作每张聚焦一个观点、风格统一的小红书图卡。 | 制作 | 图像后端及卡片布局参考。 |
| 110 | [guizang-ppt-skill](https://open-design.ai/zh/skills/guizang-ppt-skill/) | 制作杂志/瑞士风格的单文件 HTML 演示。 | 制作 | 有演讲者和同步功能；目录标注 AGPL-3.0。 |
| 111 | [alirezarezvani-brand-guidelines](https://open-design.ai/zh/skills/alirezarezvani-brand-guidelines/) | 为任意产品定义或应用品牌颜色、字体、标志和语气。 | 规范 | 区别于只针对 Anthropic 的同名技能。 |
| 112 | [alirezarezvani-design-system](https://open-design.ai/zh/skills/alirezarezvani-design-system/) | 用十问向导收集品牌身份，供后续文档和演示复用。 | 规范 | 品牌采集流程，不自动验证品牌事实。 |
| 113 | [md-slides](https://open-design.ai/zh/skills/md-slides/) | 把 Markdown 转成带品牌风格的幻灯片。 | 转换 | HTML 幻灯片。 |
| 114 | [ui-design-system](https://open-design.ai/zh/skills/ui-design-system/) | 制定设计令牌、组件文档、响应式规则及交接资料。 | 规范 | 需对接项目实现与交付。 |
| 115 | [ux-researcher-designer](https://open-design.ai/zh/skills/ux-researcher-designer/) | 综合已有资料形成用户画像、旅程及可用性研究框架。 | 研究 | 不能凭空代替真实用户证据。 |
| 116 | [huashu-design](https://open-design.ai/zh/skills/huashu-design/) | 从三个草案起步，制作 HTML 原型、演示、动画或可视化。 | 工作流 | HTML 路线；最终范围依具体任务。 |
| 117 | [accessibility-review](https://open-design.ai/zh/skills/accessibility-review/) | 检查页面或设计的对比度、键盘和触摸目标等 AA 问题。 | 检查 | 目录指向 WCAG 2.1 AA；实际合规仍须实测。 |
| 118 | [design-critique](https://open-design.ai/zh/skills/design-critique/) | 围绕可用性、层级和一致性提供结构化设计反馈。 | 检查 | 设计评论不等于已应用修复。 |
| 119 | [design-handoff](https://open-design.ai/zh/skills/design-handoff/) | 将布局、令牌、组件状态和断点写成开发交接规范。 | 规范 | 交接文档不是已经实现的组件。 |
| 120 | [anthropics-design-system](https://open-design.ai/zh/skills/anthropics-design-system/) | 审计、记录或扩展已有设计系统。 | 规范 | 需要现有系统资料。 |

### 121—160

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 121 | [research-synthesis](https://open-design.ai/zh/skills/research-synthesis/) | 将访谈、问卷和测试笔记综合成主题与建议。 | 研究 | 需要真实输入材料，不负责自动收集证据。 |
| 122 | [user-research](https://open-design.ai/zh/skills/user-research/) | 规划并协助开展访谈、问卷及可用性研究。 | 研究 | 实际参与者、执行条件和材料仍需准备。 |
| 123 | [ux-copy](https://open-design.ai/zh/skills/ux-copy/) | 编写按钮、错误、空状态、CTA 等界面文案。 | 内容设计 | 不负责实现界面或验证业务权限。 |
| 124 | [gsap-core](https://open-design.ai/zh/skills/gsap-core/) | 使用 GSAP 的基础补间、缓动、交错和减少动态效果能力。 | 设计与实现 | GSAP。 |
| 125 | [gsap-frameworks](https://open-design.ai/zh/skills/gsap-frameworks/) | 在 Vue、Svelte 等框架正确管理 GSAP 的生命周期和清理。 | 设计与实现 | GSAP 及对应框架。 |
| 126 | [gsap-performance](https://open-design.ai/zh/skills/gsap-performance/) | 优化 GSAP 动画性能，避免布局抖动和昂贵更新。 | 检查与改进 | GSAP；性能须用实际环境验证。 |
| 127 | [gsap-plugins](https://open-design.ai/zh/skills/gsap-plugins/) | 使用滚动、拖拽、文字拆分、SVG 和物理等 GSAP 插件能力。 | 设计与实现 | GSAP 及所选插件。 |
| 128 | [gsap-react](https://open-design.ai/zh/skills/gsap-react/) | 在 React/Next.js 中通过 hook、ref 和 context 集成 GSAP。 | 设计与实现 | GSAP、React；需处理清理。 |
| 129 | [gsap-scrolltrigger](https://open-design.ai/zh/skills/gsap-scrolltrigger/) | 用 ScrollTrigger 做滚动联动、固定、视差和进度动画。 | 设计与实现 | GSAP、ScrollTrigger。 |
| 130 | [gsap-timeline](https://open-design.ai/zh/skills/gsap-timeline/) | 组织 GSAP 时间轴、嵌套时序和播放控制。 | 设计与实现 | GSAP。 |
| 131 | [gsap-utils](https://open-design.ai/zh/skills/gsap-utils/) | 用 GSAP 工具函数完成数值映射、吸附、插值和循环。 | 设计与实现 | GSAP；它是动画工序，不是独立视频产品。 |
| 132 | [color-font-skill](https://open-design.ai/zh/skills/color-font-skill/) | 为演示和视觉设计选择配色与字体搭配。 | 规范 | 不负责生成完整演示文稿。 |
| 133 | [design-style-skill](https://open-design.ai/zh/skills/design-style-skill/) | 用间距与圆角等规则统一幻灯片风格。 | 规范 | 风格规则应与实际内容配合。 |
| 134 | [gif-sticker-maker](https://open-design.ai/zh/skills/gif-sticker-maker/) | 把人物、宠物、物体或标志照片做成四张带说明的 GIF 贴纸。 | 制作 | 素材与具体生成/动画要求需查配套文档。 |
| 135 | [pptx-generator](https://open-design.ai/zh/skills/pptx-generator/) | 生成、编辑和读取可编辑 PowerPoint 文件。 | 制作与转换 | PPTX；实际对象和保真范围需任务验证。 |
| 136 | [shader-dev](https://open-design.ai/zh/skills/shader-dev/) | 编写 GLSL 程序视觉，如粒子、流体、SDF 和光线行进。 | 设计与实现 | GLSL、WebGL。 |
| 137 | [slide-making-skill](https://open-design.ai/zh/skills/slide-making-skill/) | 用 PptxGenJS 实现单页 PowerPoint。 | 制作 | PptxGenJS；一页实现工序，不是自动整套叙事。 |
| 138 | [beautiful-article](https://open-design.ai/zh/skills/beautiful-article/) | 把来源材料排成易读、含插图的 HTML 长文章。 | 制作 | Node/npm、Vite、React、TypeScript、Reacticle；生图和 PDF 另有条件。 |
| 139 | [gpt-image-2](https://open-design.ai/zh/skills/gpt-image-2/) | 组织图片提示词，并经宿主图像工具或本地 API 生成/编辑。 | 工作流 | 名称不证明模型权限；本地模式需启用、脚本和凭据，参数费用需核实。 |
| 140 | [web-design-engineer](https://open-design.ai/zh/skills/web-design-engineer/) | 先确定视觉方向，做代表性界面并在浏览器审阅后扩展。 | 工作流 | 编码 Agent、前端环境和浏览器。 |
| 141 | [web-video-presentation](https://open-design.ai/zh/skills/web-video-presentation/) | 制作按时间播放视觉场景、可附旁白的浏览器演示。 | 制作 | Vite/React/TypeScript；TTS 另配，最终录制是独立步骤。 |
| 142 | [video-shotcraft](https://open-design.ai/zh/skills/video-shotcraft/) | 根据界面截图、镜头指令和时间安排制作产品视频。 | 制作 | Remotion/Node、截图工具、FFmpeg；其他组件及 Remotion 许可需核对。 |
| 143 | [scroll-world](https://open-design.ai/zh/skills/scroll-world/) | 用滚动控制预渲染的视频镜头旅程。 | 制作 | 不是实时 3D；指定视频服务、FFmpeg/ffprobe、浏览器及账号额度。 |
| 144 | [dashi-ppt](https://open-design.ai/zh/skills/dashi-ppt/) | 从同一内容生成多个幻灯片版式，并在本地编辑器导出。 | 工作流 | Node.js 20+、npm、随附生成器和本地服务；目录标注 AGPL-3.0。 |
| 145 | [baseline-ui](https://open-design.ai/zh/skills/baseline-ui/) | 修整 UI 代码中的小型布局、间距、层级与排版问题。 | 检查与改进 | 需现有代码。 |
| 146 | [create-design-md](https://open-design.ai/zh/skills/create-design-md/) | 从产品仓库或公开网站整理 DESIGN.md。 | 规范 | 提取设计规则，不是自动完成重设计。 |
| 147 | [fixing-accessibility](https://open-design.ai/zh/skills/fixing-accessibility/) | 修复 ARIA、键盘、焦点、对比度和表单错误问题。 | 检查与改进 | 需要实际页面及验证。 |
| 148 | [fixing-motion-performance](https://open-design.ai/zh/skills/fixing-motion-performance/) | 定位并改善 CSS/JS 动画和滚动联动的卡顿。 | 检查与改进 | 需要可复现性能问题。 |
| 149 | [improve-ui](https://open-design.ai/zh/skills/improve-ui/) | 根据产品已有设计证据评审界面并形成实施计划。 | 检查 | 计划不等于已执行修复。 |
| 150 | [design-md](https://open-design.ai/zh/skills/design-md/) | 分析 Stitch 项目并编写语义化 DESIGN.md。 | 规范 | Google Stitch。 |
| 151 | [enhance-prompt](https://open-design.ai/zh/skills/enhance-prompt/) | 把模糊界面想法写成更适合 Stitch 的提示词。 | 内容设计 | Google Stitch；不是已生成的界面。 |
| 152 | [react-vite-dashboard](https://open-design.ai/zh/skills/react-vite-dashboard/) | 把 Stitch 设计实现为 React+Vite 数据面板。 | 转换 | Google Stitch、React/Vite、TanStack Query。 |
| 153 | [remotion](https://open-design.ai/zh/skills/remotion/) | 将 Stitch 项目做成带转场与缩放的演示视频。 | 转换 | Google Stitch、Remotion。 |
| 154 | [shadcn-ui](https://open-design.ai/zh/skills/shadcn-ui/) | 发现、集成并定制 shadcn/ui 组件。 | 设计与实现 | shadcn/ui。 |
| 155 | [google-labs-code-stitch-code-to-design](https://open-design.ai/zh/skills/google-labs-code-stitch-code-to-design/) | 从静态 HTML 和设计系统信息将代码转为 Stitch 设计。 | 转换 | Google Stitch。 |
| 156 | [google-labs-code-stitch-extract-design-md](https://open-design.ai/zh/skills/google-labs-code-stitch-extract-design-md/) | 从不同框架的前端代码提取完整 DESIGN.md。 | 规范 | 需要源码；不是实时同步保证。 |
| 157 | [google-labs-code-stitch-extract-static-html](https://open-design.ai/zh/skills/google-labs-code-stitch-extract-static-html/) | 提取内联 CSS、图像的独立静态 HTML 快照。 | 转换 | 快照不等于保留后端服务与全部动态行为。 |
| 158 | [google-labs-code-stitch-generate-design](https://open-design.ai/zh/skills/google-labs-code-stitch-generate-design/) | 通过文字或参考图在 Stitch 创建、编辑和变换界面。 | 制作 | Google Stitch。 |
| 159 | [google-labs-code-stitch-manage-design-system](https://open-design.ai/zh/skills/google-labs-code-stitch-manage-design-system/) | 经 MCP 在 Stitch 创建、更新并应用设计系统。 | 设计与实现 | Google Stitch MCP。 |
| 160 | [google-labs-code-stitch-react-components](https://open-design.ai/zh/skills/google-labs-code-stitch-react-components/) | 将 Stitch 设计转换或同步成模块化 React/Vite 组件。 | 转换 | Google Stitch、React/Vite。 |

### 161—200

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 161 | [google-labs-code-stitch-react-native](https://open-design.ai/zh/skills/google-labs-code-stitch-react-native/) | 将 Stitch HTML 设计转换或同步成 React Native 组件。 | 转换 | Google Stitch、React Native。 |
| 162 | [app-store-screenshots](https://open-design.ai/zh/skills/app-store-screenshots/) | 用截图、文案和视觉素材制作协调的应用商店展示图。 | 制作 | 随附 Next.js 编辑器、浏览器、html-to-image；素材需授权。 |
| 163 | [codex-ppt](https://open-design.ai/zh/skills/codex-ppt/) | 把材料生成插画式幻灯片，再装入 PPTX。 | 制作 | Python、图像后端及配套脚本；页面是图片，不是对象级可编辑。 |
| 164 | [interface-design](https://open-design.ai/zh/skills/interface-design/) | 为后台、仪表盘、SaaS 工具和设置页面设计界面。 | 设计与实现 | 偏工具类界面，不是所有营销页的通用风格。 |
| 165 | [remotion-captions](https://open-design.ai/zh/skills/remotion-captions/) | 先结构化字幕文字与时间，再安排视频字幕样式。 | 规范与实现 | Remotion、@remotion/captions；目录许可未确认。 |
| 166 | [remotion-create](https://open-design.ai/zh/skills/remotion-create/) | 搭建 Remotion 项目和合成，提供开发预览。 | 工作流 | Node、Git、包安装、Remotion Studio；目录许可未确认。 |
| 167 | [remotion-interactivity](https://open-design.ai/zh/skills/remotion-interactivity/) | 通过源码公开图层、时间和控件，让视频能在 Studio 编辑。 | 设计与实现 | 匹配版本的 Remotion Interactive API；目录许可未确认。 |
| 168 | [remotion-maps](https://open-design.ai/zh/skills/remotion-maps/) | 选择技术、服务和数据，在视频中制作动画地图。 | 制作 | Remotion；选 Mapbox 时需密钥；目录许可未确认。 |
| 169 | [remotion-markup](https://open-design.ai/zh/skills/remotion-markup/) | 写按视频时间线运行的 React 标记，而不是普通 CSS 动画页。 | 设计与实现 | Remotion 与对应功能包；目录许可未确认。 |
| 170 | [baoyu-design](https://open-design.ai/zh/skills/baoyu-design/) | 用基于文件的方法制作原型、演示概念和可复用视觉系统。 | 工作流 | 需要完整方法库、参考与脚本；导入/导出各有前置条件。 |
| 171 | [anatomy](https://open-design.ai/zh/skills/anatomy/) | 以等距 SVG 结构和可交互模型解释技术原理。 | 制作 | Node.js 20.10+、Chrome/Chromium；安装 CLI 的版本要求另查。 |
| 172 | [threejs-animation](https://open-design.ai/zh/skills/threejs-animation/) | 为三维模型确定动画播放及混合策略。 | 设计与实现 | Three.js 项目、渲染器与适配版本；目录许可未确认。 |
| 173 | [threejs-geometry](https://open-design.ai/zh/skills/threejs-geometry/) | 选择并构造三维几何表示方式。 | 设计与实现 | Three.js；目录许可未确认。 |
| 174 | [threejs-interaction](https://open-design.ai/zh/skills/threejs-interaction/) | 将鼠标或手势按相机与画布坐标映射到三维对象。 | 设计与实现 | Three.js；目录许可未确认。 |
| 175 | [threejs-lighting](https://open-design.ai/zh/skills/threejs-lighting/) | 布置有目的的光照，让模型结构清楚。 | 设计与实现 | Three.js；目录许可未确认。 |
| 176 | [threejs-materials](https://open-design.ai/zh/skills/threejs-materials/) | 选择与表面匹配的材质，并在目标光照中检查效果。 | 设计与实现 | Three.js；目录许可未确认。 |
| 177 | [threejs-postprocessing](https://open-design.ai/zh/skills/threejs-postprocessing/) | 按管线顺序组织三维画面的后期特效。 | 设计与实现 | Three.js 及所需后处理组件；目录许可未确认。 |
| 178 | [threejs-shaders](https://open-design.ai/zh/skills/threejs-shaders/) | 在预设材质不足时编写顶点或像素着色行为。 | 设计与实现 | Three.js 着色器环境；目录许可未确认。 |
| 179 | [threejs-textures](https://open-design.ai/zh/skills/threejs-textures/) | 正确分配纹理角色并排查拉伸、褪色等表面问题。 | 设计与实现 | Three.js、纹理资源；目录许可未确认。 |
| 180 | [make-interfaces-feel-better](https://open-design.ai/zh/skills/make-interfaces-feel-better/) | 优化悬停、阴影、边框、图标、排版和微交互细节。 | 规范 | 设计工程原则，需实际页面验证。 |
| 181 | [affinity-diagram](https://open-design.ai/zh/skills/affinity-diagram/) | 把研究观察聚类成主题，并保留原始证据关联。 | 研究 | 需要访谈/笔记；不负责招募或收集访谈。 |
| 182 | [animation-principles](https://open-design.ai/zh/skills/animation-principles/) | 根据界面状态变化确定动画目的、特征和时序。 | 规范 | 需前后状态、目标设备，并验证中断与减少动态效果。 |
| 183 | [card-sort-analysis](https://open-design.ai/zh/skills/card-sort-analysis/) | 分析参与者的卡片分类结果，辅助定义导航类别。 | 研究 | 需要真实分类结果和方法；不自动招募或采集。 |
| 184 | [click-test-plan](https://open-design.ai/zh/skills/click-test-plan/) | 制定首次点击测试计划，检查任务起点是否清楚。 | 研究计划 | 需要界面、目标、招募标准；实际测试和采集另做。 |
| 185 | [color-system](https://open-design.ai/zh/skills/color-system/) | 将品牌色整理成有前景/背景关系的界面色彩系统。 | 规范 | 需真实状态及对比度工具验证。 |
| 186 | [component-spec](https://open-design.ai/zh/skills/component-spec/) | 写明组件外观、变体和行为，供开发与测试使用。 | 规范 | 交付规范，不是已经实现的组件。 |
| 187 | [conversational-ux](https://open-design.ai/zh/skills/conversational-ux/) | 设计对话中的系统表达、预期回答及误解恢复。 | 规范 | 语音流程还需设备与识别测试。 |
| 188 | [dark-mode-design](https://open-design.ai/zh/skills/dark-mode-design/) | 把浅色界面的层级合理转成深色表面，而非颜色反转。 | 规范 | 需实际渲染检查主题、对比度和图像。 |
| 189 | [data-visualization](https://open-design.ai/zh/skills/data-visualization/) | 按读者问题和真实数据选择恰当图表表达。 | 规范 | 不代替数据校验或图表实现。 |
| 190 | [design-token](https://open-design.ai/zh/skills/design-token/) | 给视觉值建立可复用的令牌名称及关系。 | 规范 | 导出工具和框架接入另行实现。 |
| 191 | [diary-study-plan](https://open-design.ai/zh/skills/diary-study-plan/) | 规划跨时间记录用户体验的日记研究。 | 研究计划 | 需要研究目标和记录工具；招募与数据采集另做。 |
| 192 | [empathy-map](https://open-design.ai/zh/skills/empathy-map/) | 基于研究资料组织同理心地图，并区分观察和解释。 | 研究 | 需要已有笔记及明确用户群体。 |
| 193 | [error-handling-ux](https://open-design.ai/zh/skills/error-handling-ux/) | 设计清晰且不丢工作的错误说明和恢复路径。 | 规范 | 只能承诺产品实际支持的恢复操作。 |
| 194 | [form-design](https://open-design.ai/zh/skills/form-design/) | 安排表单填写、校验、更正、提交成功与再次访问流程。 | 规范 | 需要真实字段、规则和业务简报。 |
| 195 | [gesture-patterns](https://open-design.ai/zh/skills/gesture-patterns/) | 定义手势的起始、进行、结束及替代操作。 | 规范 | 需目标平台及可通过按钮/菜单执行的替代路径。 |
| 196 | [heuristic-evaluation](https://open-design.ai/zh/skills/heuristic-evaluation/) | 按明确任务做启发式可用性评估，并给出问题证据。 | 检查 | 专家评审不能冒充真实参与者研究。 |
| 197 | [icon-system](https://open-design.ai/zh/skills/icon-system/) | 建立统一图标构造、命名和尺寸体系。 | 规范 | 需要图标样本及目标设计/代码格式。 |
| 198 | [illustration-style](https://open-design.ai/zh/skills/illustration-style/) | 为插画确定统一视觉语言和界面用途。 | 规范 | 需要参考、产品配色、位置与尺寸；不是自动生图服务。 |
| 199 | [information-architecture](https://open-design.ai/zh/skills/information-architecture/) | 先组织内容归属和信息层级，再确定导航呈现。 | 研究与规范 | 需要内容及用户任务证据。 |
| 200 | [interview-script](https://open-design.ai/zh/skills/interview-script/) | 将研究目标写成不诱导答案、鼓励举例的访谈问题。 | 研究计划 | 需要目标、对象和限制；不提供招募或录音。 |

### 201—240

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 201 | [jobs-to-be-done](https://open-design.ai/zh/skills/jobs-to-be-done/) | 围绕用户想完成的工作重新审视产品决策。 | 研究与规范 | 需要研究证据或明确标注的假设。 |
| 202 | [journey-map](https://open-design.ai/zh/skills/journey-map/) | 把触点、用户画像和分析资料组织成完整旅程。 | 研究 | 需要已有资料；不含自动情绪测量。 |
| 203 | [layout-grid](https://open-design.ai/zh/skills/layout-grid/) | 规定页面共同使用的列、边距和响应式网格。 | 规范 | 需真实内容约束，不限定具体运行时。 |
| 204 | [loading-states](https://open-design.ai/zh/skills/loading-states/) | 设计诚实的等待与进度反馈。 | 规范 | 耗时及可取得的真实进度必须由产品/实现提供。 |
| 205 | [localization-design](https://open-design.ai/zh/skills/localization-design/) | 处理语言、字体和文化差异下的界面适配。 | 规范 | 需目标区域内容与审校；不附带本地化平台。 |
| 206 | [micro-interaction-spec](https://open-design.ai/zh/skills/micro-interaction-spec/) | 为小型交互写出行为、反馈和交付规则。 | 规范 | 不限定动效库；需目标设备测试。 |
| 207 | [motion-system](https://open-design.ai/zh/skills/motion-system/) | 让组件和团队共享动画决策与令牌。 | 规范 | 需项目令牌或等效实现，不强制某框架。 |
| 208 | [navigation-patterns](https://open-design.ai/zh/skills/navigation-patterns/) | 将信息层级转成清楚的导航与到达路径。 | 规范 | 不附带现成导航组件包。 |
| 209 | [onboarding-design](https://open-design.ai/zh/skills/onboarding-design/) | 围绕新用户首次获得价值来设计引导。 | 规范 | 激活指标和监测需要项目另行实现。 |
| 210 | [search-ux](https://open-design.ai/zh/skills/search-ux/) | 设计含无结果和失败恢复的搜索体验。 | 规范 | 不附带搜索引擎或埋点服务。 |
| 211 | [service-blueprint](https://open-design.ai/zh/skills/service-blueprint/) | 梳理用户可见服务背后的运营流程与角色。 | 研究与规范 | 需要流程和相关方证据，不自动访问运营系统。 |
| 212 | [spacing-system](https://open-design.ai/zh/skills/spacing-system/) | 按信息关系和用途组织间距规则。 | 规范 | 在已有组件系统中应用。 |
| 213 | [state-machine](https://open-design.ai/zh/skills/state-machine/) | 明确组件状态与可发生的转换。 | 规范 | 不附带状态机库，实际实现与测试另做。 |
| 214 | [theming-system](https://open-design.ai/zh/skills/theming-system/) | 通过共享令牌改变组件外观而不复制结构。 | 规范 | 主题切换功能仍需实现和测试。 |
| 215 | [typography-scale](https://open-design.ai/zh/skills/typography-scale/) | 制定少量清晰、可记录的文本样式与字号层级。 | 规范 | 需要实际可用字体才能视觉验证。 |
| 216 | [usability-test-plan](https://open-design.ai/zh/skills/usability-test-plan/) | 明确可用性研究的问题、任务和执行计划。 | 研究计划 | 需要材料与参与者，不提供招募平台。 |
| 217 | [user-flow-diagram](https://open-design.ai/zh/skills/user-flow-diagram/) | 画出用户完成目标的可能路径。 | 规范 | 不限定绘图应用，需清楚保留流程符号。 |
| 218 | [user-persona](https://open-design.ai/zh/skills/user-persona/) | 从真实研究形成一致的用户画像，避免编造客户故事。 | 研究 | 没有研究时只能标记假设；给网址不等于已调查。 |
| 219 | [visual-hierarchy](https://open-design.ai/zh/skills/visual-hierarchy/) | 让构图、大小和对比突出真正重要的信息。 | 规范 | 需真实内容与渲染复查，不附带视觉评分器。 |
| 220 | [wireframe-spec](https://open-design.ai/zh/skills/wireframe-spec/) | 描述低保真界面的内容、状态和行为。 | 规范 | 不限定线框工具；需要足够的需求材料。 |
| 221 | [thesvg](https://open-design.ai/zh/skills/thesvg/) | 检索并取得品牌标志或服务图标的合适资源形式。 | 资源获取 | 需要网络；SVG 资源的商标和使用权仍应核对。 |
| 222 | [image-to-editable-ppt](https://open-design.ai/zh/skills/image-to-editable-ppt/) | 把图片形式的幻灯片重建为结构化可编辑演示。 | 转换 | editppt CLI、图像生成；多页需多 Agent，PaddleOCR 可选；须检查重建保真。 |
| 223 | [accessibility](https://open-design.ai/zh/skills/accessibility/) | 依据 WCAG 2.2 审查并改善 Web 无障碍。 | 检查与改进 | 需实际测试；不等于自动获得合规认证。 |
| 224 | [landing-page-design](https://open-design.ai/zh/skills/landing-page-design/) | 围绕一个转化目标安排落地页的内容论证及视觉规则。 | 规范 | 不强制特定框架；转化提升需实际测量。 |
| 225 | [anything2explainer](https://open-design.ai/zh/skills/anything2explainer/) | 用有来源的内容、旁白及统一视觉制作讲解视频。 | 制作 | Remotion/Node、Python、TTS、渲染；目录明确非商业用途。 |
| 226 | [logo-design](https://open-design.ai/zh/skills/logo-design/) | 先构建并测试标志，再扩展为品牌套件。 | 制作 | Python 辅助脚本及可用 SVG 渲染器；商标状态另查。 |
| 227 | [holo-card-studio](https://open-design.ai/zh/skills/holo-card-studio/) | 制作烫箔或随视角转换的全息卡片效果。 | 制作 | 图像生成、Python、Blender、网页查看器。 |
| 228 | [dream-loop](https://open-design.ai/zh/skills/dream-loop/) | 先确定目标截图，再把它用作实现与迭代目标。 | 工作流 | 需目标图；未提供时需生图权限，具体工具依所用子流程。 |
| 229 | [motion-design](https://open-design.ai/zh/skills/motion-design/) | 应用时序、缓动、编排等动效设计原则。 | 规范 | 原则指南，不等于已导出动画文件。 |
| 230 | [user-research-cookiy](https://open-design.ai/zh/skills/user-research-cookiy/) | 协助规划定性、定量用户研究及相关指南。 | 研究 | 实际数据与研究执行条件需另准备。 |
| 231 | [material-3](https://open-design.ai/zh/skills/material-3/) | 实现 Material Design 3 的令牌、组件和自适应布局。 | 设计与实现 | 目标平台与工程要求以完整上游为准。 |
| 232 | [huashu-art-motion](https://open-design.ai/zh/skills/huashu-art-motion/) | 按艺术方向制作代码场景、角色精灵与短片动效。 | 制作 | uv、FFmpeg、Playwright Chromium；角色、音频、字体需自备或另行制作授权。 |
| 233 | [academic-pptx](https://open-design.ai/zh/skills/academic-pptx/) | 围绕论证、证据和结论标题规划学术演示。 | 规范 | 需要另外的 PPTX 制作工具；目录标注许可条款冲突。 |
| 234 | [design-motion-principles](https://open-design.ai/zh/skills/design-motion-principles/) | 依据明确原则设计或评审有目的的交互动效。 | 规范与检查 | 实际动画需实现并验证。 |
| 235 | [hue](https://open-design.ai/zh/skills/hue/) | 从参考资料、设计规则和令牌创建可复用的设计技能。 | 元工具 | 文件工具、Node 验证脚本及浏览器；不是普通设计成品。 |
| 236 | [power-design](https://open-design.ai/zh/skills/power-design/) | 把品牌系统应用到 HTML 网页或演示，并采用对应布局。 | 制作 | URL 品牌提取用 Firecrawl；字体和图片另核可用性与权利。 |
| 237 | [color-expert](https://open-design.ai/zh/skills/color-expert/) | 提供色彩命名、空间、调色板、渐变和对比度方法。 | 规范 | 目录标注 CC-BY-4.0，使用需注意署名义务。 |
| 238 | [antv-g2-chart](https://open-design.ai/zh/skills/antv-g2-chart/) | 用 AntV G2 v5 创建带编码、比例尺和交互的统计图表。 | 设计与实现 | @antv/g2 v5 或对应浏览器包；数据口径另核。 |
| 239 | [antv-g6-graph](https://open-design.ai/zh/skills/antv-g6-graph/) | 用 AntV G6 v5 展示关系网络并支持交互探索。 | 设计与实现 | @antv/g6 v5、浏览器容器及真实网络数据。 |
| 240 | [antv-x6-editor](https://open-design.ai/zh/skills/antv-x6-editor/) | 用 AntV X6 构建可连线、编辑的节点图编辑器。 | 设计与实现 | 目录引用 @antv/x6 v3 API 及相关插件，需核对安装版本。 |

### 241—244

| 序号 | 技能标识 / 详情 | 中文用途 | 工作性质 | 工具或边界摘要 |
| ---: | --- | --- | --- | --- |
| 241 | [chart-visualization](https://open-design.ai/zh/skills/chart-visualization/) | 通过 AntV API 将数据渲染成常见图表与关系图图像。 | 制作 | AntV API；不是任意工作簿分析或公式计算。 |
| 242 | [infographic-creator](https://open-design.ai/zh/skills/infographic-creator/) | 依据给定文字生成信息图。 | 制作 | AntV API；需核对内容、结构与输出格式。 |
| 243 | [ux-writing](https://open-design.ai/zh/skills/ux-writing/) | 撰写易懂、可访问的按钮、标签、提示和引导文案。 | 内容设计 | 需要产品语境；不代替业务实现。 |
| 244 | [image-to-ui](https://open-design.ai/zh/skills/image-to-ui/) | 在已有应用中按截图还原界面，并渲染对比修正差异。 | 转换 | 需清楚参考图、目标视口、项目与素材；无需 UIZZE 账号或 MCP。 |

## 五、配套文件与自检

- [CSV 完整清单](catalog-purpose.csv)：UTF-8 BOM，可供表格软件读取。
- [JSON 完整清单](catalog-purpose.json)：供后续逐项选型或维护映射，不是可执行技能注册表。
- 本次整理自检：244 条、编号 1—244 连续、244 个唯一标识、每条用途/工作性质/工具边界非空；属于资料完整性检查，不是 244 项运行或商业验收。
