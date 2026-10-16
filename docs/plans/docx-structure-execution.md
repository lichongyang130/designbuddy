# 高级能力第三批：DOCX正文表格与图片结构提取

日期：2026-10-16。对应[高级能力总台账](advanced-experts-execution.md)的D2复杂表格与版式任务中的**受限结构提取子集**。当前17项可执行技能、12位专家；未把复杂版式完整还原或任何专家整体标为完成。

## 实际入口与产物

文档整理专家 → 执行技能 → **DOCX正文表格与图片结构提取**（`document.structure@1.0.0`）。可下载真实DOCX示例，上传并单独确认后才运行，不自动调用模型。

- `document-structure.json`：按正文顺序保留标题、段落、直接粗体/斜体/下划线、表格与合并跨度、图片位置、来源定位、原始图片及预览哈希、警告和字体信息。
- `document-content.txt`：实际文字及带网格坐标/跨度标记的表格文本，不推断金额、业务口径或待办。
- `document-preview.html`：有中文内嵌字体和实际位图的结构预览，保留可支持的纵横合并；不把HTML称作Word渲染截图。
- 有表格才输出`document-tables.xlsx`：一表一工作表，保留合并网格，所有内容保持字符串，不把`12.50`擅自转数值，也不把以等号开头的原文变成Excel公式。
- 有内嵌图片才输出`document-images.zip`：固定编号文件名的**原始位图字节**及映射/哈希清单。图片预览另行校正方向、缩小并转为PNG，不冒充原始字节。
- `font-license.txt`与通用执行凭据。字体许可同时放入HTML本身，单独下载HTML也能查看。

来源定位是正文元素顺序与表格逻辑行列，不是Word页码或通用XPath。段落计数包含空段落与合并续格的段落；续格来源和段落属性另存于`continuations`，不是新增可见内容。

## 真实解析与明确边界

- 校验Office压缩包、主文档关系、内容类型、XML/实体和标准命名空间；拒绝外部关系、危险路径、宏及嵌入对象。不落盘解压上传路径、不执行Word域/宏、不获取外部资源。
- 按声明的表格网格处理`gridSpan`与连续`vMerge`；缺起点、跨列越界、跨度不一致、未覆盖网格、续格含非空内容等均失败，不猜测或静默丢弃。
- 标题优先使用显式`outlineLvl`及其样式继承；无显式层级时仅识别内置`Heading1–9`标识，并在报告中提示核对。不是AI语义识别标题。
- 基本正文内容控件可展开；保留列表编号ID/层级与显式分页标记，但不计算自动编号、不模拟Word页数。
- 拒绝修订、域、脚注/尾注引用、文本框、公式、非图片绘图、嵌套表格、旧式歧义横向合并等。发现不支持的正文块/行内元素时失败，不把少取的正文当完整结果。
- 仅提取正文。页眉页脚、批注等附属部件不读取，存在时明确警告。**隐藏正文仍会提取并显示**，不保留隐藏状态；不要把结果当作只包含原件当前可见内容的副本。
- HTML预览按分节显示纸张尺寸/方向和页边距；等宽栏会通过CSS多栏显示。只读取通过关系明确引用的静态页眉/页脚文字/图像。并非Word布局引擎：分节内实际分页、不同栏宽、栏/页分隔和原生分页均不保证。
- 浮动图片只对受限的左/右对齐和square/through类型保留基础CSS浮动及距离；unsupported wrap/锚定坐标不会被伪装成精确定位。图片裁剪、变换、精确坐标和分页碰撞仍不还原。原图可能包含裁剪范围外内容，分享前须核对。
- 直接格式保留段落缩进、段前/段后距、行距、keep-with-next；表格保留已声明网格列宽、单元格RGB底纹和垂直对齐。常见段落样式`basedOn`链与`docDefaults`段落/文字属性会按默认→继承样式→当前样式→直接段落/文字属性的常见优先顺序合并；文字格式也读取字符样式`rStyle`的`basedOn`链。当前仅覆盖对齐/缩进/间距/keepNext与粗体/斜体/下划线/RGB颜色/字号。主题颜色映射、`w:rFonts`/字体映射和嵌入字体、多级列表/表格样式及完整OOXML级联仍未实现；不能据此宣称完整样式继承或分页保真。
- 预览使用仓库已有授权字体，无外网字体请求。未覆盖字符记录在`unsupportedGlyphs`，需要系统字体回退和人工检查。

支持上限：DOCX≤2MB、正文≤60000字/2000段落、≤30表，每表≤500行/30列，总物理单元格≤10000；唯一图片≤12张、位置≤30处，单张≤2MB/1200万像素、图片原始字节累计≤3MB，PNG预览字节按出现次数累计≤2MB。仅接受PNG/JPEG/WebP。预览≤4000不同字符、内嵌字体≤3MB。XML≤30000标签/64层，沿用45秒worker期限、通用10MB交付总上限和所有者存储配额。

上述多个上限不是“所有边界组合必然能在45秒内成功”的保证；任一资源限制触发即整次失败，无部分下载成果。`worker_threads`仍不是操作系统级隔离沙箱。

## 预览与安全

文字逐项HTML转义，不嵌入原DOCX的HTML。预览使用`iframe sandbox=""`和内嵌CSP，只允许内联样式、data图片/字体，不允许脚本、表单或外部资源。不会把源材料里的`<script>`等字样执行。

表格在窄屏内部可横向滚动，不撑开整个页面。原PPT预览标题保持不变，DOCX预览使用独立标题“DOCX正文结构预览（非Word渲染）”。没有修改首页、共享侧栏或头像。

## 已执行验证

DOCX专项现有**15项服务端测试**覆盖：正文顺序/标题/格式、真实合并网格及Excel字符串安全、原图和预览哈希、列表/分页/内容控件、坏合并拒绝、修订/域/命名空间、缺图/伪图/编码外部关系、XML/实体/资源边界、无表无图、不可信输入不产生部分成果、实际worker/所有者隔离、规划候选和无参数约束、直接版式、样式继承、分节和图片环绕。

DOCX专项现有**8项浏览器测试**覆盖：真实示例下载→上传→结果下载→刷新；合并表格、图片像素和内嵌中文字体的实际预览；脚本样式文字保持惰性、sandbox阻止访问父页面；错误状态无虚构结果；无表无图不编造导出；直接版式、分节页面/边距/栏/页眉/环绕CSS及320/390px移动执行台。

- 合并回归通过：**101/101服务端、155/155浏览器、9/9目录/任务库，无跳过**（此前90/149，加本批11/6）。
- 最后补充HTML内字体许可、调整移动截图取景后，本批**11/11服务端、6/6浏览器再次通过**；没有把这次复测再加进101/155统计。
- 前后端TypeScript、前端生产构建、`git diff --check`通过。既有大主包/fflate混合导入告警仍存在。
- 已查看实际中文合并表格、内嵌图和390px预览截图。截图为含脚本样式原文的安全测试样本，该文字显示为普通文字；公开DOCX示例使用普通演示正文，不含这段测试字符串。
- [验证目录](../verification/docx-structure-2026-10-16/)保留截图、**公开示例实际执行**的结构JSON/表格XLSX/原图ZIP及源码哈希。较大的内嵌字体HTML仅在`.cache/docx-structure-artifacts/`和运行下载中生成，不重复提交到源码。
- 完整回归日志：`.cache/docx-structure-final-{server,browser}.log`、`docx-structure-build.log`、`docx-structure-catalog.log`；最后复测日志为`docx-structure-new-{server,browser}.log`。缓存不保证跨会话保留。

```sh
npx --yes pnpm@9.0.0 exec tsc -p server/tsconfig.local.json
node --test server/skills/*.test.cjs server/api/*.test.cjs
node --test scripts/expert-catalog.test.mjs scripts/prompt-library.test.mjs
npx --yes pnpm@9.0.0 --filter designbuddy-web build
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test docx-structure.spec.ts formula-batch.spec.ts advanced-office.spec.ts task-skills.spec.ts skill-planning.spec.ts skill-phase-two.spec.ts skill-runtime.spec.ts expert-avatars.spec.ts experts.spec.ts skills.spec.ts expert-match.spec.ts conversation.spec.ts clarification.spec.ts attach-menu.spec.ts home-reference.spec.ts
```

## 后续增量（2026-10-16）

- 直接格式属性、分节页面/页边距/等宽栏、显式引用的静态页眉页脚、受限CSS浮图、段落样式`basedOn`继承、`docDefaults`及字符样式`basedOn`链、主题RGB颜色与安全应用的显式字体名已加入；浮图锚点关系、EMU偏移和层级也写入报告。主题字体映射/嵌入、多级列表、表格样式和精确浮图布局仍未完成。
- 增加`@deepseek-ai/libreoffice-kit@0.2.0`开发依赖及[`LibreOffice页面参考生成脚本`](../../scripts/render-docx-libreoffice-reference.mjs)。Linux当前采用其真实LibreOffice WebAssembly渲染后端（不是桌面原生二进制，也不是Microsoft Word）；服务端集成测试用实际DOCX fixture生成PNG页面和哈希清单，最新DOCX专项**19/19通过**。已能对用户提供的DOCX生成页图参考，但尚无真实业务DOCX和Word桌面对照。
- 最新DOCX专项浏览器回归**8/8通过**：包括全流程页面格式、Style节点CSS内容（通过DOM `textContent`核验）及320/390px。此次范围性回归不替代完整项目浏览器套件；没有运行原生Word/LibreOffice对照。
- 扩展`pdf.ocr-batch`：2–4份PDF、最多8页、120秒Worker期限。**真实服务Worker**处理四份两页合成PDF共8页，逐页识别成功、下载真实ZIP/报告/回执、所有者隔离404；持久化哈希与产物见[批量OCR增量证据](../verification/pdf-batch-expansion-2026-10-16/)。PDF批量专项5/5通过。但此证据仅为合成PDF，不代表业务文档准确率；续传和可恢复长时任务未实现。
- 前后端TypeScript本轮检查和差分空白检查通过；此次没有重跑生产构建或全量测试。无真实Word渲染器/原始分页截图验收；复杂版式仍未完成。新摘要功能的真实模型提供商验收另见[文档摘要记录](document-semantic-summary.md)。

没有把开发用浏览器测试当作已上线通用测试专家。未进行真实模型选型、Word原始渲染、AI摘要真实云端验收、音频转写或36个真实业务案例验收。其他高级任务全部保留。修改仅在固定分支本地工作区；无推送/PR/部署，也未自动更新旧云盘备份。
