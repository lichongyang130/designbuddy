# 高级能力第二批：公式实际计算与多文件PDF批量OCR

日期：2026-10-16。承接[完整高级能力台账](advanced-experts-execution.md)，对应A3公式处理、D3扫描PDF批量OCR的受限子集。**两项已实际运行，不代表这些专家或所有高级功能完整实现。** 当前后台共16项可执行技能，仍是12位核心专家。

## 公式重算 `table.calculate@1.0.0`

入口：数据分析专家 → 执行技能 → 工作簿公式重算与依赖核对。可下载实际双表公式示例，不会自动上传/执行。

真实实现：

- 自建封闭算术语法解析器，不使用`eval`、`Function`、任意脚本或外部数据请求。
- 从XLSX实际读取公式、共享公式的展开内容和单元格，检查原XML公式数量与解析数量一致；不读取任何公式缓存当答案。
- 支持`+ - * /`、一元正负、百分号、括号、A1/绝对引用、跨表引用、同表矩形区域、`SUM / AVERAGE / MIN / MAX / COUNT / ROUND / ABS`。
- 依赖递归计算并缓存本次已算结果；检测循环依赖、错误引用、除零、深度和运算量。**任一公式不支持或失败，整次失败，不交付部分成功。**
- 百分号在乘除前结合，例如`2/5% = 40`；ROUND中点远离零，支持负小数位。
- 输出`calculated-values.xlsx`为纯值工作簿；`formula-report.json`记录原公式、单元格、直接依赖、十进制计算结果、双精度近似值、输入哈希和`cachedValueUsed:false`。沿用所有者隔离与通用执行凭据。

边界：

- XLSX≤2MB、1–10个表、各≤2000行/50列，合计≤10000非空/100000网格单元格，≤1000公式；公式≤512字/256节点，表达式与依赖链≤64层，总计算≤200000步，沿用45秒worker期限。
- 数值/一般算术中间结果绝对值≤1e15、非零绝对值≥1e-30。ROUND位数为-15至15的整数。
- 聚合忽略引用中的文本/布尔/空白，日期拒绝；普通数值运算将空白按0处理，拒绝文本/布尔/日期，不擅自转换编号或日期。
- Decimal使用40位有效数字；**不是完整Excel浮点兼容，不是任意精度有理数计算**。XLSX及JSON数字输出转为双精度，`decimalResult`保留本引擎十进制结果。
- 不支持IF、查找、条件聚合、名称、数组/数据表公式、外部链接、错误/富文本单元格、合并或任意代码。
- 输出不保留原样式、隐藏状态、图表或原公式；所有输出行列可见。原公式及直接依赖在JSON报告中保留。业务口径仍需用户确认。

示例已实际重算：原明细`D2=B2*C2`缓存故意为999，重算结果为0.3；汇总金额缓存为0，实际重算25.3；折扣金额22.77。实际输入在`apps/web/public/skill-examples/formula-example.xlsx`，实际结果与报告保存在[验证目录](../verification/formula-batch-2026-10-16/)。这是可复验的合成样例，不充抵36个真实业务案例。

## 多文件PDF批量OCR `pdf.ocr-batch@1.0.0`

入口：文档整理专家 → 执行技能 → 多文件PDF批量OCR。

- 上传ZIP，内含2至3个顶层PDF，不含目录或其他文件。ZIP≤2MB，每份PDF≤2MB、展开合计≤6MB，**全部文件合计≤6页**。
- 使用已有ZIP中央目录预检，限制解压量、路径和条目；新读取器仅接受存储/Deflate压缩，按单文件输出上限解压并验证真实长度、CRC和本地文件名/压缩方式。全部内存处理，不将上传路径解压到磁盘。
- 先检查所有PDF可读性和合计页数，再顺序调用真实逐页渲染/中英文OCR；继承单PDF的加密、XFA、图像和渲染限制。
- 每份文件使用`document-01`等固定编号目录，避免原文件名覆盖和路径风险；目录含逐页PNG、文字和完整OCR证据。外部批次清单记录原名、编号目录、来源哈希、页数、识别页数和缺失页。
- 交付`batch-ocr-results.zip`、`batch-report.json`及通用执行凭据。原PDF不再复制进结果包。
- **整批原子交付**：某个文件全空/失败、超时或用户取消时，没有前面文件的部分下载成果；部分空页会明确警告，不声称全文读完。运行事件可以记录已处理的页，不把事件当作最终交付。
- 逐文件OCR成果累计上限8MB；结果包、清单及凭据还受通用10MB存储交付上限约束。
- 仍需对照原PDF人工复核，不能保证所有内联图/字体都无渲染差异。没有大文件、大批量、超45秒长任务、后台自动重试、语义摘要、表格/复杂版式还原或可检索PDF。

## UI与规划

- 两项已加入实际注册表、执行器、专家绑定、元数据规划候选、任务内文件执行及运行下载链路。
- 无新增模型权限；人工选择执行不会调用模型。规划不能读文件正文或宣称已检查公式，实际上传后才处理。
- 保留原双表关联的参数/示例行为；公式技能提供独立真实XLSX示例。
- 修复公式函数名单在320px窄屏撑开执行台的问题：仅修改技能区换行和网格最小宽度，不缩小字体、不改首页。
- 普通PDF提取工具的扫描件错误提示改为指向已实现的PDF OCR，不再要求先手动导出图片。

## 实测结果

新增15项服务端测试：10项公式、5项批量PDF。包括实际文件输出、故意过期缓存、引用/共享公式、算术优先级、类型规则、循环/资源限制、白名单拒绝、ZIP破损/危险路径/CRC、三文件六页、失败原子性及所有者隔离。

新增6项浏览器测试：真实示例下载→上传→重算→下载→刷新，错误公式没有假结果，实际多PDF结果包校验，第二文件失败不交付部分成果，320/390px布局。

合并回归（不重复累计专项）全通过，无跳过：

|检查|结果|
|---|---|
|服务端全部API/技能测试|90/90（上一批75 + 本批15）|
|浏览器既有范围加本批|149/149（上一批143 + 本批6）|
|目录/任务库|9/9|
|前后端TypeScript、前端生产构建、diff检查|通过|

旧有大主包、fflate混合导入告警仍在，未声称优化完成。模型相关回归仍使用明确测试替身，不能当作真实供应商联调；文件解析、计算、OCR、SQLite、worker、真实HTTP与下载没有替身。没有新增生产隔离沙箱。

已查看实际批次结果截图和390px表单。截图、样例实际公式输出、源码哈希及验证结果在[验证目录](../verification/formula-batch-2026-10-16/)。完整日志保存在忽略目录`.cache/formula-batch-final-{server,browser}.log`、`.cache/formula-batch-build.log`及`.cache/formula-batch-catalog.log`，缓存不保证跨会话保留。

复核：

```sh
npx --yes pnpm@9.0.0 exec tsc -p server/tsconfig.local.json
node --test server/skills/*.test.cjs server/api/*.test.cjs
node --test scripts/expert-catalog.test.mjs scripts/prompt-library.test.mjs
npx --yes pnpm@9.0.0 --filter designbuddy-web build
LD_LIBRARY_PATH="$PWD/.cache/browser/libs/lib" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium npx --yes pnpm@9.0.0 --filter designbuddy-web exec playwright test formula-batch.spec.ts advanced-office.spec.ts task-skills.spec.ts skill-planning.spec.ts skill-phase-two.spec.ts skill-runtime.spec.ts expert-avatars.spec.ts experts.spec.ts skills.spec.ts expert-match.spec.ts conversation.spec.ts clarification.spec.ts attach-menu.spec.ts home-reference.spec.ts
```

所有其他高级欠账继续保留；未把A3/D3或任何专家整体打勾。修改保留在固定分支的本地工作区，未执行推送/PR/部署，未覆盖旧云盘备份。
