import { useEffect, useId, useRef, useState } from "react";
import {
  brandPhotos as chishanPhotos,
  naturePhotos,
  copySample,
  Credits,
  dataUrl,
  download,
  Notice,
  SampleTop,
  useSampleState,
} from "./shared";
import { NatureArtwork, natureBoards } from "./NatureArtwork";
export const artboards = [
  [
    "品牌主海报",
    "POSTER / 01",
    1200,
    1600,
    "poster",
    "把日子，\n慢慢冲开。",
    0,
  ],
  [
    "山野宣言",
    "MANIFESTO / 02",
    1200,
    1600,
    "type",
    "山野之间，\n一杯刚好。",
    3,
  ],
  ["咖啡菜单", "MENU / 03", 1000, 1400, "menu", "今日，慢一点。", 0],
  [
    "云海社交封面",
    "SOCIAL / 04",
    1080,
    1080,
    "circle",
    "在云里，\n等一杯咖啡。",
    4,
  ],
  ["山谷摄影海报", "PHOTO / 05", 1200, 1600, "photo", "去山里。", 3],
  ["品牌字标", "IDENTITY / 06", 1600, 1000, "logo", "迟 山", 1],
  ["原豆包装标签", "LABEL / 07", 800, 1200, "label", "山野拼配", 1],
  [
    "门店开业邀请",
    "INVITATION / 08",
    1200,
    1600,
    "invite",
    "好久不见，\n来坐一会儿。",
    2,
  ],
  [
    "晨间咖啡故事",
    "STORY / 09",
    1080,
    1920,
    "story",
    "早上好。\n先闻到咖啡香。",
    0,
  ],
  ["自然材质拼贴", "MOODBOARD / 10", 1400, 1000, "collage", "山 · 木 · 光", 1],
  ["外带杯套图稿", "SLEEVE / 11", 1800, 700, "sleeve", "带一小段山野走。", 3],
  [
    "周末音乐海报",
    "EVENT / 12",
    1200,
    1600,
    "event",
    "日落之前，\n听一首慢歌。",
    2,
  ],
  ["咖啡风味卡", "TASTING / 13", 1000, 1400, "tasting", "给味道一个名字。", 0],
  [
    "品牌色彩规范",
    "PALETTE / 14",
    1600,
    1000,
    "palette",
    "自然，是我们的底色。",
    1,
  ],
  ["街区导视招牌", "SIGN / 15", 1600, 900, "sign", "咖啡在这里 →", 2],
  [
    "会员感谢卡",
    "THANK YOU / 16",
    1400,
    1000,
    "thanks",
    "谢谢你，\n把时间留给这里。",
    4,
  ],
  [
    "夏日限定海报",
    "SEASONAL / 17",
    1200,
    1600,
    "season",
    "风起的时候，\n喝一杯冰的。",
    1,
  ],
  [
    "山野明信片",
    "POSTCARD / 18",
    1600,
    1000,
    "postcard",
    "寄一片山野给你。",
    3,
  ],
  [
    "双图编辑封面",
    "EDITORIAL / 19",
    1400,
    1800,
    "editorial",
    "一半是山，\n一半是日常。",
    4,
  ],
  [
    "品牌收束画板",
    "ENDNOTE / 20",
    1200,
    1200,
    "end",
    "慢下来，\n就到山里了。",
    0,
  ],
].map(([title, tag, w, h, kind, copy, photo], index) => ({
  title: String(title),
  tag: String(tag),
  w: Number(w),
  h: Number(h),
  kind: String(kind),
  copy: String(copy),
  photo: Number(photo),
  index,
}));
export function BrandArtwork({
  index = 0,
  accent = "#B95532",
  caption,
}: {
  index?: number;
  accent?: string;
  caption?: string;
}) {
  const brandPhotos = chishanPhotos;
  const b = artboards[index],
    uid = useId().replace(/:/g, "");
  const ink = "#27372B",
    paper = "#EEE9DC";
  const dark = [1, 5, 11, 14, 19].includes(index);
  const fill = dark ? paper : ink;
  const text = (
    value: string,
    x: number,
    y: number,
    size = 60,
    color = fill,
    weight = 500,
  ) => {
    const lines = value.split("\n");
    const isCaption = value === copy;
    if (isCaption) {
      const limits: Record<string, [number, number]> = {
        poster: [1080, 200],
        type: [1060, 240],
        menu: [540, 170],
        circle: [960, 125],
        photo: [1080, 55],
        logo: [1040, 60],
        label: [600, 50],
        invite: [1080, 170],
        story: [940, 200],
        collage: [1260, 20],
        sleeve: [485, 180],
        event: [1080, 290],
        tasting: [880, 70],
        palette: [1480, 65],
        sign: [1410, 180],
        thanks: [670, 240],
        season: [920, 220],
        postcard: [530, 80],
        editorial: [1280, 230],
        end: [850, 210],
      };
      const [width, height] = limits[b.kind];
      const units = Math.max(
        1,
        ...lines.map((line) =>
          Array.from(line).reduce(
            (n, c) => n + (/[^\x00-\xff]/.test(c) ? 1 : 0.65),
            0,
          ),
        ),
      );
      size = Math.min(
        size,
        width / units,
        lines.length > 1 ? height / ((lines.length - 1) * 1.28) : Infinity,
      );
    }
    return (
      <text
        data-caption={isCaption ? "true" : undefined}
        x={x}
        y={y}
        fill={color}
        fontFamily="Arial, Noto Sans SC, sans-serif"
        fontSize={size}
        fontWeight={weight}
      >
        {lines.map((line, n) => (
          <tspan key={n} x={x} dy={n ? size * 1.28 : 0}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
  const image = (
    p: number,
    x: number,
    y: number,
    w: number,
    h: number,
    shape = "rect",
  ) => (
    <g>
      <defs>
        <clipPath id={`${uid}-${p}-${x}-${y}`}>
          {shape === "circle" ? (
            <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
          ) : (
            <rect x={x} y={y} width={w} height={h} />
          )}
        </clipPath>
      </defs>
      <image
        href={brandPhotos[p % 5].url}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${uid}-${p}-${x}-${y})`}
      />
    </g>
  );
  const line = (y: number) => (
    <path d={`M60 ${y}H${b.w - 60}`} stroke={fill} strokeWidth="2" />
  );
  const copy = caption ?? b.copy;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="brand-artwork"
      data-artboard={index + 1}
      width={b.w}
      height={b.h}
      viewBox={`0 0 ${b.w} ${b.h}`}
      role="img"
      aria-label={`画板${index + 1} ${b.title}`}
    >
      <rect width={b.w} height={b.h} fill={dark ? ink : paper} />
      {text("CHISHAN / 迟山咖啡", 60, 65, 23)}
      {text(b.tag, b.w - 300, 65, 18)}
      {b.kind === "poster" && (
        <>
          {image(0, 60, 455, b.w - 120, 870)}
          {text(copy, 60, 210, 110, ink, 700)}
          <circle cx="1040" cy="340" r="90" fill={accent} />
          {text("慢", 994, 369, 80, paper)}
          {text("COFFEE, AT YOUR OWN PACE.", 60, 1430, 28)}
          {line(1490)}
        </>
      )}
      {b.kind === "type" && (
        <>
          {text("慢", 100, 700, 570, accent, 700)}
          {text(copy, 70, 1060, 90)}
          {text("SLOW IS A WAY OF SEEING.", 75, 1400, 28)}
          <path
            d="M700 840 870 500 1110 980"
            fill="none"
            stroke={paper}
            strokeWidth="8"
          />
        </>
      )}
      {b.kind === "menu" && (
        <>
          {text(copy, 60, 210, 76, ink, 700)}
          {image(0, 650, 125, 270, 270, "circle")}
          {[
            "浓缩 ESPRESSO / 22",
            "美式 AMERICANO / 26",
            "拿铁 LATTE / 32",
            "手冲 POUR OVER / 38",
            "山野冷萃 COLD BREW / 34",
          ].map((x, i) => (
            <g key={x}>
              {line(460 + i * 140)}
              {text(x, 60, 535 + i * 140, 33)}
            </g>
          ))}
          {text("演示菜单 · 非真实商品报价", 60, 1320, 23)}
        </>
      )}
      {b.kind === "circle" && (
        <>
          {image(4, 140, 130, 800, 800, "circle")}
          <rect y="670" width="1080" height="255" fill={accent} />
          {text(copy, 60, 760, 71, paper, 700)}
          {text("WEEKEND / TAKE YOUR TIME", 60, 1010, 23)}
        </>
      )}
      {b.kind === "photo" && (
        <>
          {image(3, 0, 110, b.w, b.h - 220)}
          {text(copy, 60, 355, 135, "#FFFFFF", 700)}
          {text("一杯咖啡，一段不赶路的时间。", 65, 435, 29, "#FFFFFF")}
        </>
      )}
      {b.kind === "logo" && (
        <>
          <path
            d="M480 620 640 250 790 570 950 170 1130 620Z"
            fill="none"
            stroke={accent}
            strokeWidth="18"
          />
          {text(copy, 500, 815, 170)}
          {text("MOUNTAIN DAYS / EVERYDAY COFFEE", 485, 895, 26)}
        </>
      )}
      {b.kind === "label" && (
        <>
          <rect
            x="50"
            y="120"
            width="700"
            height="960"
            fill="none"
            stroke={ink}
            strokeWidth="3"
          />
          {text(copy, 105, 280, 85)}
          {image(1, 100, 360, 600, 370)}
          {text("CHISHAN BLEND / 250 g", 105, 810, 30)}
          {text(
            "风味示例：可可 · 坚果 · 焦糖\n中度烘焙 / 演示包装标签",
            105,
            900,
            28,
          )}
          {line(1020)}
        </>
      )}
      {b.kind === "invite" && (
        <>
          {text(copy, 60, 230, 94, ink, 700)}
          {image(2, 60, 470, 1080, 620)}
          {text("OPENING WEEKEND", 60, 1220, 50, accent, 700)}
          {text(
            "周六 14:00 / 慢坐、聊天、听音乐\n活动信息为设计演示，不对应真实门店。",
            60,
            1320,
            30,
          )}
        </>
      )}
      {b.kind === "story" && (
        <>
          {image(0, 0, 250, 1080, 1100)}
          {text(copy, 70, 1540, 95, ink, 700)}
          <circle cx="910" cy="1680" r="85" fill={accent} />
          {text("AM", 847, 1707, 54, paper)}
          {text("GOOD MORNING, SLOW MORNING.", 70, 1840, 22)}
        </>
      )}
      {b.kind === "collage" && (
        <>
          {image(1, 60, 160, 410, 580)}
          {image(3, 490, 300, 410, 520)}
          {image(2, 920, 140, 420, 600)}
          {text(copy, 70, 930, 72, ink, 700)}
        </>
      )}
      {b.kind === "sleeve" && (
        <>
          <rect
            x="580"
            y="110"
            width="650"
            height="480"
            rx="220"
            fill={accent}
          />
          {text("迟 山", 665, 430, 140, paper)}
          {text(copy, 75, 350, 43)}
          {text("COFFEE\nTO GO.", 1370, 310, 54)}
          {line(610)}
        </>
      )}
      {b.kind === "event" && (
        <>
          {image(2, 500, 150, 640, 900)}
          {text(copy, 60, 970, 100, paper, 700)}
          <circle cx="190" cy="370" r="130" fill={accent} />
          {text("33⅓", 95, 396, 62, paper)}
          {text("SLOW SESSION / SATURDAY 17:00", 60, 1370, 29)}
          {text("概念活动视觉 · 非真实演出信息", 60, 1480, 22)}
        </>
      )}
      {b.kind === "tasting" && (
        <>
          {text(copy, 60, 215, 68, ink, 700)}
          {image(0, 270, 330, 460, 460, "circle")}
          {["香气 / AROMA", "口感 / BODY", "余韵 / FINISH"].map((x, i) => (
            <g key={x}>
              {text(x, 70, 910 + i * 125, 30)}
              <path
                d={`M430 ${900 + i * 125}H900`}
                stroke={ink}
                strokeWidth="2"
              />
            </g>
          ))}
          {text("写下你的感受，而不是标准答案。", 70, 1320, 23)}
        </>
      )}
      {b.kind === "palette" && (
        <>
          {text(copy, 60, 225, 66, ink, 700)}
          {[ink, accent, "#A5AC89", paper].map((c, i) => (
            <g key={i}>
              <rect
                x={60 + i * 385}
                y="330"
                width="355"
                height="480"
                fill={c}
                stroke={ink}
              />
              {text(c, 65 + i * 385, 865, 28)}
            </g>
          ))}
        </>
      )}
      {b.kind === "sign" && (
        <>
          {text(copy, 95, 490, 156, paper, 700)}
          <path d="M75 730H1525" stroke={accent} strokeWidth="16" />
          {text("OPEN SLOWLY / STAY A WHILE", 95, 810, 28)}
        </>
      )}
      {b.kind === "thanks" && (
        <>
          {image(4, 780, 135, 560, 730)}
          {text(copy, 60, 335, 75, ink, 700)}
          {text("每一次停留，都让这里更像一个地方。", 65, 660, 27)}
          {text("THANK YOU / CHISHAN", 65, 880, 24, accent)}
        </>
      )}
      {b.kind === "season" && (
        <>
          {image(1, 0, 120, 1200, 800)}
          <rect x="80" y="715" width="1040" height="730" fill={accent} />
          {text(copy, 140, 920, 88, paper, 700)}
          {text("SUMMER SLOW BREW\n季节风味 / 概念视觉", 140, 1270, 34, paper)}
        </>
      )}
      {b.kind === "postcard" && (
        <>
          {image(3, 60, 130, 830, 750)}
          <path d="M940 150V900" stroke={ink} strokeWidth="2" />
          {text(copy, 1000, 260, 40)}
          {[390, 490, 590, 690, 790].map((y) => (
            <path key={y} d={`M1000 ${y}H1530`} stroke="#999F8A" />
          ))}
        </>
      )}
      {b.kind === "editorial" && (
        <>
          {text(copy, 60, 230, 105, ink, 700)}
          {image(4, 60, 520, 650, 1000)}
          {image(0, 740, 790, 600, 800)}
          {text("ISSUE 01 / 山野与日常", 65, 1700, 27)}
        </>
      )}
      {b.kind === "end" && (
        <>
          <circle cx="600" cy="515" r="310" fill={accent} />
          {text(copy, 175, 475, 115, paper, 700)}
          {text("CHISHAN / 每天一小段山野", 200, 1010, 36)}
        </>
      )}
      <text
        x="60"
        y={b.h - 28}
        fill={fill}
        opacity=".6"
        fontFamily="Arial, Noto Sans SC, sans-serif"
        fontSize="15"
      >
        DESIGNBUDDY / 虚构品牌视觉样板 · 非真实商业宣传
      </text>
    </svg>
  );
}
type BrandState = {
  index: number;
  accent: string;
  captions: Record<string, string>;
  favorites: number[];
};
const initial: BrandState = {
  index: 0,
  accent: "#B95532",
  captions: {},
  favorites: [],
};
export default function BrandGallery({
  draftId,
  variant = "chishan",
}: {
  draftId?: string;
  variant?: "chishan" | "nature";
}) {
  const boards = variant === "nature" ? natureBoards : artboards;
  const brandPhotos = variant === "nature" ? naturePhotos : chishanPhotos;
  const Artwork = variant === "nature" ? NatureArtwork : BrandArtwork;
  const galleryTitle =
    variant === "nature"
      ? "野生来信 · 自然摄影海报集"
      : "迟山 / 山野咖啡视觉系统";
  const [s, set, error] = useSampleState(variant, draftId, {
    ...initial,
    accent: variant === "nature" ? "#285C99" : initial.accent,
  });
  const [zoom, scale] = useState(100);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, move] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const [notice, msg] = useState("");
  const [busy, working] = useState(false);
  const [filter, only] = useState(false);
  const index = Math.min(19, Math.max(0, s.index));
  const board = boards[index];
  function fit() {
    const el = canvasRef.current;
    if (el)
      scale(
        Math.floor(
          Math.min(
            (el.clientWidth * 0.9) / board.w,
            (el.clientHeight * 0.9) / board.h,
            1,
          ) * 100,
        ),
      );
    move({ x: 0, y: 0 });
  }
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, [index]);
  function choose(i: number) {
    set((v) => ({ ...v, index: i }));
    move({ x: 0, y: 0 });
  }
  async function svgFile(i: number) {
    const { renderToStaticMarkup } = await import("react-dom/server");
    let markup = renderToStaticMarkup(
      <Artwork index={i} accent={s.accent} caption={s.captions[i]} />,
    );
    for (const p of brandPhotos) {
      if (markup.includes(p.url))
        markup = markup.split(p.url).join(await dataUrl(p.url));
    }
    return markup.replace(
      "</svg>",
      `<metadata>${brandPhotos
        .map((p) => `${p.credit} / ${p.license} / ${p.source}`)
        .join(" | ")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</metadata></svg>`,
    );
  }
  async function exportArt(format: "svg" | "png" | "zip") {
    working(true);
    try {
      if (format === "zip") {
        const { zipSync, strToU8 } = await import("fflate");
        const entries: Record<string, Uint8Array> = {};
        for (let i = 0; i < 20; i++)
          entries[`${String(i + 1).padStart(2, "0")}-${boards[i].title}.svg`] =
            strToU8(await svgFile(i));
        entries["摄影素材署名.txt"] = strToU8(
          brandPhotos
            .map(
              (p) =>
                `${p.label}\n${p.credit}\n${p.license}\n${p.source}\n已裁切排版与转换格式。`,
            )
            .join("\n\n"),
        );
        download(
          new Blob([zipSync(entries).buffer as ArrayBuffer], {
            type: "application/zip",
          }),
          galleryTitle + "-20张视觉画板.zip",
        );
      } else {
        const svg = await svgFile(index);
        if (format === "svg")
          download(
            new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
            `${board.title}.svg`,
          );
        else {
          const url = URL.createObjectURL(
            new Blob([svg], { type: "image/svg+xml" }),
          );
          try {
            const image = new Image();
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () => reject(new Error("无法渲染画板"));
              image.src = url;
            });
            const canvas = document.createElement("canvas");
            canvas.width = board.w;
            canvas.height = board.h;
            canvas.getContext("2d")!.drawImage(image, 0, 0, board.w, board.h);
            const blob = await new Promise<Blob | null>((r) =>
              canvas.toBlob(r, "image/png"),
            );
            if (!blob) throw new Error("PNG 导出失败");
            download(blob, `${board.title}.png`);
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      }
      msg("已导出真实画板文件，图片已嵌入，不依赖外链。");
    } catch (e) {
      msg(e instanceof Error ? e.message : "导出失败");
    } finally {
      working(false);
    }
  }
  function copy() {
    try {
      copySample(variant, s);
    } catch {
      msg("副本保存失败，请先导出画板。");
    }
  }
  return (
    <main className={`sample-view brand-view ${variant}-gallery`}>
      <SampleTop
        type="图片作品 · 20张独立画板"
        title={galleryTitle}
        draftId={draftId}
        onCopy={copy}
      >
        <button disabled={busy} onClick={() => void exportArt("zip")}>
          {busy ? "正在导出…" : "下载20张 SVG"}
        </button>
      </SampleTop>
      <Notice text={error || notice} />
      <div className="brand-studio">
        <aside className="brand-filmstrip">
          <div>
            <strong>画板 / 20</strong>
            <button aria-pressed={filter} onClick={() => only(!filter)}>
              ★ {filter ? "全部" : "收藏"}
            </button>
          </div>
          {boards
            .filter((b) => !filter || s.favorites.includes(b.index))
            .map((b) => (
              <button
                key={b.index}
                aria-label={`打开画板${b.index + 1} ${b.title}`}
                aria-current={index === b.index ? "page" : undefined}
                onClick={() => choose(b.index)}
              >
                <Artwork
                  index={b.index}
                  accent={s.accent}
                  caption={s.captions[b.index]}
                />
                <span>
                  {String(b.index + 1).padStart(2, "0")} · {b.title}
                </span>
              </button>
            ))}
          {filter && !s.favorites.length && <p>还没有收藏画板。</p>}
        </aside>
        <section className="brand-viewer">
          <div className="brand-canvas-toolbar">
            <div>
              <strong>{board.title}</strong>
              <span>
                {board.w} × {board.h} px
              </span>
            </div>
            <button
              aria-label="缩小画板"
              onClick={() => scale(Math.max(10, zoom - 25))}
            >
              −
            </button>
            <span>{zoom}%</span>
            <button
              aria-label="放大画板"
              onClick={() => scale(Math.min(400, zoom + 25))}
            >
              ＋
            </button>
            <button
              onClick={() => {
                scale(100);
                move({ x: 0, y: 0 });
              }}
            >
              原尺寸
            </button>
            <button onClick={fit}>适合窗口</button>
          </div>
          <div
            ref={canvasRef}
            className="brand-canvas"
            aria-label="可拖动画板画布"
            onDoubleClick={fit}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                px: pan.x,
                py: pan.y,
              };
            }}
            onPointerMove={(e) => {
              if (drag.current)
                move({
                  x: drag.current.px + e.clientX - drag.current.x,
                  y: drag.current.py + e.clientY - drag.current.y,
                });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <div
              className="brand-canvas-art"
              style={{
                width: board.w,
                height: board.h,
                transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom / 100})`,
              }}
            >
              <Artwork
                index={index}
                accent={s.accent}
                caption={s.captions[index]}
              />
            </div>
          </div>
          <div className="brand-next">
            <button disabled={!index} onClick={() => choose(index - 1)}>
              ← 上一张
            </button>
            <span>拖动画布平移 · 双击复位 · {index + 1} / 20</span>
            <button disabled={index === 19} onClick={() => choose(index + 1)}>
              下一张 →
            </button>
          </div>
        </section>
        <aside className="brand-inspector">
          <small>ARTWORK PROPERTIES</small>
          <h2>只编辑画面，不是网页。</h2>
          <label>
            品牌强调色
            <input
              type="color"
              aria-label="品牌强调色"
              value={s.accent}
              onChange={(e) => set((v) => ({ ...v, accent: e.target.value }))}
            />
          </label>
          <label>
            画板主文案
            <textarea
              aria-label="画板主文案"
              maxLength={44}
              value={s.captions[index] ?? board.copy}
              onChange={(e) =>
                set((v) => ({
                  ...v,
                  captions: { ...v.captions, [index]: e.target.value },
                }))
              }
            />
          </label>
          <button
            aria-pressed={s.favorites.includes(index)}
            onClick={() =>
              set((v) => ({
                ...v,
                favorites: v.favorites.includes(index)
                  ? v.favorites.filter((i) => i !== index)
                  : [...v.favorites, index],
              }))
            }
          >
            {s.favorites.includes(index) ? "★ 已收藏画板" : "☆ 收藏此画板"}
          </button>
          <hr />
          <button disabled={busy} onClick={() => void exportArt("svg")}>
            下载可编辑 SVG
          </button>
          <button disabled={busy} onClick={() => void exportArt("png")}>
            下载原尺寸 PNG
          </button>
          <p>
            SVG保留文字、照片和矢量构图；PNG是当前画板的真实像素图。不是网页截图，也不是HTML模版。
          </p>
        </aside>
      </div>
      <Credits photos={brandPhotos} />
    </main>
  );
}

export function NatureGallery({ draftId }: { draftId?: string }) {
  return <BrandGallery variant="nature" draftId={draftId} />;
}
