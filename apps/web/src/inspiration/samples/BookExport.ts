import { dataUrl, download } from "./shared";
import { escapeHtml as esc } from "./media-utils";
import { embeddedFontStyle } from "../../components/scene-demos/fonts";
export const table = (pairs: (string | number)[][]) =>
  "<dl>" +
  pairs
    .map(([k, v]) => `<dt>${esc(String(k))}</dt><dd>${esc(String(v))}</dd>`)
    .join("") +
  "</dl>";
export async function bookExport(
  name: string,
  title: string,
  pages: readonly (readonly string[])[],
  extras: string[],
  pictures: { url: string; page: number; alt: string }[],
) {
  const assets = await Promise.all(pictures.map((p) => dataUrl(p.url)));
  const sections = pages
    .map(
      (p, i) =>
        `<section id="p${i}"><small>${i + 1} / ${esc(p[0])}</small><h2>${esc(p[1])}</h2><p>${esc(p[2])}</p>${pictures.map((pic, j) => (pic.page === i ? `<img src="${assets[j]}" alt="${esc(pic.alt)}">` : "")).join("")}${extras[i] || ""}</section>`,
    )
    .join("");
  const fonts = (
    await embeddedFontStyle(sections.replace(/data:image\/[^\"]+/g, ""))
  )
    .replace("<metadata>", "<div hidden data-font-license>")
    .replace("</metadata>", "</div>");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{max-width:940px;margin:auto;padding:28px;background:#f3f0e8;color:#233a32;font:16px/1.8 'Noto Sans SC',sans-serif}h1{font-size:36px}h2{font-size:28px}section{padding:40px 0;border-top:1px solid #c6d0c2}img{max-width:100%;max-height:600px;object-fit:contain}svg{display:block;width:100%;max-height:650px}nav{display:flex;gap:12px;flex-wrap:wrap}a{color:inherit}dl{display:grid;grid-template-columns:minmax(80px,1fr) minmax(0,2fr)}dt,dd{margin:0;padding:10px;border-bottom:1px solid #d7d7ce;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}button{font:inherit;padding:10px 18px}@media print{nav,button{display:none}section{break-before:page}img{max-height:500px}}</style><body>${fonts}<header><small>${esc(name)} / PROJECT BOOK</small><h1>${esc(title)}</h1><p>独立阅读方案，不是完整应用源码、订单或付款凭证。所有摄影式图片为 AI 概念作品；不代表真实场地、商品或客户。</p><button onclick="window.print()">打印 / 另存 PDF</button><nav>${pages.map((p, i) => `<a href="#p${i}">${i + 1}. ${esc(p[0])}</a>`).join("")}</nav></header>${sections}</body></html>`;
  download(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    name + "-project.html",
  );
}
