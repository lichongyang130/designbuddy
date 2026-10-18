import sharp from "sharp";
import { strToU8, zipSync } from "fflate";
import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const plain = (value: unknown, max: number, required = false): value is string => typeof value === "string" && value.length <= max && (!required || !!value.trim());
function wrap(value: string, width: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width && line) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) throw Error(`文字排版超过${maxLines}行上限；请缩短文案。`);
  return lines;
}
function textLines(lines: string[], x: number, y: number, size: number, color: string, weight = 400, gap = 1.4) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * gap}">${xml(line)}</tspan>`).join("")}</text>`;
}

export async function socialCarousel(input: SkillInput, event: (message: string) => void) {
  let data: any;
  try { data = JSON.parse(text(input.bytes)); } catch { throw Error("轮播图配置必须是有效JSON。"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("配置根节点必须是对象。");
  if (Object.keys(data).some(key => !["title", "brand", "palette", "slides"].includes(key))) throw Error("配置含有不支持的字段。");
  if (!plain(data.title, 80, true)) throw Error("title 必填且最多80字。");
  if (data.brand !== undefined && !plain(data.brand, 40)) throw Error("brand 最多40字。");
  const palette = data.palette;
  if (!palette || typeof palette !== "object" || Object.keys(palette).some(key => !["background", "primary", "accent"].includes(key)) || !isHex(palette.background) || !isHex(palette.primary) || !isHex(palette.accent)) throw Error("palette 必须提供 background、primary、accent 三个十六进制颜色。");
  if (!Array.isArray(data.slides) || data.slides.length < 3 || data.slides.length > 10) throw Error("轮播页数须为3至10页。");
  for (const [i, slide] of data.slides.entries()) {
    if (!slide || typeof slide !== "object" || Array.isArray(slide) || Object.keys(slide).some(key => !["eyebrow", "heading", "body"].includes(key))) throw Error(`第${i + 1}页字段不受支持。`);
    if (!plain(slide.heading, 72, true) || !plain(slide.body, 220, true) || (slide.eyebrow !== undefined && !plain(slide.eyebrow, 32))) throw Error(`第${i + 1}页需要标题和正文；标题最多72字、正文最多220字。`);
  }
  const files: Record<string, Uint8Array> = {};
  const manifest: any[] = [];
  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];
    const heading = wrap(slide.heading, 17, 3);
    const body = wrap(slide.body, 32, 7);
    const eyebrow = slide.eyebrow || data.title;
    const isCover = i === 0;
    const headingSize = isCover ? 82 : 68;
    const headingY = isCover ? 500 : 470;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="${palette.background}"/><circle cx="940" cy="160" r="230" fill="${palette.accent}" opacity=".16"/><path d="M0 1070 Q380 940 1080 1120 V1350 H0Z" fill="${palette.primary}" opacity=".08"/><rect x="76" y="76" width="928" height="1198" rx="38" fill="none" stroke="${palette.primary}" stroke-opacity=".18" stroke-width="2"/><text x="112" y="150" fill="${palette.primary}" font-family="Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="3">${xml(eyebrow.toUpperCase())}</text><rect x="112" y="190" width="92" height="8" rx="4" fill="${palette.accent}"/>${textLines(heading, 112, headingY, headingSize, palette.primary, 700, 1.12)}${textLines(body, 116, headingY + heading.length * headingSize * 1.12 + 56, 34, palette.primary, 400, 1.55)}<text x="112" y="1195" fill="${palette.primary}" fill-opacity=".65" font-family="Arial,sans-serif" font-size="22">${xml(data.brand || "")}</text><text x="968" y="1195" text-anchor="end" fill="${palette.primary}" font-family="Arial,sans-serif" font-size="24" font-weight="700">${String(i + 1).padStart(2, "0")} / ${String(data.slides.length).padStart(2, "0")}</text></svg>`;
    const name = `slide-${String(i + 1).padStart(2, "0")}.png`;
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    if (png.length > 3_000_000) throw Error(`第${i + 1}页渲染结果超过3MB。`);
    files[name] = new Uint8Array(png);
    manifest.push({ file: name, width: 1080, height: 1350, bytes: png.length, heading: slide.heading, bodyCharacters: slide.body.length });
    event(`已实际渲染第${i + 1}/${data.slides.length}页PNG。`);
  }
  const report = { format: "PNG", canvas: { width: 1080, height: 1350, ratio: "4:5" }, pageCount: files ? manifest.length : 0, theme: palette, brand: data.brand || null, pages: manifest, limitations: ["这是受限的确定性版式生成，不是AI文案创作、品牌策略或自由设计。", "只输出图片，不包含可编辑图层文件；请检查字体回退、换行及社交平台压缩效果。", "未发布到社交平台；素材与文案权利由使用者负责。"] };
  files["carousel-report.json"] = strToU8(JSON.stringify(report, null, 2));
  const archive = zipSync(files, { level: 6 });
  event(`完成${manifest.length}张实际渲染的4:5社媒轮播图；未上传或发布。`);
  return { summary: `已按配置生成${manifest.length}张1080×1350 PNG轮播图和处理报告。`, outputs: [out("social-carousel.zip", "application/zip", archive), json("social-carousel-report.json", report)] };
}
