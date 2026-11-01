# 办公能力

在「技能 → 办公能力」里，或在对话中让 Agent 调用 `office.*` 工具。所有解析都在本地进程完成，不联网、不依赖 Office 或外部二进制。

## 工具

| 工具 | 输入 | 输出 |
|---|---|---|
| `office.read_pptx` | `filePath` 或 `dataBase64` | 逐页标题与正文 |
| `office.read_docx` | 同上 | 段落、标题、列表、表格转文本 |
| `office.read_xlsx` | 同上 | 工作表与单元格（最多显示 200 行/表） |
| `office.read_pdf` | 同上 | 抽取的文本（扫描件可能为空） |
| `office.write_docx` | `outputPath` + `text` | 生成最小可用 DOCX |
| `office.write_xlsx` | `outputPath` + `sheets` | 生成 XLSX（inlineStr） |
| `office.docx_formulas` | `filePath` + `action` | `list` 提取 LaTeX；`number` 另存编号版 |

写入内容格式：

- DOCX：`# 标题`、`- 列表`、其余按段落。
- XLSX：`[{"name":"Sheet1","rows":[["名称","数量"],["苹果",3]]}]`。

## 页面入口

技能页 → 办公能力 → 选一张卡：

- 来源可切「上传」或「本地路径」。
- Word / Excel 卡可在「读取」和「生成」之间切换。
- 公式卡支持「提取 LaTeX」和「给显示公式编号」（编号需填另存路径）。
- 结果直接显示在面板底部；失败会同时弹提示。

## 实现位置

- `src/office/zip.ts`：ZIP 读写与 CRC32（Node zlib）。
- `src/office/docx.ts`：DOCX 读写、OMML → LaTeX、公式编号。
- `src/office/pptx.ts`：按 `ppt/slides/slideN.xml` 提取。
- `src/office/xlsx.ts`：sharedStrings / workbook rels / worksheet。
- `src/office/pdf.ts`：FlateDecode 内容流与 Tj/TJ 文本。
- `src/office/index.ts`：路径或 base64 输入、操作编排。
- `src/plugins/office-tools.ts`：注册 7 个工具。
- `src/sdk/host.ts`：`office.run` 直调 RPC。

## 限制

- PPTX 只取文字，不还原版式、图表、备注页。
- PDF 只支持文本型；扫描件、CID/自定义字体可能抽不出字。
- 公式只做「提取 + 编号」，不做 LaTeX → OMML 回写。
- 上传上限 25MB；更大的文件请用本地路径。
- 写入是新建文件，不修改原文件（编号模式另存）。

## 验证

- `test/office.test.ts`：ZIP 往返、DOCX 读写、公式提取/编号、XLSX、PPTX、PDF。
- 全量 `node --test "test/*.test.ts"`：54 通过。
- `npm run typecheck`：无错误。
- 浏览器端：技能页 5 张办公卡、已安装计数 11；读取 `/tmp/office-demo.docx` 得到标题/正文/列表；生成 `/tmp/office-out.docx` 后可回读。


## 2026-11 补充

- 「更多」菜单新增「办公」，点击进入技能页办公区并高亮。
- 附件选择 PPTX/DOCX/XLSX/PDF 会直接打开办公面板并带入文件。
- XLSX 支持公式写入与读回（如 `=SUM(A1:B1)`，写入为 `<f>`，读回带 `=`）。
- mock LLM 检测到本地文件路径会调用对应的 `office.read_*`，已在对话中验证。
- 兼容性验收：生成的 DOCX/XLSX 用 LibreOffice 转 PDF 成功（16K/17K）。
- 侧栏无行为入口（全部/与您共享/网站/API 生成/垃圾箱）标「未接入」；媒体、邀请成员、文本设置隐藏。
- 仍未做：PPT 生成、Word 公式回写、设置/办公 UI 自动化测试。
