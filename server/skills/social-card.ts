import sharp from "sharp";
import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

const validHex = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const wrapText = (value: string, maxChars: number, maxLines: number) => {
  const lines: string[] = []; let line = "";
  for (const char of value.trim()) {
    if (line.length >= maxChars) { lines.push(line); line = ""; }
    line += char;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) throw Error(`文字超过${maxLines}行排版限制，请缩短内容。`);
  return lines;
};
const svgText = (lines: string[], x: number, y: number, size: number, fill: string, weight: number, lineHeight: number) => `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? lineHeight : 0}">${xml(line)}</tspan>`).join("")}</text>`;

export async function socialCard(input: SkillInput, event: (message: string) => void) {
  let data: any;
  try { data = JSON.parse(text(input.bytes)); } catch { throw Error("卡片配置必须是有效JSON。"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("卡片配置根节点必须是对象。");
  const allowed = ["title", "subtitle", "category", "brand", "points", "palette"];
  if (Object.keys(data).some(key => !allowed.includes(key))) throw Error("卡片配置含有不支持字段。");
  if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 30) throw Error("标题必填且最多30字。");
  for (const field of ["subtitle", "category", "brand"]) if (data[field] !== undefined && (typeof data[field] !== "string" || data[field].length > (field === "subtitle" ? 44 : 32))) throw Error(`${field} 字段长度或类型不合法。`);
  if (!Array.isArray(data.points) || data.points.length < 2 || data.points.length > 5 || data.points.some((item: unknown) => typeof item !== "string" || !item.trim() || item.length > 42)) throw Error("points 必须是2至5条文字，每条最多42字。");
  const p = data.palette;
  if (!p || typeof p !== "object" || Object.keys(p).some((k: string) => !["background", "ink", "accent"].includes(k)) || !validHex(p.background) || !validHex(p.ink) || !validHex(p.accent)) throw Error("palette 需要 background、ink、accent 三种十六进制颜色。");
  const title = wrapText(data.title, 10, 4);
  const subtitle = data.subtitle ? wrapText(data.subtitle, 22, 2) : [];
  const points = data.points.map((item: string) => wrapText(item, 21, 2));
  const pointGroups = points.map((lines: string[], i: number) => `<g><circle cx="130" cy="${790 + i * 96}" r="19" fill="${p.accent}"/><text x="130" y="${798 + i * 96}" text-anchor="middle" fill="${p.background}" font-family="Arial,sans-serif" font-size="20" font-weight="700">${i + 1}</text>${svgText(lines, 178, 798 + i * 96, 29, p.ink, 500, 38)}</g>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><rect width="1080" height="1440" fill="${p.background}"/><circle cx="1010" cy="60" r="320" fill="${p.accent}" opacity=".12"/><path d="M0 1180 C250 1060 520 1290 1080 1090 V1440 H0Z" fill="${p.accent}" opacity=".09"/><rect x="58" y="58" width="964" height="1324" rx="44" fill="none" stroke="${p.ink}" stroke-opacity=".13" stroke-width="2"/><text x="116" y="162" fill="${p.accent}" font-family="Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="4">${xml((data.category || "NOTES").toUpperCase())}</text><rect x="116" y="204" width="88" height="8" rx="4" fill="${p.accent}"/>${svgText(title, 116, 390, 82, p.ink, 700, 1.14)}${subtitle.length ? svgText(subtitle, 120, 390 + title.length * 92 + 26, 32, p.ink, 400, 45) : ""}${pointGroups}<text x="116" y="1290" fill="${p.ink}" fill-opacity=".68" font-family="Arial,sans-serif" font-size="23">${xml(data.brand || "")}</text><text x="964" y="1290" text-anchor="end" fill="${p.accent}" font-family="Arial,sans-serif" font-size="22" font-weight="700">收藏灵感 · 分享日常</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  const metadata = await sharp(png).metadata();
  if (png.length > 4_000_000 || metadata.width !== 1080 || metadata.height !== 1440) throw Error("卡片图像尺寸或文件大小校验失败。");
  const report = { skill: "social.card", version: "1.0.0", format: "PNG", width: 1080, height: 1440, ratio: "3:4", bytes: png.length, title: data.title, pointCount: data.points.length, palette: p, limitations: ["确定性矢量模板，不调用图像模型、不生成或搜索图片。", "使用者提供文案及颜色；不检查平台规范、版权、商标或内容真实性。", "请在目标平台预览并检查字体回退、裁切和压缩效果。"] };
  event("已实际渲染1080×1440 PNG卡片并校验尺寸；未访问平台或上传发布。");
  return { summary: "已生成可下载的3:4社媒封面PNG及处理报告。", outputs: [out("social-cover-card.png", "image/png", png), json("social-cover-report.json", report)] };
}
