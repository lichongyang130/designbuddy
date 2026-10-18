import { PDFDocument, PDFRawStream, PDFName, PDFNumber, PDFDict } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { openLocalOCR } from "./local-ocr";
import { out, json } from "./io";
import type { SkillInput, Output } from "./executors";
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
type PDFPageRecord={page:number;text:string;status:string;confidence:number;width:number;height:number;dpi:number;rasterFile:string;rasterSHA256:string;textSHA256:string;lines:unknown[];warning?:string};
export type PDFPageCheckpoint={fileIndex:number;sourceSHA256:string;page:number;record:PDFPageRecord;png:Uint8Array};
const checkCanvas = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 8000 || height > 8000 || width * height > 6_000_000) throw Error("PDF渲染资源超过画布限制，未继续OCR。请降低扫描分辨率或拆分页。");
};
/** Bounded native canvases, not an OS sandbox. Never render an uploaded URL. */
class BoundedCanvasFactory {
  create(width: number, height: number) { checkCanvas(width, height); const canvas = createCanvas(Math.ceil(width), Math.ceil(height)); return { canvas, context: canvas.getContext("2d") }; }
  reset(target: any, width: number, height: number) { checkCanvas(width, height); target.canvas.width = Math.ceil(width); target.canvas.height = Math.ceil(height); }
  destroy(target: any) { target.canvas.width = 0; target.canvas.height = 0; target.canvas = null; target.context = null; }
}
export async function pdfOCR(input: SkillInput, event: (message: string) => void, context: {fileIndex?:number;resumePages?:PDFPageCheckpoint[];onPageCheckpoint?:SkillInput['onPageCheckpoint'];maxPages?:number} = {}) {
  context={fileIndex:context.fileIndex??0,resumePages:context.resumePages??input.resumePages??[],onPageCheckpoint:context.onPageCheckpoint??input.onPageCheckpoint};
  const maxPages=context.maxPages??6;
  if (!Buffer.from(input.bytes.subarray(0,5)).equals(Buffer.from("%PDF-"))) throw Error("文件不是真实 PDF。");
  // Reject oversized declared images before PDF.js can silently omit them at maxImageSize.
  let structural: PDFDocument;
  try { structural = await PDFDocument.load(input.bytes, { updateMetadata: false, throwOnInvalidObject: true }); }
  catch (error) { if (error instanceof Error && /password|encrypt/i.test(error.message)) throw Error("PDF 已加密，请提供未加密副本。"); throw error; }
  if (structural.getPageCount() > maxPages) throw Error(`PDF批量OCR最多${maxPages}页，请先拆分；没有只处理前${maxPages}页冒充完整结果。`);
  const objects = structural.context.enumerateIndirectObjects();
  if (objects.length > 10000) throw Error("PDF对象数量超过10000，请简化文件后重试。");
  for (const [, object] of objects) if (object instanceof PDFRawStream && object.dict.lookup(PDFName.of("Subtype")) === PDFName.of("Image")) {
    const width = object.dict.lookup(PDFName.of("Width"), PDFNumber)?.asNumber();
    const height = object.dict.lookup(PDFName.of("Height"), PDFNumber)?.asNumber();
    if (!width || !height || !Number.isFinite(width*height) || width < 1 || height < 1 || width*height > 12000000) throw Error("PDF包含无效或超过1200万像素的嵌入图片，已停止，避免省略图片后冒充完整识别。");
  }
  const form = structural.context.lookup(structural.catalog.get(PDFName.of("AcroForm")));
  if (form instanceof PDFDict && form.has(PDFName.of("XFA"))) throw Error("不支持XFA动态表单，请先导出为普通静态PDF。");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = require.resolve("pdfjs-dist/package.json").replace(/package\.json$/, "");
  const loading = pdfjs.getDocument({ data: new Uint8Array(input.bytes), useSystemFonts: false, disableFontFace: true, useWorkerFetch: false, enableXfa: false, isOffscreenCanvasSupported: false, isImageDecoderSupported: false, maxImageSize: 12_000_000, CanvasFactory: BoundedCanvasFactory as any, cMapUrl: base+"cmaps/", cMapPacked: true, standardFontDataUrl: base+"standard_fonts/", stopAtErrors: true, verbosity: 0 });
  let session: Awaited<ReturnType<typeof openLocalOCR>> | undefined;
  try {
    const doc = await loading.promise;
    if (doc.numPages > maxPages) throw Error(`PDF批量OCR最多${maxPages}页，请先拆分；没有只处理前${maxPages}页冒充完整结果。`);
    session = await openLocalOCR();
    event(`开始逐页本地渲染并OCR，共${doc.numPages}页；不执行PDF脚本、不上传外部服务。`);
    const pages: PDFPageRecord[] = [];
    const outputs: Output[] = []; let totalChars = 0, totalRasterBytes = 0;
    const sourceSHA256=sha(input.bytes),fileIndex=context.fileIndex||0;
    const checkpoints=new Map((context.resumePages||[]).filter(c=>c.fileIndex===fileIndex&&c.sourceSHA256===sourceSHA256).map(c=>[c.page,c]));
    for (let i = 1; i <= doc.numPages; i++) {
      const saved=checkpoints.get(i);
      if(saved&&saved.record.page===i&&saved.record.rasterFile===`ocr-page-${String(i).padStart(2,"0")}.png`&&saved.png instanceof Uint8Array&&saved.png.length<=8000000&&Number.isInteger(saved.record.width)&&saved.record.width>0&&saved.record.width<=8000&&Number.isInteger(saved.record.height)&&saved.record.height>0&&saved.record.height<=8000&&Number.isFinite(saved.record.confidence)&&saved.record.confidence>=0&&saved.record.confidence<=100&&Number.isFinite(saved.record.dpi)&&saved.record.dpi>0&&saved.record.dpi<=144&&typeof saved.record.text==="string"&&saved.record.text.length<=60000&&["recognized","no_text"].includes(saved.record.status)&&Array.isArray(saved.record.lines)&&saved.record.lines.length<=6000&&sha(saved.png)===saved.record.rasterSHA256&&sha(saved.record.text)===saved.record.textSHA256) {
        totalChars+=saved.record.text.length;totalRasterBytes+=saved.png.length;if(totalChars>60000||totalRasterBytes>8000000)throw Error("恢复检查点合计超出OCR输出资源限制。");
        pages.push(saved.record);outputs.push(out(saved.record.rasterFile,"image/png",saved.png));event(`第${i}/${doc.numPages}页恢复自已校验的持久化检查点；未重复OCR。`);continue;
      }
      const page = await doc.getPage(i); const unit = page.getViewport({ scale: 1 });
      if (!Number.isFinite(unit.width * unit.height) || unit.width <= 0 || unit.height <= 0 || unit.width > 14400 || unit.height > 14400) throw Error(`PDF第${i}页尺寸不受支持。`);
      const scale = Math.min(2, Math.sqrt(1_990_000 / (unit.width * unit.height)));
      if (scale < .25) throw Error(`PDF第${i}页过大，无法在像素限制内可靠识别，请拆分页面。`);
      const viewport = page.getViewport({ scale }); const factory = new BoundedCanvasFactory();
      const target = factory.create(viewport.width, viewport.height);
      try {
        await page.render({ canvas: target.canvas as any, canvasContext: target.context as any, viewport, background: "rgb(255,255,255)" }).promise;
        const png = target.canvas.toBuffer("image/png"); totalRasterBytes += png.length;
        if (totalRasterBytes > 8_000_000) throw Error("PDF逐页渲染图合计超过8MB，未交付截断结果；请拆分或简化扫描文件。");
        const recognized = await session.worker.recognize(png, {}, { text: true, blocks: true });
        const source = recognized.data.text; totalChars += source.length;
        if (totalChars > 60000) throw Error("PDF OCR识别结果超过60000字，请拆分文件。");
        const lines = (recognized.data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines.map(l => ({ text: l.text, confidence: l.confidence, bbox: l.bbox }))));
        if (lines.length > 6000) throw Error("单页OCR行记录超过6000条，请拆分页面。");
        const rasterFile = `ocr-page-${String(i).padStart(2,"0")}.png`;
        const record:PDFPageRecord={ page: i, text: source, status: source.trim() ? "recognized" : "no_text", confidence: recognized.data.confidence, width: target.canvas.width, height: target.canvas.height, dpi: Math.round(scale*7200)/100, rasterFile, rasterSHA256: sha(png), textSHA256: sha(source), lines, ...(!source.trim() ? { warning: "未识别到文字：可能为空白、扫描模糊或渲染不完整；本页不能视为读取成功。" } : {}) };
        pages.push(record);outputs.push(out(rasterFile,"image/png",png));
        await context.onPageCheckpoint?.({fileIndex,sourceSHA256,page:i,record,png});
        event(`第${i}/${doc.numPages}页已实际渲染：${source.trim() ? `识别${source.length}字，置信度${recognized.data.confidence.toFixed(1)}%` : "未识别到文字，已记录警告"}。`);
      } finally { factory.destroy(target); page.cleanup(); }
    }
    const recognizedPages = pages.filter(p => p.status === "recognized").length;
    if (!recognizedPages) throw Error("所有PDF页面均未识别到文字，不能视为OCR成功；请检查扫描清晰度及渲染资源。");
    outputs.push(out("pdf-ocr.txt", "text/plain; charset=utf-8", pages.map(p => `【第${p.page}页】\n${p.warning || p.text}`).join("\n\n")));
    outputs.push(json("pdf-ocr-evidence.json", { sourceSHA256, pageCount: pages.length, recognizedPages, pagesWithoutText: pages.filter(p => p.warning).map(p => p.page), allPagesHaveText: recognizedPages === pages.length, pages, engine: "tesseract.js@6.0.1", renderer: "pdfjs-dist@6.4.299", modelSource: "@tesseract.js-data@1.0.0/4.0.0_best_int", modelHashes: session.modelHashes, language: "chi_sim+eng", coordinateSystem: "每页渲染PNG的左上角像素坐标；PDF旋转已应用。", requiresReview: true, limits: `最多${maxPages}页/2MB，逐页≤200万像素，最高144dpi；识别的是渲染后的可见内容，已预检拒绝超限的独立图像对象；仍可能有内联图像省略或字体/渲染差异。必须对照原PDF及逐页PNG复核，置信度不是正确率保证。不还原复杂表格/版式，不生成可检索PDF。` }));
    return { summary: `完成${pages.length}页PDF的本地渲染与OCR报告，${recognizedPages}页识别到文字，${pages.length-recognizedPages}页未识别到。${recognizedPages < pages.length ? "存在缺失页，不能视为全文读取完成。" : "识别文字仍须对照原件逐页复核。"}未执行语义摘要、表格还原或外部上传。`, outputs };
  } catch (error) {
    if (error instanceof Error && /password|encrypt/i.test(error.message)) throw Error("PDF 已加密，请提供未加密副本。");
    throw error;
  } finally { try { if (session) await session.worker.terminate(); } finally { await loading.destroy(); } }
}
