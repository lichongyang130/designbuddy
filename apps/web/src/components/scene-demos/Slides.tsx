import { useState } from "react";
import { useSceneState, useSceneSession } from "./workspace";
import { art, Toolbar, type DemoProps } from "./shared";
import { imageData, uploadImage } from "./files";
export type Slide = {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  layout: string;
  image: string;
  focus: number;
  notes: string;
};
export const seedSlides: Slide[] = [
  [
    "专注每一段声音。",
    "PRODUCT LAUNCH / 2026",
    "无线降噪耳机\n从产品价值到上市路径",
    "cover",
  ],
  [
    "用户需要的不是更多功能，\n而是更少打扰。",
    "01 / CUSTOMER INSIGHTS",
    "通勤｜屏蔽环境噪声，稳定聆听\n办公｜舒适佩戴，快速设备切换\n出行｜清晰电量，减少续航焦虑",
    "cards",
  ],
  [
    "把体验，做在细节里。",
    "02 / VALUE PROPOSITION",
    "自适应降噪，关注声音本身\n轻量结构，降低佩戴负担\n长续航，减少中断",
    "split",
  ],
  [
    "让选择有据可依。",
    "03 / POSITIONING",
    "降噪方式｜自适应降噪｜被动隔音\n设备切换｜多设备｜单设备\n充电接口｜USB-C｜USB-C\n产品定位｜通勤办公｜轻量使用",
    "table",
  ],
  [
    "在合适的地方，被看见。",
    "04 / GO-TO-MARKET",
    "30%｜内容种草：体验测评与通勤故事\n45%｜官网承接：信息与规格对比\n25%｜门店体验：佩戴试听与服务",
    "cards",
  ],
  [
    "先形成共识，再有序发布。",
    "05 / ROADMAP",
    "W1｜完善规格、摄影与售后内容\nW2｜联调官网、库存与服务流程\nW3｜小范围预热，收集反馈\nW4｜复核问题，扩大传播",
    "timeline",
  ],
  [
    "用可解释的数据，评估每一步。",
    "06 / MEASUREMENT",
    "触达｜跟踪内容的有效曝光\n体验｜记录试听与咨询的反馈\n转化｜比较各渠道的实际成本",
    "cards",
  ],
  [
    "下一步，让体验发生。",
    "07 / NEXT STEPS",
    "产品团队：确认规格与合规边界\n设计团队：完成页面、摄影与物料\n运营团队：明确负责人及验收日期",
    "cover",
  ],
].map(([title, eyebrow, body, layout], i) => ({
  id: `slide-${i}`,
  title,
  eyebrow,
  body,
  layout,
  image: art.headphones,
  focus: 50,
  notes:
    i === 0
      ? "产品、指标和摄影均为概念示例；演示前请替换为真实资料。"
      : "补充本页的讲述要点与依据。",
}));
export async function exportPptx(slides: Slide[], name = "aura-one.pptx") {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "DesignBuddy";
  pptx.subject = "可编辑产品提案";
  pptx.title = slides[0]?.title || "演示文稿";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
  };
  for (const [i, s] of slides.entries()) {
    const page = pptx.addSlide();
    const cover = s.layout === "cover",
      split = s.layout === "split";
    const ink = cover ? "FFFFFF" : "273E40";
    page.background = { color: cover ? "17292C" : "F2F1EB" };
    if (cover || split) {
      const img = new Image();
      img.src = await imageData(s.image);
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = cover ? 952 : 676;
      cv.height = 900;
      const ratio = Math.max(cv.width / img.width, cv.height / img.height);
      const sw = cv.width / ratio,
        sh = cv.height / ratio;
      cv.getContext("2d")!.drawImage(
        img,
        ((img.width - sw) * s.focus) / 100,
        (img.height - sh) / 2,
        sw,
        sh,
        0,
        0,
        cv.width,
        cv.height,
      );
      page.addImage({
        data: cv.toDataURL("image/jpeg", 0.9),
        x: cover ? 5.4 : 7.7,
        y: 0,
        w: cover ? 7.94 : 5.64,
        h: 7.5,
      });
    }
    page.addText(s.eyebrow, {
      x: 0.65,
      y: 0.5,
      w: cover ? 5 : 11,
      h: 0.35,
      fontSize: 11,
      color: cover ? "B0C8BC" : "63816F",
      charSpacing: 2,
      breakLine: false,
    });
    page.addText(s.title, {
      x: 0.65,
      y: cover ? 2.15 : 1.25,
      w: cover ? 5.2 : split ? 6.7 : 12,
      h: cover ? 2 : 1.3,
      fontSize: cover ? 34 : 29,
      bold: true,
      color: ink,
      breakLine: false,
      fit: "shrink",
    });
    const lines = s.body.split("\n");
    if (s.layout === "table")
      page.addTable(
        lines.map((l) => l.split("｜").map((text) => ({ text }))),
        {
          x: 0.65,
          y: 3,
          w: 12,
          h: 3,
          border: { type: "solid", pt: 1, color: "BCC8BC" },
          color: ink,
          fontSize: 16,
          fill: { color: "F2F1EB" },
          margin: 0.16,
        },
      );
    else if (s.layout === "chart")
      page.addChart(
        pptx.ChartType.bar,
        [
          {
            name: "示例指标",
            labels: lines.map((l) => l.split("｜")[0]),
            values: lines.map((l) => Number(l.split("｜")[1]) || 0),
          },
        ],
        {
          x: 0.65,
          y: 3,
          w: 12,
          h: 3.5,
          showLegend: false,
          showTitle: false,
          catAxisLabelFontSize: 12,
          valAxisLabelFontSize: 11,
          showValue: true,
          chartColors: ["769980"],
        },
      );
    else if (s.layout === "cards" || s.layout === "timeline") {
      const w = 12 / Math.max(lines.length, 1);
      lines.forEach((l, j) => {
        page.addText(String(j + 1).padStart(2, "0"), {
          x: 0.65 + j * w,
          y: 3.1,
          w: w - 0.2,
          h: 0.6,
          fontSize: 28,
          color: "769980",
        });
        page.addText(l.replaceAll("｜", "\n"), {
          x: 0.65 + j * w,
          y: 4,
          w: w - 0.3,
          h: 2,
          fontSize: 18,
          color: ink,
          fit: "shrink",
        });
      });
    } else
      page.addText(s.body, {
        x: 0.65,
        y: cover ? 4.7 : 3.4,
        w: cover ? 4.6 : 6.3,
        h: 1.9,
        fontSize: 17,
        color: ink,
        breakLine: false,
        fit: "shrink",
      });
    page.addText(
      `AURA ONE / ${String(i + 1).padStart(2, "0")}  ·  CONCEPT PROPOSAL`,
      {
        x: 0.65,
        y: 7,
        w: 8,
        h: 0.2,
        fontSize: 8,
        color: cover ? "B7C4BC" : "75877E",
      },
    );
    page.addNotes(
      `${s.notes}\n素材说明：内置产品图为 AI 生成概念图片；用户上传素材请自行确认授权。`,
    );
  }
  await pptx.writeFile({ fileName: name });
}
export function Slides({ interactive }: DemoProps) {
  const [slides, setSlides] = useSceneState<Slide[]>("slides", seedSlides),
    [page, setPage] = useSceneState("page", 0);
  const session = useSceneSession();
  const [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const index = Math.min(page, slides.length - 1),
    s = slides[index];
  const update = (patch: Partial<Slide>) =>
    setSlides((old) =>
      old.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );
  const move = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= slides.length) return;
    const list = [...slides];
    [list[index], list[next]] = [list[next], list[index]];
    if (session) session.transaction({ slides: list, page: next });
    else {
      setSlides(list);
      setPage(next);
    }
  };
  const add = () => {
    const list = [
      ...slides.slice(0, index + 1),
      {
        ...s,
        id: crypto.randomUUID(),
        title: "新的想法，从这里开始。",
        notes: "",
        layout: "split",
      },
      ...slides.slice(index + 1),
    ];
    if (session) session.transaction({ slides: list, page: index + 1 });
    else {
      setSlides(list);
      setPage(index + 1);
    }
  };
  return (
    <div
      className={`pd-presentation ws-deck ${playing ? "is-playing" : ""}`}
      onKeyDown={(e) => {
        if (!playing) return;
        if (e.key === "ArrowRight")
          setPage(Math.min(index + 1, slides.length - 1));
        if (e.key === "ArrowLeft") setPage(Math.max(0, index - 1));
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setPlaying(false);
        }
      }}
    >
      <Toolbar brand="KEYNOTE /" title="AURA ONE · 产品上市提案">
        <span>
          {index + 1} / {slides.length}
        </span>
        <button onClick={() => setPlaying(!playing)}>
          {playing ? "退出播放" : "播放演示"}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await exportPptx(slides);
              setMessage("PPTX 已生成，文字、表格和备注可继续编辑。");
            } catch (e) {
              setMessage(`导出失败：${(e as Error).message}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "正在生成…" : "导出 PPTX ↓"}
        </button>
      </Toolbar>
      {message && (
        <p role="status" className="ws-inline-status">
          {message}
        </p>
      )}
      <div className="pd-presentation-main">
        <aside className="pd-slide-nav">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              aria-label={`第${i + 1}页 ${slide.title}`}
              aria-current={index === i ? "page" : undefined}
              onClick={() => setPage(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{slide.title}</strong>
            </button>
          ))}
          {interactive && (
            <button disabled={slides.length >= 30} onClick={add}>
              ＋ 新增页面
            </button>
          )}
        </aside>
        <section className="pd-slide-stage">
          <div className={`ws-slide ws-slide-${s.layout}`}>
            {(s.layout === "cover" || s.layout === "split") && (
              <img
                src={s.image}
                alt="当前页图片"
                style={{ objectPosition: `${s.focus}% center` }}
              />
            )}
            <div className="ws-slide-content">
              <small>{s.eyebrow}</small>
              {interactive && !playing ? (
                <textarea
                  aria-label="幻灯片标题"
                  className="ws-slide-title"
                  rows={2}
                  value={s.title}
                  maxLength={180}
                  onChange={(e) => update({ title: e.target.value })}
                />
              ) : (
                <h1>{s.title}</h1>
              )}
              {s.layout === "chart" ? (
                <div className="ws-deck-bars">
                  {s.body.split("\n").map((line, i) => {
                    const [label, value] = line.split("｜");
                    const amount = Number(value) || 0;
                    const max = Math.max(
                      1,
                      ...s.body
                        .split("\n")
                        .map((l) => Number(l.split("｜")[1]) || 0),
                    );
                    return (
                      <article key={i}>
                        <span>{label}</span>
                        <i
                          style={{
                            height: `${Math.max(0, amount / max) * 100}%`,
                          }}
                        />
                        <strong>{amount}</strong>
                      </article>
                    );
                  })}
                </div>
              ) : s.layout === "cards" || s.layout === "timeline" ? (
                <div className="ws-slide-cards">
                  {s.body.split("\n").map((line, i) => (
                    <article key={i}>
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      <p>{line.replaceAll("｜", "\n")}</p>
                    </article>
                  ))}
                </div>
              ) : s.layout === "table" ? (
                <table aria-label="幻灯片表格">
                  <tbody>
                    {s.body.split("\n").map((line, i) => (
                      <tr key={i}>
                        {line.split("｜").map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>{s.body}</p>
              )}
              <footer>
                AURA ONE / CONCEPT PROPOSAL{" "}
                <span>{String(index + 1).padStart(2, "0")}</span>
              </footer>
            </div>
          </div>
          {playing ? (
            <div className="ws-play-controls">
              <button disabled={!index} onClick={() => setPage(index - 1)}>
                ← 上一页
              </button>
              <span>使用方向键翻页，Esc 退出播放</span>
              <button
                disabled={index === slides.length - 1}
                onClick={() => setPage(index + 1)}
              >
                下一页 →
              </button>
            </div>
          ) : (
            interactive && (
              <div className="ws-slide-inspector">
                <div className="ws-actions">
                  <label>
                    版式
                    <select
                      aria-label="幻灯片版式"
                      value={s.layout}
                      onChange={(e) => update({ layout: e.target.value })}
                    >
                      {[
                        ["cover", "摄影封面"],
                        ["split", "图文分栏"],
                        ["cards", "观点卡片"],
                        ["table", "对比表格"],
                        ["timeline", "时间线"],
                        ["chart", "数据柱图"],
                      ].map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ws-upload">
                    更换图片
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          update({ image: await uploadImage(file) });
                          setMessage("图片已替换，调整焦点可改变裁切位置。");
                        } catch (err) {
                          setMessage((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  <label>
                    图片焦点
                    <input
                      aria-label="图片焦点"
                      type="range"
                      min="0"
                      max="100"
                      value={s.focus}
                      onChange={(e) => update({ focus: +e.target.value })}
                    />
                  </label>
                  <button disabled={!index} onClick={() => move(-1)}>
                    前移
                  </button>
                  <button
                    disabled={index === slides.length - 1}
                    onClick={() => move(1)}
                  >
                    后移
                  </button>
                  <button
                    disabled={slides.length <= 1}
                    onClick={() => {
                      if (!confirm("删除当前页？可通过工作区撤销恢复。"))
                        return;
                      const list = slides.filter((_, i) => i !== index);
                      session
                        ? session.transaction({
                            slides: list,
                            page: Math.max(0, index - 1),
                          })
                        : (setSlides(list), setPage(Math.max(0, index - 1)));
                    }}
                  >
                    删除页面
                  </button>
                </div>
                <div className="ws-two-columns">
                  <label>
                    正文 /
                    每行一个内容块，表格用「｜」分列；柱图用「标签｜数值」
                    <textarea
                      aria-label="幻灯片正文"
                      rows={4}
                      value={s.body}
                      maxLength={3000}
                      onChange={(e) => update({ body: e.target.value })}
                    />
                  </label>
                  <label>
                    演讲者备注
                    <textarea
                      aria-label="演讲者备注"
                      rows={4}
                      value={s.notes}
                      maxLength={3000}
                      onChange={(e) => update({ notes: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
