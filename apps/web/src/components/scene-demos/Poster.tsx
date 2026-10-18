import { embeddedFontStyle } from "./fonts";
import { useRef, useState } from "react";
import { useSceneState } from "./workspace";
import { art, Toolbar, type DemoProps } from "./shared";
import { escapeXML, imageData, saveBlob, toPng, uploadImage } from "./files";
export type PosterLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
};
export const posterLayers: PosterLayer[] = [
  { id: "eyebrow", text: "BOTANICAL COLLECTION / 2026", x: 10, y: 8, size: 24 },
  { id: "title", text: "让自然，\n慢慢发生。", x: 10, y: 17, size: 106 },
  {
    id: "subtitle",
    text: "留一点空间，给生活里的绿意。",
    x: 10,
    y: 82,
    size: 28,
  },
  {
    id: "footer",
    text: "10.24 — 11.08  /  自然生活提案",
    x: 10,
    y: 90,
    size: 19,
  },
];
export const posterSizes: Record<string, [number, number]> = {
  portrait: [1200, 1600],
  square: [1200, 1200],
  landscape: [1600, 900],
};
export async function makePosterSvg(data: Record<string, any>) {
  const [w, h] =
    posterSizes[data.posterSize || "portrait"] || posterSizes.portrait;
  const layers = (data.layers || posterLayers) as PosterLayer[];
  const image = await imageData(data.posterImage || art.botanical);
  const focus = data.posterFocus ?? 50;
  const font = await embeddedFontStyle(layers.map((l) => l.text).join(""));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${font}<defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient></defs><rect width="${w}" height="${h}" fill="#768273"/><image href="${image}" width="${w}" height="${h}" preserveAspectRatio="x${focus < 34 ? "Min" : focus > 66 ? "Max" : "Mid"}YMid slice"/><rect width="${w}" height="${h}" fill="url(#shade)"/>${layers
    .map(
      (l) =>
        `<text x="${(l.x * w) / 100}" y="${(l.y * h) / 100 + (l.size * w) / 1200}" font-family="Noto Sans SC, Microsoft YaHei, sans-serif" font-size="${(l.size * w) / 1200}" fill="${escapeXML(data.posterInk || "#f6f2dd")}">${l.text
          .split("\n")
          .map(
            (t, i) =>
              `<tspan x="${(l.x * w) / 100}" dy="${i ? ((l.size * w) / 1200) * 1.15 : 0}">${escapeXML(t)}</tspan>`,
          )
          .join("")}</text>`,
    )
    .join(
      "",
    )}<metadata>DesignBuddy botanical concept poster. Built-in image is AI-generated; uploaded assets require the uploader's authorization. Text remains vector text; photography is embedded raster imagery.</metadata></svg>`;
}
export function Poster({ interactive }: DemoProps) {
  const [layers, setLayers] = useSceneState("layers", posterLayers),
    [size, setSize] = useSceneState("posterSize", "portrait"),
    [image, setImage] = useSceneState("posterImage", art.botanical),
    [ink, setInk] = useSceneState("posterInk", "#f6f2dd"),
    [focus, setFocus] = useSceneState("posterFocus", 50);
  const [selected, setSelected] = useState("title"),
    [guides, setGuides] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLDivElement>(null),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      ox: number;
      oy: number;
      w: number;
      h: number;
    } | null>(null);
  const active = layers.find((l) => l.id === selected);
  const [w, h] = posterSizes[size] || posterSizes.portrait;
  const patch = (id: string, p: Partial<PosterLayer>) =>
    setLayers((old) => old.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const exportFile = async (format: "png" | "svg") => {
    setBusy(true);
    try {
      const svg = await makePosterSvg({
        layers,
        posterSize: size,
        posterImage: image,
        posterInk: ink,
        posterFocus: focus,
      });
      if (format === "svg")
        saveBlob(
          "botanical-poster.svg",
          new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        );
      else await toPng(svg, "botanical-poster.png");
      setMessage(`${format.toUpperCase()} 已导出：${w} × ${h}。`);
    } catch (e) {
      setMessage(`导出失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ws-poster-studio">
      <Toolbar brand="STILL / STUDIO" title="植物生活 · 视觉海报">
        <span>
          {w} × {h}
        </span>
        <button disabled={busy} onClick={() => exportFile("svg")}>
          矢量 SVG
        </button>
        <button disabled={busy} onClick={() => exportFile("png")}>
          {busy ? "正在生成…" : "导出 PNG ↓"}
        </button>
      </Toolbar>
      <div className="ws-poster-layout">
        <aside className="ws-poster-tools">
          <small>ART DIRECTION</small>
          <h2>
            让文字，
            <br />
            成为构图。
          </h2>
          <p>点击文字直接编辑。拖动对象的移动手柄，或用方向键微调位置。</p>
          <label>
            画布尺寸
            <select
              aria-label="海报尺寸"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="portrait">竖版 · 3:4</option>
              <option value="square">方形 · 1:1</option>
              <option value="landscape">横版 · 16:9</option>
            </select>
          </label>
          <label className="ws-upload">
            上传自己的图片
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f)
                  try {
                    setImage(await uploadImage(f));
                    setMessage("新图片已应用。");
                  } catch (err) {
                    setMessage((err as Error).message);
                  }
              }}
            />
          </label>
          <label>
            裁切焦点
            <select
              aria-label="海报裁切焦点"
              value={focus}
              onChange={(e) => setFocus(+e.target.value)}
            >
              <option value={0}>左侧</option>
              <option value={50}>居中</option>
              <option value={100}>右侧</option>
            </select>
          </label>
          <label>
            文字颜色
            <input
              aria-label="海报文字颜色"
              type="color"
              value={ink}
              onChange={(e) => setInk(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={guides}
              onChange={(e) => setGuides(e.target.checked)}
            />{" "}
            显示对齐参考线
          </label>
          <hr />
          <small>LAYERS / 图层</small>
          {layers.map((l) => (
            <button
              className="ws-layer"
              key={l.id}
              aria-pressed={selected === l.id}
              onClick={() => setSelected(l.id)}
            >
              <span>Ｔ</span>
              {l.text.split("\n")[0]}
            </button>
          ))}
          {active && (
            <label>
              选中文字大小 · {active.size}
              <input
                aria-label="海报字号"
                type="range"
                min="16"
                max="150"
                value={active.size}
                onChange={(e) => patch(active.id, { size: +e.target.value })}
              />
            </label>
          )}
        </aside>
        <div className="ws-poster-mat">
          <div
            className={`ws-poster-canvas ${guides && interactive ? "show-guides" : ""}`}
            ref={canvas}
            style={{ aspectRatio: `${w}/${h}`, color: ink }}
          >
            <img
              src={image}
              alt="自然生活海报主视觉"
              style={{ objectPosition: `${focus}% center` }}
            />
            <div className="ws-poster-shade" />
            {layers.map((l) => (
              <div
                key={l.id}
                className={`ws-poster-layer ${selected === l.id && interactive ? "selected" : ""}`}
                style={{
                  left: `${l.x}%`,
                  top: `${l.y}%`,
                  fontSize: `${l.size / 12}cqw`,
                  width: `${Math.max(20, 94 - l.x)}%`,
                }}
              >
                {interactive && (
                  <button
                    className="ws-drag-handle"
                    data-no-print
                    aria-label={`移动${l.id}图层`}
                    onFocus={() => setSelected(l.id)}
                    onKeyDown={(e) => {
                      if (!e.key.startsWith("Arrow")) return;
                      e.preventDefault();
                      const d = e.shiftKey ? 3 : 0.5;
                      patch(l.id, {
                        x: Math.max(
                          0,
                          Math.min(
                            75,
                            l.x +
                              (e.key === "ArrowRight"
                                ? d
                                : e.key === "ArrowLeft"
                                  ? -d
                                  : 0),
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            94,
                            l.y +
                              (e.key === "ArrowDown"
                                ? d
                                : e.key === "ArrowUp"
                                  ? -d
                                  : 0),
                          ),
                        ),
                      });
                    }}
                    onPointerDown={(e) => {
                      const rect = canvas.current!.getBoundingClientRect();
                      setSelected(l.id);
                      drag.current = {
                        id: l.id,
                        x: e.clientX,
                        y: e.clientY,
                        ox: l.x,
                        oy: l.y,
                        w: rect.width,
                        h: rect.height,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      if (!d) return;
                      let x = Math.max(
                          0,
                          Math.min(75, d.ox + ((e.clientX - d.x) / d.w) * 100),
                        ),
                        y = Math.max(
                          0,
                          Math.min(94, d.oy + ((e.clientY - d.y) / d.h) * 100),
                        );
                      if (guides) {
                        if (Math.abs(x - 10) < 1) x = 10;
                        if (Math.abs(x - 50) < 1) x = 50;
                        if (Math.abs(y - 50) < 1) y = 50;
                      }
                      patch(d.id, { x, y });
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                  >
                    ✥
                  </button>
                )}
                {interactive ? (
                  <textarea
                    aria-label={`海报${l.id}文字`}
                    rows={Math.max(1, l.text.split("\n").length)}
                    value={l.text}
                    maxLength={l.id === "title" ? 60 : 120}
                    onFocus={() => setSelected(l.id)}
                    onChange={(e) => patch(l.id, { text: e.target.value })}
                  />
                ) : (
                  <span>{l.text}</span>
                )}
              </div>
            ))}
          </div>
          <p>
            {interactive
              ? "可编辑文字 + 摄影图层 · 修改自动保存在此浏览器"
              : "BOTANICAL / AN EDITORIAL POSTER"}
          </p>
        </div>
      </div>
      {message && (
        <p className="ws-inline-status" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
