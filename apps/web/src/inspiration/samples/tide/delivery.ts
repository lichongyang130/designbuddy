import {
  pages,
  boats,
  plans,
  courses,
  events,
  calculate,
  money,
  time,
  type State,
} from "./model";
import { images } from "./images";
import { bookExport, table } from "../BookExport";
import { download } from "../shared";
import { escapeHtml as esc, csvValue } from "../media-utils";
import { embeddedFontStyle } from "../../../components/scene-demos/fonts";
export function routeSVG(s: State) {
  const pts = s.points.map(([x, y]) => [x * 6 + 20, y * 3.8 + 25]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="非地理行程草图"><defs><pattern id="tidegrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" stroke="#33516b" fill="none"/></pattern></defs><rect width="640" height="440" fill="#142e45"/><rect width="640" height="440" fill="url(#tidegrid)"/><polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#efa36d" stroke-width="3" stroke-dasharray="8 8"/>${pts.map(([x, y], i) => `<g transform="translate(${x} ${y})"><circle r="14" fill="#f0e5d1"/><text text-anchor="middle" y="5" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#18344c">${i + 1}</text></g>`).join("")}<text x="18" y="425" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#eee6d6">${esc(s.project.slice(0, 20))} / 非地理示意，不可用于导航</text></svg>`;
}
export function jsonExport(s: State) {
  download(
    new Blob(
      [JSON.stringify({ format: "tide-project-v1", state: s }, null, 2)],
      { type: "application/json" },
    ),
    "tide-project.json",
  );
}
export function csvExport(s: State) {
  const c = calculate(s),
    rows = [
      ["项目", s.project],
      ["月份", s.month],
      ["费用条目", "示例金额"],
      ...c.rows.map((r) => [r.name, r.amount]),
      ["税费", c.tax],
      ["总计", c.total],
      ["声明", "不是合同、付款或出航凭证"],
    ];
  download(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "tide-costs.csv",
  );
}
export async function svgExport(s: State) {
  const svg = routeSVG(s);
  download(
    new Blob(
      [svg.replace("</svg>", (await embeddedFontStyle(svg)) + "</svg>")],
      { type: "image/svg+xml" },
    ),
    "tide-schematic.svg",
  );
}
export function contactsExport(s: State) {
  download(
    new Blob(
      [
        `TIDE / 本地联络草稿\n项目：${s.project}\n适用地区：${s.area}\n场地联系人：${s.manager}\n自行核实的应急联系：${s.emergency}\n\n未核验号码、未拨号、未发送求救或定位。不是实际应急服务。请在活动前独立确认信息。`,
      ],
      { type: "text/plain;charset=utf-8" },
    ),
    "tide-contacts.txt",
  );
}
export async function htmlExport(s: State) {
  const c = calculate(s);
  const intentTable = table(
    s.intents.map((b) => [
      b.date + " " + time(b.start),
      `${b.title} / ${boats[b.boat].name} / ${b.people}人 / ${b.minutes}分钟 / ${b.cancelled ? "本地取消" : "意向，未真实预约"}`,
    ]),
  );
  const extras = [
    table([
      ["项目", s.project],
      ["说明", "虚构俱乐部概念，不是实际服务"],
    ]),
    table([
      ["简报", s.brief],
      ["方式", ["岸上交流", "初次学习", "持续学习"][s.aim]],
    ]),
    table([
      ["方案", plans[s.plan].name],
      ["月费", money(plans[s.plan].fee)],
      ["月意向上限", plans[s.plan].hours + "h"],
    ]),
    table([
      ["称呼", s.name],
      ["联系意向", s.contact],
      ["学习目标", s.goal],
    ]),
    table(
      boats.map((b) => [
        b.name,
        b.type + " / " + b.capacity + "人 / " + money(b.rate) + "/h",
      ]),
    ),
    table([
      ["所选船只", boats[s.boat].name],
      ["需求", s.request],
    ]),
    intentTable,
    table(s.crew.map((p) => [p.name, ["协调人", "参与者", "观察者"][p.role]])),
    routeSVG(s) +
      table([
        ["手填距离", c.miles + "海里 / " + c.km + "km"],
        ["纯算术预计", c.duration + "分钟"],
      ]),
    table([
      ["风速手填", s.wind + "kn"],
      ["潮位手填", s.tide + "m"],
      ["来源", s.source || "未记录"],
      ["备注", s.conditions],
      ["结论", "不提供安全可航结论"],
    ]),
    table(
      [
        "装备适配待确认",
        "通信设备待测试",
        "急救配置待核查",
        "现场规则待说明",
      ].map((v, i) => [v, s.equipment[i] ? "个人标记已讨论" : "尚未讨论"]),
    ),
    table(
      courses.map((v, i) => [v, s.course > i ? "手动标记完成" : "尚未完成"]),
    ),
    table(s.skills.map((x) => [x.at, x.note])),
    intentTable,
    table(
      s.logs.map((l) => [
        l.date,
        `${l.miles}海里 / ${l.minutes}分钟 / ${l.note}`,
      ]),
    ),
    table([
      ["月份", s.month],
      ["意向时数", c.hours],
      ["方案剩余", c.remaining],
      ["手动日志时长", c.logMinutes + "分钟"],
    ]),
    table(
      s.trials.map((x, i) => [
        "练习 " + (i + 1),
        `${x.miles}海里 / ${x.minutes}分钟`,
      ]),
    ),
    table(events.map((e, i) => [e.name, s.joins[i] + "人本地意向"])),
    table(
      s.issues.map((x) => [
        x.closed ? "个人跟踪关闭，非技师确认" : "未发送观察",
        x.text,
      ]),
    ),
    table([
      ["自带水杯计划", s.cups],
      ["清洁袋物料", s.bags],
      ["手套双数", s.gloves],
      ["说明", "计划而非已完成清洁成果"],
    ]),
    table([
      ...c.rows.map((r) => [r.name, money(r.amount)]),
      ["税费", money(c.tax)],
      ["总计", money(c.total)],
    ]),
    table([
      ["地区", s.area],
      ["场地联系人", s.manager],
      ["自行核验的应急信息", s.emergency],
    ]),
    s.review
      ? table([
          ["冻结称呼", s.review.name],
          ["冻结月份", s.review.month],
          ["冻结意向", s.review.selection],
          ["冻结金额", money(s.review.total)],
          [
            "状态",
            s.review.status === "confirmed" ? "本地确认，非出航批准" : "已撤回",
          ],
        ])
      : "<p>尚无冻结快照。</p>",
    "<p>此档案不含导航、真实会员或商家业务。图片均为专用 AI 概念图，字体附 OFL；联络资料由用户手动填写且未经验证。没有自动上传、发送或拨号。</p>",
  ];
  await bookExport("tide", s.project, pages, extras, [
    { url: images.harbor, page: 0, alt: "AI码头概念" },
    { url: images.keelboat, page: 4, alt: "AI巡航帆船概念" },
    { url: images.dinghy, page: 11, alt: "AI小帆船概念" },
    { url: images.deck, page: 18, alt: "AI甲板概念" },
    { url: images.clubhouse, page: 17, alt: "AI会所概念" },
  ]);
}
