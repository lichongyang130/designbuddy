import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { zipSync } from 'fflate';
import { inspectZip } from './office';
import { pdfOCR } from './pdf-ocr';
import { out, json } from './io';
import { validateSkillOptions } from './contracts';
import type { SkillInput } from './executors';
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** No filesystem extraction. Check the central directory, bounded inflate, lengths and CRC. */
export function readPDFBatch(bytes: Uint8Array) {
  const paths = inspectZip(bytes);
  if (paths.size < 2 || paths.size > 4 || [...paths].some(p => !/^[^/\\\x00-\x1f\x7f]+\.pdf$/i.test(p))) throw Error('请上传只含2至4个PDF、无目录或其他文件的ZIP。');
  const buffer = Buffer.from(bytes); let end = buffer.length - 22;
  while (end >= 0 && !(buffer.readUInt32LE(end) === 0x06054b50 && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length)) end--;
  let position = buffer.readUInt32LE(end + 16), total = 0;
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < paths.size; i++) {
    const method = buffer.readUInt16LE(position + 10), expectedCRC = buffer.readUInt32LE(position + 16), compressed = buffer.readUInt32LE(position + 20), expanded = buffer.readUInt32LE(position + 24);
    const size = buffer.readUInt16LE(position + 28), extra = buffer.readUInt16LE(position + 30), comment = buffer.readUInt16LE(position + 32), offset = buffer.readUInt32LE(position + 42);
    const rawName = buffer.subarray(position + 46, position + 46 + size); const name = new TextDecoder('utf-8', { fatal: true }).decode(rawName);
    total += expanded;
    if (![0,8].includes(method) || !expanded || expanded > 2000000 || total > 6000000) throw Error('ZIP仅支持存储/Deflate压缩，每个PDF≤2MB、合计≤6MB。');
    const localNameSize = buffer.readUInt16LE(offset + 26), start = offset + 30 + localNameSize + buffer.readUInt16LE(offset + 28);
    if (!buffer.subarray(offset + 30, offset + 30 + localNameSize).equals(rawName) || buffer.readUInt16LE(offset + 8) !== method) throw Error('ZIP本地文件名或压缩方式与目录不一致。');
    const body = buffer.subarray(start, start + compressed);
    const decoded = method === 0 ? body : inflateRawSync(body, { maxOutputLength: 2000000 });
    if (decoded.length !== expanded || crc32(decoded) !== expectedCRC) throw Error('ZIP文件长度或CRC校验失败，不处理损坏/截断材料。');
    files.push({ name, bytes: decoded }); position += 46 + size + extra + comment;
  }
  return files;
}
export async function pdfBatch(input: SkillInput, event: (message: string) => void) {
  validateSkillOptions('pdf.ocr-batch', { deduplicate: input.deduplicate, ...(input.parameters ? { parameters: input.parameters } : {}) });
  const files = readPDFBatch(input.bytes); let pages = 0;
  for (const file of files) {
    if (Buffer.from(file.bytes.subarray(0,5)).toString() !== '%PDF-') throw Error(`${file.name}不是真实PDF。`);
    try { const doc = await PDFDocument.load(file.bytes, { updateMetadata: false, throwOnInvalidObject: true }); pages += doc.getPageCount(); }
    catch { throw Error(`${file.name}无法读取或已加密，请提供完整未加密PDF。`); }
    if (pages > 8) throw Error('本次多个PDF合计最多8页；没有只处理前8页。');
  }
  const archive: Record<string, Uint8Array> = {}; let outputBytes = 0;
  const reports: { index: number; filename: string; folder: string; sourceSHA256: string; pageCount: number; recognizedPages: number; pagesWithoutText: number[] }[] = [];
  for (const [i, file] of files.entries()) {
    const folder = `document-${String(i + 1).padStart(2,'0')}`;
    event(`开始文件${i+1}/${files.length}：${file.name}。任何文件失败则整批不交付部分成果。`);
    let result;
    try { result = await pdfOCR({ skillId: 'pdf.ocr', filename: file.name, bytes: file.bytes, deduplicate: false }, message => event(`文件${i+1}：${message}`), {fileIndex:i,resumePages:input.resumePages,onPageCheckpoint:input.onPageCheckpoint}); }
    catch (e) { throw Error(`文件${i+1}（${file.name}）失败，整批未完成：${e instanceof Error ? e.message : 'OCR失败'}`); }
    for (const output of result.outputs) {
      outputBytes += output.bytes.length; if (outputBytes > 8000000) throw Error('批量OCR成果合计超过8MB，整批未交付，请拆分文件。');
      archive[folder + '/' + output.name] = output.bytes;
    }
    const evidence = JSON.parse(Buffer.from(result.outputs.find(o => o.name === 'pdf-ocr-evidence.json')!.bytes).toString('utf8'));
    reports.push({ index: i+1, filename: file.name, folder, sourceSHA256: evidence.sourceSHA256, pageCount: evidence.pageCount, recognizedPages: evidence.recognizedPages, pagesWithoutText: evidence.pagesWithoutText });
  }
  const missing = reports.reduce((n, r) => n + r.pagesWithoutText.length, 0);
  const report = json('batch-report.json', { sourceArchiveSHA256: createHash('sha256').update(input.bytes).digest('hex'), fileCount: files.length, pageCount: pages, pagesWithoutText: missing, files: reports, requiresReview: true, allPagesHaveText: missing === 0, atomicDelivery: true, policy: '文件顺序按ZIP目录；每个文件独立编号目录，内含实际页图、文字和OCR证据。未识别页不代表读取成功，所有内容需对照原PDF复核。任一文件失败不交付部分成果。最多4个PDF、合计8页；没有执行语义摘要/复杂版式还原。' });
  archive['batch-report.json'] = report.bytes;
  return { summary: `实际处理${files.length}个PDF、共${pages}页；${missing}页未识别到文字。${missing ? '存在缺失页，不能视为全文读取完整。' : '文字仍须逐页对照原件复核。'}交付含分文件页图/文字/证据的ZIP及批次清单。`, outputs: [out('batch-ocr-results.zip', 'application/zip', zipSync(archive, { level: 6 })), report] };
}
