import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fontFor, fontLicense } from "./fonts";
import { out, json } from "./io";
import type { Output } from "./executors";

export async function extractPDF(bytes: Uint8Array) {
  if (!Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from("%PDF-"))) throw Error("文件不是真实 PDF。");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = require.resolve("pdfjs-dist/package.json").replace(/package\.json$/, "");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, useWorkerFetch: false, cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/", stopAtErrors: true, verbosity: 0 });
  try {
    const doc = await task.promise;
    if (doc.numPages > 40) throw Error("PDF 最多 40 页。");
    const pages: { page: number; text: string; textItems: number; warning?: string }[] = []; let chars = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i); const content = await page.getTextContent({ disableNormalization: false });
      let source = "";
      for (const item of content.items) if ("str" in item) { source += item.str + (item.hasEOL ? "\n" : ""); chars += item.str.length; if (chars > 60000) throw Error("PDF 提取文本超过 60000 字。"); }
      pages.push({ page: i, text: source, textItems: content.items.length, ...(!source.trim() ? { warning: "此页无可提取文本，可能为空白页或扫描图；没有执行OCR。" } : {}) });
      page.cleanup();
    }
    if (!pages.some(p => p.text.trim())) throw Error("PDF 无可提取文字，可能是扫描件。请改用扫描PDF逐页批量OCR；本技能不会把空文本当成功。");
    return pages;
  } catch (e) {
    if (e instanceof Error && /password|encrypt/i.test(e.message)) throw Error("PDF 已加密，请提供未加密副本。");
    throw e;
  } finally { await task.destroy(); }
}
export async function writePDF(sections: { text: string; heading?: number }[]): Promise<Output[]> {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit); doc.setCreator("DesignBuddy deterministic document formatter");
  const fonts = new Map<string, PDFFont>(); let page = doc.addPage([595.28, 841.89]), x = 44, y = 790, count = 1;
  const nextLine = (height: number) => { x = 44; y -= height; if (y < 55) { if (++count > 80) throw Error("PDF 排版超过80页。"); page = doc.addPage([595.28, 841.89]); y = 790; } };
  for (const section of sections) {
    const size = section.heading ? 17 : 11; const source = section.text.replace(/^#{1,3}\s+/, "").replace(/\t/g, "    ");
    for (const character of source) {
      if (character === "\n") { nextLine(size * 1.65); continue; }
      const f = await fontFor(character); let embedded = fonts.get(f.file);
      if (!embedded) { embedded = await doc.embedFont(f.bytes, { subset: true }); fonts.set(f.file, embedded); }
      const width = embedded.widthOfTextAtSize(character, size);
      if (x + width > 551) nextLine(size * 1.65);
      page.drawText(character, { x, y, size, font: embedded, color: rgb(.16, .23, .2) }); x += width;
    }
    nextLine(size * 1.8);
  }
  const bytes = await doc.save(); const checked = await PDFDocument.load(bytes); if (checked.getPageCount() !== count) throw Error("PDF输出页数校验失败。");
  return [out("organized.pdf", "application/pdf", bytes), out("font-license.txt", "text/plain; charset=utf-8", await fontLicense())];
}
export async function pdfRead(bytes: Uint8Array, event: (message: string) => void) {
  const pages = await extractPDF(bytes); const missing = pages.filter(p => p.warning).length;
  event(`已实际提取 ${pages.length} 页，${missing} 页没有可提取文字。未执行 PDF JavaScript 或 OCR。`);
  return { summary: `读取 ${pages.length} 页 PDF；${missing ? `${missing} 页无文本，请检查来源记录并补充OCR，不能视为全文读取完整。` : "每页都有可提取文本。"} 阅读顺序按PDF文本流，不保证表格与分栏还原。`, outputs: [out("extracted.txt", "text/plain; charset=utf-8", pages.map(p => `【第${p.page}页】\n${p.warning || p.text}`).join("\n\n")), json("pdf-pages.json", pages)] };
}
