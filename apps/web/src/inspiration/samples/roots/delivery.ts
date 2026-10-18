import {
  plants,
  colors,
  calculate,
  pages,
  phases,
  money,
  type State,
} from "./model";
import { images } from "./images";
import { table, bookExport } from "../BookExport";
import { escapeHtml as esc, csvValue } from "../media-utils";
import { download } from "../shared";
import { embeddedFontStyle } from "../../../components/scene-demos/fonts";
export function planSVG(s: State) {
  const w = s.width * 100,
    h = s.depth * 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="花园比例示意"><defs><pattern id="rootsgrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#cdd5c6" stroke-width="1"/></pattern></defs><rect width="${w}" height="${h}" fill="#eaf0e3"/><rect width="${w}" height="${h}" fill="url(#rootsgrid)"/><rect x="3" y="3" width="${s.bedW * 100}" height="${s.bedD * 100}" fill="#ceb99a" fill-opacity=".7" stroke="#9a805a"/><rect x="${Math.max(0, w - s.pathW * 100)}" width="${s.pathW * 100}" height="${s.pathL * 100}" fill="#eee6d7"/><g font-family="Noto Sans SC,sans-serif" font-size="11" text-anchor="middle">${plants.map((p, i) => (s.qty[i] ? `<g transform="translate(${s.positions[i].join(" ")})"><circle r="${p.spread / 2}" fill="${colors[i]}" fill-opacity=".7" stroke="#415b42" stroke-width="1.5"/><text y="4" fill="#152e21">${p.name}</text><text y="18" fill="#152e21">${s.qty[i]}株 / 代表点</text></g>` : "")).join("")}</g><text x="8" y="${h - 8}" font-family="Noto Sans SC,sans-serif" font-size="10" fill="#304d3d">${s.width} × ${s.depth} m · 50cm 网格 · 非施工图</text></svg>`;
}
export function jsonExport(s: State) {
  download(
    new Blob(
      [JSON.stringify({ format: "roots-project-v1", state: s }, null, 2)],
      { type: "application/json" },
    ),
    "roots-project.json",
  );
}
export function csvExport(s: State) {
  const c = calculate(s);
  const rows = [
    ["项目", s.project],
    ["名称", "数量", "单位金额", "小计"],
    ...c.rows.map((r) => [r.name, r.qty, r.price, r.qty * r.price]),
    ["税费", "", "", c.tax],
    ["总计", "", "", c.total],
    ["说明", "估算而非采购合同"],
  ];
  download(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "roots-budget.csv",
  );
}
export async function svgExport(s: State) {
  const svg = planSVG(s);
  download(
    new Blob(
      [svg.replace("</svg>", (await embeddedFontStyle(svg)) + "</svg>")],
      { type: "image/svg+xml" },
    ),
    "roots-plan.svg",
  );
}
export async function htmlExport(s: State) {
  const c = calculate(s),
    p = plants[s.selected];
  const extras = [
    table([
      ["项目", s.project],
      ["面积", c.area + " m²"],
    ]),
    table([
      ["简报", s.brief],
      ["气候系数", [1, 1.4, 0.75][s.climate]],
    ]),
    table([
      ["净宽", s.width + " m"],
      ["净深", s.depth + " m"],
      ["面积", c.area + " m²"],
    ]),
    table([
      ["日照", s.sun + " 小时"],
      ["朝向", ["南", "东", "西", "北"][s.orientation]],
    ]),
    table([
      ["土质", ["偏砂", "均衡", "偏黏"][s.soil]],
      ["排水", ["快", "中", "慢"][s.drain]],
      ["pH", s.ph],
    ]),
    table(plants.map((p) => [p.name, p.note])),
    table([
      ["所选植物", p.name],
      ["拉丁名", p.latin],
      ["冠幅", p.spread + " cm"],
      ["说明", p.note],
    ]),
    table(plants.map((p, i) => [p.name, s.qty[i] + " 株"])),
    table(
      plants.map((p, i) => [
        p.name,
        c.compatible[i] ? "光照初筛匹配" : "需要复核光照",
      ]),
    ),
    planSVG(s),
    table([
      ["种植床", `${s.bedW} × ${s.bedD} m / 深 ${s.bedH} cm`],
      ["容积", c.bed + " L"],
    ]),
    table([
      ["单盆估算", c.pot + " L"],
      ["花盆数量", s.pots],
      ["顶部留空", s.headroom + "%"],
    ]),
    table([
      ["总基质", c.litres + " L"],
      ["袋数", c.bags],
      ["估算湿重", c.weight + " kg"],
      ["配方中改良部分", s.mix + "%"],
    ]),
    table([
      ["周用水", c.water + " L"],
      ["雨水可用", c.rain + " L"],
      ["补水估算", c.topup + " L"],
    ]),
    table([
      ["集水面", s.catchment + " m²"],
      ["雨量", s.rain + " mm"],
      ["效率", s.efficiency + "%"],
      ["桶容量", s.tank + " L"],
    ]),
    table([
      ["滴头数量", c.heads],
      ["软管长度", s.hose + " m"],
    ]),
    table([
      ["步道面积", s.pathW * s.pathL + " m²"],
      ["砖数", c.tiles],
      ["损耗", s.waste + "%"],
    ]),
    table(
      ["昆虫观察", "保留枯枝角落", "安全浅水"].map((x, i) => [
        x,
        s.eco[i] ? "计划保留" : "未选择",
      ]),
    ),
    table(
      plants
        .filter((_, i) => s.qty[i])
        .map((p) => [
          p.name,
          (p.months as readonly number[]).includes(s.month + 1)
            ? "参考花期，观察访花昆虫"
            : "观察叶片与基质，按现场情况养护",
        ]),
    ),
    table(s.logs.map((l) => [l.date, l.notes])),
    table([
      ...c.rows.map((r) => [r.name, r.qty + " × " + money(r.price)]),
      ["税费", money(c.tax)],
      ["总计", money(c.total)],
      ["预算差额", money(s.budget - c.total)],
    ]),
    table(phases.map((x, i) => [x, i < s.phase ? "手动复核完成" : "尚未复核"])),
    s.review
      ? table([
          ["评审人", s.review.name],
          ["确认时金额", money(s.review.total)],
          ["确认时面积", s.review.area + " m²"],
          ["状态", s.review.status === "confirmed" ? "本地确认" : "已撤回"],
          ["确认时植物", s.review.selection],
        ])
      : "<p>尚未创建评审快照。</p>",
    "<p>JSON 可恢复编辑；CSV 为估算清单；SVG 与本文不是施工文件。五张概念图均由 AI 单独生成，未复用其他模板；中文字体附 OFL 许可。</p>",
  ];
  await bookExport("roots", s.project, pages, extras, [
    { url: images.courtyard, page: 0, alt: "AI庭院概念" },
    { url: images.soil, page: 4, alt: "AI根系观察" },
    { url: images.sun, page: 6, alt: "AI香草示例" },
    { url: images.shade, page: 17, alt: "AI阴生植物概念" },
    { url: images.tools, page: 19, alt: "AI园艺工具" },
  ]);
}
