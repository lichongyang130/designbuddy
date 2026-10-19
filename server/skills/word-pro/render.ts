import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { presentationFonts } from "../presentation/fonts";
import { hash } from "./schema";
export type PdfItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type WordPage = {
  page: number;
  width: number;
  height: number;
  items: PdfItem[];
  jpg: Uint8Array;
  sha256: string;
};
export async function renderWord(bytes: Uint8Array, workDirectory?: string) {
  const work = await mkdtemp(join(workDirectory || tmpdir(), "word-pro-"));
  let converter: any;
  try {
    const inputPath = join(work, "document.docx"),
      pdfPath = join(work, "document.pdf"),
      outputDir = join(work, "pages");
    await writeFile(inputPath, bytes, { flag: "wx", mode: 0o600 });
    const { createConverter, ENGINE_VERSION } = await import(
      "@deepseek-ai/libreoffice-kit"
    );
    converter = await createConverter({
      timeoutMs: 60000,
      maxInputBytes: 2_000_000,
      maxOutputBytes: 8_000_000,
      maxArchiveEntries: 1500,
      maxUncompressedBytes: 12_000_000,
      fontMetadataCacheDirectory: false,
      fontDirectories: [presentationFonts().directory],
      initialFontFamilies: ["Noto Sans SC"],
      maxFontFiles: 2,
      maxFontFileBytes: 20_000_000,
      maxLoadedFontBytes: 25_000_000,
    });
    const receipt = await converter.render({ inputPath, outputPath: pdfPath });
    const pdf = new Uint8Array(await readFile(pdfPath));
    if (pdf.length > 8_000_000) throw Error("PDF超过8MB。");
    const pd = await PDFDocument.load(pdf, { updateMetadata: false });
    const count = pd.getPageCount();
    if (count < 1 || count > 20 || receipt.pageCount !== count)
      throw Error("Word物理页数不一致或超过20页。");
    const raster = await converter.renderImages({
      inputPath,
      outputDir,
      pages: "all",
      dpi: 72,
      maxPages: 20,
      maxPixels: 600_000,
      maxDimension: 1100,
    });
    if (
      raster.rasterEngine !== "libreoffice" ||
      raster.pageCount !== count ||
      raster.images.length !== count
    )
      throw Error("DOCX的PDF与页图页数不一致或渲染引擎错误。");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const base = require
      .resolve("pdfjs-dist/package.json")
      .replace(/package\.json$/, "");
    const task = pdfjs.getDocument({
      data: new Uint8Array(pdf),
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
      standardFontDataUrl: base + "standard_fonts/",
      cMapUrl: base + "cmaps/",
      cMapPacked: true,
      stopAtErrors: true,
      verbosity: 0,
    });
    const pages: WordPage[] = [];
    try {
      const doc = await task.promise;
      let pixels = 0,
        previewBytes = 0,
        chars = 0;
      for (let i = 0; i < count; i++) {
        const image = raster.images[i];
        const path = resolve(image.path),
          rel = relative(resolve(outputDir), path);
        if (
          image.page !== i + 1 ||
          !rel ||
          rel.startsWith("..") ||
          isAbsolute(rel) ||
          image.byteLength > 5_000_000
        )
          throw Error("页图路径、顺序或体积不合法。");
        const png = await readFile(path);
        pixels += png.length;
        if (png.length !== image.byteLength || pixels > 40_000_000)
          throw Error("页图长度或总量超过限制。");
        const jpg = new Uint8Array(
          await sharp(png, { limitInputPixels: 600_000 })
            .jpeg({ quality: 76 })
            .toBuffer(),
        );
        previewBytes += jpg.length;
        if (previewBytes > 5_000_000) throw Error("预览总量超过5MB。");
        const page = await doc.getPage(i + 1),
          viewport = page.getViewport({ scale: 1 }),
          content = await page.getTextContent();
        const items = content.items
          .filter((x: any) => typeof x.str === "string")
          .map((x: any) => ({
            text: x.str,
            x: x.transform[4],
            y: x.transform[5],
            width: x.width,
            height: x.height,
          }));
        chars += items.reduce((n: number, x: PdfItem) => n + x.text.length, 0);
        if (chars > 120_000) throw Error("PDF文字提取超过120000字。");
        pages.push({
          page: i + 1,
          width: viewport.width,
          height: viewport.height,
          items,
          jpg,
          sha256: hash(jpg),
        });
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
    return {
      pdf,
      pages,
      receipt: {
        renderer: "LibreOffice Kit",
        engineApiVersion: ENGINE_VERSION,
        backend: raster.backend,
        rasterEngine: raster.rasterEngine,
        sourceSHA256: hash(bytes),
        pdfSHA256: hash(pdf),
        pageCount: count,
        dpi: 72,
        missingFonts: [
          ...new Set([
            ...(receipt.missingFonts || []),
            ...(raster.missingFonts || []),
          ]),
        ],
        pages: pages.map((p) => ({
          page: p.page,
          file: `pages/${String(p.page).padStart(2, "0")}.jpg`,
          sha256: p.sha256,
        })),
        microsoftWordVerified: false,
      },
    };
  } finally {
    try {
      if (converter) await converter.dispose();
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
}
