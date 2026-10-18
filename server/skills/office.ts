import { unzipSync } from "fflate";
import { text } from "./io";
/** Validate central-directory sizes before any decompression/library load. */
export function inspectZip(bytes: Uint8Array, options: { allowEmbeddedExcel?: boolean } = {}) {
  const b = Buffer.from(bytes); let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50 && i + 22 + b.readUInt16LE(i + 20) === b.length) { end = i; break; }
  if (end < 0 || b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6)) throw Error("不是受支持的 Office ZIP 文件。");
  const count = b.readUInt16LE(end + 10), start = b.readUInt32LE(end + 16), size = b.readUInt32LE(end + 12);
  if (!count || count > 1500 || start + size !== end || b.readUInt16LE(end + 8) !== count) throw Error("Office 压缩包结构或条目数量不受支持。");
  let pos = start, total = 0; const paths = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || b.readUInt32LE(pos) !== 0x02014b50) throw Error("Office 压缩包损坏。");
    const compressed = b.readUInt32LE(pos + 20), expanded = b.readUInt32LE(pos + 24), n = b.readUInt16LE(pos + 28), e = b.readUInt16LE(pos + 30), c = b.readUInt16LE(pos + 32), offset = b.readUInt32LE(pos + 42);
    const path = b.subarray(pos + 46, pos + 46 + n).toString("utf8");
    total += expanded;
    if (b.readUInt16LE(pos + 8) & 1 || total > 12_000_000 || expanded > 8_000_000 || expanded > Math.max(100_000, compressed * 150) || pos + 46 + n + e + c > end || offset + 30 > start || paths.has(path) || path.includes("..") || path.startsWith("/") || path.includes("\\")) throw Error("压缩包含危险路径、加密内容或解压量超过限制。");
    const embeddedExcel = options.allowEmbeddedExcel && /^ppt\/embeddings\/Microsoft_Excel_Worksheet\d+\.xlsx$/i.test(path);
    if (/vbaProject|externalLinks|activeX|oleObject|ctrlProps/i.test(path) || /embeddings\/[^/]+/i.test(path) && !embeddedExcel) throw Error("不支持宏、外部链接、活动控件或此类嵌入对象。");
    if (b.readUInt32LE(offset) !== 0x04034b50) throw Error("压缩包本地条目损坏。");
    const body = offset + 30 + b.readUInt16LE(offset + 26) + b.readUInt16LE(offset + 28);
    if (body + compressed > start) throw Error("压缩包条目越界。");
    paths.add(path); pos += 46 + n + e + c;
  }
  if (pos !== end) throw Error("压缩包目录不完整。");
  return paths;
}
export function openOffice(bytes: Uint8Array, required: string, options: { allowEmbeddedExcel?: boolean } = {}) {
  const paths = inspectZip(bytes, options);
  if (!paths.has(required)) throw Error("文件真实类型与所选 Office 格式不符。");
  // fflate filter checks original sizes again; never extract files to disk.
  let total = 0;
  const entries = unzipSync(bytes, { filter: entry => {
    total += entry.originalSize;
    if (total > 12_000_000 || entry.originalSize > 8_000_000) throw Error("Office 解压大小超过限制。");
    return /\.xml$|\.rels$/.test(entry.name);
  } });
  let actual = 0;
  for (const [name, bytes] of Object.entries(entries)) {
    actual += bytes.length;
    if (actual > 12_000_000) throw Error("解压内容超过限制。");
    const value = text(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(value)) throw Error("不支持 XML 外部实体声明。");
    if (/\.rels$/.test(name) && /TargetMode\s*=\s*["']External["']/i.test(value)) throw Error("请移除 Office 外部链接后重试。");
  }
  return entries;
}
