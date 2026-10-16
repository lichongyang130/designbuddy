import {
  pages,
  beans,
  calculate,
  label,
  balance,
  money,
  type State,
} from "./model";
import { images } from "./images";
import { bookExport, table } from "../BookExport";
import { download } from "../shared";
import { escapeHtml as esc, csvValue } from "../media-utils";
import { embeddedFontStyle } from "../../../components/scene-demos/fonts";
export const timesValid = (s: State) =>
  s.times[0] < s.times[1] && s.times[1] < s.times[2];
export function recipeSVG(s: State) {
  if (!timesValid(s)) throw Error("请先修正注水时间顺序。");
  const c = calculate(s),
    xs = s.times.map((t) => 60 + (t / s.times[2]) * 500),
    ys = c.pours.map(
      (_, i) =>
        330 -
        (c.pours.slice(0, i + 1).reduce((a, b) => a + b, 0) / c.water) * 230,
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="累计注水示意"><rect width="640" height="420" fill="#f4dfce"/><text x="30" y="35" font-family="Noto Sans SC,sans-serif" font-size="14" fill="#593748">${esc(s.project.slice(0, 24))} / 非实时秤数据</text>${[0, 0.25, 0.5, 0.75, 1].map((n) => `<path d="M60 ${330 - n * 230}H580" stroke="#ceb6a4"/><text x="15" y="${334 - n * 230}" font-size="11" fill="#6f5158">${Math.round(c.water * n)}</text>`).join("")}<polyline points="60,330 ${xs.map((x, i) => x + "," + ys[i]).join(" ")}" fill="none" stroke="#74445b" stroke-width="4"/>${xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="6" fill="#74445b"/><text x="${x}" y="360" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#593748">${s.times[i]} s</text>`).join("")}<text x="30" y="399" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#593748">${s.dose} g / 1:${s.ratio} / ${c.water} ml · 手动配方</text></svg>`;
}
export function jsonExport(s: State) {
  download(
    new Blob(
      [JSON.stringify({ format: "morrow-project-v1", state: s }, null, 2)],
      { type: "application/json" },
    ),
    "morrow-project.json",
  );
}
export function csvExport(s: State) {
  const c = calculate(s),
    rows = [
      ["项目", s.project],
      ["口径", s.mode ? "四期计划" : "单次清单"],
      ["条目", "示例金额"],
      ...c.rows.map((r) => [r.name, r.amount]),
      ["税费", c.tax],
      ["总计", c.total],
      ["声明", "未订阅、未付款、未发货"],
    ];
  download(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "morrow-costs.csv",
  );
}
export async function svgExport(s: State) {
  const svg = recipeSVG(s);
  download(
    new Blob(
      [svg.replace("</svg>", (await embeddedFontStyle(svg)) + "</svg>")],
      { type: "image/svg+xml" },
    ),
    "morrow-recipe.svg",
  );
}
export function requestExport(s: State) {
  download(
    new Blob(
      [
        `MORROW / 未发送售后草稿\n称呼：${s.name}\n沟通意向：${s.contact}\n问题：${s.issue}\n\n未发送、未受理、未退款、未鉴定。请自行联系真实商家。`,
      ],
      { type: "text/plain;charset=utf-8" },
    ),
    "morrow-request.txt",
  );
}
export async function htmlExport(s: State) {
  const c = calculate(s),
    items = (
      xs: { label: string; grams: number; qty: number; unit: number }[],
    ) =>
      table(
        xs.map((x) => [
          x.label,
          `${x.grams}g × ${x.qty} / ${money(x.unit)}每袋`,
        ]),
      );
  const extra = [
    table([
      ["项目", s.project],
      ["图片", "五张专用 AI 概念图，非实物证据"],
    ]),
    table(
      s.preferences.map((v, i) => [["果香", "甜感", "醇厚"][i], v + " / 5"]),
    ),
    table(
      beans.map((b) => [b.name, b.notes + " / " + money(b.price) + "/250g"]),
    ),
    table([
      ["所选豆款", beans[s.bean].name],
      ["风味", beans[s.bean].notes],
    ]),
    table([
      ["拼配启用", s.blend ? "是" : "否"],
      ["比例", s.ratios.join(" / ")],
    ]),
    table([
      ["研磨", ["整豆", "手冲研磨", "意式研磨", "浸泡研磨"][s.grind]],
      ["器具", ["手冲", "意式", "浸泡"][s.method]],
    ]),
    table([
      ["袋规格", s.grams + "g"],
      ["每期袋数", s.qty],
      ["间隔", s.weeks + "周"],
    ]),
    table([
      ["日用量", c.daily + "g"],
      ["周期用量", c.cycleUse + "g"],
      ["库存可用天数", c.coverage],
    ]),
    table([
      ["粉量", s.dose],
      ["粉水比", "1:" + s.ratio],
      ["总水量", c.water + "ml"],
      ["三段水量", c.pours.join(" / ") + "ml"],
      ["参考温度", s.temp + "℃"],
    ]),
    timesValid(s) ? recipeSVG(s) : "<p>时间顺序待修正，未绘制曲线。</p>",
    items(s.cart),
    table([
      ["称呼", s.name],
      ["沟通意向", s.contact],
      ["交付备注", s.delivery],
    ]),
    table(
      s.queue.map((x) => [
        x.date,
        `${x.label} / ${x.grams}g × ${x.qty} / ${x.skip ? "本地跳过" : "本地计划，非发货"}`,
      ]),
    ),
    table([
      ["计划状态", s.paused ? "本地暂停" : "本地启用"],
      ["说明", "没有实际订阅或扣款授权"],
    ]),
    table(
      s.brews.map((b) => [
        b.label,
        `${b.dose}g / 1:${b.ratio} / ${b.temp}℃ / ${b.note}`,
      ]),
    ),
    table(s.tastings.map((t) => [t.rating + "/5", t.note])),
    table([
      ["轮换目标期", s.cycle + 1],
      ["候选单豆", beans[s.replacement].name],
    ]),
    table([
      ["起始示例库存", "500g"],
      ...s.stock.map((x) => [x.note, x.delta + "g"]),
      ["余额", balance(s) + "g"],
    ]),
    table([
      ["烘焙日期", s.roasted],
      ["观察日期", s.observed],
      ["相差天数", c.age],
      ["注意", "不是食品安全或保质期判断"],
    ]),
    table([
      ["礼盒", s.gift],
      ["减少一次性包装意向", s.pack ? "是" : "否"],
    ]),
    table([
      ...c.rows.map((r) => [r.name, money(r.amount)]),
      ["税费", money(c.tax)],
      ["总计", money(c.total)],
    ]),
    table([
      ["售后草稿", s.issue],
      ["状态", "未发送、未受理"],
    ]),
    s.review
      ? table([
          ["冻结称呼", s.review.name],
          ["冻结口径", s.review.mode],
          ...s.review.rows.map((r) => [r.name, money(r.amount)]),
          ["冻结总额", money(s.review.total)],
          ["状态", s.review.withdrawn ? "已撤回" : "本地讨论确认"],
        ])
      : "<p>未冻结讨论稿。</p>",
    "<p>JSON 用于恢复编辑；命名版本只在本机。文件不是订单或配送凭证；五图均为 AI 概念，中文字体附 OFL 许可证。</p>",
  ];
  await bookExport("morrow", s.project, pages, extra, [
    { url: images.ritual, page: 0, alt: "AI晨间咖啡" },
    { url: images.cherries, page: 2, alt: "AI咖啡樱桃" },
    { url: images.beans, page: 4, alt: "AI咖啡豆" },
    { url: images.roaster, page: 18, alt: "AI烘焙工作室" },
    { url: images.parcel, page: 19, alt: "AI包装概念" },
  ]);
}
