import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import sharp from 'sharp';
import type { Output } from './executors';
import { json, out } from './io';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const requireFromHere = createRequire(__filename);

/** Resolve the renderer's own optional engine package without starting it. */
export function presentationRendererAvailable(): boolean {
  try {
    const kitPath = requireFromHere.resolve('@deepseek-ai/libreoffice-kit');
    const kitRequire = createRequire(kitPath);
    const packageNames = process.platform === 'linux'
      ? ['@deepseek-ai/libreoffice-kit-wasm/package.json']
      : [
          `@deepseek-ai/libreoffice-kit-${process.platform}-${process.arch}/package.json`,
          '@deepseek-ai/libreoffice-kit-wasm/package.json',
        ];
    return packageNames.some((name) => {
      try { kitRequire.resolve(name); return true; } catch { return false; }
    });
  } catch {
    return false;
  }
}

export type PresentationRenderResult = {
  report: Record<string, unknown>;
  outputs: Output[];
};

/**
 * Rasterize every physical slide with the already-pinned local LibreOffice Kit.
 * This is a rendering receipt and a visual-review aid, not an automatic visual pass.
 */
export async function renderPresentation(
  pptxBytes: Uint8Array,
  expectedSlides: number,
  event: (message: string) => void = () => {},
): Promise<PresentationRenderResult> {
  if (!presentationRendererAvailable()) throw Error('本机没有安装可用的 LibreOffice PPTX 渲染引擎。');
  if (expectedSlides < 1 || expectedSlides > 50) throw Error('渲染页数超出 1 至 50 页限制。');

  const workDir = await mkdtemp(join(tmpdir(), 'designbuddy-pptx-render-'));
  const inputPath = join(workDir, 'source.pptx');
  const outputDir = join(workDir, 'rendered');
  let converter: { renderImages: (request: any, signal?: AbortSignal) => Promise<any>; dispose: () => Promise<void> } | undefined;
  try {
    await writeFile(inputPath, pptxBytes, { flag: 'wx', mode: 0o600 });
    const { createConverter, ENGINE_VERSION } = await import('@deepseek-ai/libreoffice-kit');
    const activeConverter = await createConverter({
      timeoutMs: 90_000,
      maxInputBytes: 2_000_000,
      maxOutputBytes: 10_000_000,
      maxArchiveEntries: 1500,
      maxUncompressedBytes: 12_000_000,
      fontMetadataCacheDirectory: false,
    });
    converter = activeConverter;
    event('正在用本地 LibreOffice 引擎逐页渲染 PPTX；文档不会发送到外部服务。');
    const rendered = await activeConverter.renderImages({
      inputPath,
      outputDir,
      pages: Array.from({ length: expectedSlides }, (_, index) => index + 1),
      dpi: 48,
      maxPages: 50,
      maxPixels: 300_000,
      maxDimension: 1024,
    });
    if (rendered.rasterEngine !== 'libreoffice') throw Error('PPTX 没有由预期的 LibreOffice 引擎渲染。');
    if (rendered.pageCount !== expectedSlides || rendered.images.length !== expectedSlides) {
      throw Error(`实际渲染页数与预期不符（预期 ${expectedSlides}，文档 ${rendered.pageCount}，图像 ${rendered.images.length}）。`);
    }
    const originalRasterBytes = rendered.images.reduce((sum: number, image: { byteLength: number }) => sum + image.byteLength, 0);
    if (!Number.isSafeInteger(originalRasterBytes) || originalRasterBytes > 60_000_000) throw Error('逐页渲染临时图像总量超过 60 MB 安全上限。');

    const pages: { page: number; filename: string; bytes: Uint8Array; width: number; height: number; sha256: string; sourcePngBytes: number }[] = [];
    for (const [index, image] of rendered.images.entries()) {
      if (!Number.isSafeInteger(image.page) || image.page !== index + 1 || image.byteLength <= 0 || image.byteLength > 8_000_000) {
        throw Error('渲染器返回的页码或图像大小无效。');
      }
      const imagePath = resolve(image.path);
      const fromOutput = relative(resolve(outputDir), imagePath);
      if (!fromOutput || fromOutput === '..' || fromOutput.startsWith(`..${sep}`) || isAbsolute(fromOutput)) throw Error('渲染器图像路径超出受控输出目录。');
      const png = await readFile(imagePath);
      if (png.length !== image.byteLength) throw Error('渲染图像文件长度与 LibreOffice 清单不一致。');
      const preview = await sharp(png, { limitInputPixels: 300_000 }).resize({
        width: 480,
        height: 480,
        fit: 'inside',
        withoutEnlargement: true,
      }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
      const metadata = await sharp(preview).metadata();
      if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height || preview.length > 600_000) {
        throw Error(`第 ${index + 1} 页预览图校验失败。`);
      }
      pages.push({
        page: index + 1,
        filename: `slides/${String(index + 1).padStart(2, '0')}.jpg`,
        bytes: new Uint8Array(preview),
        width: metadata.width,
        height: metadata.height,
        sha256: sha256(preview),
        sourcePngBytes: png.length,
      });
    }

    const columns = Math.min(4, pages.length);
    const tileWidth = 320;
    const tileImageHeight = 180;
    const labelHeight = 28;
    const tileHeight = tileImageHeight + labelHeight;
    const rows = Math.ceil(pages.length / columns);
    const composites: sharp.OverlayOptions[] = [];
    for (const item of pages) {
      const index = item.page - 1;
      const left = (index % columns) * tileWidth;
      const top = Math.floor(index / columns) * tileHeight;
      const thumbnail = await sharp(item.bytes).resize({ width: tileWidth, height: tileImageHeight, fit: 'contain', background: '#FFFFFF' }).jpeg({ quality: 75 }).toBuffer();
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#f7f8f5"/><text x="12" y="19" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="#36423c">Slide ${String(item.page).padStart(2, '0')}</text></svg>`);
      composites.push({ input: thumbnail, left, top });
      composites.push({ input: label, left, top: top + tileImageHeight });
    }
    const contactSheet = await sharp({
      create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: '#e8ece8' },
    }).composite(composites).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    if (contactSheet.length > 1_500_000) throw Error('整份幻灯片联系表超过 1.5 MB 限制。');

    const missingFonts = Array.isArray(rendered.missingFonts)
      ? [...new Set(rendered.missingFonts
        .filter((font: unknown): font is string => typeof font === 'string')
        .map((font: string) => font.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100))
        .filter(Boolean))].slice(0, 50)
      : [];
    const manifest = {
      schemaVersion: 1,
      status: 'rendered-locally',
      sourceSHA256: sha256(pptxBytes),
      renderer: 'LibreOffice via @deepseek-ai/libreoffice-kit',
      engineApiVersion: ENGINE_VERSION,
      backend: rendered.backend,
      rasterEngine: rendered.rasterEngine,
      dpi: rendered.dpi,
      pageCount: rendered.pageCount,
      missingFonts,
      missingFontCount: missingFonts.length,
      pages: pages.map(({ page, filename, width, height, bytes, sha256, sourcePngBytes }) => ({
        page, filename, width, height, previewBytes: bytes.length, sha256, sourcePngBytes,
      })),
      review: {
        renderedByOfficeEngine: true,
        visualReviewRequired: true,
        automaticVisualPass: false,
        textOverflowChecked: false,
        note: 'LibreOffice raster images are visual evidence, not a Microsoft PowerPoint pixel-match or an automatic no-overflow/legibility pass. Check every page image manually; rendering never proves facts, readability, or design quality.',
      },
    };
    const archiveEntries: Record<string, Uint8Array> = Object.fromEntries(pages.map(page => [page.filename, page.bytes]));
    archiveEntries['render-manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
    const archive = zipSync(archiveEntries, { level: 1 });
    if (archive.length > 4_000_000) throw Error('逐页预览包超过 4 MB 输出限制。');
    event(`本地 LibreOffice 已渲染 ${pages.length} 页；输出页图、联系表与渲染记录。${missingFonts.length ? `检测到缺失字体：${missingFonts.slice(0, 5).join('、')}${missingFonts.length > 5 ? ' 等' : ''}。` : ''}仍需人工逐页确认溢出、遮挡、字体替换和对比度。`);

    return {
      report: manifest,
      outputs: [
        out('slide-contact-sheet.jpg', 'image/jpeg', new Uint8Array(contactSheet)),
        out('slide-01-preview.jpg', 'image/jpeg', pages[0].bytes),
        out('rendered-slides.zip', 'application/zip', new Uint8Array(archive)),
        json('render-report.json', manifest),
      ],
    };
  } finally {
    try { if (converter) await converter.dispose(); }
    finally { await rm(workDir, { recursive: true, force: true }); }
  }
}
