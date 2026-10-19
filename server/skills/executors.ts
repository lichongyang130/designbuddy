import { createWord } from "./word-pro/pipeline";
import { createPresentation } from "./presentation/pipeline";
import type { PresentationCheckpoint } from "../../shared/presentation";
import { runtimeCatalog } from "./runtime-catalog";
import { requestAI } from "../api/ai";
import { createHash } from "node:crypto";
import { posterLayout } from "./poster-layout";
import { brandSystem } from "./brand-system";
import { transcribeEnglish } from "./audio-transcribe";
import ExcelJS from "exceljs";
import Decimal from "decimal.js";
const D = Decimal.clone({ precision: 40 });
import { parse } from "csv-parse/sync";
import { openOffice } from "./office";
import { infographic } from "./infographic";
import { docxStructure } from "./docx-structure";
import { calculateWorkbook } from "./table-calculate";
import { joinTables } from "./table-join";
import { joinMultiTables } from "./table-join-multi";
import { pdfBatch } from "./pdf-batch";
import { pdfOCR } from "./pdf-ocr";
import { paragraphs } from "./source-text";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";
import { writePDF, pdfRead } from "./pdf";
import { palette, productImages, marketing, ocr } from "./images";
import { schedule, requirements } from "./planning";
import { htmlAudit, codeInspect } from "./web-checks";
import { cssAudit, designTokens, webScaffold, webImagePack } from "./frontend-design";
import { socialCarousel } from "./social-carousel";
import { designReview } from "./design-review";
import { articleMagazine } from "./article-magazine";
import { designBrief } from "./design-brief";
import { socialCard } from "./social-card";
import { teamOKRs } from "./team-okrs";
import { dataReport } from "./data-report";
import { emailMarketing } from "./email-marketing";
import { productSpec } from "./product-spec";
import { faqPage } from "./faq-page";
import { hrOnboarding } from "./hr-onboarding";
import { engineeringRunbook } from "./engineering-runbook";
import { financeReport } from "./finance-report";
import { connectData } from "./data-connect";
import { runVerification } from "./web-verify";
import { runBuild } from "./code-build";
import { generateImage } from "./image-generate";
import { runCollaborationSync } from "./collaboration-sync";
import { buildStructuredPresentation } from "./pptx-deck";
import { inspectPresentation } from "./pptx-inspect";
import { presentationRendererAvailable, renderPresentation } from "./pptx-render";

export type SkillInput = { workDirectory?: string; onAIUsage?: (usage: import("../api/model-registry").UsageRecord) => void; skillId: string; filename: string; bytes: Uint8Array; deduplicate: boolean; parameters?: Record<string, string>; owner?: string; resumePresentation?: PresentationCheckpoint; onPresentationCheckpoint?: (checkpoint: PresentationCheckpoint) => Promise<void> | void; resumePages?: import('./pdf-ocr').PDFPageCheckpoint[]; onPageCheckpoint?: (checkpoint: import('./pdf-ocr').PDFPageCheckpoint) => Promise<void> | void };
export type Output = { name: string; mime: string; bytes: Uint8Array };
import { out, json, text, xml } from "./io";
async function table(input: SkillInput, event: (s: string) => void) {
  let rows: string[][] = []; let sourceSheet = "CSV";
  if (/\.csv$/i.test(input.filename)) {
    rows = parse(text(input.bytes), { bom: true, skip_empty_lines: true, max_record_size: 100000, to: 5002 });
  } else {
    openOffice(input.bytes, "xl/workbook.xml");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(input.bytes) as any);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 5001 || sheet.columnCount > 50) throw Error("工作表为空或超过 5000 行、50 列限制。");
    sourceSheet = sheet.name;
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row: string[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        const value = sheet.getCell(r, c).value;
        if (value && typeof value === "object" && !(value instanceof Date)) throw Error("不支持公式、富文本或链接单元格，请先转为普通值。");
        row.push(value instanceof Date ? value.toISOString() : String(value ?? ""));
      }
      rows.push(row);
    }
  }
  if (rows.length < 2 || rows.length > 5001 || rows[0].length > 50 || rows.length * rows[0].length > 100000) throw Error("需要表头和至少一行数据，最多 5000 行、50 列、100000 单元格。");
  if (rows.some(r => r.length !== rows[0].length || r.some(v => v.length > 10000))) throw Error("行的列数不一致或单元格内容过长。");
  const headers = rows[0].map(s => s.trim());
  if (headers.some(s => !s) || new Set(headers).size !== headers.length) throw Error("字段名必须非空且唯一。");
  event(`读取 ${rows.length - 1} 行、${headers.length} 列（${sourceSheet}），校验通过。`);
  const seen = new Set<string>(); let duplicates = 0;
  const cleaned = rows.slice(1).map((row, i) => ({ sourceRow: i + 2, values: row })).filter(row => {
    const key = JSON.stringify(row.values); const duplicate = seen.has(key); seen.add(key);
    if (duplicate) duplicates++;
    return !(input.deduplicate && duplicate);
  });
  const stats = headers.map((name, col) => {
    const values = cleaned.map(r => r.values[col].trim()).filter(Boolean);
    const numeric = values.length > 0 && values.every(v => /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v) && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 1e12 && (v.split(".")[1]?.length || 0) <= 12 && !/^[-+]?0\d/.test(v));
    const numbers = numeric ? values.map(Number) : [];
    const total = values.reduce((sum, value) => numeric ? sum.plus(value) : sum, new D(0));
    const sum = total.toNumber();
    return { name, missing: cleaned.length - values.length, count: values.length, numeric, ...(numeric ? { sum, sumExact: total.toFixed(), mean: total.div(numbers.length).toNumber(), meanExact: total.div(numbers.length).toSignificantDigits(20).toString(), min: Math.min(...numbers), max: Math.max(...numbers) } : {}) };
  });
  event(`计算完成；发现 ${duplicates} 行完全重复记录，${input.deduplicate ? "已按选项去重" : "按选项保留"}。数值列将写为 Excel 数值，精确合计保存在统计表和 JSON 的 sumExact 字段。`);
  const workbook = new ExcelJS.Workbook(); workbook.creator = "DesignBuddy";
  const sheet = workbook.addWorksheet("清洗数据"); sheet.addRow(headers); cleaned.forEach(r => sheet.addRow(r.values.map((value, col) => stats[col].numeric && value.trim() ? Number(value) : value)));
  const summary = workbook.addWorksheet("字段统计"); summary.addRow(["字段", "非空数", "缺失数", "数值列", "合计", "均值", "最小", "最大"]);
  stats.forEach(s => summary.addRow([s.name, s.count, s.missing, s.numeric ? "是" : "否", s.sumExact ?? "", s.meanExact ?? "", s.min ?? "", s.max ?? ""]));
  for (const s of workbook.worksheets) { s.getRow(1).font = { bold: true }; s.columns.forEach(c => c.width = 22); s.views = [{ state: "frozen", ySplit: 1 }]; }
  const xlsx = new Uint8Array(await workbook.xlsx.writeBuffer());
  const numeric = stats.filter(s => s.numeric).slice(0, 12);
  const chartItems = numeric.length ? numeric.map(s => ({ label: s.name, value: s.sum! })) : stats.slice(0, 12).map(s => ({ label: s.name, value: s.count }));
  const max = Math.max(1, ...chartItems.map(s => Math.abs(s.value)));
  const chart = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${150 + chartItems.length * 48}" viewBox="0 0 900 ${150 + chartItems.length * 48}"><rect width="100%" height="100%" fill="#fafaf7"/><g font-family="sans-serif" fill="#273c38"><text x="32" y="38" font-size="22">${numeric.length ? "数值列合计（正负以数字标签为准）" : "各字段非空记录数"}</text><text x="32" y="65" font-size="13">独立字段仅作概览；单位可能不同，请勿据柱长比较业务价值。最多展示12列。</text>${chartItems.map((s, i) => `<text x="32" y="${110 + i * 48}" font-size="14">${xml(s.label.slice(0, 12))}</text><rect x="210" y="${90 + i * 48}" width="${Math.abs(s.value) / max * 450}" height="28" rx="4" fill="${s.value < 0 ? "#bb7060" : "#698a80"}"/><text x="680" y="${110 + i * 48}" font-size="14">${xml(Number(s.value.toPrecision(12)))}</text>`).join("")}</g></svg>`;
  return { summary: `实际处理 ${rows.length - 1} 行；交付 ${cleaned.length} 行。发现 ${duplicates} 行完全重复；数值列 ${stats.filter(s => s.numeric).length} 个。`, outputs: [out("cleaned.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx), json("analysis.json", { sourceSheet, originalRows: rows.length - 1, retainedRows: cleaned.length, duplicateRows: duplicates, deduplicated: input.deduplicate, sourceRows: cleaned.map(r => r.sourceRow), rowReference: "CSV 为解析后记录序号（含表头、跳过空行），XLSX 为首表实际行号；不是所有文件的物理文本行号。", columns: stats, numericPolicy: "Decimal 40位十进制计算；sumExact 为精确合计，meanExact 最多20位有效数字，图表及数字字段为近似值。绝对值≤1e12且小数≤12位，不推断前导零、币种、百分比或日期。" }), out("overview.svg", "image/svg+xml", chart)] };
}
async function summarizeDocument(input: SkillInput, event: (s: string) => void) {
  if (input.parameters?.externalConsent !== "yes") throw Error("没有第三方模型正文处理授权，未发送文档内容。");
  if (!input.owner) throw Error("缺少已认证的任务所有者，未调用模型。");
  const sections = paragraphs(input);
  const inputHash = createHash("sha256").update(input.bytes).digest("hex");
  const chunks: { ids: number[]; text: string }[] = [];
  let current = "", ids: number[] = [];
  for (const section of sections) {
    const parts = section.text.match(/[\s\S]{1,4500}/g) || [];
    for (const part of parts) {
      const record = `[P${section.sourceParagraph}] ${part}`;
      if (current && current.length + record.length > 5000) { chunks.push({ids,text:current}); current=""; ids=[]; }
      current += (current ? "\n" : "") + record;
      if (!ids.includes(section.sourceParagraph)) ids.push(section.sourceParagraph);
    }
  }
  if (current) chunks.push({ids,text:current});
  if (chunks.length > 12) throw Error("文档分段超过12块安全上限；请先拆分文档后重试。");
  const systemPrompt = "你是严谨的文档摘要助手。只能依据用户提供的正文，不得补充外部事实、推测、编造数据或把相关性说成因果。用简体中文写摘要；主要事实句末必须带原段落引用，格式 [P1] 或 [P1][P2]，引用只能取自输入。明确区分原文事实、原文观点和不确定信息；保留否定、条件、时间、单位及限定语。对缺失信息写‘原文未说明’。只输出可读Markdown，不声称独立核验。";
  event(`文档正文已按来源段落分为${chunks.length}块；正在请求已配置模型（正文将发往第三方服务）。`);
  const partials = await Promise.all(chunks.map(async (chunk, i) => {
    const result = await requestAI({userId:input.owner!,systemPrompt,prompt:`请总结第${i+1}/${chunks.length}块。覆盖关键主题、事实、决策、风险和待确认项；重要表述附原文段落标记。\n\n${chunk.text}`});
    const refs = [...result.content.matchAll(/\[P(\d+)\]/g)].map(m=>Number(m[1]));
    if (!refs.length || refs.some(n=>!chunk.ids.includes(n))) throw Error("模型摘要缺少有效来源段落标记；没有交付未经验证的摘要。");
    return {model:result.model,content:result.content,sourceParagraphs:[...new Set(refs)]};
  }));
  let markdown:string;
  let model=partials[0]?.model || "";
  if (partials.length===1) markdown=partials[0].content;
  else {
    const combined=partials.map((p,i)=>`【分块${i+1}，来源段落${p.sourceParagraphs.map(n=>`P${n}`).join(",")}】\n${p.content}`).join("\n\n");
    const final=await requestAI({userId:input.owner,systemPrompt,prompt:`请整合以下已带原文段落标记的分块摘要，去除重复信息、保留矛盾/差异、重要限制及未决问题。不能丢失或改写来源标记；只引用输入中已有的段落标记。\n\n${combined}`});
    const refs=[...final.content.matchAll(/\[P(\d+)\]/g)].map(m=>Number(m[1]));
    const valid=new Set(partials.flatMap(p=>p.sourceParagraphs));
    if (!refs.length || refs.some(n=>!valid.has(n))) throw Error("整合摘要引用无效；未交付部分结果。");
    markdown=final.content; model=final.model;
  }
  const allRefs=[...markdown.matchAll(/\[P(\d+)\]/g)].map(m=>Number(m[1]));
  if (!allRefs.length || allRefs.some(n=>n<1||n>sections.length)) throw Error("最终摘要没有有效来源标记，未交付结果。");
  const report={skill:"document.summarize",version:"1.0.0",inputSHA256:inputHash,inputCharacters:sections.reduce((n,s)=>n+s.text.length,0),paragraphCount:sections.length,sourceParagraphs:[...new Set(allRefs)].sort((a,b)=>a-b),model,providerConfiguredOnServer:true,externalProcessingAuthorized:true,networkUsed:true,contentWasSentToThirdParty:true,limitations:["AI摘要可能遗漏或误读；来源段落标记不证明句意被来源蕴含。","仅处理TXT/MD或DOCX主文档文字段落；DOCX表格文字会被展平，不保留单元格关系；不读取图片、OCR内容或版式。","需人工对照原文核实，不可当作事实审计或专业建议。"]};
  return {summary:`已调用服务端配置的第三方模型摘要${sections.length}个正文段落；交付${new Set(allRefs).size}个来源段落引用。摘要可能误读，必须对照原文复核。`,outputs:[out("document-summary.md","text/markdown; charset=utf-8",markdown),json("document-summary-report.json",report)]};
}
async function document(input: SkillInput, event: (s: string) => void) {
  const sections = paragraphs(input); event(`已提取 ${sections.length} 个非空段落；未执行摘要或事实改写。`);
  const doc = new Document({ creator: "DesignBuddy", sections: [{ children: sections.map(s => new Paragraph({ children: [new TextRun({ text: s.text.replace(/^#{1,3}\s+/, ""), font: "Microsoft YaHei", size: 24 })], ...(s.heading ? { heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][s.heading - 1] } : {}), spacing: { after: 180 } })) }] });
  return { summary: `已将 ${sections.length} 个实际段落整理为可编辑 DOCX 和内嵌字体 PDF，未进行 AI 摘要或语义推断。`, outputs: [...await writePDF(sections), out("organized.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await Packer.toBuffer(doc)), json("source-paragraphs.json", sections)] };
}
async function buildTextPresentation(input: SkillInput, event: (s: string) => void) {
  const sections = paragraphs(input);
  if (sections.reduce((n, s) => n + s.text.length, 0) > 18000) throw Error("演示材料最多 18000 字。");
  const pages: { title: string; parts: { text: string; sourceParagraph: number }[] }[] = [];
  let title = "材料汇报";
  for (const section of sections) {
    if (section.heading) {
      title = section.text.replace(/^#{1,3}\s+/, "");
      if (title.length > 60) throw Error("演示页标题超过 60 字，请缩短标题后重试。");
      pages.push({ title, parts: [] });
      continue;
    }
    for (let i = 0; i < section.text.length; i += 140) {
      const fragment = { text: section.text.slice(i, i + 140), sourceParagraph: section.sourceParagraph };
      let page = pages.at(-1);
      if (!page || page.parts.length >= 3 || page.parts.reduce((n, p) => n + p.text.length, 0) + fragment.text.length > 320) {
        page = { title, parts: [] };
        pages.push(page);
      }
      page.parts.push(fragment);
    }
  }
  if (!pages.length) throw Error("材料中没有可生成的非空页面。");
  if (pages.length > 50) throw Error("材料分页超过 50 页，请缩短材料。");
  event(`确定性分页完成，共 ${pages.length} 页；正在写入原生可编辑 PPTX。`);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "DesignBuddy";
  pptx.title = title;
  pptx.subject = "材料分页整理（非 AI 汇报分析）";
  pages.forEach((page, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9F6" };
    slide.addText(String(i + 1).padStart(2, "0"), { x: .55, y: .35, w: 1, h: .3, fontSize: 12, color: "618477" });
    slide.addText(page.title, { x: .55, y: .85, w: 12, h: 1, fontFace: "Microsoft YaHei", fontSize: 26, bold: true, color: "273C38", breakLine: false });
    page.parts.forEach((part, index) => slide.addText(part.text, { x: .65, y: 2 + index * 1.35, w: 11.9, h: 1.2, fontFace: "Microsoft YaHei", fontSize: 18, color: "344641", margin: 0, valign: "top" }));
    slide.addNotes(`来源段落：${page.parts.map(part => part.sourceParagraph).join("、")}。未核实事实，未进行语义总结。`);
  });
  const bytes = new Uint8Array(await pptx.write({ outputType: "nodebuffer" }) as Buffer);
  const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>页面内容预览</title><style>body{font:18px/1.7 sans-serif;background:#eee;padding:24px;color:#273c38}section{max-width:900px;background:#f8f9f6;margin:24px auto;padding:36px;border-radius:12px}p{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#667}</style><h1>页面内容预览（非 PowerPoint 渲染截图）</h1>${pages.map((page, index) => `<section><small>第 ${index + 1} 页</small><h2>${xml(page.title)}</h2>${page.parts.map(part => `<p>${xml(part.text)}</p>`).join("")}</section>`).join("")}</html>`;
  return { title, slideCount: pages.length, pptxBytes: bytes, outputs: [out("content-preview.html", "text/html; charset=utf-8", html), json("source-paragraphs.json", { sections, pages })] };
}

async function slides(input: SkillInput, event: (s: string) => void) {
  const build = /\.json$/i.test(input.filename)
    ? await buildStructuredPresentation(input.bytes)
    : await buildTextPresentation(input, event);
  let renderOutputs: Output[] = [];
  let rendered = false;
  let missingFonts: string[] = [];
  try {
    const preview = await renderPresentation(build.pptxBytes, build.slideCount, event, { workDirectory: input.workDirectory });
    renderOutputs = preview.outputs;
    missingFonts = Array.isArray(preview.report.missingFonts) ? preview.report.missingFonts.filter((font): font is string => typeof font === "string").slice(0, 5) : [];
    rendered = true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "未知渲染错误";
    const report = {
      schemaVersion: 1,
      status: presentationRendererAvailable() ? "failed" : "unavailable",
      source: "local-only; no external service was contacted",
      slideCount: build.slideCount,
      error: message,
      review: { visualReviewRequired: true, automaticVisualPass: false, note: "没有生成逐页渲染图；PPTX 仍可下载，但不能视为完成视觉质检。" },
    };
    renderOutputs = [json("render-report.json", report)];
    event(`PPTX 已生成，但本机 LibreOffice 渲染未完成：${message}。未把内容预览当作渲染截图。`);
  }
  return {
    summary: rendered
      ? `已生成 ${build.slideCount} 页原生可编辑 PPTX，并用本地 LibreOffice 实际渲染全部页面，附页面内容预览、联系表与逐页图像包。${missingFonts.length ? `当前渲染环境缺少字体（${missingFonts.join("、")}），相关页面文字可能替代或缺字。` : ""}渲染不是自动视觉通过；请人工检查溢出、遮挡、字体替换与可读性。`
      : `已生成 ${build.slideCount} 页原生可编辑 PPTX 和内容预览，但本机渲染未完成；render-report.json 记录引擎状态。未执行视觉验收、AI 改写或事实核查。`,
    outputs: [
      out("presentation.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", build.pptxBytes),
      ...build.outputs,
      ...renderOutputs,
    ],
  };
}

export async function executeSkill(input: SkillInput, event: (s: string) => void = () => {}, onPageCheckpoint?: SkillInput['onPageCheckpoint'], onPresentationCheckpoint?: SkillInput['onPresentationCheckpoint']) {
  if (onPageCheckpoint) input.onPageCheckpoint = onPageCheckpoint;
  if (onPresentationCheckpoint) input.onPresentationCheckpoint = onPresentationCheckpoint;
  if (input.bytes.length > (input.skillId === "slides.create" ? 13_600_000 : 2_000_000) || !input.bytes.length) throw Error("文件为空或超过当前技能的输入限制。");
  const definition = runtimeCatalog().find(s => s.id === input.skillId && s.status === "ready");
  const extension = /\.[a-z0-9]+$/i.exec(input.filename)?.[0].toLowerCase();
  if (!definition || !extension || !definition.accepts.includes(extension)) throw Error("技能或输入文件格式不受支持。");
  const executors: Record<string, (input: SkillInput, event: (s: string) => void) => Promise<{ summary: string; outputs: Output[] }>> = {
    "audio.transcribe-en": transcribeEnglish, "document.summarize": summarizeDocument, "infographic.compose": infographic, "table.calculate": calculateWorkbook, "table.analyze": table, "table.join": joinTables, "table.join-multi": joinMultiTables, "pdf.ocr": pdfOCR, "pdf.ocr-batch": pdfBatch, "document.create": createWord, "document.format": document, "document.structure": docxStructure, "slides.create": createPresentation, "slides.compose": slides, "slides.inspect": inspectPresentation,
    "pdf.extract": (input, event) => pdfRead(input.bytes, event), "image.ocr": ocr,
    "brand.assets": palette, "brand.system": brandSystem, "image.product": productImages, "image.marketing": marketing, "image.layout": posterLayout,
    "collaboration.schedule": schedule, "requirements.check": requirements, "data.connect": connectData,
    "web.audit": htmlAudit, "code.inspect": codeInspect,
    "web.verify": (input, event) => runVerification({ filename: input.filename, bytes: input.bytes, parameters: input.parameters, mode: "web" }, event),
    "test.browser": (input, event) => runVerification({ filename: input.filename, bytes: input.bytes, parameters: input.parameters, mode: "qa" }, event),
    "code.build": (input, event) => runBuild({ filename: input.filename, bytes: input.bytes, parameters: input.parameters }, event),
    "image.generate": (input, event) => generateImage({ filename: input.filename, bytes: input.bytes, parameters: input.parameters }, event),
    "collaboration.sync": (input, event) => runCollaborationSync({ filename: input.filename, bytes: input.bytes, parameters: input.parameters }, event),
    "web.css-audit": cssAudit, "web.scaffold": webScaffold, "design.tokens": designTokens, "image.web-pack": webImagePack, "social.carousel": socialCarousel, "design.review": designReview, "article.magazine": articleMagazine, "design.brief": designBrief, "social.card": socialCard, "team.okrs": teamOKRs, "data.report": dataReport, "email.marketing": emailMarketing, "product.spec": productSpec, "faq.page": faqPage, "hr.onboarding": hrOnboarding, "engineering.runbook": engineeringRunbook, "finance.report": financeReport,
  };
  const executor = executors[input.skillId];
  if (!executor) throw Error("该技能没有可用执行器。");
  const result = await executor(input, event);
  if (!result.outputs.length || result.outputs.some(o => !o.bytes.length) || result.outputs.reduce((n, o) => n + o.bytes.length, 0) > (input.skillId === "slides.create" ? 25_000_000 : 10_000_000)) throw Error("交付文件为空或超过输出限制。");
  // Re-open generated Office packages before declaring success.
  for (const output of result.outputs) {
    if (/\.xlsx$/.test(output.name)) { openOffice(output.bytes, "xl/workbook.xml"); const w = new ExcelJS.Workbook(); await w.xlsx.load(Buffer.from(output.bytes) as any); if (!w.worksheets.length) throw Error("输出表格校验失败。"); }
    if (/\.docx$/.test(output.name)) openOffice(output.bytes, "word/document.xml");
    if (/\.pptx$/.test(output.name)) openOffice(output.bytes, "ppt/presentation.xml", { allowEmbeddedExcel: true });
    if (/\.json$/.test(output.name)) JSON.parse(text(output.bytes));
  }
  event("成果文件结构校验通过，正在保存下载文件与处理记录。");
  return result;
}
