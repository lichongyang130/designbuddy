import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(process.env.DESIGNBUDDY_ASSET_ROOT || process.cwd(), "apps/web/src/assets/fonts");
type Font = ReturnType<typeof fontkit.create>;
let manifest: { file: string; ranges: [number, number][] }[] | undefined;
const loaded = new Map<string, { bytes: Uint8Array; font: Font }>();
const selected = new Map<number, { bytes: Uint8Array; font: Font; file: string }>();
export async function fontFor(character: string) {
  const code = character.codePointAt(0)!;
  const cached = selected.get(code); if (cached) return cached;
  if (!manifest) {
    const source = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")) as { file: string; ranges: string }[];
    manifest = source.map(s => ({ file: s.file, ranges: s.ranges.split(",").map(r => { const [a, b] = r.replace(/^U\+/i, "").split("-").map(x => parseInt(x, 16)); return [a, b ?? a] as [number, number]; }) }));
  }
  for (const item of manifest) {
    if (!item.ranges.some(([a, b]) => code >= a && code <= b)) continue;
    let found = loaded.get(item.file);
    if (!found) { const bytes = await readFile(resolve(root, item.file)); found = { bytes, font: fontkit.create(bytes) }; loaded.set(item.file, found); }
    if (found.font.hasGlyphForCodePoint(code)) { const choice = { ...found, file: item.file }; selected.set(code, choice); return choice; }
  }
  throw Error(`字体不支持字符 U+${code.toString(16).toUpperCase()}，请替换该字符后重试，避免导出缺字。`);
}
export const fontLicense = () => readFile(resolve(root, "OFL.txt"));
/** Embed only the local WOFF2 subset shards needed by a portable HTML deliverable. */
export async function embeddedFontSubsets(value: string) {
  const files = new Map<string, Uint8Array>();
  for (const character of new Set([...value].filter(c => c.codePointAt(0)! > 127))) {
    const selected = await fontFor(character);
    files.set(selected.file, selected.bytes);
  }
  const items = manifest || [];
  return [...files].map(([file, bytes]) => {
    const item = items.find(x => x.file === file)!;
    const unicodeRange = item.ranges.map(([a,b]) => a===b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`).join(",");
    return { file, bytes, unicodeRange };
  });
}
/** Outline user text into SVG paths; no platform font dependence or HTML injection. */
export async function textPaths(value: string, x: number, y: number, size: number, maxWidth: number, maxLines: number, color: string) {
  let at = x, baseline = y, lines = 1; const paths: string[] = [];
  for (const character of value) {
    const { font } = await fontFor(character); const glyph = font.glyphForCodePoint(character.codePointAt(0)!); const scale = size / font.unitsPerEm;
    const width = glyph.advanceWidth * scale;
    if (at + width > x + maxWidth) { at = x; baseline += size * 1.4; lines++; }
    if (lines > maxLines) throw Error("文字超出版式空间，请缩短标题或说明。");
    if (character.trim()) paths.push(`<path d="${glyph.path.toSVG()}" transform="translate(${at} ${baseline}) scale(${scale} ${-scale})" fill="${color}"/>`);
    at += width;
  }
  return paths.join("");
}
