import { fontLicense, embeddedFontStyle } from "./fonts";
import { useState } from "react";
import { zipSync, strToU8 } from "fflate";
import type { HomeScene } from "../homeScenes";
import type { SceneSession } from "./workspace";
import {
  escapeXML,
  exportWebsite,
  makeDocx,
  printArtwork,
  saveBlob,
  toPng,
} from "./files";
import { makePosterSvg } from "./Poster";
import { exportPptx, seedSlides } from "./Slides";
import { csvCell } from "./shared";
import { exportXlsx } from "./tabular";
export function projectJson(session: SceneSession) {
  return JSON.stringify(
    {
      schema: 1,
      sceneId: session.sceneId,
      exportedAt: new Date().toISOString(),
      data: session.getSnapshot().data,
      versions: session.getSnapshot().versions,
    },
    null,
    2,
  );
}
export function exportProject(session: SceneSession) {
  saveBlob(
    `${session.sceneId}-project.json`,
    new Blob([projectJson(session)], { type: "application/json" }),
  );
}
const csv = (name: string, rows: unknown[][]) =>
  saveBlob(
    name,
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
export function brandSvg(d: Record<string, any>, application = false) {
  const color = ["#425e50", "#344961", "#825b47"][d.palette || 0] || "#425e50";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#eeeadf"/>${application ? `<rect x="210" y="90" width="360" height="590" rx="8" fill="${color}"/><rect x="620" y="260" width="370" height="250" rx="10" fill="#faf7ef" stroke="${color}"/>` : ""}<g transform="translate(${application ? "390 270" : "600 230"})" fill="none" stroke="${application ? "#eeeadf" : color}" stroke-width="5"><path d="M0 40V-10C-65-10-78-55-72-108C-15-108 22-66 0-10M0 20C64 20 87-24 73-75C22-68-7-31 0 20"/></g><g fill="${application ? "#eeeadf" : color}" font-family="${d.serif === false ? "Noto Sans SC, sans-serif" : "Georgia, Noto Sans SC, serif"}" text-anchor="middle"><text x="${application ? 390 : 600}" y="${application ? 400 : 410}" font-size="90">${escapeXML(d.name || "栖间")}</text><text x="${application ? 390 : 600}" y="${application ? 455 : 480}" font-size="28" letter-spacing="7">${escapeXML(d.english || "SEREIN")}</text><text x="${application ? 390 : 600}" y="${application ? 580 : 590}" font-size="21">${escapeXML(d.tagline || "把片刻，留给自己。")}</text></g>${application ? `<text x="805" y="375" text-anchor="middle" fill="${color}" font-size="55" font-family="${d.serif === false ? "Noto Sans SC, sans-serif" : "Georgia, Noto Sans SC, serif"}">${escapeXML(d.name || "栖间")}</text><text x="805" y="420" text-anchor="middle" fill="${color}" font-size="20">${escapeXML(d.english || "SEREIN")}</text>` : ""}</svg>`;
}
function documentContent(
  id: string,
  d: Record<string, any>,
): [string, string[], string[][][]] {
  if (id === "meeting")
    return [
      d.title,
      [
        d.notes,
        "核心决策",
        d.decision || "",
        "决策记录",
        ...(d.decisions || []).map((v: any) => `${v.text} / ${v.reason || ""}`),
        "会议来源",
        d.source || "产品发布评审示例",
      ],
      [
        [
          ["行动事项", "负责人", "截止日期", "状态"],
          ...(d.tasks || []).map((t: any) => [
            t.text,
            t.owner,
            t.date,
            t.done ? "已完成" : "待办",
          ]),
        ],
      ],
    ];
  if (id === "weekly")
    return [
      d.title,
      [
        `团队 / ${d.team || "产品设计组"}　项目 / ${d.project || "品牌站交付"}`,
        `本期 ${d.completed}/${d.target}，上期完成 ${d.previous ?? 6} 项。`,
        d.body,
        `风险：${d.risks || ""}`,
        `下周计划：${d.nextSteps || ""}`,
        `交付模块：${d.delivered || ""}`,
        `数据来源：${d.source || "团队任务记录（示例）"}`,
      ],
      [],
    ];
  if (id === "campaign")
    return [
      d.title || "营销执行计划",
      [
        `受众：${d.audience || "城市青年"}`,
        `目标：${d.objective || "建立产品认知"}`,
        `策略：${d.strategy || "从生活场景切入，以内容与体验联动。"}`,
        `预算：${JSON.stringify(d.budget || {})}`,
      ],
      [
        [
          ["日期", "内容", "渠道", "负责人", "状态"],
          ...(d.schedule || []).map((v: any) => [
            v.day || v.date,
            v.title,
            v.channel,
            v.owner || "待分配",
            v.status || "待执行",
          ]),
        ],
      ],
    ];
  return [
    "作品交付说明",
    [
      "本文件由 DesignBuddy 本地工作区生成。",
      "继续编辑请使用同一浏览器，或保留项目 JSON 备份。",
    ],
    [],
  ];
}
export function Delivery({
  scene,
  session,
  canvas,
}: {
  scene: HomeScene;
  session: SceneSession;
  canvas: React.RefObject<HTMLDivElement | null>;
}) {
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const run = async (label: string, fn: () => unknown) => {
    setBusy(label);
    setMessage("");
    try {
      await fn();
      setMessage(`${label}已完成。`);
    } catch (e) {
      setMessage(`未完成：${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };
  const raw = session.getSnapshot().data;
  const d =
    scene.id === "email"
      ? {
          ...raw,
          ...(raw.drafts?.find((v: any) => v.id === raw.mail) ||
            raw.drafts?.[0] ||
            {}),
        }
      : raw;
  const doc = () => {
    const [title, paragraphs, tables] = documentContent(scene.id, d);
    saveBlob(
      `${scene.id}-document.docx`,
      new Blob([makeDocx(title, paragraphs, tables) as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
  };
  const sales = () => [
    ["记录编号", "月份", "渠道", "区域", "订单数", "均价", "退款单"],
    ...(d.rows || []).map((r: any) => [
      r.id,
      r.month,
      r.channel,
      r.region,
      r.orders,
      r.price,
      r.returns,
    ]),
  ];
  const format: Record<string, string> = {
    meeting: "DOCX 文档",
    weekly: "DOCX 周报",
    data: "XLSX 数据表",
    slides: "PPTX 演示文稿",
    email: "EML 邮件草稿",
    website: "可运行 HTML 网站",
    dashboard: "CSV 订单",
    api: "JSON 请求集合",
    debug: "JSON 调试记录",
    tests: "JSON 测试报告",
    prototype: "JSON 交互原型",
    interface: "可运行 HTML 作品集",
    poster: "PNG 海报",
    brand: "ZIP 品牌素材包",
    campaign: "DOCX 执行方案",
  };
  const primary = async () => {
    switch (scene.id) {
      case "meeting":
      case "weekly":
      case "campaign":
        doc();
        break;
      case "slides":
        await exportPptx(d.slides || seedSlides);
        break;
      case "data":
        exportXlsx(sales());
        break;
      case "poster":
        await toPng(await makePosterSvg(d), "botanical-poster.png");
        break;
      case "website":
      case "interface":
        await exportWebsite(scene.id, d);
        break;
      case "brand": {
        const files = {
          "brand-logo.svg": strToU8(
            brandSvg(d).replace(
              "</svg>",
              `${await embeddedFontStyle(`${d.name || ""}${d.english || ""}${d.tagline || ""}`)}</svg>`,
            ),
          ),
          "brand-packaging.svg": strToU8(
            brandSvg(d, true).replace(
              "</svg>",
              `${await embeddedFontStyle(`${d.name || ""}${d.english || ""}${d.tagline || ""}`)}</svg>`,
            ),
          ),
          "OFL.txt": strToU8(fontLicense),
          "brand-guidelines.txt": strToU8(
            `品牌：${d.name}\n英文：${d.english}\n主张：${d.tagline}\n主色：${["#425e50", "#344961", "#825b47"][d.palette || 0]}\n字体：${d.serif ? "Georgia / " : ""}Noto Sans SC；矢量素材嵌入字形子集，许可见 OFL.txt。\n安全区：至少标志高度的 1/4。\n最小字标尺寸：屏幕 80px，印刷 20mm。\nSVG 为可编辑矢量设计，需在印刷前转曲与校色；不包含商标注册核查。`,
          ),
        };
        saveBlob(
          "brand-kit.zip",
          new Blob([zipSync(files) as BlobPart], { type: "application/zip" }),
        );
        break;
      }
      case "dashboard":
        csv("orders.csv", [
          ["订单号", "客户", "商品", "数量", "单价", "状态"],
          ...(d.orders || []).map((o: any) => [
            o.id,
            o.customer,
            o.product,
            o.qty,
            o.price,
            o.status,
          ]),
        ]);
        break;
      case "email": {
        const clean = (s: string) => s.replace(/[\r\n]/g, "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.address || ""))
          throw new Error("请先填写有效的收件邮箱。");
        const b64 = (s: string) =>
          btoa(String.fromCharCode(...new TextEncoder().encode(s)));
        const boundary = "designbuddy-" + crypto.randomUUID();
        const attachments = d.attachments || [];
        const body = `${d.body || ""}\n\n${d.signature || "林晓 / PRODUCT DESIGN"}`;
        const parts = [
          `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${
            b64(body)
              .match(/.{1,76}/g)
              ?.join("\r\n") || ""
          }`,
          ...attachments.map(
            (a: any) =>
              `Content-Type: application/octet-stream\r\nContent-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(a.name)}\r\nContent-Transfer-Encoding: base64\r\n\r\n${
                a.data
                  .split(",")[1]
                  ?.match(/.{1,76}/g)
                  ?.join("\r\n") || ""
              }`,
          ),
        ];
        saveBlob(
          "message-draft.eml",
          new Blob(
            [
              `X-Unsent: 1\r\nTo: ${clean(d.address)}\r\nSubject: =?UTF-8?B?${b64(d.subject || "")}?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n${parts.map((p) => `--${boundary}\r\n${p}\r\n`).join("")}--${boundary}--\r\n`,
            ],
            { type: "message/rfc822" },
          ),
        );
        break;
      }
      default:
        exportProject(session);
    }
  };
  return (
    <section className="ws-delivery">
      <header>
        <small>DELIVERY DESK / 交付中心</small>
        <h2>把作品带走，也把边界说清楚。</h2>
        <p>
          当前编辑内容会进入对应文件；项目 JSON
          是完整备份。命名版本与撤销记录不等于云端历史。
        </p>
      </header>
      <div className="ws-delivery-grid">
        <article>
          <span>01 / 成果</span>
          <h3>{format[scene.id]}</h3>
          <p>
            {scene.id === "poster"
              ? "摄影嵌入图片；文字在 SVG 中保持矢量。PNG 可直接使用。"
              : scene.id === "slides"
                ? "真实 OOXML 文件，含逐页文字、图片、表格和演讲备注。"
                : scene.id === "website" || scene.id === "interface"
                  ? "独立 HTML，含首页、项目、联系导航与本地表单校验；无后端。"
                  : "从当前作品内容生成，而非只导出示例说明。"}
          </p>
          <button disabled={!!busy} onClick={() => run("成果导出", primary)}>
            {busy === "成果导出" ? "正在生成…" : `下载 ${format[scene.id]}`}
          </button>
          {scene.id === "poster" && (
            <button
              disabled={!!busy}
              onClick={() =>
                run("SVG 导出", async () =>
                  saveBlob(
                    "poster.svg",
                    new Blob([await makePosterSvg(d)], {
                      type: "image/svg+xml",
                    }),
                  ),
                )
              }
            >
              下载 SVG
            </button>
          )}
        </article>
        <article>
          <span>02 / 继续编辑</span>
          <h3>作品与版本备份</h3>
          <p>
            包含全部本地编辑字段、图片及命名版本。自动保存只在当前浏览器有效，清理网站数据会丢失。
          </p>
          <button onClick={() => exportProject(session)}>下载项目 JSON</button>
          <button
            disabled={!!busy}
            onClick={() =>
              run("打印窗口打开", () => {
                if (!canvas.current) throw new Error("作品未加载");
                return printArtwork(canvas.current);
              })
            }
          >
            打印 / 保存 PDF
          </button>
        </article>
        <article>
          <span>03 / 使用须知</span>
          <h3>素材、字体与服务</h3>
          <ul>
            <li>内置摄影为 AI 生成的概念图片，不代表真实项目、销量或客户。</li>
            <li>
              中文使用 Noto Sans SC（SIL OFL 1.1），SVG/PNG
              嵌入所需字形子集；Office 文件采用系统字体，跨设备可能略有差异。
            </li>
            <li>用户上传资料请自行确认授权。导出文件仅保存在自己的设备。</li>
            <li>
              无云同步、真实发送、支付、预订或物流；API
              为本地模拟，代码工具只运行列出的预设案例。
            </li>
          </ul>
          <button
            onClick={() =>
              saveBlob(
                "OFL-font-license.txt",
                new Blob([fontLicense], { type: "text/plain;charset=utf-8" }),
              )
            }
          >
            下载字体许可
          </button>
          <button
            onClick={() =>
              saveBlob(
                "README-delivery.txt",
                new Blob(
                  [
                    `${scene.title}\n\n${scene.description}\n\n本地打开 HTML；Office 文件用兼容的编辑器打开。PDF 使用浏览器打印。JSON 为内容备份，不是可执行应用。\n自动保存仅在本浏览器，同一作品多标签编辑会提示冲突而不是覆盖。\n内置图像：AI 概念素材；字体：Noto Sans SC（SIL OFL 1.1）与设备系统字体；矢量素材内嵌子集附 OFL 许可。\n未接入：云端账户、邮件、支付、预订、物流、生产 API、任意代码运行环境。\n上传素材与商业使用请核验授权及事实。`,
                  ],
                  { type: "text/plain;charset=utf-8" },
                ),
              )
            }
          >
            下载使用说明
          </button>
        </article>
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
