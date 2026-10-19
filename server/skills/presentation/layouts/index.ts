import { drawNativeExplanation } from "./explanations";
import {
  directionRoles,
  directionPaces,
  presentationDirectionEngineVersion,
  directorLayoutIds,
} from "../../../../shared/presentationDirection";
import PptxGenJS from "pptxgenjs";
import { createHash } from "node:crypto";
import type { Colors, StructuredSlide, ResolvedText } from "../../pptx-deck";
import { applyStructuredTheme } from "../../pptx-theme";
import { json, out } from "../../io";
import {
  presentationLayoutCatalog,
  presentationLayoutEngineVersion,
  presentationVisualEngineVersion,
  type PresentationDesign,
  type PresentationLayoutId,
} from "../../../../shared/presentationDesign";
import type { VisualBuildOptions } from "../visuals";
import { textHeight, textLines } from "./measure";

export type Box = { x: number; y: number; w: number; h: number };
export type ResolvedObject = Box & {
  slideId: string;
  elementId: string;
  kind: "text" | "shape" | "chart" | "table" | "image";
  role: string;
  decorative?: boolean;
  parentId?: string;
};
type Style = {
  size: number;
  color: string;
  fill: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
};
type Element = ResolvedObject & {
  text?: string;
  style?: Style;
  fill?: string;
  data?: any;
};
export type ResolvedSlide = {
  id: string;
  layoutId: PresentationLayoutId;
  nature: PresentationDesign["nature"];
  semanticHash: string;
  elements: Element[];
};
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const rgb = (v: string) => v.replace(/^#/, "").toUpperCase();
const natureLabels = {
  fact: "事实",
  analysis: "分析",
  recommendation: "建议",
  pending: "待确认",
};

export function validateSlideDesign(
  value: unknown,
  content: StructuredSlide,
  page = 0,
  count = 0,
): PresentationDesign {
  const raw =
    value === undefined
      ? { layout: "auto", nature: "pending" }
      : (value as any);
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).some(
      (k) =>
        ![
          "layout",
          "nature",
          "takeaway",
          "emphasisRows",
          "visual",
          "directed",
        ].includes(k),
    )
  )
    throw Error("版式意图只允许已支持的声明字段，不接受坐标/代码。");
  if (
    raw.layout !== "auto" &&
    !presentationLayoutCatalog.some(
      (l) => l.id === raw.layout && l.type === content.type,
    )
  )
    throw Error("版式不存在或与页面类型不兼容。");
  if (raw.directed !== undefined) {
    const v = raw.directed;
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some(
        (k) => !["role", "pace", "focusIndex", "sequenceBasis"].includes(k),
      ) ||
      !Object.hasOwn(directionRoles, v.role) ||
      !Object.hasOwn(directionPaces, v.pace) ||
      (v.sequenceBasis !== undefined &&
        !["proposal", "source"].includes(v.sequenceBasis)) ||
      (v.focusIndex !== undefined &&
        (!Number.isInteger(v.focusIndex) ||
          content.type !== "bullets" ||
          v.focusIndex < 0 ||
          v.focusIndex >= content.bullets.length))
    )
      throw Error("导演编译元数据非法。");
    if (
      v.sequenceBasis === "proposal" &&
      !["recommendation", "pending"].includes(raw.nature)
    )
      throw Error("建议顺序不能视为事实。");
  }
  if (raw.visual !== undefined) {
    const v = raw.visual;
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some((k) => !["assetId", "fit"].includes(k)) ||
      typeof v.assetId !== "string" ||
      !/^asset-[a-z0-9][a-z0-9-]{0,30}$/.test(v.assetId) ||
      !["contain", "cover"].includes(v.fit) ||
      !["cover", "bullets"].includes(content.type) ||
      !["auto", "visual-cover", "visual-story", "screenshot-evidence"].includes(
        raw.layout,
      )
    )
      throw Error(
        "图文意图须绑定已支持的图片布局/素材ID及完整显示或中心裁切。",
      );
  }
  if (
    ["visual-cover", "visual-story", "screenshot-evidence"].includes(
      raw.layout,
    ) &&
    !raw.visual
  )
    throw Error("图文布局必须绑定真实素材。");
  if (!Object.hasOwn(natureLabels, raw.nature))
    throw Error("页面须区分 fact / analysis / recommendation / pending。");
  if (
    raw.takeaway !== undefined &&
    (typeof raw.takeaway !== "string" ||
      !raw.takeaway.trim() ||
      raw.takeaway.length > 160 ||
      /[\x00-\x1f\x7f]/.test(raw.takeaway))
  )
    throw Error("结论说明需要1–160字安全文本。");
  if (
    content.type === "chart" &&
    raw.layout === "chart-ledger" &&
    content.categories.length > 3
  )
    throw Error(
      "图表与明细版式当前最多3个类别；请选择图表与结论或确认拆页，不会隐藏类别。",
    );
  if (
    raw.emphasisRows !== undefined &&
    (content.type !== "table" ||
      !Array.isArray(raw.emphasisRows) ||
      raw.emphasisRows.length > content.rows.length ||
      new Set(raw.emphasisRows).size !== raw.emphasisRows.length ||
      raw.emphasisRows.some(
        (r: unknown) =>
          !Number.isInteger(r) ||
          (r as number) < 0 ||
          (r as number) >= content.rows.length,
      ))
  )
    throw Error("强调行只能选择本页实际存在的数据行，不能改变数据。");
  return {
    layout: raw.layout,
    ...(raw.directed ? { directed: { ...raw.directed } } : {}),
    nature: raw.nature,
    ...(raw.visual === undefined
      ? {}
      : { visual: { assetId: raw.visual.assetId, fit: raw.visual.fit } }),
    ...(raw.takeaway === undefined ? {} : { takeaway: raw.takeaway.trim() }),
    ...(raw.emphasisRows === undefined
      ? {}
      : { emphasisRows: [...raw.emphasisRows] }),
  };
}
function balancedHeadline(value: string, w: number, size: number) {
  if (textLines(value, w, size, true) <= 1) return value;
  const segments = [
      ...new Intl.Segmenter("zh", { granularity: "word" }).segment(value),
    ],
    candidates = segments
      .slice(1)
      .map((s) => s.index)
      .filter(
        (i) =>
          textLines(value.slice(0, i), w, size, true) === 1 &&
          textLines(value.slice(i), w, size, true) === 1,
      );
  if (!candidates.length) return value;
  candidates.sort(
    (a, b) => Math.abs(value.length - 2 * a) - Math.abs(value.length - 2 * b),
  );
  const at = candidates[0];
  return value.slice(0, at) + "\n" + value.slice(at);
}
function selectLayout(
  s: StructuredSlide,
  d: PresentationDesign,
  page: number,
  total: number,
): PresentationLayoutId {
  if (d.layout !== "auto") return d.layout;
  const defaults: Record<string, PresentationLayoutId> = {
    cover: "editorial-cover",
    bullets: page === total - 1 ? "action-agenda" : "executive-summary",
    comparison: "capability-boundary",
    metrics: "kpi-insight",
    chart: "chart-takeaway",
    table: "adaptive-table",
    timeline: "stage-gates",
    quote: "evidence-spotlight",
  };
  return defaults[s.type];
}
export function resolveAdaptiveDeck(
  slides: StructuredSlide[],
  theme: Colors,
  designs: PresentationDesign[],
  visual?: VisualBuildOptions,
): ResolvedSlide[] {
  if (designs.length !== slides.length)
    throw Error("逐页版式意图与文稿数量不一致。");
  return slides.map((s, page) => {
    const d = validateSlideDesign(designs[page], s, page, slides.length),
      layoutId = selectLayout(s, d, page, slides.length);
    const id = `slide-${String(page + 1).padStart(2, "0")}`,
      elements: Element[] = [];
    const add = (
      kind: Element["kind"],
      role: string,
      box: Box,
      extra: Partial<Element> = {},
    ) => {
      const e = {
        slideId: id,
        elementId: `${id}-${role}`,
        kind,
        role,
        ...box,
        ...extra,
      };
      if (elements.some((v) => v.elementId === e.elementId))
        throw Error("版式元素标识重复。");
      elements.push(e);
      return e;
    };
    const shape = (
      role: string,
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
    ) => add("shape", role, { x, y, w, h }, { fill, decorative: true });
    const text = (
      role: string,
      value: string,
      x: number,
      y: number,
      w: number,
      size = 18,
      bold = false,
      color = theme.text,
      fill = theme.background,
      minH = 0,
    ) => {
      const h = Math.max(minH, textHeight(value, w, size, bold));
      return add(
        "text",
        role,
        { x, y, w, h },
        { text: value, style: { size, bold, color, fill } },
      );
    };
    try {
      if (d.directed)
        text(
          "direction-kicker",
          `${directionRoles[d.directed.role]} / ${directionPaces[d.directed.pace]}`,
          2.1,
          0.4,
          8.6,
          10,
          false,
          theme.muted,
        );
      shape("top-rule", 0.62, 0.45, 0.48, 0.055, theme.accent);
      text(
        "nature",
        natureLabels[d.nature],
        11.48,
        0.4,
        1.2,
        10,
        false,
        theme.primary,
      );
      text(
        "pagination",
        `${String(page + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`,
        11.7,
        7.1,
        1.0,
        9,
        false,
        theme.muted,
      );
      text(
        "source-footer",
        "来源、字段口径与讲稿见随附证据包 · 待人工复核",
        0.65,
        7.1,
        10.5,
        9,
        false,
        theme.muted,
      );
      const imageAsset = d.visual
        ? visual?.assets.find((a) => a.id === d.visual!.assetId)
        : undefined;
      if (d.visual && !imageAsset) throw Error("图片不可用；不会渲染替代图。");
      const image = (
        role: string,
        x: number,
        y: number,
        w: number,
        h: number,
      ) => {
        if (!imageAsset || !d.visual) throw Error("图文布局没有真实素材。");
        if (imageAsset.usage === "evidence" && d.visual.fit !== "contain")
          throw Error("证据图片不允许裁切。");
        add(
          "image",
          role,
          { x, y, w, h },
          {
            decorative: imageAsset.usage === "decorative",
            data: { assetId: imageAsset.id, fit: d.visual.fit },
          },
        );
      };
      if (s.type === "cover" && imageAsset) {
        const style = visual!.style;
        if (style === "technology-launch") {
          image("hero", 6.5, 0.9, 6.833, 5.65);
          shape("cover-stage", 0, 0.9, 6.25, 5.65, theme.background);
          text(
            "visual-kicker",
            "TECHNOLOGY / DECISION BRIEF",
            0.7,
            1.15,
            5.2,
            11,
            true,
            theme.primary,
          );
          text(
            "title",
            balancedHeadline(s.title, 5.32, 40),
            0.66,
            2.05,
            5.32,
            40,
            true,
          );
          if (s.subtitle)
            text(
              "subtitle",
              s.subtitle,
              0.7,
              4.65,
              5.1,
              16,
              false,
              theme.muted,
            );
        } else if (style === "brand-editorial") {
          text(
            "visual-kicker",
            "EDITORIAL / DECISION BRIEF",
            0.65,
            1.02,
            11.5,
            11,
            true,
            theme.primary,
          );
          image("hero", 0.65, 1.75, 5.8, 4.65);
          text(
            "title",
            balancedHeadline(s.title, 5.65, 38),
            6.95,
            2.0,
            5.65,
            38,
            true,
          );
          if (s.subtitle)
            text(
              "subtitle",
              s.subtitle,
              6.98,
              4.5,
              5.45,
              16,
              false,
              theme.muted,
            );
        } else {
          text(
            "visual-kicker",
            "CONSULTING / DECISION BRIEF",
            0.65,
            1.1,
            7.0,
            11,
            true,
            theme.primary,
          );
          text(
            "title",
            balancedHeadline(s.title, 7.05, 38),
            0.65,
            2.05,
            7.05,
            38,
            true,
          );
          if (s.subtitle)
            text(
              "subtitle",
              s.subtitle,
              0.68,
              4.5,
              6.7,
              16,
              false,
              theme.muted,
            );
          image("hero", 8.12, 1.45, 4.56, 4.9);
        }
        text(
          "asset-disclosure",
          imageAsset.usage === "decorative"
            ? "概念配图 · 非业务事实证据"
            : "图片证据 · 未自动OCR",
          0.65,
          6.62,
          11.9,
          10,
          false,
          theme.muted,
        );
      } else if (s.type === "cover") {
        shape("cover-spine", 0, 0, 0.16, 7.5, theme.primary);
        text(
          "brand",
          "DESIGNBUDDY / DECISION BRIEF",
          0.9,
          1.05,
          8.9,
          12,
          true,
          theme.primary,
        );
        text("title", s.title, 0.86, 2.15, 9.0, 38, true);
        if (s.subtitle)
          text("subtitle", s.subtitle, 0.9, 4.25, 8.5, 18, false, theme.muted);
        shape("draft-panel", 10.35, 1.05, 2.35, 5.35, theme.primary);
        text(
          "draft-label",
          "DRAFT",
          10.63,
          1.5,
          1.8,
          21,
          true,
          theme.background,
          theme.primary,
        );
        text(
          "draft-status",
          "待人工\n复核",
          10.63,
          2.5,
          1.65,
          27,
          true,
          theme.background,
          theme.primary,
        );
        text(
          "draft-caption",
          "原生可编辑\n非商业认证",
          10.63,
          4.75,
          1.75,
          12,
          false,
          theme.background,
          theme.primary,
        );
      } else {
        const title = text("title", s.title, 0.62, 0.8, 12.02, 30, true);
        let top = Math.max(1.65, title.y + title.h + 0.12);
        if (s.subtitle) {
          const sub = text(
            "subtitle",
            s.subtitle,
            0.65,
            top,
            11.98,
            12,
            false,
            theme.muted,
          );
          top = sub.y + sub.h + 0.24;
        } else top += 0.15;
        const bottom = 6.85,
          H = bottom - top,
          X = 0.65,
          W = 12.03;
        if (H < 3.65) throw Error("标题与副标题过长，请调整表达或确认拆页。");
        if (
          drawNativeExplanation(s, d, { x: X, top, bottom, w: W }, theme, {
            text,
            shape,
            geometry: (role, kind, x, y, w, h, fill) =>
              add(
                "shape",
                role,
                { x, y, w, h },
                { fill, decorative: true, data: { geometry: kind } },
              ),
          })
        ) {
          // All original nodes are authored as editable text and shapes; no flattened page image.
        } else if (s.type === "bullets" && imageAsset) {
          const leftImage = visual!.style === "brand-editorial",
            iw = 5.05,
            tw = 6.65,
            ix = leftImage ? X : X + tw + 0.33,
            tx = leftImage ? X + iw + 0.33 : X;
          const captionHeight = textHeight(imageAsset.alt, iw, 12) + 0.12;
          const bodyHeight = s.body ? textHeight(s.body, tw, 16) + 0.16 : 0;
          let y = top;
          if (s.body) {
            const t = text("body", s.body, tx, y, tw, 16, false, theme.muted);
            y = t.y + t.h + 0.16;
          }
          const sizes = s.bullets.map((b) =>
            Math.max(0.72, textHeight(b, tw - 0.35, 18) + 0.22),
          );
          if (
            sizes.reduce((a, b) => a + b, 0) + 0.12 * (sizes.length - 1) >
              bottom - y ||
            H - captionHeight < 1.4
          )
            throw Error("图文页内容/图注过密，请确认换布局或拆页，不删正文。");
          s.bullets.forEach((b, i) => {
            shape(`visual-card-${i}`, tx, y, tw, sizes[i], theme.surface);
            text(
              `visual-bullet-${i}`,
              b,
              tx + 0.17,
              y + 0.1,
              tw - 0.35,
              18,
              false,
              theme.text,
              theme.surface,
            );
            y += sizes[i] + 0.12;
          });
          image("story-image", ix, top, iw, H - captionHeight - 0.13);
          text(
            "image-caption",
            imageAsset.alt,
            ix,
            bottom - captionHeight,
            iw,
            12,
            false,
            theme.muted,
          );
        } else if (s.type === "bullets") {
          const aside =
            layoutId === "executive-summary" &&
            !!s.body &&
            textHeight(s.body, 2.59, 21) < H - 1.2 &&
            s.bullets.reduce(
              (n, b) => n + Math.max(0.78, textHeight(b, 7.68, 18) + 0.3),
              0,
            ) +
              0.15 * (s.bullets.length - 1) <
              H;
          const x = aside ? 4.0 : X,
            w = aside ? 8.68 : W;
          let start = top;
          if (aside) {
            shape("summary-panel", X, top, 3.05, H, theme.primary);
            text(
              "summary-label",
              "本页要点",
              X + 0.22,
              top + 0.25,
              2.6,
              12,
              true,
              theme.background,
              theme.primary,
            );
            text(
              "body",
              s.body!,
              X + 0.22,
              top + 0.9,
              2.59,
              21,
              true,
              theme.background,
              theme.primary,
            );
          } else if (s.body) {
            const t = text("body", s.body, X, top, W, 18, false, theme.muted);
            start = t.y + t.h + 0.22;
          }
          const hero =
            !aside &&
            !s.body &&
            layoutId === "executive-summary" &&
            s.bullets.reduce(
              (n, b, i) =>
                n +
                Math.max(0.78, textHeight(b, w - 1.0, i === 0 ? 22 : 18) + 0.3),
              0,
            ) +
              0.15 * (s.bullets.length - 1) <
              bottom - start;
          const heights = s.bullets.map((b, i) =>
            Math.max(
              0.78,
              textHeight(b, w - 1.0, hero && i === 0 ? 22 : 18) + 0.3,
            ),
          );
          const gap = 0.15,
            need =
              heights.reduce((a, b) => a + b, 0) + gap * (heights.length - 1);
          if (need > bottom - start)
            throw Error(
              "正文无法在固定字号内排入本页，请确认拆页；未增页或删减要点。",
            );
          const extra = Math.min(
            0.22,
            (bottom - start - need) / s.bullets.length,
          );
          s.bullets.forEach((b, i) => {
            const h = heights[i] + extra,
              lead = hero && i === 0,
              bg = lead ? theme.primary : theme.surface,
              fg = lead ? theme.background : theme.text;
            shape(`card-${i}`, x, start, w, h, bg);
            text(
              `index-${i}`,
              String(i + 1).padStart(2, "0"),
              x + 0.2,
              start + 0.18,
              0.5,
              14,
              true,
              lead ? theme.background : theme.accent,
              bg,
            );
            text(
              `bullet-${i}`,
              b,
              x + 0.85,
              start + 0.14,
              w - 1.05,
              lead ? 22 : 18,
              lead,
              fg,
              bg,
            );
            start += h + gap;
          });
        } else if (s.type === "comparison") {
          const gap = 0.25,
            cw = (W - gap) / 2;
          s.columns.forEach((c, i) => {
            const x = X + i * (cw + gap);
            shape(`column-${i}`, x, top, cw, H, theme.surface);
            shape(
              `column-rule-${i}`,
              x,
              top,
              cw,
              0.06,
              i ? theme.accent : theme.primary,
            );
            const t = text(
              `heading-${i}`,
              c.heading,
              x + 0.25,
              top + 0.3,
              cw - 0.5,
              22,
              true,
              i ? theme.accent : theme.primary,
              theme.surface,
            );
            let y = t.y + t.h + 0.3;
            for (const [j, b] of c.bullets.entries()) {
              const t = text(
                `point-${i}-${j}`,
                b,
                x + 0.25,
                y,
                cw - 0.5,
                18,
                false,
                theme.text,
                theme.surface,
              );
              y = t.y + t.h + 0.24;
            }
            if (y - 0.24 > bottom - 0.15)
              throw Error("对照栏内容过密，请确认拆页。");
          });
        } else if (s.type === "metrics") {
          const gap = 0.22,
            cw = (W - gap * (s.items.length - 1)) / s.items.length;
          s.items.forEach((m, i) => {
            const x = X + i * (cw + gap);
            shape(`metric-card-${i}`, x, top, cw, H, theme.surface);
            text(
              `metric-value-${i}`,
              m.value,
              x + 0.25,
              top + 0.4,
              cw - 0.5,
              44,
              true,
              i % 2 ? theme.accent : theme.primary,
              theme.surface,
            );
            const t = text(
              `metric-label-${i}`,
              m.label,
              x + 0.25,
              top + 1.65,
              cw - 0.5,
              18,
              true,
              theme.text,
              theme.surface,
            );
            if (m.note)
              text(
                `metric-note-${i}`,
                m.note,
                x + 0.25,
                Math.max(top + 2.9, t.y + t.h + 0.3),
                cw - 0.5,
                13,
                false,
                theme.muted,
                theme.surface,
              );
          });
        } else if (s.type === "table") {
          addTable(
            "data-table",
            s.headers,
            s.rows,
            X,
            top,
            W,
            H,
            18,
            d.emphasisRows || [],
          );
        } else if (s.type === "chart") {
          if (layoutId === "chart-ledger") {
            const chartH = H * 0.42;
            add(
              "chart",
              "native-chart",
              { x: X, y: top, w: W, h: chartH },
              { data: s },
            );
            addTable(
              "chart-data",
              [
                "类别",
                ...s.series.map(
                  (a) => `${a.name}${s.unit ? `（${s.unit}）` : ""}`,
                ),
              ],
              s.categories.map((c, i) => [
                c,
                ...s.series.map((a) => String(a.values[i])),
              ]),
              X,
              top + chartH + 0.2,
              W,
              H - chartH - 0.2,
              13,
              [],
            );
          } else {
            const cw = 8.0;
            add(
              "chart",
              "native-chart",
              { x: X, y: top, w: cw, h: H },
              { data: s },
            );
            shape(
              "takeaway-panel",
              X + cw + 0.22,
              top,
              W - cw - 0.22,
              H,
              theme.primary,
            );
            text(
              "takeaway-label",
              "阅读提示",
              X + cw + 0.45,
              top + 0.28,
              W - cw - 0.7,
              12,
              true,
              theme.background,
              theme.primary,
            );
            text(
              "takeaway",
              d.takeaway || s.title,
              X + cw + 0.45,
              top + 0.92,
              W - cw - 0.7,
              22,
              true,
              theme.background,
              theme.primary,
            );
            text(
              "scope-note",
              "数值来自绑定单元格。\n单位、范围及未确认项\n请结合来源与讲稿核对。",
              X + cw + 0.45,
              bottom - 1.25,
              W - cw - 0.7,
              12,
              false,
              theme.background,
              theme.primary,
            );
          }
        } else if (s.type === "timeline") {
          const gap = 0.2,
            cw = (W - gap * (s.items.length - 1)) / s.items.length;
          s.items.forEach((m, i) => {
            const x = X + i * (cw + gap);
            shape(`stage-${i}`, x, top, cw, H, theme.surface);
            text(
              `stage-number-${i}`,
              String(i + 1).padStart(2, "0"),
              x + 0.2,
              top + 0.2,
              cw - 0.4,
              28,
              true,
              i % 2 ? theme.accent : theme.primary,
              theme.surface,
            );
            let y = top + 1.0;
            if (m.date) {
              const t = text(
                `stage-date-${i}`,
                m.date,
                x + 0.2,
                y,
                cw - 0.4,
                12,
                false,
                theme.muted,
                theme.surface,
              );
              y = t.y + t.h + 0.18;
            }
            const label = text(
              `stage-label-${i}`,
              m.label,
              x + 0.2,
              y,
              cw - 0.4,
              20,
              true,
              theme.text,
              theme.surface,
            );
            text(
              `stage-body-${i}`,
              m.body,
              x + 0.2,
              label.y + label.h + 0.3,
              cw - 0.4,
              17,
              false,
              theme.muted,
              theme.surface,
            );
          });
        } else if (s.type === "quote") {
          shape("quote-panel", X, top, W, H, theme.surface);
          shape("quote-rule", X, top, 0.09, H, theme.accent);
          text(
            "quote-label",
            "原文证据 / 非独立事实认证",
            X + 0.38,
            top + 0.3,
            W - 0.76,
            12,
            true,
            theme.primary,
            theme.surface,
          );
          const q = text(
            "quote",
            `“${s.quote}”`,
            X + 0.38,
            top + 0.95,
            W - 0.76,
            24,
            true,
            theme.text,
            theme.surface,
          );
          if (s.attribution)
            text(
              "attribution",
              s.attribution,
              X + 0.38,
              q.y + q.h + 0.3,
              W - 0.76,
              14,
              false,
              theme.muted,
              theme.surface,
            );
        }
        // No implicit font changes or truncation. Content crossing the safe area requires an explicit edit/split.
        for (const e of elements)
          if (
            e.kind === "text" &&
            ![
              "source-footer",
              "pagination",
              "nature",
              "title",
              "subtitle",
            ].includes(e.role) &&
            e.y + e.h > bottom + 0.005
          )
            throw Error(`元素 ${e.role} 超出内容安全区，请确认换布局或拆页。`);
        function addTable(
          role: string,
          headers: string[],
          rows: string[][],
          x: number,
          y: number,
          w: number,
          maxH: number,
          size: number,
          emphasis: number[],
        ) {
          const values = [headers, ...rows];
          const weights = headers.map((_, c) =>
            Math.max(
              5,
              ...values.map((r) => Math.min(24, Array.from(r[c]).length)),
            ),
          );
          if (layoutId === "risk-response" && headers.length === 3)
            weights.splice(0, 3, 5, 10, 12);
          if (layoutId === "decision-matrix")
            weights[0] = Math.max(5, weights[0] * 0.65);
          const min = 1.4,
            rest = w - min * headers.length,
            total = weights.reduce((a, b) => a + b, 0),
            widths = weights.map((v) => min + (rest * v) / total);
          const rowHeights = values.map((row, r) =>
            Math.max(
              0.58,
              ...row.map(
                (v, c) =>
                  textHeight(
                    v,
                    widths[c] - 0.28,
                    size,
                    !r ||
                      emphasis.includes(r - 1) ||
                      (layoutId === "risk-response" && c === 0),
                  ) + 0.22,
              ),
            ),
          );
          const required = rowHeights.reduce((a, b) => a + b, 0);
          if (required > maxH)
            throw Error(
              "表格无法完整排入本页；请确认减少展示列或拆页，不会隐藏行或缩字。",
            );
          const surplus =
            role === "data-table"
              ? (maxH - required) / values.length
              : Math.min(0.12, (maxH - required) / values.length);
          rowHeights.forEach((_, i) => (rowHeights[i] += surplus));
          const table = add(
            "table",
            role,
            { x, y, w, h: rowHeights.reduce((a, b) => a + b, 0) },
            {
              data: {
                values,
                widths,
                rowHeights,
                size,
                emphasis,
                riskKey: layoutId === "risk-response",
              },
            },
          );
          let cy = y;
          values.forEach((row, r) => {
            let cx = x;
            row.forEach((v, c) => {
              const highlighted = r > 0 && emphasis.includes(r - 1);
              const bg = !r || highlighted ? theme.primary : theme.surface;
              const fg = !r || highlighted ? theme.background : theme.text;
              const bold =
                !r || highlighted || (layoutId === "risk-response" && c === 0);
              const height = textHeight(v, widths[c] - 0.28, size, bold);
              const e = text(
                `${role}-r${r}-c${c}`,
                v,
                cx + 0.14,
                cy + (rowHeights[r] - height) / 2,
                widths[c] - 0.28,
                size,
                bold,
                fg,
                bg,
              );
              e.parentId = table.elementId;
              cx += widths[c];
            });
            cy += rowHeights[r];
          });
        }
      }
      if (visual?.style === "brand-editorial")
        shape("editorial-spine", 0.16, 1.7, 0.07, 4.8, theme.primary);
      if (visual?.style === "technology-launch")
        shape("stage-edge", 13.12, 0.25, 0.035, 6.65, theme.primary);
      if (visual?.logoAssetId) {
        const logo = visual.assets.find(
          (a) => a.id === visual.logoAssetId && a.role === "logo",
        );
        if (!logo) throw Error("品牌Logo不存在。");
        const oldRule = elements.findIndex((e) => e.role === "top-rule");
        if (oldRule >= 0) elements.splice(oldRule, 1);
        add(
          "image",
          "brand-logo",
          { x: 0.65, y: 0.35, w: 1.15, h: 0.32 },
          { decorative: true, data: { assetId: logo.id, fit: "contain" } },
        );
      }
      for (const e of elements)
        if (
          ![e.x, e.y, e.w, e.h].every(Number.isFinite) ||
          e.x < 0 ||
          e.y < 0 ||
          e.w <= 0 ||
          e.h <= 0 ||
          e.x + e.w > 13.334 ||
          e.y + e.h > 7.501
        )
          throw Error(`元素 ${e.role} 超出画布。`);
      return {
        id,
        layoutId,
        nature: d.nature,
        semanticHash: hash({
          content: s,
          takeaway: d.takeaway || null,
          ...(d.directed ? { directed: d.directed } : {}),
          ...(d.visual
            ? { visual: { ...d.visual, sha256: imageAsset?.sha256 } }
            : {}),
        }),
        elements,
      };
    } catch (error) {
      throw Error(
        `第${page + 1}页「${s.title}」：${error instanceof Error ? error.message : "版式求解失败"}`,
      );
    }
  });
}

export async function buildAdaptivePresentation(
  deck: {
    title: string;
    theme: Colors;
    bodyFont: string;
    headingFont: string;
    slides: StructuredSlide[];
  },
  designs: PresentationDesign[],
  visual?: VisualBuildOptions,
) {
  if (deck.bodyFont !== "Noto Sans SC" || deck.headingFont !== "Noto Sans SC")
    throw Error(
      "自适应V2仅对随部署提供的Noto Sans SC字体进行度量；请明确配置该字体。",
    );
  const resolved = resolveAdaptiveDeck(
      deck.slides,
      deck.theme,
      designs,
      visual,
    ),
    pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "DesignBuddy";
  pptx.title = deck.title;
  pptx.subject = "自适应商务V2 · 原生可编辑草稿";
  pptx.theme = { headFontFace: deck.headingFont, bodyFontFace: deck.bodyFont };
  const layout: ResolvedText[] = [],
    objects: ResolvedObject[] = [];
  for (const [i, page] of resolved.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: rgb(deck.theme.background) };
    for (const e of page.elements) {
      const {
        slideId,
        elementId,
        kind,
        role,
        x,
        y,
        w,
        h,
        decorative,
        parentId,
      } = e;
      objects.push({
        slideId,
        elementId,
        kind,
        role,
        x,
        y,
        w,
        h,
        ...(decorative ? { decorative } : {}),
        ...(parentId ? { parentId } : {}),
      });
      if (kind === "text") {
        const s = e.style!;
        layout.push({
          slideId,
          elementId,
          text: e.text!,
          x,
          y,
          w,
          h,
          fontSize: s.size,
          fontFace: s.bold ? deck.headingFont : deck.bodyFont,
          color: s.color,
          fill: s.fill,
          bold: !!s.bold,
          role: parentId ? "table-cell" : "text",
        });
        if (!parentId)
          slide.addText(e.text!, {
            x,
            y,
            w,
            h,
            fontFace: s.bold ? deck.headingFont : deck.bodyFont,
            fontSize: s.size,
            bold: s.bold,
            color: rgb(s.color),
            margin: 0,
            breakLine: false,
            valign: "top",
            paraSpaceAfter: 0,
            align: s.align || "left",
          });
      } else if (kind === "image") {
        const a = visual?.assets.find((a) => a.id === e.data.assetId);
        if (!a) throw Error("图片素材未解析。");
        const data = `image/png;base64,${a.data}`;
        if (e.data.fit === "contain") {
          const scale = Math.min(w / a.width, h / a.height),
            iw = a.width * scale,
            ih = a.height * scale;
          slide.addImage({
            data,
            x: x + (w - iw) / 2,
            y: y + (h - ih) / 2,
            w: iw,
            h: ih,
            altText: a.alt,
          });
        } else
          slide.addImage({
            data,
            x,
            y,
            w: a.width / 100,
            h: a.height / 100,
            sizing: { type: "cover", w, h },
            altText: a.alt,
          });
      } else if (kind === "shape")
        slide.addShape(
          e.data?.geometry === "chevron"
            ? pptx.ShapeType.chevron
            : e.data?.geometry === "ellipse"
              ? pptx.ShapeType.ellipse
              : pptx.ShapeType.rect,
          {
            x,
            y,
            w,
            h,
            fill: { color: rgb(e.fill!) },
            line: { color: rgb(e.fill!), transparency: 100 },
          },
        );
      else if (kind === "table") {
        const d = e.data;
        slide.addTable(
          d.values.map((row: string[], r: number) =>
            row.map((cell, c) => {
              const highlighted = r > 0 && d.emphasis.includes(r - 1);
              return {
                text: cell,
                options: {
                  bold: !r || highlighted || (d.riskKey && c === 0),
                  color: rgb(
                    !r || highlighted ? deck.theme.background : deck.theme.text,
                  ),
                  fill: rgb(
                    !r || highlighted ? deck.theme.primary : deck.theme.surface,
                  ),
                },
              };
            }),
          ),
          {
            x,
            y,
            w,
            h,
            colW: d.widths,
            rowH: d.rowHeights,
            fontFace: deck.bodyFont,
            fontSize: d.size,
            margin: [7.2, 10, 7.2, 10],
            border: { type: "solid", pt: 0.5, color: rgb(deck.theme.muted) },
            autoPage: false,
            valign: "middle",
          },
        );
      } else if (kind === "chart") {
        const c = e.data;
        slide.addChart(
          c.chartType === "line" ? pptx.ChartType.line : pptx.ChartType.bar,
          c.series.map((s: any) => ({
            name: s.name,
            labels: c.categories,
            values: s.values,
          })),
          {
            x,
            y,
            w,
            h,
            showLegend: c.series.length > 1,
            legendPos: "b",
            showValue: c.categories.length <= 8,
            dataLabelPosition: c.chartType === "bar" ? "outEnd" : undefined,
            dataLabelFormatCode: "0.############",
            valAxisLabelFormatCode: "0.############",
            dataLabelFontFace: deck.bodyFont,
            dataLabelFontSize: 12,
            dataLabelColor: rgb(deck.theme.text),
            legendFontFace: deck.bodyFont,
            legendFontSize: 11,
            legendColor: rgb(deck.theme.text),
            catAxisLabelFontFace: deck.bodyFont,
            catAxisLabelFontSize: 12,
            catAxisLabelColor: rgb(deck.theme.muted),
            valAxisLabelFontFace: deck.bodyFont,
            valAxisLabelFontSize: 10,
            valAxisLabelColor: rgb(deck.theme.muted),
            chartArea: { fill: { color: rgb(deck.theme.background) } },
            plotArea: { fill: { color: rgb(deck.theme.background) } },
            chartColors: [
              rgb(deck.theme.primary),
              rgb(deck.theme.accent),
              "6B8E7D",
            ],
            valGridLine: { color: "D9E0DB" },
            showTitle: false,
            border: { pt: 0, color: rgb(deck.theme.background) },
          },
        );
      }
    }
    const content = deck.slides[i];
    const usedAssetIds = [
      ...new Set(
        page.elements
          .filter((e) => e.kind === "image")
          .map((e) => e.data.assetId),
      ),
    ];
    const assetNotes = usedAssetIds
      .map((id) => {
        const a = visual!.assets.find((a) => a.id === id)!;
        return `素材 ${a.id}：${a.alt}；来源：${a.source}；使用声明：${a.license}；SHA256：${a.sha256}；用途：${a.usage}；未自动OCR/语义核验。`;
      })
      .join("\n");
    slide.addNotes(
      [
        content.speakerNotes,
        assetNotes,
        content.sources?.length ? `来源：${content.sources.join("；")}` : "",
        `版式：${page.layoutId}；引擎：${presentationLayoutEngineVersion}；性质：${natureLabels[page.nature]}；待人工复核。`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  const bytesOut = applyStructuredTheme(
    new Uint8Array(
      (await pptx.write({
        outputType: "nodebuffer",
        compression: true,
      })) as Buffer,
    ),
    deck.theme,
    deck.headingFont,
    deck.bodyFont,
  );
  return {
    title: deck.title,
    slideCount: deck.slides.length,
    pptxBytes: bytesOut,
    layout,
    resolvedObjects: objects,
    adaptiveLayout: {
      schemaVersion: 2,
      engineVersion: presentationLayoutEngineVersion,
      ...(designs.some((d) => d.directed)
        ? { directionEngineVersion: presentationDirectionEngineVersion }
        : {}),
      ...(visual
        ? {
            visualEngineVersion: presentationVisualEngineVersion,
            visualStyle: visual.style,
          }
        : {}),
      slides: resolved,
    },
    outputs: [
      json("source-slides.json", {
        schemaVersion: 2,
        title: deck.title,
        slides: deck.slides,
        planningOrigin:
          "see presentation-spec planner; layout is deterministic, not an independent fact check",
      }),
      out(
        "content-preview.html",
        "text/html; charset=utf-8",
        Buffer.from(
          '<!doctype html><meta charset="utf-8"><title>自适应商务V2</title><p>这是布局规范产物；真实效果请查看同份PPTX的PDF与全页渲染，不以HTML模拟代替。</p>',
        ),
      ),
    ],
  };
}
