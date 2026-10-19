import type { StructuredSlide, Colors } from "../../pptx-deck";
import type { PresentationDesign } from "../../../../shared/presentationDesign";
import { directorLayoutIds } from "../../../../shared/presentationDirection";
import { textHeight } from "./measure";
type B = { x: number; y: number; w: number; h: number };
type Draw = {
  text: (
    role: string,
    value: string,
    x: number,
    y: number,
    w: number,
    size: number,
    bold?: boolean,
    color?: string,
    fill?: string,
  ) => B;
  shape: (
    role: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
  ) => unknown;
  geometry: (
    role: string,
    kind: "chevron" | "ellipse",
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
  ) => unknown;
};
export function drawNativeExplanation(
  s: StructuredSlide,
  d: PresentationDesign,
  box: { x: number; top: number; bottom: number; w: number },
  t: Colors,
  draw: Draw,
): boolean {
  if (!directorLayoutIds.includes(d.layout as any)) return false;
  if (!d.directed)
    throw Error("解释性布局需要经过校验的导演元数据，不做无依据图示。");
  const { text, shape, geometry } = draw,
    { x: X, w: W, bottom } = box;
  let top = box.top;
  if (s.type === "bullets" && s.body) {
    const b = text("explanation-body", s.body, X, top, W, 16, false, t.muted);
    top = b.y + b.h + 0.22;
  }
  const disclosure =
    d.layout === "native-process" || d.layout === "connected-gates"
      ? d.directed.sequenceBasis === "proposal"
        ? "建议顺序 · 不表示已启动、批准或因果"
        : "原文所述顺序 · 关系语义待核对，不表示因果"
      : d.layout === "native-structure"
        ? "并列关系 · 不表示顺序、从属或因果"
        : d.layout === "decision-criteria"
          ? "待逐项核对 · 空框不表示条件已经满足"
          : "重点来自原有要点 · 不添加新的事实结论";
  const footer = textHeight(disclosure, W, 11) + 0.18,
    H = bottom - top - footer;
  if (H < 2.7)
    throw Error("图示与说明过密，请调整表达或确认拆页，不缩字、删要点。");
  text(
    "explanation-boundary",
    disclosure,
    X,
    bottom - footer + 0.1,
    W,
    11,
    false,
    t.muted,
  );
  if (d.layout === "message-focus" && s.type === "bullets") {
    const index = d.directed.focusIndex || 0,
      cw = 6.4,
      rw = W - cw - 0.35;
    shape("focus-panel", X, top, cw, H, t.primary);
    text(
      "focus-label",
      `重点 / 原文要点 ${index + 1}`,
      X + 0.3,
      top + 0.3,
      cw - 0.6,
      12,
      true,
      t.background,
      t.primary,
    );
    const h = textHeight(s.bullets[index], cw - 0.6, 26, true);
    if (h > H - 1.05)
      throw Error("重点主张不能以固定字号完整排入，请换表达或确认拆页。");
    text(
      `focus-point-${index}`,
      s.bullets[index],
      X + 0.3,
      top + 0.85 + (H - 0.95 - h) / 2,
      cw - 0.6,
      26,
      true,
      t.background,
      t.primary,
    );
    const others = s.bullets
        .map((v, i) => ({ v, i }))
        .filter((v) => v.i !== index),
      gap = 0.18,
      rh = (H - gap * (others.length - 1)) / others.length;
    others.forEach(({ v, i }, j) => {
      const y = top + j * (rh + gap);
      if (textHeight(v, rw - 0.85, 18) > rh - 0.25)
        throw Error("支撑要点过密，不隐藏非重点内容。");
      shape(`support-panel-${i}`, X + cw + 0.35, y, rw, rh, t.surface);
      text(
        `support-label-${i}`,
        String(i + 1).padStart(2, "0"),
        X + cw + 0.49,
        y + rh / 2 - 0.1,
        0.34,
        10,
        true,
        t.primary,
        t.surface,
      );
      text(
        `support-point-${i}`,
        v,
        X + cw + 0.99,
        y + (rh - textHeight(v, rw - 0.85, 18)) / 2,
        rw - 0.85,
        18,
        false,
        t.text,
        t.surface,
      );
    });
  } else if (d.layout === "native-structure" && s.type === "bullets") {
    const gap = 0.16,
      ch = (H - gap * (s.bullets.length - 1)) / s.bullets.length,
      cardX = X + 3.25,
      cardW = W - 3.25,
      mid = top + H / 2;
    shape("parallel-hub", X, mid - 0.72, 2.05, 1.44, t.primary);
    text(
      "parallel-hub-label",
      "并列\n要点",
      X + 0.25,
      mid - 0.55,
      1.55,
      24,
      true,
      t.background,
      t.primary,
    );
    shape("parallel-root-link", X + 2.05, mid - 0.015, 0.5, 0.03, t.primary);
    const first = top + ch / 2,
      last = top + (s.bullets.length - 1) * (ch + gap) + ch / 2;
    shape(
      "parallel-spine",
      X + 2.54,
      first,
      0.03,
      Math.max(0.03, last - first),
      t.primary,
    );
    s.bullets.forEach((v, i) => {
      const y = top + i * (ch + gap);
      if (textHeight(v, cardW - 0.58, 19) > ch - 0.3)
        throw Error("结构节点过密，请换布局或确认拆页，不裁切节点文字。");
      shape(
        `parallel-link-${i}`,
        X + 2.55,
        y + ch / 2 - 0.015,
        0.7,
        0.03,
        t.primary,
      );
      geometry(
        `parallel-joint-${i}`,
        "ellipse",
        X + 2.48,
        y + ch / 2 - 0.075,
        0.15,
        0.15,
        t.accent,
      );
      shape(`parallel-panel-${i}`, cardX, y, cardW, ch, t.surface);
      text(
        `parallel-point-${i}`,
        v,
        cardX + 0.29,
        y + (ch - textHeight(v, cardW - 0.58, 19)) / 2,
        cardW - 0.58,
        19,
        false,
        t.text,
        t.surface,
      );
    });
  } else if (d.layout === "decision-criteria" && s.type === "bullets") {
    const cols = s.bullets.length === 4 ? 2 : 1,
      rows = Math.ceil(s.bullets.length / cols),
      gap = 0.22,
      cw = (W - gap * (cols - 1)) / cols,
      ch = (H - gap * (rows - 1)) / rows;
    s.bullets.forEach((v, i) => {
      const x = X + (i % cols) * (cw + gap),
        y = top + Math.floor(i / cols) * (ch + gap);
      if (textHeight(v, cw - 0.6, 20) > ch - 0.9)
        throw Error("决策条件过密，请换布局或确认拆页。");
      shape(`criterion-panel-${i}`, x, y, cw, ch, t.surface);
      shape(`criterion-box-${i}`, x + 0.3, y + 0.25, 0.23, 0.23, t.primary);
      shape(`criterion-empty-${i}`, x + 0.33, y + 0.28, 0.17, 0.17, t.surface);
      text(
        `criterion-label-${i}`,
        `条件 ${String(i + 1).padStart(2, "0")} / 待核对`,
        x + 0.7,
        y + 0.24,
        cw - 1,
        11,
        true,
        t.primary,
        t.surface,
      );
      text(
        `criterion-point-${i}`,
        v,
        x + 0.3,
        y + 0.78,
        cw - 0.6,
        20,
        true,
        t.text,
        t.surface,
      );
    });
  } else if (
    (d.layout === "native-process" && s.type === "bullets") ||
    (d.layout === "connected-gates" && s.type === "timeline")
  ) {
    if (!d.directed.sequenceBasis)
      throw Error("顺序箭头缺少原文或建议关系依据。");
    const nodes =
      s.type === "bullets"
        ? s.bullets.map((b) => ({
            label: undefined as string | undefined,
            body: b,
            date: undefined as string | undefined,
          }))
        : s.items;
    const gap = 0.44,
      cw = (W - gap * (nodes.length - 1)) / nodes.length,
      ch = H - 0.25,
      y = top + 0.12;
    nodes.forEach((m, i) => {
      const x = X + i * (cw + gap);
      shape(`process-panel-${i}`, x, y, cw, ch, t.surface);
      shape(`process-rule-${i}`, x, y, cw, 0.055, t.primary);
      text(
        `process-index-${i}`,
        `${d.directed!.sequenceBasis === "proposal" ? "建议步骤" : "原文步骤"} ${String(i + 1).padStart(2, "0")}`,
        x + 0.22,
        y + 0.25,
        cw - 0.44,
        11,
        true,
        t.primary,
        t.surface,
      );
      let ty = y + 0.8;
      if (m.date) {
        const date = text(
          `process-date-${i}`,
          m.date,
          x + 0.22,
          ty,
          cw - 0.44,
          12,
          false,
          t.muted,
          t.surface,
        );
        ty = date.y + date.h + 0.14;
      }
      if (m.label) {
        const label = text(
          `process-label-${i}`,
          m.label,
          x + 0.22,
          ty,
          cw - 0.44,
          20,
          true,
          t.text,
          t.surface,
        );
        ty = label.y + label.h + 0.22;
      }
      const h = textHeight(m.body, cw - 0.44, 18);
      if (ty + h > y + ch - 0.2)
        throw Error("流程节点不能完整显示，请换布局或确认拆页，不缩字或跳步。");
      text(
        `process-body-${i}`,
        m.body,
        x + 0.22,
        ty,
        cw - 0.44,
        18,
        false,
        t.text,
        t.surface,
      );
      if (i < nodes.length - 1)
        geometry(
          `process-arrow-${i}`,
          "chevron",
          x + cw + 0.12,
          y + ch / 2 - 0.1,
          0.2,
          0.2,
          t.primary,
        );
    });
  } else throw Error("解释图示与内容类型不匹配。");
  return true;
}
