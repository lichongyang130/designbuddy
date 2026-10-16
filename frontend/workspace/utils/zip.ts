export interface ZipEntry {
  path: string;
  content: string;
}

const encoder = new TextEncoder();
const CRC_TABLE = new Uint32Array(256);

for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[n] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function write16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

/** Creates a standards-compatible ZIP using the "store" method (no third-party library). */
export function createZipBlob(entries: ZipEntry[]): Blob {
  if (!entries.length) throw new Error("Cannot export an empty project.");
  const seen = new Set<string>();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const stamp = dosTimestamp();
  let localOffset = 0;

  for (const entry of entries) {
    const path = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path.split("/").includes("..")) throw new Error("Project contains an unsafe file path.");
    if (seen.has(path)) throw new Error("Project contains duplicate path: " + path);
    seen.add(path);

    const nameBytes = encoder.encode(path);
    const dataBytes = encoder.encode(entry.content);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800); // UTF-8 file names
    write16(localView, 8, 0); // no compression
    write16(localView, 10, stamp.time);
    write16(localView, 12, stamp.day);
    write32(localView, 14, checksum);
    write32(localView, 18, dataBytes.length);
    write32(localView, 22, dataBytes.length);
    write16(localView, 26, nameBytes.length);
    write16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localChunks.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write16(centralView, 12, stamp.time);
    write16(centralView, 14, stamp.day);
    write32(centralView, 16, checksum);
    write32(centralView, 20, dataBytes.length);
    write32(centralView, 24, dataBytes.length);
    write16(centralView, 28, nameBytes.length);
    write16(centralView, 30, 0);
    write16(centralView, 32, 0);
    write16(centralView, 34, 0);
    write16(centralView, 36, 0);
    write32(centralView, 38, 0);
    write32(centralView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    localOffset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concat(centralChunks);
  const centralOffset = localOffset;
  const centralSize = centralDirectory.length;
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, entries.length);
  write16(endView, 10, entries.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, centralOffset);
  write16(endView, 20, 0);

  const archive = concat([...localChunks, centralDirectory, endRecord]);
  return new Blob([archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer], { type: "application/zip" });
}

export function downloadProjectZip(projectName: string, entries: ZipEntry[]): void {
  const blob = createZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (projectName.trim() || "designbuddy-project").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-") + ".zip";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
