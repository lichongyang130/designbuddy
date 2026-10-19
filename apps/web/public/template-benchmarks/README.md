# 第一批模板标杆候选 / 2026.10.20-1

8 套新增作品，配合既有 FORME 家具采购原型覆盖九类。不是所有存量模板已完成商业验收的声明。

## 内容与权利

本目录新作中的原创文字、合成业务数据、程序 SVG 图形、程序音效与参数化几何按 CC0-1.0 提供，完整文本见 CC0-1.0.txt。来源：shared/commercialTemplates.ts、shared/commercialExports.ts、scripts/generate-template-benchmarks.cjs。

例外：Noto Sans SC 字体及其嵌入/衍生字体子集仍受 SIL OFL 约束，见 OFL.txt；代码和依赖维持各自原许可。CC0 不授予任何第三方商标、肖像、专利或真实业务背书。虚构品牌名称不代表已进行全球商标检索。

CC0 文本来自 https://github.com/spdx/license-list-data/blob/main/text/CC0-1.0.txt 。

## 输出边界

- pro-review：10 页原生可编辑 PPTX、由同一文件实际渲染的 PDF 与 10 张 JPEG，含讲稿、口径和合成指标。
- pro-project：8 节正文与原生表格；实际 DOCX 导出为 5 页 PDF，全页图与内容核对报告。此页数为当前原始样例，不是保证修改后仍为 5 页。
- pro-launch：6 张原创 SVG；浏览器可按当前参数导出 SVG/PNG；不含摄影，不做印刷认证。
- pro-tour：五步离线教学 HTML；不操纵外部软件、不采集用户行为。
- pro-film：真实编码 20 秒、960×540、25fps H.264 MP4，5 个程序绘制镜头与 VTT，无音乐。修改分镜不自动重编码固定样片；不宣称摄影或完整非线性剪辑器。
- pro-cues：5 个原创 PCM WAV，22,050 Hz / mono / 16-bit；浏览器试听/增益/导出，不是音乐或人声。
- pro-cost：本地预算测算 HTML；所有金额以分计算，含公式与情景说明；不接支付/报价平台。
- pro-config：原创边几几何、WebGL HTML、OBJ/JSON；无外部模型、纹理或服务。不用于工程测量。

当前品牌/副标题/章节标题修改可导出 PPTX/DOCX；PDF 和原始页图明确是固定原始版本，不包含这些修改。当前修改版 PDF 需在目标办公软件另行渲染。PPTX/DOCX 不嵌入字体，接收端需安装授权字体。三份离线 HTML 与浏览器下载的 SVG 内嵌本地简体中文 WOFF2 和 OFL 全文，不需要字体 CDN；字体覆盖之外的生僻字仍需目标端字体支持。静态原始 SVG 保留字体名称，显示取决于查看端字体。

assets-manifest.json 保存原始文件 SHA256 与长度；readiness.json 是源码能力清单，不是全量商业验收结论。Word 与 PPT 的实际渲染、浏览器交互、数据模型及测试边界见仓库 docs/verification/template-benchmarks-2026-10-20/README.md。
