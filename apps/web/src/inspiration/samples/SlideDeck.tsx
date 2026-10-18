import { useEffect, useId, useRef, useState } from "react";
import {
  copySample,
  Credits,
  jpegDataUrl,
  Notice,
  SampleTop,
  slidePhotos as lumaPhotos,
  cityPhotos,
  useSampleState,
} from "./shared";
import {
  slideData as lumaData,
  slideElements as lumaElements,
  type SlideElement,
} from "./slideContent";
import { citySlides, cityElements } from "./cityDeck";
const configuration = (variant: "luma" | "city") =>
  variant === "city"
    ? {
        data: citySlides,
        elements: cityElements,
        photos: cityPhotos,
        title: "WALK · 城市漫步提案",
        file: "WALK-城市漫步-20页.pptx",
        label: "WALK / FIELD PROPOSAL",
      }
    : {
        data: lumaData,
        elements: lumaElements,
        photos: lumaPhotos,
        title: "LUMA 产品发布",
        file: "LUMA-产品发布-20页.pptx",
        label: "LUMA / PRODUCT LAUNCH",
      };
function wrapped(element: SlideElement) {
  const size = element.size || 20,
    max = Math.max(4, element.w / size);
  const lines: string[] = [];
  for (const para of (element.text || "").split("\n")) {
    let line = "",
      length = 0;
    for (const char of para) {
      const weight = /[\u0000-\u00ff]/.test(char) ? 0.53 : 1;
      if (length + weight > max) {
        lines.push(line);
        line = "";
        length = 0;
      }
      line += char;
      length += weight;
    }
    lines.push(line);
  }
  return {
    lines,
    size: Math.min(size, element.h / Math.max(1, lines.length) / 1.2),
  };
}
export function SlideCanvas({
  variant = "luma",
  index = 0,
  title,
  body,
}: {
  variant?: "luma" | "city";
  index?: number;
  title?: string;
  body?: string;
}) {
  const {
    data: slideData,
    elements: slideElements,
    photos: slidePhotos,
  } = configuration(variant);
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      className="luma-slide"
      data-slide={index}
      viewBox="0 0 960 540"
      role="img"
      aria-label={`幻灯片 ${index + 1}：${title || slideData[index].title.replace(/\n/g, " ")}`}
    >
      {slideElements(index, title, body).map((e, i) =>
        e.kind === "rect" ? (
          <rect
            key={i}
            x={e.x}
            y={e.y}
            width={e.w}
            height={e.h}
            fill={`#${e.fill}`}
          />
        ) : e.kind === "image" ? (
          <g key={i}>
            <defs>
              <clipPath id={`${uid}-${i}`}>
                <rect x={e.x} y={e.y} width={e.w} height={e.h} />
              </clipPath>
            </defs>
            <image
              href={slidePhotos[e.photo!].url}
              x={e.x}
              y={e.y}
              width={e.w}
              height={e.h}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${uid}-${i})`}
            />
          </g>
        ) : (
          <text
            key={i}
            x={e.x}
            y={e.y}
            fill={`#${e.color}`}
            fontFamily="Arial, Noto Sans SC, sans-serif"
            fontSize={wrapped(e).size}
            fontWeight={e.bold ? 700 : 400}
          >
            {wrapped(e).lines.map((line, j) => (
              <tspan
                key={j}
                x={e.x}
                dy={j ? wrapped(e).size * 1.2 : wrapped(e).size}
              >
                {line}
              </tspan>
            ))}
          </text>
        ),
      )}
    </svg>
  );
}
type DeckState = {
  index: number;
  titles: Record<string, string>;
  bodies: Record<string, string>;
  notes: Record<string, string>;
};
const initial: DeckState = { index: 0, titles: {}, bodies: {}, notes: {} };
export default function SlideDeck({
  draftId,
  variant = "luma",
}: {
  draftId?: string;
  variant?: "luma" | "city";
}) {
  const config = configuration(variant);
  const {
    data: slideData,
    elements: slideElements,
    photos: slidePhotos,
  } = config;
  const [s, set, error] = useSampleState(variant, draftId, initial);
  const index = Math.min(19, Math.max(0, s.index));
  const [present, presentation] = useState(false);
  const [editing, edit] = useState(false);
  const [notice, msg] = useState("");
  const [busy, exporting] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const go = (i: number) =>
    set((v) => ({ ...v, index: Math.min(19, Math.max(0, i)) }));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,textarea,select,[contenteditable]")
      )
        return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(19);
      if (e.key === "Escape") presentation(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index]);
  useEffect(() => {
    if (!present) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stage.current?.focus();
    return () => {
      document.body.style.overflow = old;
    };
  }, [present]);
  async function exportDeck() {
    exporting(true);
    msg("");
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "DesignBuddy";
      pptx.subject = config.title + " · 可编辑幻灯片";
      pptx.title = config.title;
      const assets = await Promise.all(
        slidePhotos.map((p) => jpegDataUrl(p.url)),
      );
      for (let i = 0; i < 20; i++) {
        const slide = pptx.addSlide();
        for (const e of slideElements(i, s.titles[i], s.bodies[i])) {
          if (e.kind === "rect")
            slide.addShape(pptx.ShapeType.rect, {
              x: e.x / 72,
              y: e.y / 72,
              w: e.w / 72,
              h: e.h / 72,
              fill: { color: e.fill },
              line: { color: e.fill, transparency: 100 },
            });
          else if (e.kind === "image")
            slide.addImage({
              data: assets[e.photo!],
              x: e.x / 72,
              y: e.y / 72,
              w: e.w / 72,
              h: e.h / 72,
              sizing: { type: "crop", w: e.w / 72, h: e.h / 72 },
            });
          else
            slide.addText(e.text || "", {
              x: e.x / 72,
              y: e.y / 72,
              w: e.w / 72,
              h: e.h / 72,
              fontFace: "Microsoft YaHei",
              lang: "zh-CN",
              fontSize: e.size,
              color: e.color,
              bold: e.bold,
              margin: 0,
              breakLine: false,
              valign: "top",
              fit: "shrink",
            });
        }
        slide.addNotes(
          (s.notes[i] || "演示内容，非真实产品商业承诺。") +
            "\n\n摄影素材：\n" +
            slidePhotos
              .map(
                (p) => `${p.label} / ${p.credit} / ${p.license} / ${p.source}`,
              )
              .join("\n"),
        );
      }
      await pptx.writeFile({ fileName: config.file });
      msg("已导出20页可编辑 PPTX，含演讲备注与图片署名。");
    } catch (e) {
      msg(e instanceof Error ? e.message : "导出失败，请重试。");
    } finally {
      exporting(false);
    }
  }
  function copy() {
    try {
      copySample(variant, s);
    } catch {
      msg("无法保存副本，请先导出 PPTX。");
    }
  }
  return (
    <main className={`sample-view deck-view ${variant}-deck`}>
      <SampleTop
        type="幻灯片 · 16:9 · 20页"
        title={config.title}
        draftId={draftId}
        onCopy={copy}
      >
        <button disabled={busy} onClick={() => void exportDeck()}>
          {busy ? "导出中…" : "导出 PPTX"}
        </button>
      </SampleTop>
      <Notice text={notice || error} />
      <div className={`deck-workspace ${present ? "is-presenting" : ""}`}>
        <aside className="deck-thumbnails" aria-label="20页幻灯片缩略图">
          {slideData.map((slide, i) => (
            <button
              key={i}
              aria-label={`第${i + 1}页 ${slide.title.replace(/\n/g, " ")}`}
              aria-current={index === i ? "page" : undefined}
              onClick={() => go(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <SlideCanvas
                variant={variant}
                index={i}
                title={s.titles[i]}
                body={s.bodies[i]}
              />
            </button>
          ))}
        </aside>
        <div className="deck-main">
          <div className="deck-format">
            <span>{config.label}</span>
            <span>16:9 · {index + 1} / 20</span>
            <button onClick={() => presentation(!present)}>
              {present ? "退出演示" : "全屏演示"}
            </button>
          </div>
          <div ref={stage} tabIndex={-1} className="deck-stage">
            <SlideCanvas
              variant={variant}
              index={index}
              title={s.titles[index]}
              body={s.bodies[index]}
            />
          </div>
          <div className="deck-controls">
            <button
              disabled={!index}
              aria-label="上一页幻灯片"
              onClick={() => go(index - 1)}
            >
              ← 上一页
            </button>
            <span>方向键翻页 · Esc 退出演示</span>
            <button
              disabled={index === 19}
              aria-label="下一页幻灯片"
              onClick={() => go(index + 1)}
            >
              下一页 →
            </button>
          </div>
          {!present && (
            <div className="deck-bottom">
              <div className="deck-notes">
                <label>
                  演讲备注
                  <textarea
                    aria-label="演讲备注"
                    maxLength={3000}
                    placeholder="为这一页记下要讲的话…"
                    value={s.notes[index] || ""}
                    onChange={(e) =>
                      set((v) => ({
                        ...v,
                        notes: { ...v.notes, [index]: e.target.value },
                      }))
                    }
                  />
                </label>
                <small>备注按页保存，导出时写入 PPTX。</small>
              </div>
              <div className="deck-editor">
                <button onClick={() => edit(!editing)} aria-expanded={editing}>
                  {editing ? "收起内容编辑" : "编辑此页文字"}
                </button>
                {editing && (
                  <>
                    <label>
                      幻灯片标题
                      <textarea
                        aria-label="幻灯片标题"
                        maxLength={100}
                        value={s.titles[index] ?? slideData[index].title}
                        onChange={(e) =>
                          set((v) => ({
                            ...v,
                            titles: { ...v.titles, [index]: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      幻灯片正文
                      <textarea
                        aria-label="幻灯片正文"
                        maxLength={400}
                        value={s.bodies[index] ?? slideData[index].body}
                        onChange={(e) =>
                          set((v) => ({
                            ...v,
                            bodies: { ...v.bodies, [index]: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <button
                      onClick={() =>
                        set((v) => {
                          const t = { ...v.titles },
                            b = { ...v.bodies };
                          delete t[index];
                          delete b[index];
                          return { ...v, titles: t, bodies: b };
                        })
                      }
                    >
                      恢复此页原文
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Credits photos={slidePhotos} />
    </main>
  );
}

export function CityDeck({ draftId }: { draftId?: string }) {
  return <SlideDeck variant="city" draftId={draftId} />;
}
