/**
 * Gamma 版式引擎（规则层，可替换为小模型 layout-ranking）
 * 输入 GammaCard → 输出 合适的 layout/kind
 */
import type { GammaCard, GammaCardKind } from "./gammaStore";

export type LayoutDecision = {
  layout: string;
  kind: GammaCardKind;
  reason: string;
};

const LAYOUTS = ["cover", "split", "cards", "table", "timeline", "chart", "text", "bullets", "image", "cta"] as const;

function bodyLength(card: GammaCard): number {
  return card.body.replaceAll("｜", "").replaceAll("\n", "").length;
}
function hasNumbers(body: string): boolean {
  return /(\d+)|｜/.test(body);
}
function hasImage(card: GammaCard): boolean {
  return !!card.image && !card.image.includes("AAAAEAAAAB"); // 过滤占位
}

export function decideLayout(card: GammaCard): LayoutDecision {
  const len = bodyLength(card);
  const nums = hasNumbers(card.body);
  const img = hasImage(card);

  // 规则优先级：封面 > 图表 > 表格 > 时间线 > 卡片 > 分栏 > 纯文本
  if (card.kind === "cover" || /封面|cover/i.test(card.title)) {
    return { layout: "cover", kind: "cover", reason: "标题含封面关键词" };
  }
  if (nums && card.body.includes("｜") && card.body.split("\n").every((l) => l.includes("｜"))) {
    // 每行都含 ｜ → 可能是 chart 或 table
    const firstRowCols = card.body.split("\n")[0].split("｜").length;
    if (firstRowCols === 2 && card.body.split("\n").every((l) => !isNaN(Number(l.split("｜")[1])))) {
      return { layout: "chart", kind: "chart", reason: "2列且第二列为数值 → 柱图" };
    }
    return { layout: "table", kind: "table", reason: "多行含｜ → 表格" };
  }
  if (/时间|timeline|W\d|Q\d/i.test(card.body) && card.body.split("\n").length >= 3) {
    return { layout: "timeline", kind: "timeline", reason: "含时间标记 → 时间线" };
  }
  if (len <= 80 && !img) {
    return { layout: "cards", kind: "cards", reason: "短文本无图 → 卡片" };
  }
  if (img && len >= 60 && len <= 200) {
    return { layout: "split", kind: "split", reason: "有图且中等长度 → 图文分栏" };
  }
  if (len > 200) {
    return { layout: "bullets", kind: "text", reason: "长文本 → 要点列表" };
  }
  return { layout: "text", kind: "text", reason: "默认文本" };
}

// 评分（用于大纲阶段随机 + 打分，已在 pptFrameworks 验证）
export function scoreLayouts(prompt: string, candidates: string[]): { layout: string; score: number }[] {
  const keywords = prompt.slice(0, 60);
  return candidates.map((layout) => {
    let base = 0.5;
    if (hasImage({ body: keywords } as GammaCard) && layout === "split") base += 0.2;
    if (hasNumbers(keywords) && layout === "chart") base += 0.2;
    const jitter = Math.random() * 0.6;
    return { layout, score: base + jitter };
  });
}

export function pickLayout(prompt: string, exclude: string[] = []): string {
  const pool = LAYOUTS.filter((l) => !exclude.includes(l));
  const scored = scoreLayouts(prompt, [...pool]);
  scored.sort((a, b) => b.score - a.score);
  return scored[0].layout;
}
