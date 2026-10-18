#!/usr/bin/env node
/** Render a DOCX with the LibreOffice engine and save hash-linked PNG page references locally. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConverter, ENGINE_VERSION, ENGINE_VERSIONS } from '@deepseek-ai/libreoffice-kit';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function main(inputArg, outputArg) {
  if (!inputArg || !outputArg) throw Error('Usage: node scripts/render-docx-libreoffice-reference.mjs <input.docx> <new-output-directory>');
  if (!isAbsolute(inputArg) || !isAbsolute(outputArg) || !/\.docx$/i.test(inputArg)) throw Error('Input and output must be absolute paths; input must be a DOCX file.');
  const inputPath = resolve(inputArg), outputDir = resolve(outputArg);
  const input = await readFile(inputPath);
  if (!input.length || input.length > 64 * 1024 * 1024) throw Error('DOCX input must be between 1 byte and 64 MiB.');
  const converter = await createConverter({ timeoutMs: 120_000, maxInputBytes: 64 * 1024 * 1024, maxOutputBytes: 128 * 1024 * 1024, fontMetadataCacheDirectory: false });
  try {
    const rendered = await converter.renderImages({ inputPath, outputDir, pages: 'all', dpi: 96, maxPages: 100, maxPixels: 16_777_216, maxDimension: 8192 });
    const nativeKey = process.platform === 'linux' ? `${process.platform}-${process.arch}-glibc` : `${process.platform}-${process.arch}`;
    const pages = [];
    for (const image of rendered.images) pages.push({ page: image.page, file: image.path.split(/[\\/]/).at(-1), width: image.width, height: image.height, bytes: image.byteLength, sha256: sha256(await readFile(image.path)) });
    const report = {
      schemaVersion: 1,
      source: { filename: inputPath.split(/[\\/]/).at(-1), sha256: sha256(input) },
      renderer: { product: 'LibreOffice', apiVersion: ENGINE_VERSION, engineVersion: rendered.backend === 'wasm' ? ENGINE_VERSIONS.wasm : ENGINE_VERSIONS[nativeKey], backend: rendered.backend, rasterEngine: rendered.rasterEngine },
      pageCount: rendered.pageCount,
      dpi: rendered.dpi,
      missingFonts: rendered.missingFonts,
      pages,
      note: 'LibreOffice engine raster reference. On Linux the pinned package currently uses its WebAssembly build, not the desktop native executable. This is not a Microsoft Word rendering result.'
    };
    await writeFile(resolve(outputDir, 'libreoffice-reference.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ ...report, pages: report.pages.map(({ page, file, width, height, bytes, sha256 }) => ({ page, file, width, height, bytes, sha256 })) }, null, 2) + '\n');
  } finally {
    await converter.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2], process.argv[3]).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
