import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { zipSync } from 'fflate';
import { inspectZip } from './office';
import { pdfOCR } from './pdf-ocr';
import { scoreAccuracy } from './ocr-accuracy';
import { out, json } from './io';
import { validateSkillOptions } from './contracts';
import type { SkillInput } from './executors';
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export type BatchLimits = { maxFiles: number; maxPages: number; concurrency: number; maxPagesPerFile: number; fromEnvironment: string[] };
/** Caps are configurable per deployment; the shipped defaults stay exactly as documented. */
export function batchLimits(): BatchLimits {
  const fromEnvironment: string[] = [];
  const read = (name: string, fallback: number, min: number, max: number) => {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw Error(`${name} 必须是${min}至${max}的整数。`);
    fromEnvironment.push(name);
    return value;
  };
  return {
    maxFiles: read('SKILL_OCR_BATCH_MAX_FILES', 4, 2, 40),
    maxPages: read('SKILL_OCR_BATCH_MAX_PAGES', 8, 1, 400),
    concurrency: read('SKILL_OCR_BATCH_CONCURRENCY', 1, 1, 4),
    maxPagesPerFile: read('SKILL_OCR_MAX_PAGES', 6, 1, 200),
    fromEnvironment,
  };
}
/** No filesystem extraction. Check the central directory, bounded inflate, lengths and CRC. */
export function readPDFBatch(bytes: Uint8Array, limits: BatchLimits = batchLimits()) {
  const paths = inspectZip(bytes);
  const referenceEntries = [...paths].filter(path => path.startsWith('gold-standard/'));
  const pdfEntries = [...paths].filter(path => !path.startsWith('gold-standard/'));
  if (pdfEntries.length < 2 || pdfEntries.length > limits.maxFiles || pdfEntries.some(p => !/^[^/\\\x00-\x1f\x7f]+\.pdf$/i.test(p))) throw Error(`请上传只含2至${limits.maxFiles}个PDF、无目录或其他文件的ZIP。`);
  if (referenceEntries.some(path => !/^gold-standard\/[^/\\\x00-\x1f\x7f]+\.txt$/i.test(path))) throw Error('参考文本只允许放在 gold-standard/ 目录下的 .txt 文件。');
  const buffer = Buffer.from(bytes); let end = buffer.length - 22;
  while (end >= 0 && !(buffer.readUInt32LE(end) === 0x06054b50 && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length)) end--;
  let position = buffer.readUInt32LE(end + 16), total = 0;
  const files: { name: string; bytes: Uint8Array }[] = [];
  const references: { name: string; text: string }[] = [];
  for (let i = 0; i < paths.size; i++) {
    const method = buffer.readUInt16LE(position + 10), expectedCRC = buffer.readUInt32LE(position + 16), compressed = buffer.readUInt32LE(position + 20), expanded = buffer.readUInt32LE(position + 24);
    const size = buffer.readUInt16LE(position + 28), extra = buffer.readUInt16LE(position + 30), comment = buffer.readUInt16LE(position + 32), offset = buffer.readUInt32LE(position + 42);
    const rawName = buffer.subarray(position + 46, position + 46 + size); const name = new TextDecoder('utf-8', { fatal: true }).decode(rawName);
    if (!referenceEntries.includes(name)) total += expanded;
    if (![0, 8].includes(method) || !expanded || expanded > 2000000 || total > 6000000) throw Error('ZIP仅支持存储/Deflate压缩，每个PDF≤2MB、合计≤6MB。');
    const localNameSize = buffer.readUInt16LE(offset + 26), start = offset + 30 + localNameSize + buffer.readUInt16LE(offset + 28);
    if (!buffer.subarray(offset + 30, offset + 30 + localNameSize).equals(rawName) || buffer.readUInt16LE(offset + 8) !== method) throw Error('ZIP本地文件名或压缩方式与目录不一致。');
    const body = buffer.subarray(start, start + compressed);
    const decoded = method === 0 ? body : inflateRawSync(body, { maxOutputLength: 2000000 });
    if (decoded.length !== expanded || crc32(decoded) !== expectedCRC) throw Error('ZIP文件长度或CRC校验失败，不处理损坏/截断材料。');
    if (name.startsWith('gold-standard/')) references.push({ name: name.slice('gold-standard/'.length), text: Buffer.from(decoded).toString('utf8') });
    else files.push({ name, bytes: decoded });
    position += 46 + size + extra + comment;
  }
  return { files, references };
}
async function pool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
export async function pdfBatch(input: SkillInput, event: (message: string) => void) {
  validateSkillOptions('pdf.ocr-batch', { deduplicate: input.deduplicate, ...(input.parameters ? { parameters: input.parameters } : {}) });
  const limits = batchLimits();
  const { files, references } = readPDFBatch(input.bytes, limits); let pages = 0;
  for (const file of files) {
    if (Buffer.from(file.bytes.subarray(0, 5)).toString() !== '%PDF-') throw Error(`${file.name}不是真实PDF。`);
    try { const doc = await PDFDocument.load(file.bytes, { updateMetadata: false, throwOnInvalidObject: true }); pages += doc.getPageCount(); }
    catch { throw Error(`${file.name}无法读取或已加密，请提供完整未加密PDF。`); }
    if (pages > limits.maxPages) throw Error(`本次多个PDF合计最多${limits.maxPages}页；没有只处理前${limits.maxPages}页。`);
  }
  const archive: Record<string, Uint8Array> = {}; let outputBytes = 0;
  const reports: { index: number; filename: string; folder: string; sourceSHA256: string; pageCount: number; recognizedPages: number; pagesWithoutText: number[]; accuracy: unknown }[] = [];
  const results = await pool(files, limits.concurrency, async (file, i) => {
    const folder = `document-${String(i + 1).padStart(2, '0')}`;
    event(`开始文件${i + 1}/${files.length}：${file.name}。任何文件失败则整批不交付部分成果。`);
    let result;
    try { result = await pdfOCR({ skillId: 'pdf.ocr', filename: file.name, bytes: file.bytes, deduplicate: false }, message => event(`文件${i + 1}：${message}`), { fileIndex: i, resumePages: input.resumePages, onPageCheckpoint: input.onPageCheckpoint, maxPages: limits.maxPagesPerFile }); }
    catch (e) { throw Error(`文件${i + 1}（${file.name}）失败，整批未完成：${e instanceof Error ? e.message : 'OCR失败'}`); }
    const evidence = JSON.parse(Buffer.from(result.outputs.find(o => o.name === 'pdf-ocr-evidence.json')!.bytes).toString('utf8'));
    const recognizedText = evidence.pages.map((page: { text: string }) => page.text).join('\n');
    const reference = references.find(item => item.name.replace(/\.txt$/i, '') === file.name.replace(/\.pdf$/i, ''));
    const accuracy = reference
      ? { referenceFile: `gold-standard/${reference.name}`, referenceSHA256: createHash('sha256').update(reference.text).digest('hex'), ...scoreAccuracy(recognizedText, reference.text) }
      : { referenceFile: '', note: '未提供人工参考文本，未计算字错率。' };
    return { index: i + 1, filename: file.name, folder, sourceSHA256: evidence.sourceSHA256, pageCount: evidence.pageCount, recognizedPages: evidence.recognizedPages, pagesWithoutText: evidence.pagesWithoutText, accuracy, outputs: result.outputs };
  });
  for (const result of results) {
    for (const output of result.outputs) {
      outputBytes += output.bytes.length; if (outputBytes > 8000000) throw Error('批量OCR成果合计超过8MB，整批未交付，请拆分文件。');
      archive[result.folder + '/' + output.name] = output.bytes;
    }
    const { outputs, ...report } = result; reports.push(report);
  }
  const missing = reports.reduce((n, r) => n + r.pagesWithoutText.length, 0);
  const scored = reports.filter(report => (report.accuracy as { referenceCharacters?: number }).referenceCharacters);
  const totalErrors = scored.reduce((n, report) => n + (report.accuracy as { errors: number }).errors, 0);
  const totalReference = scored.reduce((n, report) => n + (report.accuracy as { referenceCharacters: number }).referenceCharacters, 0);
  const report = json('batch-report.json', {
    sourceArchiveSHA256: createHash('sha256').update(input.bytes).digest('hex'), fileCount: files.length, pageCount: pages, pagesWithoutText: missing, files: reports,
    accuracy: { scoredFiles: scored.length, totalErrors, totalReferenceCharacters: totalReference, characterErrorRate: totalReference ? totalErrors / totalReference : null, note: '字错率以人工参考文本为分母；未提供参考文本的文件不计入，也不能因此被当作通过。' },
    limits: { ...limits, note: '默认上限与已发布说明一致；配置项仅由服务端环境变量设定，调用方不能在上传文件里放大限制。' },
    requiresReview: true, allPagesHaveText: missing === 0, atomicDelivery: true,
    policy: '文件顺序按ZIP目录；每个文件独立编号目录，内含实际页图、文字和OCR证据。未识别页不代表读取成功，所有内容需对照原PDF复核。任一文件失败不交付部分成果。参考文本只允许放在 gold-standard/ 目录，按文件名与PDF一一对应，参考文本必须由人工校对。'
      + `默认最多${limits.maxFiles}个PDF、合计${limits.maxPages}页、单文件${limits.maxPagesPerFile}页；没有执行语义摘要/复杂版式还原。`,
  });
  archive['batch-report.json'] = report.bytes;
  return { summary: `实际处理${files.length}个PDF、共${pages}页；${missing}页未识别到文字。${missing ? '存在缺失页，不能视为全文读取完整。' : '文字仍须逐页对照原件复核。'}${scored.length ? `已对${scored.length}份人工参考文本计算字错率。` : '未提供人工参考文本，未计算字错率。'}交付含分文件页图/文字/证据的ZIP及批次清单。`, outputs: [out('batch-ocr-results.zip', 'application/zip', zipSync(archive, { level: 6 })), report] };
}
