import {
  pages,
  quote,
  money,
  summary,
  measurements,
  schedule,
  colors,
  fabrics,
  silhouettes,
  stages,
  type State,
} from "./model";
import { images } from "./images";
import { escapeHtml as esc, csvValue } from "../media-utils";
import { dataUrl, download } from "../shared";
import { embeddedFontStyle } from "../../../components/scene-demos/fonts";
export function technical(s: State) {
  const shoulder = Math.max(90, Math.min(210, s.measures.shoulder * 3.2)),
    half = shoulder / 2,
    body = Math.max(90, Math.min(195, (s.measures.chest + s.ease[0]) * 1.4)),
    end = Math.max(190, Math.min(385, 70 + s.measures.length * 3.3)),
    sleeve = Math.max(130, Math.min(370, 80 + s.measures.sleeve * 3.3));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 510" role="img" aria-label="${esc("上装技术示意：" + summary(s))}"><rect width="480" height="510" fill="#efede6"/><g fill="${colors[s.color][1]}" stroke="#171717" stroke-width="2"><path d="M${240 - half} 80 L220 60 L260 60 L${240 + half} 80 L${240 + half + 52} ${sleeve} L${240 + half + 20} ${sleeve + 12} L${240 + body / 2 - 4} 160 L${240 + body / 2} ${end} L${240 - body / 2} ${end} L${240 - body / 2 + 4} 160 L${240 - half - 20} ${sleeve + 12} L${240 - half - 52} ${sleeve} Z"/></g><g fill="none" stroke="#d7d0bd" stroke-width="2"><path d="${s.lapel === 2 ? "M220 60 Q180 140 240 210 Q300 140 260 60" : s.lapel === 1 ? "M220 60 L185 120 L205 110 L240 210 L275 110 L295 120 L260 60" : "M220 60 L205 108 L193 104 L240 210 L287 104 L275 108 L260 60"}"/><path d="M240 210 L240 ${end}"/>${s.pocket === 0 ? '<path d="M180 245 h40 m40 0 h40"/>' : '<rect x="175" y="230" width="42" height="40"/><rect x="263" y="230" width="42" height="40"/>'}<circle cx="247" cy="223" r="3"/><circle cx="247" cy="250" r="3"/></g><g font-family="Noto Sans SC,sans-serif" fill="#282528" font-size="13"><text x="22" y="28">ATELIER / TECHNICAL STUDY</text><text x="240" y="440" text-anchor="middle">肩宽 ${s.measures.shoulder} / 袖长 ${s.measures.sleeve} / 衣长 ${s.measures.length} cm</text><text x="240" y="465" text-anchor="middle">${esc(colors[s.color][0])} · ${esc(s.monogram || "无绣字")} · 仅示意，不可作为裁剪纸样</text><text x="240" y="490" text-anchor="middle">目标胸围 ${s.measures.chest + s.ease[0]} cm</text></g></svg>`;
}
export function board(s: State) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 540" role="img" aria-label="可编辑搭配板"><rect width="540" height="540" fill="#e7e3d9"/><path d="M0 270H540M270 0V540" stroke="#c6beb0" stroke-dasharray="4"/><g transform="translate(${s.board[0].join(" ")})" fill="${colors[s.color][1]}"><path d="M10 20L45 0H85L120 20L140 130L110 140L100 70L100 200H25L25 70L15 140L-10 130Z"/></g><g transform="translate(${s.board[1].join(" ")})" fill="#faf7ef" stroke="#aaa"><path d="M0 20L25 0H70L95 20L110 65L80 75V175H15V75L-15 65Z"/></g><g transform="translate(${s.board[2].join(" ")})" fill="#754534"><rect width="110" height="32" rx="8"/><rect x="75" y="-4" width="30" height="40" rx="4" fill="none" stroke="#b18b57" stroke-width="6"/></g></svg>`;
}
export function exportJSON(s: State) {
  download(
    new Blob(
      [
        JSON.stringify(
          {
            format: "atelier-project-v1",
            state: s,
            disclosure: "AI 概念图；本地演示方案，非商家订单。",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "atelier-project.json",
  );
}
export function exportCSV(s: State) {
  const q = quote(s);
  const rows = [
    ["项目", s.project],
    ["配置", summary(s)],
    ["项目", "单件金额", "件数", "合计"],
    ...q.lines.map((l) => [
      l.label,
      l.amount,
      s.quantity,
      l.amount * s.quantity,
    ]),
    ["折扣", "", `${s.discount}%`, -q.discount],
    ["税费", "", `${s.tax}%`, q.tax],
    ["总计", "", "", q.total],
    ["声明", "示例计算；非付款凭证"],
  ];
  download(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "atelier-quote.csv",
  );
}
export async function exportSVG(s: State) {
  const svg = technical(s);
  const fonts = await embeddedFontStyle(svg);
  download(
    new Blob([svg.replace("</svg>", fonts + "</svg>")], {
      type: "image/svg+xml",
    }),
    "atelier-technical.svg",
  );
}
export function alterationText(s: State) {
  return `ATELIER / 改衣沟通草稿\n项目：${s.project}\n客户：${s.client}\n联系方式：${s.contact}\n部位：${["肩部", "袖长", "腰部", "裤长"][s.issue]}\n问题：${s.alteration}\n沟通方式：${s.returnMethod ? "远程先咨询" : "到店意向"}\n此文档未发送、未受理，不承诺改衣范围或费用。`;
}
export async function exportHTML(s: State) {
  const pictures = await Promise.all(Object.values(images).map(dataUrl)),
    q = quote(s),
    dates = schedule(s).dates;
  const list = (pairs: (string | number)[][]) =>
    "<dl>" +
    pairs
      .map(([k, v]) => `<dt>${esc(String(k))}</dt><dd>${esc(String(v))}</dd>`)
      .join("") +
    "</dl>";
  const measureTable = list(
    measurements.map((m) => [m.label, s.measures[m.key] + " cm"]),
  );
  const extras = [
    `<img src="${pictures[0]}" alt="AI生成的服饰概念形象">`,
    list([
      ["项目", s.project],
      ["简报", s.brief],
      ["场合", ["日常通勤", "正式聚会", "旅行"][s.occasion]],
    ]),
    list([
      ["廓形", silhouettes[s.silhouette].name],
      ["意图", silhouettes[s.silhouette].note],
    ]),
    `<img src="${pictures[2]}" alt="AI面料概念">` +
      list([
        ["面料", fabrics[s.fabric].name],
        ["成分", fabrics[s.fabric].composition],
        ["克重", fabrics[s.fabric].weight + " g/m²"],
      ]),
    list([
      ["色彩", colors[s.color][0]],
      ["屏幕色值", colors[s.color][1]],
    ]),
    list([
      ["驳领", ["平驳领", "戗驳领", "青果领"][s.lapel]],
      ["开衩", ["双开衩", "单开衩", "无开衩"][s.vent]],
      ["口袋", ["翻盖袋", "贴袋"][s.pocket]],
    ]),
    list([
      ["裤褶", ["无褶", "单褶", "双褶"][s.pleat]],
      ["腰部", ["腰袢", "侧调节扣"][s.waistband]],
      ["裤脚", ["平脚", "翻边"][s.hem]],
    ]),
    list([
      ["内里", ["全里", "半里", "无里"][s.lining]],
      ["绣字", s.monogram || "无"],
    ]),
    `<img src="${pictures[4]}" alt="AI量体工具概念">` +
      list(measurements.map((m) => [m.label, m.guide])),
    measureTable,
    list(
      ["胸", "腰", "臀"].map((v, i) => [
        v + "部目标围度",
        s.measures[(["chest", "waist", "hip"] as const)[i]] + s.ease[i] + " cm",
      ]),
    ),
    technical(s),
    board(s) + `<p>${esc(s.boardNotes)}</p>`,
    `<img src="${pictures[1]}" alt="AI缝制概念">` +
      list([
        ["结构", ["半麻衬", "全麻衬"][s.construction]],
        ["挑缝", s.handwork ? "选择手工挑缝" : "标准制作"],
      ]),
    list(stages.map((n, i) => [n, dates[i]])),
    list([
      ["日期", s.appointmentDate],
      ["时段", ["10:00", "14:00", "16:30"][s.slot]],
      ["方式", s.meeting ? "远程沟通" : "到店意向"],
      ["状态", s.appointmentSaved ? "已保存意向，未预约" : "未保存意向"],
    ]),
    list([
      ["称呼", s.client],
      ["联系方式", s.contact],
      ["资料授权", s.consent ? "同意用于此方案" : "未确认"],
    ]),
    list([
      ...q.lines.map((l) => [l.label, money(l.amount)]),
      ["件数", s.quantity],
      ["折扣", money(q.discount)],
      ["税费", money(q.tax)],
      ["总额", money(q.total)],
    ]),
    list(s.fittings.map((f) => [f.at, f.notes])),
    s.order
      ? list([
          ["本地演示单", s.order.id],
          ["确认时配置", s.order.summary],
          ["确认时金额", money(s.order.total)],
          ["确认时件数", s.order.quantity],
          ["确认时折扣", money(s.order.discountAmount)],
          ["确认时税费", money(s.order.taxAmount)],
          ["确认时联系", s.order.contact],
          ["状态", s.order.status === "active" ? "本地有效" : "本地已取消"],
        ])
      : "<p>尚未生成演示单；没有订单、支付或库存动作。</p>",
    list(
      stages.map((n, i) => [
        n,
        s.order && i < s.order.progress ? "手动标记完成" : "尚未完成",
      ]),
    ),
    `<img src="${pictures[3]}" alt="AI衣物细节概念"><p>${esc(fabrics[s.fabric].care)}</p>`,
    `<pre>${esc(alterationText(s))}</pre>`,
    "<p>项目包含 24 个内容页面，JSON 另行导出以便继续编辑。全部五张图片为本项目新生成的 AI 概念图，不代表真实商品、模特代言或营业场所。字体使用 Noto Sans SC，遵循随文件附带的 OFL 许可。</p>",
  ];
  const chapters = pages
    .map(
      (p, i) =>
        `<section id="p${i}"><small>${String(i + 1).padStart(2, "0")} / ${p[0]}</small><h2>${esc(p[1])}</h2><p>${esc(p[2])}</p>${extras[i]}</section>`,
    )
    .join("");
  const text = chapters.replace(/data:image\/[^\"]+/g, "");
  const fonts = (await embeddedFontStyle(text))
    .replace("<metadata>", "<div hidden data-font-license>")
    .replace("</metadata>", "</div>");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.project)} / ATELIER</title><style>body{margin:0;background:#eeeae1;color:#242122;font:16px/1.8 'Noto Sans SC',sans-serif}header,main{max-width:900px;margin:auto;padding:32px}h1{font-size:clamp(26px,5vw,50px)}h2{font-size:30px}nav{display:flex;gap:10px;flex-wrap:wrap}a{color:#771b28}section{padding:40px 0;border-top:1px solid #b8afa1}img{max-width:100%;max-height:640px;object-fit:contain}svg{display:block;width:min(100%,480px)}dl{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr)}dt,dd{margin:0;padding:10px 0;border-bottom:1px solid #d4cabb;overflow-wrap:anywhere}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{font:inherit}button{font:inherit;padding:10px 18px}@media print{nav,button{display:none}section{break-before:page}img,svg{max-height:600px}}</style></head><body>${fonts}<header><small>ATELIER / PERSONAL EDITION</small><h1>${esc(s.project)}</h1><p>独立方案快照 · 非生产纸样 / 合同 / 订单或付款凭据</p><button onclick="window.print()">打印 / 另存 PDF</button><nav>${pages.map((p, i) => `<a href="#p${i}">${i + 1}. ${p[0]}</a>`).join("")}</nav></header><main>${chapters}</main></body></html>`;
  download(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    "atelier-project.html",
  );
}
