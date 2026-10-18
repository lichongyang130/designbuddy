# PPTX 技能增强：结构化可编辑生成与本地渲染检查

更新：2026-10-18。此文记录对外部 PPT 技能项目的只读调研，以及将受用能力收敛到 DesignBuddy 现有技能运行时的实现边界。不是全量安装或移植 12 个仓库。

## 外部项目审阅与复用决策

调研只检查公开 README、LICENSE、部分源码和依赖元数据；除本仓库的 LibreOffice Kit 验证外，不代表对上游完整源码做过安全审计或运行测试。所有实现均在本仓库原创；下列项目仅作工作流/格式设计参考，不复制脚本、提示词或图形资产。

|项目|公开许可核对|对本实现的参考价值|处理决定|
|---|---|---|---|
|[Liuguanyi2125/editable-pptx-skill](https://github.com/Liuguanyi2125/editable-pptx-skill)|仓库 LICENSE 为 MIT|结构化输入到原生对象的路线|只参考方向；本仓库使用自己的 JSON schema 和 PptxGenJS 实现|
|[MiniMax-AI/skills](https://github.com/MiniMax-AI/skills)|仓库根许可证为 MIT|以 PptxGenJS 组织工作流/模板|只参考流程，不引入完整技能|
|[siril9/presentation-skill](https://github.com/siril9/presentation-skill)|仓库 LICENSE 为 MIT|JSON 源、原生图表和渲染检查的组合|仅参考能力分层，不复制实现|
|[PeterKalmstrom/claude-powerpoint-skill](https://github.com/PeterKalmstrom/claude-powerpoint-skill)|仓库 LICENSE 为 MIT|逐页渲染、检查、修正的 QA 思路|只借鉴“渲染证据不等于通过”的流程；不接入 PowerPoint MCP/COM|
|[xxcxy-max/ppt-skill](https://github.com/xxcxy-max/ppt-skill)|package.json 标注 MIT|可编辑生成/导出流程|自述含非官方逆向；未做安全审计，不作为依赖|
|[AIPMAndy/PPTskill](https://github.com/AIPMAndy/PPTskill)|本仓库 LICENSE 为 MIT；其上游 `ppt-master` 许可未核清|可编辑输出的宣称与依赖类型|不上游源码，也不引入其依赖链|
|[bytedance/deer-flow PPT 技能](https://github.com/bytedance/deer-flow)|上游仓库为 MIT|逐页内容组织|以逐页 AI 图像为主，不符合原生可编辑对象优先目标，不移植|
|[npogeant/claude-pptx-skills](https://github.com/npogeant/claude-pptx-skills)|调研时 LICENSE 路径未找到|token/原生对象辅助函数方向|未确认许可，不复制源码|
|[XiNian-dada/PPTskills](https://github.com/XiNian-dada/PPTskills)|调研时未确认仓库根 LICENSE|Schema JSON 与图片化路线的差别|未确认许可，不复制源码|
|[lgwanai/ppt-skill](https://github.com/lgwanai/ppt-skill)|README 声称 MIT，但根 LICENSE 页面未找到|规范提取、布局评估的目标方向|许可未确认，不复制源码|
|[zhuyansen/awesome-codex-ppt-skills](https://github.com/zhuyansen/awesome-codex-ppt-skills)|索引清单标注 CC0；被索引项目各有独立许可|项目发现/比较|不是引擎，不把清单许可扩展到其中仓库|
|[anthropics/skills](https://github.com/anthropics/skills)|PPT 技能许可为专有条款|无可复用实现|不复制代码、提示词、文档或衍生材料|

## 已接入的运行时能力

### `slides.compose` v1.1.0

- 保留既有 `.txt`、`.md`、`.docx` 确定性分页功能，输入/来源段落行为不改为 AI 写作。
- 新增严格 `.json` 结构化输入：1–50 页、规范化文字最多 60,000 字；支持 `cover`、`bullets`、`metrics`、`timeline`、`chart`、`quote` 六种页面结构。
- 以 PptxGenJS 生成原生 PowerPoint 文本框、形状/卡片与 bar/line 原生图表（含本地工作簿数据）；自定义主题色和字体写回 OOXML 主题槽。不是整页截图，也不是模板/母版导入。
- 若本机 LibreOffice Kit 可用，用本机引擎渲染每一页，交付 `slide-contact-sheet.jpg`、`slide-01-preview.jpg`、`rendered-slides.zip`、`render-report.json`。渲染失败时 PPTX 仍可交付，但报告会写明不可用/失败，不会把 HTML 内容预览冒充渲染截图。

### `slides.inspect` v1.0.0

- 输入仅接受 `.pptx`；按 OOXML 关系顺序解析 1–50 页，统计文本对象、形状、图片、原生图表/表格，提取直接对象边界和文字。
- 提取主题配色/字体、观察到的字体/字号/颜色，并输出可复制到结构化输入的 `suggestedThemeForSlidesCompose`；主题与直接样式并不总能揭示设计角色，仍须人工判断。
- 生成 `pptx-analysis.json`、`pptx-design-tokens.json`、`pptx-text.md` 和逐页本地渲染预览。
- 安全限制：输入≤2 MB、OOXML 解压≤12 MB、最多 10,000 个对象、提取文字≤150,000 字；拒绝宏、外部关系、活动内容、未知嵌入对象和损坏包。只放行并再验证图表使用的受限嵌入 XLSX。
- `imageDominatedLikely` 是对象面积/文本形状启发式，不能认证编辑意图。对象框在画布内不等于文本没有溢出；不自动判断重叠、可读性、事实、对比度或设计质量。

### 权限、依赖与实际验收

- 两项技能均申请 `local.read`、`local.write`、`subprocess`：渲染器可能使用本地 WASM worker 或平台原生 LibreOffice 进程；无网络、无外部模型调用。
- 依赖 `@deepseek-ai/libreoffice-kit@0.2.0`（MPL-2.0）。当前包位于仓库根 `devDependencies`，其 WASM 引擎较大（约 146 MB）；运行时会检测是否实际可解析。`slides.inspect` 在缺引擎时显示 unavailable，不能假设精简生产包已包含渲染器。发布桌面安装包前需单独验证依赖打包/体积策略。
- 所有渲染输出都会明确标记 `visualReviewRequired: true`、`automaticVisualPass: false`、`textOverflowChecked: false`。LibreOffice 不是 Microsoft PowerPoint 像素级对照；字体替代也可能改变布局。
- 当前 Linux 测试环境没有可供 LibreOffice Kit 使用的 CJK TTF/OTF：仓库仅有 Noto Sans SC WOFF2 分片，渲染器的字体扫描不识别它们。六页中文冒烟稿虽真实完成 LibreOffice 渲染，但缺失字形显示为方框；渲染报告/执行摘要会列出 `missingFonts` 并警告。故当前环境只验证了渲染链路，不代表中文字体外观已验收；需在装有目标字体的环境逐页复核。
- `pnpm test:skills` 包含结构化生成、原生 chart/workbook 验证、实际本地 LibreOffice 逐页渲染、设计令牌提取、外部关系拒绝及错误输入测试；运行结果以最新命令输出为准。

## 仍未实现/不可声称的能力

- 不把任意 `.pptx` 导入编辑后自动美化；不导入 PowerPoint 母版/占位符模板，不做像素级模板拟合。
- 不做 AI 论证、事实核查、外部研究、自动配图、任意 SVG/DrawingML 生成、动画/转场或完整商业提案。
- 不自动检测文字溢出、对象遮挡、视觉层级或语义可编辑性；渲染与结构报告只是人工复核证据。
- 不声称通过 Microsoft PowerPoint 原生环境验收；仍需使用目标 PowerPoint 版本/字体逐页核对关键交付，并由人确认最终视觉质量。
