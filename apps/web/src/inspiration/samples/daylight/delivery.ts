import {
  pages,
  resources,
  events,
  time,
  cost,
  estimate,
  money,
  type State,
} from "./model";
import { images } from "./images";
import { bookExport, table } from "../BookExport";
import { download } from "../shared";
import { escapeHtml as esc, csvValue } from "../media-utils";
import { embeddedFontStyle } from "../../../components/scene-demos/fonts";
export function seating(s: State) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="团队座位示意"><rect width="640" height="440" fill="#f5f2eb"/><text x="28" y="32" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#243957">DAYLIGHT / TEAM SEATING · 非疏散或门禁图</text>${s.seats.map((id, i) => `<g transform="translate(${30 + (i % 4) * 155} ${70 + Math.floor(i / 4) * 120})"><rect width="130" height="80" rx="10" fill="${id ? "#dce7ff" : "#e5e2dc"}" stroke="#a4afc0"/><text x="12" y="24" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#263c5a">DESK ${String(i + 1).padStart(2, "0")}</text><text x="12" y="55" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#263c5a">${esc(s.members.find((m) => m.id === id)?.name.slice(0, 7) || "未分配")}</text></g>`).join("")}</svg>`;
}
export function jsonExport(s: State) {
  download(
    new Blob(
      [JSON.stringify({ format: "daylight-project-v1", state: s }, null, 2)],
      { type: "application/json" },
    ),
    "daylight-project.json",
  );
}
export function csvExport(s: State) {
  const rows = [
    ["项目", s.project],
    [
      "预约主题",
      "东京日期",
      "资源",
      "开始",
      "结束",
      "人数",
      "示例费用",
      "状态",
    ],
    ...s.bookings.map((b) => [
      b.title,
      b.date,
      resources[b.resource].name,
      time(b.start),
      time(b.start + b.duration),
      b.people,
      cost(b),
      b.cancelled ? "本地已取消" : b.checked ? "本地已签到" : "本地有效",
    ]),
  ];
  download(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    "daylight-bookings.csv",
  );
}
const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function calendar(s: State) {
  const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, ""),
    at = (date: string, n: number) =>
      date.replaceAll("-", "") + "T" + time(n).replace(":", "") + "00";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DesignBuddy//DAYLIGHT Local Plan//ZH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Tokyo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:JST",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...s.bookings
      .filter((b) => !b.cancelled)
      .flatMap((b) => [
        "BEGIN:VEVENT",
        `UID:${icsText(b.id)}@daylight.invalid`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Tokyo:${at(b.date, b.start)}`,
        `DTEND;TZID=Asia/Tokyo:${at(b.date, b.start + b.duration)}`,
        `SUMMARY:${icsText(b.title)}`,
        `DESCRIPTION:${icsText(resources[b.resource].name + " / " + b.people + "人 / 仅本地规划，非真实预约")}`,
        "END:VEVENT",
      ]),
    "END:VCALENDAR",
  ];
  const encoder = new TextEncoder();
  const folded =
    lines
      .map((line) => {
        const parts: string[] = [];
        let part = "";
        for (const ch of line) {
          if (encoder.encode(part + ch).length > 75) {
            parts.push(part);
            part = " ";
          }
          part += ch;
        }
        parts.push(part);
        return parts.join("\r\n");
      })
      .join("\r\n") + "\r\n";
  download(
    new Blob([folded], { type: "text/calendar;charset=utf-8" }),
    "daylight-calendar.ics",
  );
}
export async function svgExport(s: State) {
  const svg = seating(s);
  download(
    new Blob(
      [svg.replace("</svg>", (await embeddedFontStyle(svg)) + "</svg>")],
      { type: "image/svg+xml" },
    ),
    "daylight-seating.svg",
  );
}
export async function htmlExport(s: State) {
  const q = estimate(s);
  const bookingTable = (resource?: number) =>
    table(
      s.bookings
        .filter(
          (b) =>
            !b.cancelled && (resource === undefined || b.resource === resource),
        )
        .map((b) => [
          b.date + " " + time(b.start),
          b.title + " / " + b.people + " 人 / " + resources[b.resource].name,
        ]),
    );
  const extras = [
    table([
      ["项目", s.project],
      ["团队规模", s.teamSize],
    ]),
    table([
      ["工作简报", s.brief],
      ["偏好", ["独立专注", "小组协作", "内容创作"][s.mode]],
    ]),
    table([
      ["时间范围", "08:00–20:00"],
      ["时区", "Asia/Tokyo"],
      ["地点", "虚构样板，非实际地址"],
    ]),
    table(
      resources.map((r) => [
        r.name,
        r.capacity + "人 / " + money(r.rate) + " 每" + r.unit,
      ]),
    ),
    bookingTable(0),
    bookingTable(1),
    bookingTable(2) +
      table(
        ["双麦克风", "耳机监听", "屏幕演示"].map((x, i) => [
          x,
          s.equipment[i] ? "需要" : "不需要",
        ]),
      ),
    table([
      ["通行方案", ["人时", "人日", "人月"][s.pass]],
      ["团队", s.teamSize],
      ["单位数", s.days],
      ["独立通行预算", money(q.passCost)],
    ]),
    table(s.members.map((m) => [m.name, ["发起人", "协作者", "访客"][m.role]])),
    seating(s),
    bookingTable(),
    table([
      ...q.rows.map((r) => [r.name, money(r.amount)]),
      ["税费", money(q.tax)],
      ["总计", money(q.total)],
    ]),
    table(
      s.bookings
        .filter((b) => !b.cancelled)
        .map((b) => [b.title, b.checked ? "本地已签到" : "未签到"]),
    ),
    table([
      ["咖啡", s.coffee],
      ["打印页数", s.prints],
      ["储物柜日数", s.lockers],
    ]),
    table(events.map((e, i) => [e.name, s.joins[i] + "人意向 / 非真实报名"])),
    bookingTable(),
    table([
      ["专注时长", s.focusMinutes + "分钟"],
      ["规则", "电话到讨论区；共享空间避免外放音频。"],
    ]),
    table(s.tickets.map((t) => [t.done ? "手动完成" : "待处理草稿", t.text])),
    table(
      s.visitors.map((v) => [
        v.name,
        v.date +
          " / " +
          (s.members.find((m) => m.id === v.host)?.name || "成员已移除"),
      ]),
    ),
    table(
      [
        "通道保持畅通",
        "确认电源使用规则",
        "检查设备使用说明",
        "记录真实应急联系方式",
      ].map((x, i) => [x, s.safety[i] ? "手动复核" : "未复核"]),
    ),
    table([
      ["设备", s.devices + " × " + s.watts + " W"],
      ["时长", s.hours + " h"],
      ["照明", s.lighting + " W"],
      ["情景电量", q.energy + " kWh"],
      ["估算电费", money(q.energy * s.tariff)],
    ]),
    table(s.reviews.map((r) => [r.rating + " / 5", r.text])),
    s.invoice
      ? table([
          ...s.invoice.rows.map((r) => [r.name, money(r.amount)]),
          ["冻结税费", money(s.invoice.tax)],
          ["冻结总额", money(s.invoice.total)],
          ["计费口径", s.invoice.mode],
        ])
      : "<p>未生成费用快照。</p>",
    "<p>当前 JSON 用于继续编辑，ICS 只导出有效本地预约。取消后的再次导出不会删除外部日历中已有事件，需自行处理。五张照片均为专用 AI 概念图；中文字体附 OFL。</p>",
  ];
  await bookExport("daylight", s.project, pages, extras, [
    { url: images.lounge, page: 0, alt: "AI办公休憩区" },
    { url: images.focus, page: 4, alt: "AI专注工位" },
    { url: images.meeting, page: 5, alt: "AI会议室" },
    { url: images.studio, page: 6, alt: "AI录音室" },
    { url: images.community, page: 14, alt: "AI社区厨房" },
  ]);
}
